# Third-party notices

`THIRD-PARTY-NOTICES.md` collects the licence of every third-party component
distributed with YuuClip, with each component's full verbatim licence text.

It is generated - do not edit it by hand:

```
yuu-dev notices
```

## What it covers

- **Python packages** - the exact runtime closure pinned in `../requirements.lock`.
  Each package's licence text is read from its installed wheel's `dist-info`. Run
  `yuu-dev lock-deps` first if the lock is stale, then `yuu-dev notices`.
- **Bundled components** - FFmpeg, llama.cpp (`llama-server`), and the Oxanium
  font, whose verbatim texts live in the repo (see `notices.py`
  `_BUNDLED_COMPONENTS`).

## fallback-licenses/

A few wheels ship no licence file in their `dist-info`. For those, the verbatim
upstream licence is stored here as `<pep503-normalized-name>.txt` and the generator
uses it as the fallback. Add a file here (named to match the package) if a newly
pinned dependency reports "no bundled licence text".

**Known exception:** `nvidia-ml-py` publishes no verbatim licence text anywhere
(wheel, repo, or PyPI) - only a "BSD License" classifier. It is recorded with its
declared licence and homepage; we do not fabricate a BSD variant for it.

`tests/unit/test_third_party_notices.py` guards that every pinned package and every
bundled component still has an entry in the generated file.
