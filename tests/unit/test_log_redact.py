import logging

from yuu_clip.log import _SanitizingFormatter, redact_paths


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
