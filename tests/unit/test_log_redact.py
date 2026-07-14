import logging

from yuu_clip.log import (
    _SanitizingFormatter,
    configure_logging,
    get_logger,
    redact,
    redact_paths,
    redact_secrets,
)


def test_redacts_windows_username_keeps_subpath():
    line = r'Loaded config from C:\Users\myser\Videos\yuu-clip\.yuu-clip\config.json'
    assert redact_paths(line) == (
        r'Loaded config from C:\Users\<user>\Videos\yuu-clip\.yuu-clip\config.json'
    )


def test_redacts_windows_appdata_and_forward_slashes():
    assert redact_paths(r'C:\Users\jane.doe\AppData\Local\yuu-clip\venv') == (
        r'C:\Users\<user>\AppData\Local\yuu-clip\venv'
    )
    assert redact_paths('C:/Users/jane/AppData') == 'C:/Users/<user>/AppData'


def test_redacts_linux_and_macos_homes():
    assert redact_paths('/home/myser/.cache/huggingface') == '/home/<user>/.cache/huggingface'
    assert redact_paths('/Users/myser/Library/Caches') == '/Users/<user>/Library/Caches'


def test_leaves_non_home_paths_untouched():
    line = r'Spawning backend from D:\apps\yuu-clip\venv\python.exe'
    assert redact_paths(line) == line


def test_is_idempotent():
    once = redact_paths(r'C:\Users\myser\x')
    assert redact_paths(once) == once


def test_redacts_username_inside_traceback():
    formatter = _SanitizingFormatter("%(message)s")
    try:
        raise FileNotFoundError(r'C:\Users\myser\.cache\huggingface\hub not found')
    except FileNotFoundError:
        import sys
        record = logging.LogRecord(
            name="yuu_clip.test", level=logging.ERROR, pathname=__file__, lineno=1,
            msg="scan failed", args=(), exc_info=sys.exc_info(),
        )
    formatted = formatter.format(record)
    assert r'C:\Users\<user>\.cache' in formatted
    assert 'myser' not in formatted


# ---------------------------------------------------------------------------
# Secret redaction (defense-in-depth sink-side net)
# ---------------------------------------------------------------------------

class TestRedactSecrets:
    def test_redacts_anthropic_key(self):
        out = redact_secrets("using key sk-ant-api03-AbC123_def-456XYZ done")
        assert "sk-ant-api03" not in out
        assert "<redacted>" in out

    def test_redacts_hf_token(self):
        out = redact_secrets("token=hf_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345 loaded")
        assert "hf_ABCDEFGHIJKLMNOPQRSTUVWXYZ" not in out
        assert "<redacted>" in out

    def test_does_not_redact_hf_prefixed_prose(self):
        # The hf_cache module name must survive - it is not a token.
        assert redact_secrets("scanning hf_cache for revisions") == "scanning hf_cache for revisions"

    def test_redacts_bearer_token_keeps_keyword(self):
        assert redact_secrets("Authorization: Bearer abcdef0123456789") == (
            "Authorization: <redacted>"
        )

    def test_redacts_query_string_secrets(self):
        out = redact_secrets("GET /v1/x?api_key=SEKRET123&page=2")
        assert "SEKRET123" not in out
        assert "page=2" in out

    def test_combined_redact_applies_paths_and_secrets(self):
        line = r'C:\Users\myser\run.log key sk-ant-api03-ZZZ999aaaBBB'
        out = redact(line)
        assert "myser" not in out
        assert "sk-ant-api03" not in out


# ---------------------------------------------------------------------------
# H1 - redaction survives a foreign root handler (propagate=False)
# ---------------------------------------------------------------------------

class TestNoPropagationToRoot:
    def test_username_not_leaked_via_root_handler(self, tmp_path):
        yuu = logging.getLogger("yuu_clip")
        saved_handlers, saved_propagate = yuu.handlers[:], yuu.propagate
        for handler in saved_handlers:
            yuu.removeHandler(handler)
        captured: list[str] = []

        class _CaptureHandler(logging.Handler):
            def emit(self, record):
                captured.append(record.getMessage())

        root = logging.getLogger()
        probe = _CaptureHandler()
        root.addHandler(probe)
        try:
            configure_logging(tmp_path)
            get_logger("test").warning(r"path C:\Users\myser\x is gone")
            # The record must not have reached the un-sanitizing root handler.
            assert captured == []
            assert yuu.propagate is False
        finally:
            root.removeHandler(probe)
            for handler in yuu.handlers[:]:
                yuu.removeHandler(handler)
                handler.close()
            for handler in saved_handlers:
                yuu.addHandler(handler)
            yuu.propagate = saved_propagate
