# test-golden.ps1 - run ONLY the opt-in golden real-models path.
#
# Thin wrapper over `yuu-dev test-golden`. The golden path (tests/system,
# `-m golden`) drives the core loop on a REAL clip with REAL Whisper (tiny) + a
# REAL local LLM - the wiring proof behind UC-B01 / UC-B05 that the stubbed
# system tier deliberately can't give.
#
# It is env-gated and SKIPS (never fails) when an input is missing:
#   $env:YUU_GOLDEN_CLIP       = path to a short recording with real speech
#   $env:YUU_GOLDEN_LLM_MODEL  = path to a real text .gguf model
# plus ffmpeg on PATH and a runnable local llama-server.
#
# A skip means the real models did NOT run, so `yuu-dev test-golden` prints a
# prominent banner with the skip reason - do not read a skip as a pass. It is
# excluded from every default run (`yuu-dev test-system` runs `-m "not golden"`).
#
# Any extra args pass straight through to pytest, e.g.:
#   .\scripts\test-golden.ps1 --detailed

yuu-dev test-golden @args
exit $LASTEXITCODE
