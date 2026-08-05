@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-server.ps1" start
if errorlevel 1 (
    echo.
    echo Nao foi possivel iniciar o servidor local.
    pause
    exit /b 1
)
start "" "http://127.0.0.1:8000/"
endlocal
