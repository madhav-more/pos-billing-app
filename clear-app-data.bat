@echo off
echo Clearing G.U.R.U POS app data...
echo ================================

adb shell pm clear com.guru.pos

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Success! App data cleared.
    echo Please restart the app on your device.
) else (
    echo.
    echo Failed to clear app data.
    echo Make sure:
    echo 1. Your Android device is connected via USB
    echo 2. USB debugging is enabled
    echo 3. ADB is installed and in your PATH
    echo.
    echo Alternative: Manually uninstall and reinstall the app
)

pause
