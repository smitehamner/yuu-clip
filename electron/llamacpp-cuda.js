'use strict';

// Prebuilt CUDA wheels for llama-cpp-python are published directly as GitHub
// Release assets tagged `v<version>-cu<tag>` (abetlen's old pip index at
// abetlen.github.io/llama-cpp-python/whl/ stopped at v0.2.69, which predates
// yuu-clip's own `llama-cpp-python>=0.3,<1.0` pin in pyproject.toml — do not
// resurrect that index). Re-pinning LLAMA_CPP_CUDA_VERSION or the available tag
// list requires checking https://github.com/abetlen/llama-cpp-python/releases
// for which cu<NNN> tags the target version actually published a win_amd64 wheel
// for (not every version publishes every tag).
const LLAMA_CPP_CUDA_VERSION = '0.3.32';
const AVAILABLE_CUDA_TAGS = ['cu118', 'cu121', 'cu122', 'cu123', 'cu124', 'cu125', 'cu130', 'cu132'];

// Each tag encodes major*10+minor (cu124 -> 12.4, cu130 -> 13.0) — the same scale
// `nvidia-smi`'s reported "CUDA Version: 12.6" parses to, so tag and detected
// version compare directly as integers.
function pickCudaWheelTag(cudaVersionString, availableTags = AVAILABLE_CUDA_TAGS) {
  const versionMatch = String(cudaVersionString || '').match(/^(\d+)\.(\d+)/);
  if (!versionMatch) return null;
  const detectedCode = parseInt(versionMatch[1], 10) * 10 + parseInt(versionMatch[2], 10);

  let best = null;
  for (const tag of availableTags) {
    const tagMatch = tag.match(/^cu(\d+)$/);
    if (!tagMatch) continue;
    const tagCode = parseInt(tagMatch[1], 10);
    // A wheel built for an older/equal CUDA toolkit runs fine against a newer
    // driver (NVIDIA's minor-version-compatibility guarantee), so pick the
    // highest available tag that doesn't exceed the detected version.
    if (tagCode <= detectedCode && (best === null || tagCode > best)) {
      best = tagCode;
    }
  }
  return best === null ? null : `cu${best}`;
}

function buildCudaWheelUrl(version, tag) {
  return `https://github.com/abetlen/llama-cpp-python/releases/download/v${version}-${tag}/llama_cpp_python-${version}-py3-none-win_amd64.whl`;
}

module.exports = { LLAMA_CPP_CUDA_VERSION, AVAILABLE_CUDA_TAGS, pickCudaWheelTag, buildCudaWheelUrl };
