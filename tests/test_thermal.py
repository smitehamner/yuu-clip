"""GPU thermal monitoring - yuu_clip/analyze/thermal.py (roadmap plan 01, Stage 3).

GpuThermalMonitor wraps pynvml directly; tests inject a fake sampler so they
never depend on real NVIDIA hardware being present in CI.
"""
from __future__ import annotations


def _monitor(readings):
    """A GpuThermalMonitor whose sampler pops one reading per call (None allowed
    to simulate a transient read failure)."""
    from yuu_clip.analyze.thermal import GpuThermalMonitor
    it = iter(readings)
    return GpuThermalMonitor(sampler=lambda: next(it))


# ---------------------------------------------------------------------------
# GpuThermalMonitor
# ---------------------------------------------------------------------------

class TestGpuThermalMonitorWithSampler:
    def test_available_true_with_sampler(self):
        m = _monitor([70.0])
        assert m.available() is True

    def test_read_returns_sampler_value(self):
        m = _monitor([72.5])
        assert m.read_max_temp_c() == 72.5

    def test_sampler_none_reading_returns_none(self):
        m = _monitor([None])
        assert m.read_max_temp_c() is None

    def test_sampler_exception_returns_none_not_raise(self):
        from yuu_clip.analyze.thermal import GpuThermalMonitor

        def boom():
            raise RuntimeError("driver hiccup")

        m = GpuThermalMonitor(sampler=boom)
        assert m.read_max_temp_c() is None


class TestGpuThermalMonitorUnavailable:
    def test_unavailable_when_nvml_init_fails(self, monkeypatch):
        import pynvml

        from yuu_clip.analyze.thermal import GpuThermalMonitor

        def _fail_init():
            raise RuntimeError("no NVIDIA driver")
        monkeypatch.setattr(pynvml, "nvmlInit", _fail_init)

        m = GpuThermalMonitor()
        assert m.available() is False
        assert m.read_max_temp_c() is None

    def test_unavailable_when_zero_devices(self, monkeypatch):
        import pynvml

        from yuu_clip.analyze.thermal import GpuThermalMonitor

        monkeypatch.setattr(pynvml, "nvmlInit", lambda: None)
        monkeypatch.setattr(pynvml, "nvmlDeviceGetCount", lambda: 0)

        m = GpuThermalMonitor()
        assert m.available() is False

    def test_init_only_runs_once(self, monkeypatch):
        """A second available()/read call must not re-attempt nvmlInit (and re-log)."""
        import pynvml

        from yuu_clip.analyze.thermal import GpuThermalMonitor

        calls = {"n": 0}

        def _fail_init():
            calls["n"] += 1
            raise RuntimeError("no driver")
        monkeypatch.setattr(pynvml, "nvmlInit", _fail_init)

        m = GpuThermalMonitor()
        m.available()
        m.available()
        m.read_max_temp_c()
        assert calls["n"] == 1

    def test_multi_gpu_uses_max_temp(self, monkeypatch):
        import pynvml

        from yuu_clip.analyze.thermal import GpuThermalMonitor

        monkeypatch.setattr(pynvml, "nvmlInit", lambda: None)
        monkeypatch.setattr(pynvml, "nvmlDeviceGetCount", lambda: 3)
        monkeypatch.setattr(pynvml, "nvmlDeviceGetHandleByIndex", lambda i: i)
        temps_by_index = {0: 60.0, 1: 88.0, 2: 71.0}
        monkeypatch.setattr(pynvml, "nvmlDeviceGetTemperature", lambda handle, sensor: temps_by_index[handle])

        m = GpuThermalMonitor()
        assert m.read_max_temp_c() == 88.0

    def test_read_exception_mid_run_returns_none_not_raise(self, monkeypatch):
        import pynvml

        from yuu_clip.analyze.thermal import GpuThermalMonitor

        monkeypatch.setattr(pynvml, "nvmlInit", lambda: None)
        monkeypatch.setattr(pynvml, "nvmlDeviceGetCount", lambda: 1)
        monkeypatch.setattr(pynvml, "nvmlDeviceGetHandleByIndex", lambda i: i)

        def _boom(handle, sensor):
            raise RuntimeError("NVML read error")
        monkeypatch.setattr(pynvml, "nvmlDeviceGetTemperature", _boom)

        m = GpuThermalMonitor()
        assert m.read_max_temp_c() is None


# ---------------------------------------------------------------------------
# ThermalTrigger - consecutive-sample debounce, thresholds, hysteresis
# ---------------------------------------------------------------------------

