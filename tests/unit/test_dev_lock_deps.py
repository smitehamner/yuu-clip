from yuu_clip.dev.deps import filter_pins, render_lock


def test_filter_pins_drops_project_and_bootstrap_and_sorts():
    freeze = [
        "torch==2.1.0",
        "yuu-clip==0.1.22",
        "pip==24.0",
        "setuptools==69.0",
        "wheel==0.42",
        "anthropic==0.40.0",
        "yuu_clip @ file:///repo",
        "",
        "  ",
    ]
    assert filter_pins(freeze) == ["anthropic==0.40.0", "torch==2.1.0"]


def test_render_lock_is_header_blank_then_pins():
    out = render_lock(["a==1", "b==2"])
    lines = out.splitlines()
    assert lines[0].startswith("# requirements.lock")
    assert "`yuu-dev lock-deps`" in out
    assert lines[-2:] == ["a==1", "b==2"]
    assert lines[lines.index("a==1") - 1] == ""  # blank line separates header from pins
    assert out.endswith("\n")
