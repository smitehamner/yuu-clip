import os

# huggingface_hub emits a multi-line UserWarning on Windows when the machine cannot
# create cache symlinks (Developer Mode off / not admin). The degraded cache is benign
# here, but the warning leaked verbatim into the analyze subprocess's UI log. Set before
# any huggingface_hub import - this package is imported first in every yuu_clip process
# (server, CLI, and the analyze/score subprocess).
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