class TestThermalTrigger:
    def _trigger(self, readings):
        from yuu_clip.analyze.thermal import ThermalTrigger
        return ThermalTrigger(_monitor(readings))

    def test_unavailable_reading_yields_unavailable_state(self):
        trigger = self._trigger([None])
        result = trigger.poll(warn_c=85, pause_c=90, autopause_enabled=True)
        assert result.state == "unavailable"
        assert result.warn_triggered is False
        assert result.pause_triggered is False

    def test_cool_reading_is_ok(self):
        trigger = self._trigger([50.0])
        result = trigger.poll(warn_c=85, pause_c=90, autopause_enabled=True)
        assert result.state == "ok"

    def test_warn_requires_three_consecutive_samples(self):
        trigger = self._trigger([86.0, 86.0, 86.0])
        r1 = trigger.poll(85, 90, True)
        r2 = trigger.poll(85, 90, True)
        r3 = trigger.poll(85, 90, True)
        assert r1.state == "ok" and r1.warn_triggered is False
        assert r2.state == "ok" and r2.warn_triggered is False
        assert r3.state == "warn" and r3.warn_triggered is True

    def test_warn_triggered_only_on_the_edge_not_every_poll(self):
        """The debounce fires once when the streak first reaches 3, not on
        every subsequent poll while still hot - avoids toast/log spam."""
        trigger = self._trigger([86.0] * 5)
        results = [trigger.poll(85, 90, True) for _ in range(5)]
        assert [r.warn_triggered for r in results] == [False, False, True, False, False]
        assert all(r.state == "warn" for r in results[2:])

    def test_streak_resets_on_cool_sample(self):
        trigger = self._trigger([86.0, 86.0, 50.0, 86.0, 86.0, 86.0])
        for _ in range(5):
            trigger.poll(85, 90, True)
        result = trigger.poll(85, 90, True)
        # Only 3 consecutive hot samples after the cool-down reset - must fire again
        assert result.warn_triggered is True

    def test_pause_requires_three_consecutive_samples_above_pause_threshold(self):
        trigger = self._trigger([91.0, 91.0, 91.0])
        r1 = trigger.poll(85, 90, True)
        r2 = trigger.poll(85, 90, True)
        r3 = trigger.poll(85, 90, True)
        assert r1.pause_triggered is False
        assert r2.pause_triggered is False
        assert r3.pause_triggered is True
        assert r3.state == "pause"

    def test_pause_not_triggered_when_autopause_disabled(self):
        trigger = self._trigger([91.0, 91.0, 91.0])
        for _ in range(2):
            trigger.poll(85, 90, False)
        result = trigger.poll(85, 90, False)
        assert result.pause_triggered is False
        # Still reports the hot state even though auto-pause won't act on it.
        assert result.state == "pause"

    def test_hysteresis_suppresses_pause_after_resume_until_below_warn(self):
        trigger = self._trigger([91.0, 91.0, 91.0, 91.0, 91.0, 91.0, 80.0, 91.0, 91.0, 91.0])
        for _ in range(3):
            trigger.poll(85, 90, True)  # first pause trigger
        trigger.note_resumed()
        # Still hot immediately after resume - must NOT re-trigger despite reaching streak 3 again
        r4 = trigger.poll(85, 90, True)
        r5 = trigger.poll(85, 90, True)
        r6 = trigger.poll(85, 90, True)
        assert r4.pause_triggered is False
        assert r5.pause_triggered is False
        assert r6.pause_triggered is False
        # Temp drops below warn once - suppression lifts
        trigger.poll(85, 90, True)  # 80.0, cools down, resets streak too
        # Now three fresh hot samples must trigger again
        r8 = trigger.poll(85, 90, True)
        r9 = trigger.poll(85, 90, True)
        r10 = trigger.poll(85, 90, True)
        assert [r8.pause_triggered, r9.pause_triggered, r10.pause_triggered] == [False, False, True]

    def test_read_failure_mid_streak_does_not_reset_streak(self):
        """A transient read glitch (None) must be skipped, not treated as a
        cool sample that would erase real consecutive-hot-sample progress."""
        trigger = self._trigger([86.0, 86.0, None, 86.0])
        trigger.poll(85, 90, True)
        trigger.poll(85, 90, True)
        skipped = trigger.poll(85, 90, True)
        assert skipped.state == "unavailable"
        result = trigger.poll(85, 90, True)
        # This is only the 3rd real hot sample (the None was skipped, not counted
        # as cool) - streak must still be intact at 3, not reset to 1.
        assert result.warn_triggered is True
