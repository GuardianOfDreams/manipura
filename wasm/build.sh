#!/usr/bin/env bash
#
# Сборка PRISM analyzer в WebAssembly.
# Требует: Emscripten (emcc) в PATH или в ~/emsdk/emsdk_env.sh
#
set -euo pipefail

# Корень проекта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRISM_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"

# Активируем Emscripten, если он не в PATH.
if ! command -v emcc >/dev/null 2>&1; then
    if [ -f "${HOME}/emsdk/emsdk_env.sh" ]; then
        # shellcheck disable=SC1090
        source "${HOME}/emsdk/emsdk_env.sh" >/dev/null 2>&1
    fi
fi

if ! command -v emcc >/dev/null 2>&1; then
    echo "ERROR: emcc не найден. Установите Emscripten:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git ~/emsdk"
    echo "  cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest"
    exit 1
fi

echo "==> emcc: $(emcc --version | head -1)"
echo "==> Сборка: ${BUILD_DIR}"

mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

emcmake cmake "${SCRIPT_DIR}" -DCMAKE_BUILD_TYPE=Release
emmake make -j"$(sysctl -n hw.ncpu 2>/dev/null || echo 4)"

echo "==> Готово."
ls -la "${BUILD_DIR}"/*.js "${BUILD_DIR}"/*.wasm 2>/dev/null || true