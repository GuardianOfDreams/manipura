cmake_minimum_required(VERSION 3.20)

# PRISM · generator — standalone module for hybrid harmonic synthesis.
#
# This is not a wrapper around the JS synth. It is a from-scratch C++ core
# that recreates the vowel topology of the speech tract, per
# docs/SYNTHESIS_THEORY.md (S.1–S.6) and docs/JOURNAL.md (2.31–2.32).
#
# The module is header-only by design: Presets.h and HarmonicSynth.h
# contain all logic. This CMakeLists.txt builds it as a static library
# so it can be linked into wasm/ (browser) and standalone/ (native CLI,
# future) without code duplication. See generator/README.md for the
# philosophy, invariants, and history.

project(prism_generator LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Header-only interface library. Anything that links prism_generator
# gets the include path for <generator/HarmonicSynth.h>.
add_library(prism_generator INTERFACE)

target_include_directories(prism_generator INTERFACE
    "${CMAKE_CURRENT_SOURCE_DIR}/.."
)

target_compile_features(prism_generator INTERFACE cxx_std_20)

# Optional self-test target (not required for the browser build).
# Build with: cmake -B build -DPRISM_GENERATOR_BUILD_TEST=ON
option(PRISM_GENERATOR_BUILD_TEST "Build a native smoke-test for the generator module" OFF)

if(PRISM_GENERATOR_BUILD_TEST)
    add_executable(prism_generator_smoke
        "${CMAKE_CURRENT_SOURCE_DIR}/smoke_test.cpp"
    )
    target_link_libraries(prism_generator_smoke PRIVATE prism_generator)
    target_compile_options(prism_generator_smoke PRIVATE -O2 -Wall -Wextra)
endif()