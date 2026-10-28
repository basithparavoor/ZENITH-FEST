@echo off
setlocal enabledelayedexpansion

if exist "C:\Users\asus\AppData\Local\jdk-21\jdk-21.0.4+7\bin\java.exe" (
    set "JAVA_HOME=C:\Users\asus\AppData\Local\jdk-21\jdk-21.0.4+7"
) else if exist "C:\Users\asus\AppData\Local\jdk-17\jdk-17.0.12+7\bin\java.exe" (
    set "JAVA_HOME=C:\Users\asus\AppData\Local\jdk-17\jdk-17.0.12+7"
) else (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo ===================================================
echo [FestOS] Building Android APK (Anti-Locking Mode)
echo JAVA_HOME: %JAVA_HOME%
echo ===================================================

echo [1/4] Preparing Clean Web Assets...
cd /d "%~dp0\.."
call node scripts\prepare-clean-www.js
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] prepare-clean-www failed
    exit /b %ERRORLEVEL%
)

echo [2/4] Syncing Capacitor Android...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] cap sync android failed
    exit /b %ERRORLEVEL%
)

echo [3/4] Releasing File Locks...
cd /d "%~dp0\..\android"
call gradlew.bat --stop >nul 2>&1
ping 127.0.0.1 -n 3 >nul 2>&1

echo [4/4] Compiling Android APK with Gradle...
call gradlew.bat assembleDebug --no-daemon --no-build-cache

if %ERRORLEVEL% EQU 0 (
    echo ===================================================
    echo [SUCCESS] VIBRANIUM APK Generated Successfully!
    cd /d "%~dp0\.."
    if not exist dist mkdir dist
    if exist "android\app\build\outputs\apk\debug\VIBRANIUM.apk" (
        copy /y "android\app\build\outputs\apk\debug\VIBRANIUM.apk" "VIBRANIUM.apk" >nul
        copy /y "android\app\build\outputs\apk\debug\VIBRANIUM.apk" "dist\VIBRANIUM.apk" >nul
        copy /y "android\app\build\outputs\apk\debug\VIBRANIUM.apk" "www\VIBRANIUM.apk" >nul
        copy /y "android\app\build\outputs\apk\debug\VIBRANIUM.apk" "festos-app.apk" >nul
    ) else if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
        copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "VIBRANIUM.apk" >nul
        copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "dist\VIBRANIUM.apk" >nul
        copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "www\VIBRANIUM.apk" >nul
        copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "festos-app.apk" >nul
    )
    echo Output: VIBRANIUM.apk
    echo Output: dist\VIBRANIUM.apk
    echo Output: www\VIBRANIUM.apk
    echo ===================================================
) else (
    echo ===================================================
    echo [ERROR] Gradle APK assembly encountered an issue.
    echo ===================================================
)
