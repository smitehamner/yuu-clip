from __future__ import annotations

import logging
import warnings
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.config import Config

_log = logging.getLogger(__name__)


class DiarizationError(RuntimeError):
    """A diarization failure the user can act on (e.g. accept model terms)."""


# pyannote.audio 4.x's recommended pipeline. Unlike speaker-diarization-3.1 (which
# chained in segmentation-3.0 plus a PLDA from community-1), this one is
# self-contained: accepting the single repo's user conditions is enough. We still
# don't assume the failing repo when access is denied — HF's own error names the
# exact repo and accept URL, so we pass that text through and append the account /
# token guidance. The None branch covers older pyannote returning None instead of
# raising.
_PIPELINE_ID = "pyannote/speaker-diarization-community-1"

_ACCEPT_TERMS_HINT = (
    "To fix: sign in to HuggingFace with the SAME account as your token, open "
    "the gated model page named above, and accept its user conditions. The "
    "token also needs 'Read' access — create one at https://hf.co/settings/tokens"
)

_ACCEPT_TERMS_HELP = (
    "Speaker labels need access to a gated HuggingFace model. While signed in "
    "with your token's account, accept the user conditions at:\n"
    f"  - https://hf.co/{_PIPELINE_ID}\n"
    + _ACCEPT_TERMS_HINT
)


def _load_waveform(audio_path: str) -> dict:
    """Decode a PCM WAV into pyannote's in-memory input dict.

    pyannote 4.x's community-1 pipeline decodes file paths through torchcodec, which
    needs the FFmpeg shared libraries on the system PATH — frequently absent on
    Windows, where it fails with "torchcodec is not available". We always feed it our
    own 16 kHz mono PCM WAVs, so we decode them with the stdlib `wave` module and hand
    pyannote a {waveform, sample_rate} dict, sidestepping torchcodec entirely.
    """
    import wave

    import numpy as np
    import torch

    with wave.open(audio_path, "rb") as wav:
        sample_rate = wav.getframerate()
        n_channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        frames = wav.readframes(wav.getnframes())

    dtype = {1: np.uint8, 2: np.int16, 4: np.int32}.get(sample_width)
    if dtype is None:
        raise DiarizationError(
            f"Unsupported WAV sample width ({sample_width} bytes) for {audio_path}"
        )
    samples = np.frombuffer(frames, dtype=dtype).astype(np.float32)
    if dtype is np.uint8:  # 8-bit PCM is unsigned, centred at 128
        samples = (samples - 128.0) / 128.0
    else:
        samples /= float(np.iinfo(dtype).max + 1)
    waveform = torch.from_numpy(samples.reshape(-1, n_channels).T.copy())
    return {"waveform": waveform, "sample_rate": sample_rate}


def _move_pipeline_to_gpu_if_available(pipeline) -> None:
    """Move the diarization pipeline onto CUDA when a GPU-enabled torch is present.

    pyannote pipelines stay on CPU unless explicitly moved. This only helps when
    the installed torch is a CUDA build (``torch.cuda.is_available()``); the CPU
    build reports no CUDA and we stay on CPU. Any failure degrades to CPU rather
    than aborting diarization.
    """
    import torch

    if not torch.cuda.is_available():
        return
    try:
        pipeline.to(torch.device("cuda"))
        _log.info("Diarization pipeline moved to CUDA")
    except Exception as exc:
        _log.warning("Could not move diarization pipeline to CUDA (%s); using CPU", exc)


def _looks_like_access_error(exc: Exception) -> bool:
    text = f"{type(exc).__name__} {exc}".lower()
    return any(
        needle in text
        for needle in (
            "401", "403", "gated", "unauthorized", "forbidden",
            "authenticate", "restricted", "awaiting", "permission",
        )
    )


class DiarizationClient(ABC):
    @abstractmethod
    def diarize(self, audio_path: str) -> list[tuple[float, float, str]]:
        """Return (start_s, end_s, speaker_label) speaker turns for *audio_path*."""
        ...

    def diarize_with_embeddings(
        self, audio_path: str
    ) -> tuple[list[tuple[float, float, str]], dict[str, list[float]]]:
        """Return turns plus a per-speaker voiceprint centroid keyed by raw label.

        Default: turns with no embeddings. Backends that can produce speaker
        embeddings (Pyannote) override this so a name can be re-attached to the
        same voice across diarization runs.
        """
        return self.diarize(audio_path), {}

    @abstractmethod
    def available(self) -> tuple[bool, str]: ...


