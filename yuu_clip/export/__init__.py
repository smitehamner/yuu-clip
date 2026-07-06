"""The export feature, in one place.

- ``naming`` — export filename stem: template, validation, rendering.
- ``presets`` — Export preset definitions, validation, size-cap bitrate math.
- ``render`` — the export engine: retranscribe, title card, caption staging,
  window computation, and the final ffmpeg cut. Driven by ``cli/export.py``'s
  ``export``/``retranscribe`` commands (spawned as a subprocess by the web UI).

Kept import-light on purpose: ``naming`` is imported at module load by
``db/models.py`` and ``config.py``, so this package must not eagerly pull in the
heavy ``render`` module. Import the submodule you need directly.
"""
