"""Auto-framing suggestion for vertical (9:16) exports via MediaPipe face detection.

Optional feature: `mediapipe` (Apache-2.0) is installed on demand from Settings.
Everything that touches it imports it lazily, so this module loads fine without
the package - only `suggest_crop_x` (which the route calls behind an
`importlib.util.find_spec` gate) requires it to be present.

The MediaPipe wheel that installs on current Python ships only the Tasks API
(`mediapipe.tasks.python.vision.FaceDetector`), which needs a model asset - the
~230 KB BlazeFace short-range model, downloaded to the user cache on first use
(same "downloads on first use" pattern as the laugh scorer's model).

The detector samples a handful of frames across a clip's window, finds the median
face position, and converts that to a `crop_x` (0-1) that centers the 9:16 crop on
the face. A static position per clip - no per-frame keyframed panning in v1.
"""
from __future__ import annotations

import statistics
import subprocess
import tempfile
import urllib.request
from pathlib import Path
from typing import Optional

from yuu_clip.config import find_ffmpeg
from yuu_clip.log import get_logger

_log = get_logger(__name__)

_SAMPLE_COUNT = 5
# Downscale frames before detection - face-center x is a normalized fraction, so
# it is unaffected by scale, and 360p is plenty for a face-detector while keeping
# the ffmpeg extraction cheap.
_FRAME_HEIGHT = 360

# BlazeFace short-range face detector (Apache-2.0), the model the MediaPipe Tasks
# FaceDetector consumes. Cached under platformdirs' user cache on first use.
_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_detector/"
    "blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
)
_MODEL_FILENAME = "blaze_face_short_range.tflite"


def crop_x_from_face_center(
    face_center_x: float, source_w: Optional[int], source_h: Optional[int]
) -> float:
    """Map a normalized face-center x (0-1 of the frame) to the `crop_x` that
    centers the 9:16 crop column on that face, clamped to [0, 1].

    Falls back to a 16:9 assumption when the source dimensions are unknown, and
    returns 0.5 when the source has no horizontal slack (already 9:16 or narrower,
    so the whole width is kept and centering is meaningless).
    """
    aspect = (source_w / source_h) if source_w and source_h else (16 / 9)
    crop_width_fraction = min(1.0, (9 / 16) / aspect)
    travel = 1.0 - crop_width_fraction
    if travel <= 0:
        return 0.5
    return max(0.0, min(1.0, (face_center_x - crop_width_fraction / 2) / travel))


def _sample_timestamps(start_s: float, end_s: float, count: int = _SAMPLE_COUNT) -> list[float]:
    """`count` timestamps evenly spaced strictly inside [start_s, end_s]."""
    span = max(0.0, end_s - start_s)
    if span <= 0:
        return [start_s]
    step = span / (count + 1)
    return [start_s + step * (i + 1) for i in range(count)]


def _extract_frame(ffmpeg: str, src: Path, timestamp_s: float, out_path: Path) -> bool:
    result = subprocess.run(
        [ffmpeg, "-y", "-ss", str(timestamp_s), "-i", src.as_posix(),
         "-frames:v", "1", "-vf", f"scale=-2:{_FRAME_HEIGHT}", out_path.as_posix()],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        _log.debug("Frame extract failed at %.2fs: %s", timestamp_s, result.stderr.strip()[-200:])
    return result.returncode == 0 and out_path.exists()


def _model_path() -> Path:
    from platformdirs import user_cache_dir
    return Path(user_cache_dir("yuu-clip")) / "models" / _MODEL_FILENAME


def face_model_cached() -> bool:
    """Whether the BlazeFace detector model has already been downloaded
    (filesystem-only, no network) - lets the Settings capabilities overview
    distinguish "ready" from "downloads on first use"."""
    return _model_path().exists()


def _ensure_face_model() -> Path:
    """Return the cached BlazeFace model path, downloading it on first use.

    Downloads to a temp sibling then renames, so an interrupted download never
    leaves a truncated file that looks valid on the next run.
    """
    path = _model_path()
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    _log.info("Downloading face-detector model (%s)...", _MODEL_FILENAME)
    tmp = path.with_name(path.name + ".part")
    urllib.request.urlretrieve(_MODEL_URL, tmp)
    tmp.replace(path)
    return path


def _make_detector():
    """Build a MediaPipe Tasks FaceDetector (short-range). Imports lazily."""
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    options = vision.FaceDetectorOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(_ensure_face_model())),
        min_detection_confidence=0.5,
    )
    return vision.FaceDetector.create_from_options(options)


def _center_x_from_result(detections, image_width: int) -> Optional[float]:
    """Normalized center x of the highest-confidence detection, or None.

    Tasks-API bounding boxes are in pixels (origin_x + width), so we divide by the
    frame width to get the 0-1 fraction the crop math expects.
    """
    if not detections or not image_width:
        return None
    best = max(detections, key=lambda d: d.categories[0].score if d.categories else 0.0)
    box = best.bounding_box
    return (box.origin_x + box.width / 2) / image_width


def _detect_face_center_x(frame_path: Path, detector) -> Optional[float]:
    """Normalized center x of the highest-confidence face in one frame, or None."""
    import mediapipe as mp

    image = mp.Image.create_from_file(str(frame_path))
    result = detector.detect(image)
    return _center_x_from_result(result.detections, image.width)


def _median(values: list[Optional[float]]) -> Optional[float]:
    present = [v for v in values if v is not None]
    return statistics.median(present) if present else None


def suggest_crop_x(
    encode_src: Path, start_s: float, end_s: float,
    source_w: Optional[int], source_h: Optional[int],
) -> Optional[float]:
    """Sample frames across the clip window, run MediaPipe face detection, and
    return a `crop_x` (0-1) that centers the 9:16 crop on the median face position
    - or None when no face is found in any sampled frame.

    Imports mediapipe lazily; callers must ensure the package is installed.
    """
    ffmpeg, _ = find_ffmpeg()
    centers: list[Optional[float]] = []
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        detector = _make_detector()
        try:
            for index, timestamp_s in enumerate(_sample_timestamps(start_s, end_s)):
                frame = tmp / f"frame_{index}.png"
                if _extract_frame(ffmpeg, encode_src, timestamp_s, frame):
                    centers.append(_detect_face_center_x(frame, detector))
        finally:
            detector.close()

    face_center = _median(centers)
    if face_center is None:
        return None
    return crop_x_from_face_center(face_center, source_w, source_h)