class NullDiarizationClient(DiarizationClient):
    """Returned when diarization is disabled (backend = "null")."""

    def available(self) -> tuple[bool, str]:
        return True, ""

    def diarize(self, audio_path: str) -> list[tuple[float, float, str]]:
        return []


class PyannoteDiarizationClient(DiarizationClient):
    def __init__(self, config: Config) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        if not self._config.huggingface_token:
            return False, (
                "No HuggingFace token set — open Settings (⚙) and enter your token "
                "under Speaker labels"
            )
        try:
            import pyannote.audio  # noqa: F401
        except ImportError:
            return False, "pyannote.audio is not installed (pip install pyannote.audio)"
        return True, ""

    def _run_pipeline(self, audio_path: str):
        """Load and run the diarization pipeline; return (annotation, raw_result).

        Shared by ``diarize`` and ``diarize_with_embeddings`` so the pipeline load
        + error translation lives in one place.
        """
        # pyannote.audio.core.io warns (with the full libtorchcodec load traceback
        # inlined as text) whenever FFmpeg's shared libs aren't on PATH (common on
        # Windows). It's expected and harmless here: we decode the WAV ourselves in
        # _load_waveform and never use torchcodec. Narrowly scoped to this one
        # warning/module so unrelated warnings during the import still surface.
        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore",
                message=r"\s*torchcodec is not installed correctly",
                category=UserWarning,
                module=r"pyannote\.audio\.core\.io",
            )
            from pyannote.audio import Pipeline
        try:
            pipeline = Pipeline.from_pretrained(
                _PIPELINE_ID,
                token=self._config.huggingface_token,
            )
        except Exception as exc:
            if _looks_like_access_error(exc):
                raise DiarizationError(f"{exc}\n\n{_ACCEPT_TERMS_HINT}") from exc
            raise
        if pipeline is None:
            raise DiarizationError(_ACCEPT_TERMS_HELP)
        _move_pipeline_to_gpu_if_available(pipeline)
        result = pipeline(_load_waveform(audio_path))
        # community-1 returns a DiarizeOutput dataclass whose `speaker_diarization`
        # field holds the Annotation; older pipelines return the Annotation directly.
        annotation = getattr(result, "speaker_diarization", result)
        return annotation, result

    @staticmethod
    def _turns(annotation) -> list[tuple[float, float, str]]:
        return [
            (turn.start, turn.end, speaker)
            for turn, _, speaker in annotation.itertracks(yield_label=True)
        ]

    def diarize(self, audio_path: str) -> list[tuple[float, float, str]]:
        annotation, _ = self._run_pipeline(audio_path)
        return self._turns(annotation)

    def diarize_with_embeddings(
        self, audio_path: str
    ) -> tuple[list[tuple[float, float, str]], dict[str, list[float]]]:
        annotation, result = self._run_pipeline(audio_path)
        turns = self._turns(annotation)
        # community-1's DiarizeOutput exposes one centroid per speaker on
        # `speaker_embeddings`, a (num_speakers, dim) array whose rows align with
        # annotation.labels(). Older pipelines return a bare Annotation with no
        # embeddings — degrade to turns-only.
        embeddings: dict[str, list[float]] = {}
        raw = getattr(result, "speaker_embeddings", None)
        if raw is not None and raw is not result:
            for index, label in enumerate(annotation.labels()):
                try:
                    embeddings[label] = [float(x) for x in raw[index]]
                except (IndexError, TypeError, ValueError):
                    continue
        return turns, embeddings


# ── SpeechBrain diarization ──────────────────────────────────────────────────
# A token-free backend: ECAPA-TDNN speaker embeddings (SpeechBrain, Apache-2.0)
# over energy-active windows, clustered with agglomerative clustering. No fixed
# speaker count and no HuggingFace account — the model downloads anonymously.

_SB_MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"
_SB_WINDOW_S = 1.5   # embedding window length
_SB_HOP_S = 0.75     # step between windows
_SB_BATCH = 32       # windows per encoder forward pass
# Cosine-distance threshold above which two windows are treated as different
# speakers. Tuned conservatively on real recordings; distinct voices sit well
# above ~0.5 cosine distance, same-voice windows well below.
_SB_DISTANCE_THRESHOLD = 0.55
# Voice-activity floor: a window is "speech" when its RMS is above both an
# absolute silence floor and a margin below the track's median window level.
_SB_ABS_FLOOR_DB = -55.0
_SB_REL_MARGIN_DB = 15.0


