cmake_minimum_required(VERSION 3.16)
project(WarzoneAimOptimizer VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release)
endif()

if(MSVC)
  add_compile_options(/W4 /utf-8 /permissive- /MP)
  add_compile_definitions(_CRT_SECURE_NO_WARNINGS)
  # Static CRT so the EXE runs without the VC++ redistributable.
  set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
else()
  add_compile_options(-Wall -Wextra)
endif()

# Portable core: analysis, curves, benchmark, recommender. No Windows headers.
add_library(wzcore STATIC
  src/core/Benchmark.cpp
  src/core/History.cpp
  src/core/KeyValue.cpp
  src/core/Profile.cpp
  src/core/Recommender.cpp
  src/core/ResponseCurve.cpp
  src/core/StickAnalysis.cpp)

add_executable(wz_core_tests tests/core_tests.cpp)
target_link_libraries(wz_core_tests PRIVATE wzcore)
enable_testing()
add_test(NAME core COMMAND wz_core_tests)

if(WIN32)
  if(MSVC)
    # MSVC embeds the manifest itself; the .rc line would duplicate it.
    set(WZ_RC_DEFS WZ_NO_RC_MANIFEST)
  endif()
  add_executable(WarzoneAimOptimizer WIN32
    src/main.cpp
    src/platform/Input.cpp
    src/ui/App.cpp
    src/ui/PageBenchmark.cpp
    src/ui/PageCalibration.cpp
    src/ui/PageLive.cpp
    src/ui/PageProfiles.cpp
    src/ui/PageResults.cpp
    src/ui/Ui.cpp
    res/app.rc)
  target_compile_definitions(WarzoneAimOptimizer PRIVATE UNICODE _UNICODE ${WZ_RC_DEFS})
  target_link_libraries(WarzoneAimOptimizer PRIVATE wzcore gdiplus winmm shell32 user32 gdi32 ole32)
  if(MSVC)
    target_sources(WarzoneAimOptimizer PRIVATE res/app.manifest)
  else()
    target_link_options(WarzoneAimOptimizer PRIVATE -municode -static -static-libgcc -static-libstdc++)
    target_link_options(wz_core_tests PRIVATE -static -static-libgcc -static-libstdc++)
  endif()
endif()
