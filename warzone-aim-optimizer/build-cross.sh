#!/bin/sh
# Cross-compiles the Windows EXE on Linux with MinGW-w64 and packages dist/.
set -e
cd "$(dirname "$0")"
cmake -S . -B build/win -G Ninja -DCMAKE_TOOLCHAIN_FILE=cmake/mingw-w64-x86_64.cmake -DCMAKE_BUILD_TYPE=Release
cmake --build build/win
x86_64-w64-mingw32-strip build/win/WarzoneAimOptimizer.exe
rm -rf build/pkg && mkdir -p build/pkg/WarzoneAimOptimizer dist
cp build/win/WarzoneAimOptimizer.exe build/pkg/WarzoneAimOptimizer/
cp README.md build/pkg/WarzoneAimOptimizer/README.txt
rm -f dist/WarzoneAimOptimizer-win64.zip
(cd build/pkg && zip -q -r -X ../../dist/WarzoneAimOptimizer-win64.zip WarzoneAimOptimizer)
ls -l dist/WarzoneAimOptimizer-win64.zip