def _load_mono_waveform(audio_path: str):
    """Return (mono float32 numpy array, sample_rate) for a PCM WAV.

    Reuses _load_waveform's decode, then downmixes to mono — SpeechBrain's ECAPA
    encoder and the energy VAD both want a single channel. Our extracted track
    WAVs are already 16 kHz mono, so this is a no-op reshape in practice.
    """
    import numpy as np

    decoded = _load_waveform(audio_path)
    waveform = decoded["waveform"].numpy()  # (channels, samples)
    mono = waveform.mean(axis=0).astype(np.float32)
    return mono, decoded["sample_rate"]


def _slice_windows(n_samples: int, sample_rate: int) -> list[tuple[int, int]]:
    """Sample-index bounds of fixed-length windows tiling the signal.

    Only full-length windows are emitted (a sub-window tail is dropped) so every
    window is identical length and can be batched into one encoder call.
    """
    window = int(_SB_WINDOW_S * sample_rate)
    hop = int(_SB_HOP_S * sample_rate)
    if window <= 0 or hop <= 0 or n_samples < window:
        return []
    return [(start, start + window) for start in range(0, n_samples - window + 1, hop)]


def _window_rms_db(waveform, bounds: list[tuple[int, int]]):
    """Per-window RMS in dBFS (float32 array aligned with *bounds*)."""
    import numpy as np

    rms = np.array(
        [np.sqrt(np.mean(np.square(waveform[start:end]))) for start, end in bounds],
        dtype=np.float32,
    )
    return 20.0 * np.log10(rms + 1e-9)


def _active_window_indices(rms_db) -> list[int]:
    """Indices of windows loud enough to be speech (energy VAD).

    Active when RMS is above both an absolute floor and a relative margin below
    the median window level, so a uniformly-quiet or uniformly-loud track still
    yields a sensible set rather than everything or nothing.
    """
    import numpy as np

    if len(rms_db) == 0:
        return []
    floor = max(_SB_ABS_FLOOR_DB, float(np.median(rms_db)) - _SB_REL_MARGIN_DB)
    return [index for index, value in enumerate(rms_db) if value >= floor]


def _cluster_labels(embeddings, distance_threshold: float = _SB_DISTANCE_THRESHOLD):
    """Agglomerative cosine clustering of window embeddings → integer labels.

    A single window (or none) can't be clustered, so it trivially forms cluster 0.
    """
    import numpy as np

    count = len(embeddings)
    if count == 0:
        return np.array([], dtype=int)
    if count == 1:
        return np.zeros(1, dtype=int)
    from sklearn.cluster import AgglomerativeClustering

    model = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=distance_threshold,
        metric="cosine",
        linkage="average",
    )
    return model.fit_predict(np.asarray(embeddings, dtype=np.float64))


def _merge_turns(window_times: list[tuple[float, float]], labels) -> list[tuple[float, float, str]]:
    """Merge adjacent same-label windows into (start_s, end_s, "SPEAKER_NN") turns.

    Windows overlap (hop < window), so a run of the same speaker collapses to one
    turn spanning the first window's start to the last window's end.
    """
    turns: list[tuple[float, float, str]] = []
    for (start_s, end_s), label in zip(window_times, labels):
        speaker = f"SPEAKER_{int(label):02d}"
        if turns and turns[-1][2] == speaker and start_s <= turns[-1][1]:
            prev_start, prev_end, _ = turns[-1]
            turns[-1] = (prev_start, max(prev_end, end_s), speaker)
        else:
            turns.append((start_s, end_s, speaker))
    return turns


def _cluster_centroids(embeddings, labels) -> dict[str, list[float]]:
    """L2-normalized mean embedding per cluster, keyed by "SPEAKER_NN".

    These centroids become Speaker voiceprints; cosine re-attach needs them unit-
    normalized so the stored centroid matches how similarity is later computed.
    """
    import numpy as np

    array = np.asarray(embeddings, dtype=np.float64)
    centroids: dict[str, list[float]] = {}
    for label in sorted(set(int(value) for value in labels)):
        mean = array[np.asarray(labels) == label].mean(axis=0)
        norm = np.linalg.norm(mean)
        if norm > 0:
            mean = mean / norm
        centroids[f"SPEAKER_{label:02d}"] = mean.tolist()
    return centroids


def speechbrain_model_dir():
    """Where the SpeechBrain ECAPA encoder is cached once downloaded.

    Module-level (not tied to a client instance) so the Settings capabilities
    overview can do a cheap, side-effect-free existence check without
    constructing a full SpeechBrainDiarizationClient.
    """
    from pathlib import Path

    from platformdirs import user_cache_dir

    return Path(user_cache_dir("yuu-clip")) / "models" / "spkrec-ecapa-voxceleb"


