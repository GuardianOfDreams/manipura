cmake_minimum_required(VERSION 3.20)

project(manipura_wasm LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

get_filename_component(MANIPURA_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/.." ABSOLUTE)

set(WRAPPER_SRC "${CMAKE_CURRENT_SOURCE_DIR}/wasm_wrapper.cpp")

add_executable(manipura ${WRAPPER_SRC})

target_include_directories(manipura PRIVATE "${MANIPURA_ROOT}")

# Header-only generator module (HarmonicSynth + Presets).
add_subdirectory("${MANIPURA_ROOT}/generator" "${CMAKE_BINARY_DIR}/generator")
target_link_libraries(manipura PRIVATE prism_generator)

target_compile_options(manipura PRIVATE -O3 -flto)

set(EMSCRIPTEN_LINK_FLAGS
    "-sMODULARIZE=1"
    "-sEXPORT_ES6=1"
    "-sEXPORT_NAME=Manipura"
    "-sENVIRONMENT=web,worker,node"
    "-sALLOW_MEMORY_GROWTH=1"
    "-sINITIAL_MEMORY=16777216"
    "-sEXPORTED_FUNCTIONS=['_manipura_synth_init','_manipura_synth_set_preset','_manipura_synth_set_f0','_manipura_synth_set_h1_boost','_manipura_synth_set_fwidth','_manipura_synth_set_inharm','_manipura_synth_get_gains','_manipura_synth_render','_manipura_synth_render_block','_manipura_synth_reset_phase','_manipura_synth_morph','_malloc','_free']"
    "-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPF32','HEAPF64']"
    "-sASSERTIONS=1"
)

target_link_options(manipura PRIVATE ${EMSCRIPTEN_LINK_FLAGS} --no-entry)

set_target_properties(manipura PROPERTIES
    OUTPUT_NAME "manipura"
    SUFFIX ".js"
)
