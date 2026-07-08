"""GPU thermal monitoring - warn/auto-pause a running analysis before sustained
high temperatures become a hardware risk.

Two pieces, deliberately separate:
  - GpuThermalMonitor: lazy pynvml wrapper that reads the hottest GPU's
    temperature. Singleton (one per ProjectContext) - pynvml init is not free
    and only needs to happen once.
  - ThermalTrigger: the consecutive-sample debounce/hysteresis state machine
    over a monitor's readings. A fresh instance per analyze run - its streak
    counters must not leak between separate jobs.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

from yuu_clip.log import get_logger

_log = get_logger(__name__)

_STREAK_THRESHOLD = 3  # consecutive samples required before warn/pause fires


class GpuThermalMonitor:
    """Reads the max temperature (°C) across all NVIDIA GPUs via pynvml.

    Lazily initializes on first use. If NVML is missing, fails to init (no
    NVIDIA GPU, broken/missing driver), or reports zero devices, logs one WARN
    and goes silent thereafter - available() returns False and
    read_max_temp_c() returns None without raising or logging again.
    """

    def __init__(self, sampler: Optional[Callable[[], Optional[float]]] = None) -> None:
        # sampler overrides pynvml entirely - used by tests to inject a fake reading
        # without needing real NVIDIA hardware.
        self._sampler = sampler
        self._nvml = None
        self._checked = False
        self._device_count = 0

    def available(self) -> bool:
        if self._sampler is not None:
            return True
        if not self._checked:
            self._init()
        return self._nvml is not None

    def _init(self) -> None:
        self._checked = True
        try:
            import pynvml
            pynvml.nvmlInit()
            count = pynvml.nvmlDeviceGetCount()
            if count == 0:
                raise RuntimeError("no NVIDIA GPU detected")
            self._device_count = count
            self._nvml = pynvml
        except Exception as exc:
            _log.warning("GPU thermal monitoring unavailable: %s", exc)
            self._nvml = None

    def read_max_temp_c(self) -> Optional[float]:
        if self._sampler is not None:
            try:
                temp = self._sampler()
                return float(temp) if temp is not None else None
            except Exception as exc:
                _log.debug("GPU temperature sampler failed: %s", exc)
                return None
        if not self.available():
            return None
        try:
            temps = [
                self._nvml.nvmlDeviceGetTemperature(
                    self._nvml.nvmlDeviceGetHandleByIndex(i),
                    self._nvml.NVML_TEMPERATURE_GPU,
                )
                for i in range(self._device_count)
            ]
            return float(max(temps)) if temps else None
        except Exception as exc:
            # A transient read failure (driver hiccup) must not disable monitoring
            # for the rest of the run - just skip this one sample.
            _log.debug("GPU temperature read failed: %s", exc)
            return None


@dataclass
class ThermalPollResult:
    temp_c: Optional[float]
    state: str              # "unavailable" | "ok" | "warn" | "pause"
    warn_triggered: bool    # True only on the poll where the warn streak first reaches threshold
    pause_triggered: bool   # True only on the poll where auto-pause should actually fire


class ThermalTrigger:
    """Per-run debounce/hysteresis over a GpuThermalMonitor's readings.

    A temperature read failure (monitor returns None) skips the sample without
    resetting either streak - a single transient read glitch mid-run must not
    erase real consecutive-hot-sample progress.
    """

    def __init__(self, monitor: GpuThermalMonitor) -> None:
        self._monitor = monitor
        self._warn_streak = 0
        self._pause_streak = 0
        self._suppress_autopause = False

    def note_resumed(self) -> None:
        """Call after any resume (manual or auto-pause's 'Resume now'). Suppresses
        auto-pause from firing again until a poll observes the temperature back
        below the warn threshold - otherwise a still-hot GPU immediately re-pauses
        on the next sample and the Resume action fights the monitor."""
        self._suppress_autopause = True

    def poll(self, warn_c: float, pause_c: float, autopause_enabled: bool) -> ThermalPollResult:
        temp = self._monitor.read_max_temp_c()
        if temp is None:
            return ThermalPollResult(None, "unavailable", False, False)

        if self._suppress_autopause and temp < warn_c:
            self._suppress_autopause = False

        self._pause_streak = self._pause_streak + 1 if temp >= pause_c else 0
        self._warn_streak = self._warn_streak + 1 if temp >= warn_c else 0

        warn_edge = self._warn_streak == _STREAK_THRESHOLD
        pause_edge = self._pause_streak == _STREAK_THRESHOLD
        pause_triggered = pause_edge and autopause_enabled and not self._suppress_autopause

        if self._pause_streak >= _STREAK_THRESHOLD:
            state = "pause"
        elif self._warn_streak >= _STREAK_THRESHOLD:
            state = "warn"
        else:
            state = "ok"

        return ThermalPollResult(temp, state, warn_edge, pause_triggered)