def speechbrain_model_cached() -> bool:
    """Whether the ECAPA model has already been downloaded (filesystem-only,
    no network) — used to distinguish "ready" from "downloads on first use"."""
    model_dir = speechbrain_model_dir()
    return model_dir.exists() and any(model_dir.iterdir())


def prefetch_speechbrain_model(config: Config) -> None:
    """Download the ECAPA encoder now, for the Settings "Download now" prefetch
    flow — the same load SpeechBrainDiarizationClient triggers lazily on first
    use."""
    SpeechBrainDiarizationClient(config)._load_encoder()


class SpeechBrainDiarizationClient(DiarizationClient):
    """Token-free diarization via SpeechBrain ECAPA embeddings + clustering."""

    def __init__(self, config: Config) -> None:
        self._config = config
        self._encoder = None

    def available(self) -> tuple[bool, str]:
        import importlib.util

        missing = [
            name for name in ("speechbrain", "sklearn")
            if importlib.util.find_spec(name) is None
        ]
        if missing:
            return False, (
                "SpeechBrain speaker labels aren't available — this should be bundled "
                "with yuu-clip, so try reinstalling if this persists"
            )
        return True, ""

    def _model_dir(self):
        return speechbrain_model_dir()

    def _load_encoder(self):
        if self._encoder is not None:
            return self._encoder
        import torch
        from speechbrain.inference import EncoderClassifier
        from speechbrain.utils.fetching import LocalStrategy

        savedir = self._model_dir()
        savedir.mkdir(parents=True, exist_ok=True)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _log.info(
            "Loading SpeechBrain ECAPA encoder (%s) on %s — first run downloads "
            "~80 MB from HuggingFace (no token needed)", _SB_MODEL_SOURCE, device,
        )
        # LocalStrategy.COPY, not the default SYMLINK: symlinking the HF cache into
        # savedir needs a privilege Windows withholds unless Developer Mode/admin is
        # on, so the default raises WinError 1314. Copying is portable.
        self._encoder = EncoderClassifier.from_hparams(
            source=_SB_MODEL_SOURCE,
            savedir=str(savedir),
            run_opts={"device": device},
            local_strategy=LocalStrategy.COPY,
        )
        return self._encoder

    def _embed_windows(self, waveform, active_bounds: list[tuple[int, int]]):
        import numpy as np
        import torch

        encoder = self._load_encoder()
        device = next(encoder.mods.parameters()).device
        vectors: list[np.ndarray] = []
        for offset in range(0, len(active_bounds), _SB_BATCH):
            chunk = active_bounds[offset:offset + _SB_BATCH]
            batch = torch.tensor(
                np.stack([waveform[start:end] for start, end in chunk]),
                dtype=torch.float32,
            ).to(device)
            with torch.no_grad():
                # encode_batch → (batch, 1, embedding_dim); drop the singleton axis.
                embeddings = encoder.encode_batch(batch).squeeze(1).cpu().numpy()
            vectors.extend(embeddings)
        return np.asarray(vectors, dtype=np.float64)

    def diarize(self, audio_path: str) -> list[tuple[float, float, str]]:
        turns, _ = self.diarize_with_embeddings(audio_path)
        return turns

    def diarize_with_embeddings(
        self, audio_path: str
    ) -> tuple[list[tuple[float, float, str]], dict[str, list[float]]]:
        waveform, sample_rate = _load_mono_waveform(audio_path)
        bounds = _slice_windows(len(waveform), sample_rate)
        if not bounds:
            return [], {}
        active = _active_window_indices(_window_rms_db(waveform, bounds))
        active_bounds = [bounds[index] for index in active]
        if not active_bounds:
            return [], {}
        embeddings = self._embed_windows(waveform, active_bounds)
        labels = _cluster_labels(embeddings, _SB_DISTANCE_THRESHOLD)
        window_times = [(start / sample_rate, end / sample_rate) for start, end in active_bounds]
        turns = _merge_turns(window_times, labels)
        centroids = _cluster_centroids(embeddings, labels)
        _log.info(
            "SpeechBrain diarization: %d active window(s) → %d turn(s), %d speaker(s)",
            len(active_bounds), len(turns), len(centroids),
        )
        return turns, centroids


def make_diarization_client(config: Config) -> DiarizationClient:
    if config.diarization_backend == "pyannote":
        return PyannoteDiarizationClient(config)
    if config.diarization_backend == "speechbrain":
        return SpeechBrainDiarizationClient(config)
    return NullDiarizationClient()
