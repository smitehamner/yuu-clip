from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.config import Config

_log = logging.getLogger(__name__)


class DiarizationError(RuntimeError):
    """A diarization failure the user can act on (e.g. an unreadable WAV)."""


def _load_waveform(audio_path: str) -> dict:
    """Decode a PCM WAV into an in-memory {waveform, sample_rate} dict.

    We always feed diarization our own 16 kHz mono PCM WAVs, so we decode them with
    the stdlib `wave` module rather than routing through a heavier audio backend.
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
        embeddings (SpeechBrain) override this so a name can be re-attached to the
        same voice across diarization runs.
        """
        return self.diarize(audio_path), {}

    @abstractmethod
    def available(self) -> tuple[bool, str]: ...

    @abstractmethod
    def model_cached(self) -> bool:
        """Whether this backend's model is already downloaded (filesystem-only, no
        network) - lets a caller warn "downloading..." on first use without knowing
        which backend is configured. True when there is nothing to download."""
        ...


class NullDiarizationClient(DiarizationClient):
    """Returned when diarization is disabled (backend = "null")."""

    def available(self) -> tuple[bool, str]:
        return True, ""

    def model_cached(self) -> bool:
        return True

    def diarize(self, audio_path: str) -> list[tuple[float, float, str]]:
        return []


# ── SpeechBrain diarization ──────────────────────────────────────────────────
# A token-free backend: ECAPA-TDNN speaker embeddings (SpeechBrain, Apache-2.0)
# over energy-active windows, clustered with agglomerative clustering. No fixed
# speaker count and no HuggingFace account - the model downloads anonymously.

_SB_MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"
_SB_WINDOW_S = 1.5   # embedding window length
_SB_HOP_S = 0.75     # step between windows
_SB_BATCH = 32       # windows per encoder forward pass
# Cosine-distance threshold above which two windows are treated as different
# speakers. Fallback for Config.speaker_cluster_threshold; keep the two in step.
# Raised to 0.85 (W2) - on mixed single-track audio a lower distance shatters one
# speaker into dozens of fragments (see config.speaker_cluster_threshold).
_SB_DISTANCE_THRESHOLD = 0.85
# Fallback for Config.speaker_min_cluster_seconds (post-consolidation noise prune).
_SB_MIN_CLUSTER_SECONDS = 10.0
# Voice-activity floor: a window is "speech" when its RMS is above both an
# absolute silence floor and a margin below the track's median window level.
_SB_ABS_FLOOR_DB = -55.0
_SB_REL_MARGIN_DB = 15.0


