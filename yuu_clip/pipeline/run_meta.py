"""
Analyze-run metadata capture.

Records how long each pipeline stage took, the effective settings used, and
whether transcription/diarization ran on CPU or GPU - persisted as JSON on the
Video row so the creator can later answer "how long did this take, what
settings did I use, and did it use my GPU?".
"""
from __future__ import annotations

import json
import time
from contextlib import contextmanager
from datetime import datetime, timezone


class StageRecorder:
    """Times named pipeline stages and the overall run via a context manager."""

    def __init__(self) -> None:
        self.stages: list[dict] = []
        self._t0 = time.perf_counter()

    @contextmanager
    def stage(self, name: str):
        start = time.perf_counter()
        try:
            yield
        finally:
            self.stages.append({"name": name, "seconds": round(time.perf_counter() - start, 2)})

    @property
    def elapsed_ms(self) -> int:
        return int((time.perf_counter() - self._t0) * 1000)


def _resolve_devices(config, *, transcribed: bool, diarized: bool) -> dict:
    """Report the CPU/GPU device each ML stage actually used.

    Reuses the same resolvers the runners use so the recorded device matches
    what really ran (whisper's 'auto' → cuda/cpu; diarization → torch CUDA build).
    """
    devices: dict = {"has_gpu": False}
    if transcribed:
        from yuu_clip.transcribe.whisper_runner import _resolve_device_and_compute
        device, compute_type = _resolve_device_and_compute(config)
        devices["transcribe"] = f"{device} ({compute_type})"
        devices["has_gpu"] = devices["has_gpu"] or device == "cuda"
    if diarized:
        try:
            import torch
            diar_device = "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            diar_device = "cpu"
        devices["diarization"] = diar_device
        devices["has_gpu"] = devices["has_gpu"] or diar_device == "cuda"
    return devices


def _run_settings(config, opts, *, transcribed: bool, diarized: bool) -> dict:
    captions_source = "external" if opts.subtitle_source else ("whisper" if transcribed else "none")
    return {
        "model":           config.whisper_model,
        "track_layout":    opts.profile or "default",
        "energy_mode":     opts.energy_mode,
        "scene_mode":      config.scene_detection_mode,
        "speaker_labels":  diarized,
        "captions_source": captions_source,
        "scoring":         not opts.no_score,
        "contexts":        list(opts.context_names or []),
        "weights": {
            "energy": config.scorer_energy_weight,
            "scene":  config.scorer_scene_weight,
            "llm":    config.scorer_llm_weight,
            "laugh":  config.scorer_laugh_weight,
        },
    }


def build_run_json(
    recorder: StageRecorder,
    config,
    opts,
    started_at: datetime,
    *,
    transcribed: bool,
    diarized: bool,
) -> str:
    record = {
        "started_at":  started_at.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "elapsed_ms":  recorder.elapsed_ms,
        "device":      _resolve_devices(config, transcribed=transcribed, diarized=diarized),
        "settings":    _run_settings(config, opts, transcribed=transcribed, diarized=diarized),
        "stages":      recorder.stages,
    }
    return json.dumps(record)
