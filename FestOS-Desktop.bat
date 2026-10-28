@echo off
title VIBRANIUM Desktop Application
cd /d "%~dp0"

echo ========================================================
echo   Launching VIBRANIUM Desktop Application...
echo ========================================================

:: Check if local server is already active on port 3050
powershell -Command "$r = try { (Invoke-WebRequest -Uri 'http://localhost:3050' -TimeoutSec 1).StatusCode } catch { 0 }; if ($r -eq 200) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo [VIBRANIUM] Starting local application server...
    start /min "VIBRANIUM Server" node server.js
    timeout /t 2 /nobreak >nul
)

:: Priority 1: Launch via packaged standalone desktop app
if exist "dist-desktop\Vibranium-win32-x64\Vibranium.exe" (
    start "" "dist-desktop\Vibranium-win32-x64\Vibranium.exe"
    exit /b 0
)
if exist "dist-desktop\FestOS-win32-x64\Vibranium.exe" (
    start "" "dist-desktop\FestOS-win32-x64\Vibranium.exe"
    exit /b 0
)
if exist "dist-desktop\FestOS-win32-x64\FestOS.exe" (
    start "" "dist-desktop\FestOS-win32-x64\FestOS.exe"
    exit /b 0
)

:: Priority 2: Launch via local Electron runtime
if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" .
    exit /b 0
)

:: Fallback via npx
npx electron .