def _load_mono_waveform(audio_path: str):
    """Return (mono float32 numpy array, sample_rate) for a PCM WAV.

    Reuses _load_waveform's decode, then downmixes to mono - SpeechBrain's ECAPA
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


def _consolidate_labels(embeddings, labels, similarity_threshold: float):
    """Merge clusters whose centroids are within *similarity_threshold* (cosine),
    collapsing fragments of one speaker that window-level clustering split apart -
    the fix for "one person shows up as 50 speakers".

    Keyed on the same "how similar counts as the same voice" threshold used for
    cross-video matching, so a single knob governs both. Centroids (averaged) are far
    cleaner than the raw short-window embeddings, so merging them is reliable even when
    the initial clustering over-fragments. Returns relabeled integer labels.
    """
    import numpy as np

    unique = sorted({int(value) for value in labels})
    if len(unique) <= 1:
        return np.asarray(labels, dtype=int)

    array = np.asarray(embeddings, dtype=np.float64)
    labels_arr = np.asarray(labels)
    centroids = []
    for label in unique:
        mean = array[labels_arr == label].mean(axis=0)
        norm = np.linalg.norm(mean)
        centroids.append(mean / norm if norm > 0 else mean)

    from sklearn.cluster import AgglomerativeClustering

    merged = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=max(0.0, 1.0 - similarity_threshold),
        metric="cosine",
        linkage="average",
    ).fit_predict(np.asarray(centroids))
    old_to_new = {old: int(new) for old, new in zip(unique, merged)}
    return np.array([old_to_new[int(value)] for value in labels], dtype=int)


def _prune_small_clusters(
    embeddings, labels, min_seconds: float, max_merge_distance: float,
    hop_s: float = _SB_HOP_S,
):
    """Fold noise/overlap fragments into a real voice, dropping speaker clusters that own
    too little speech to be a genuine speaker.

    A cluster owning < *min_seconds* of speech is reassigned to its nearest surviving
    centroid, but ONLY when that centroid is within *max_merge_distance* (cosine) - the
    same distance the within-recording clustering used. A tiny fragment with no
    close-enough survivor is a distinct brief voice and is kept as its own cluster. This
    keeps behavior monotonic in the grouping distance: a lower distance yields more (or
    equal) speakers, never a collapse. Without the gate, a low distance shatters mixed
    "crowd" audio into one dominant blended cluster plus many tiny fragments, and an
    ungated prune would fold every fragment into the crowd - reporting one speaker for a
    room full of people.

    Speech time is approximated as window_count * hop_s (each active window advances the
    timeline by one hop). An absolute-seconds floor generalizes across recording lengths
    where a percentage would delete a genuine minor speaker on a long recording. Guards:
    a non-positive floor disables the prune, and the last surviving cluster is never
    removed (all-below-floor returns the labels unchanged).
    """
    import numpy as np

    if min_seconds <= 0:
        return np.asarray(labels, dtype=int)
    labels_arr = np.asarray(labels, dtype=int)
    unique, counts = np.unique(labels_arr, return_counts=True)
    survivors = [int(u) for u, c in zip(unique, counts) if c * hop_s >= min_seconds]
    if len(survivors) == len(unique) or not survivors:
        return labels_arr

    array = np.asarray(embeddings, dtype=np.float64)
    centroids = {}
    for label in survivors:
        mean = array[labels_arr == label].mean(axis=0)
        norm = np.linalg.norm(mean)
        centroids[label] = mean / norm if norm > 0 else mean

    pruned = labels_arr.copy()
    for label in (int(u) for u in unique if int(u) not in survivors):
        mean = array[labels_arr == label].mean(axis=0)
        norm = np.linalg.norm(mean)
        vector = mean / norm if norm > 0 else mean
        nearest = max(survivors, key=lambda s: float(np.dot(vector, centroids[s])))
        if 1.0 - float(np.dot(vector, centroids[nearest])) <= max_merge_distance:
            pruned[labels_arr == label] = nearest
    return _densify_labels(pruned)


def _densify_labels(labels):
    """Renumber labels to a contiguous 0..n-1 range, preserving their order.

    Folding a middle cluster away leaves a hole (survivors {0, 2}), and these integers
    become speaker names downstream (SPEAKER_NN), so the user would see "Speaker 1,
    Speaker 3". Pure renumbering - it never merges two labels.
    """
    import numpy as np

    labels_arr = np.asarray(labels, dtype=int)
    dense = {old: new for new, old in enumerate(sorted({int(v) for v in labels_arr}))}
    return np.array([dense[int(v)] for v in labels_arr], dtype=int)


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
    no network) - used to distinguish "ready" from "downloads on first use"."""
    model_dir = speechbrain_model_dir()
    return model_dir.exists() and any(model_dir.iterdir())


def prefetch_speechbrain_model(config: Config) -> None:
    """Download the ECAPA encoder now, for the Settings "Download now" prefetch
    flow - the same load SpeechBrainDiarizationClient triggers lazily on first
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
                "SpeechBrain speaker labels aren't available - this should be bundled "
                "with yuu-clip, so try reinstalling if this persists"
            )
        return True, ""

    def model_cached(self) -> bool:
        return speechbrain_model_cached()

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
            "Loading SpeechBrain ECAPA encoder (%s) on %s - first run downloads "
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
        cluster_threshold = (
            self._config.speaker_cluster_threshold
            if self._config.speaker_cluster_threshold is not None
            else _SB_DISTANCE_THRESHOLD
        )
        raw_labels = _cluster_labels(embeddings, cluster_threshold)
        # Deliberately a different config value, not cluster_threshold: consolidation
        # merges on speaker_match_threshold (a SIMILARITY), while the clustering above
        # used speaker_cluster_threshold (a DISTANCE) - see _consolidate_labels' docstring.
        consolidated = _consolidate_labels(embeddings, raw_labels, self._config.speaker_match_threshold)
        min_seconds = (
            self._config.speaker_min_cluster_seconds
            if self._config.speaker_min_cluster_seconds is not None
            else _SB_MIN_CLUSTER_SECONDS
        )
        labels = _prune_small_clusters(embeddings, consolidated, min_seconds, cluster_threshold)
        window_times = [(start / sample_rate, end / sample_rate) for start, end in active_bounds]
        turns = _merge_turns(window_times, labels)
        centroids = _cluster_centroids(embeddings, labels)
        raw_count = len({int(value) for value in raw_labels})
        consolidated_count = len({int(value) for value in consolidated})
        _log.info(
            "SpeechBrain diarization: %d active window(s) -> %d turn(s); %d raw cluster(s) "
            "-> %d consolidated -> %d speaker(s) after pruning clusters under %.0fs",
            len(active_bounds), len(turns), raw_count, consolidated_count,
            len(centroids), min_seconds,
        )
        return turns, centroids


def make_diarization_client(config: Config) -> DiarizationClient:
    if config.diarization_backend == "speechbrain":
        return SpeechBrainDiarizationClient(config)
    return NullDiarizationClient()
