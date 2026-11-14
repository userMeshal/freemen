@echo off
rem Builds with Visual Studio 2022 + CMake. Run from a normal command prompt.
setlocal
cmake -S "%~dp0." -B "%~dp0build" -A x64 || exit /b 1
cmake --build "%~dp0build" --config Release || exit /b 1
"%~dp0build\Release\wz_core_tests.exe" || exit /b 1
echo.
echo Built: %~dp0build\Release\WarzoneAimOptimizer.exe
