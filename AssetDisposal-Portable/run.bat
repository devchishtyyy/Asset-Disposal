@echo off
title Asset Disposal System
cd /d "%~dp0"

echo.
echo  Starting Asset Disposal System...
echo.

REM Use bundled node.exe if present, otherwise fall back to system node
if exist "%~dp0node.exe" (
    set "NODE_EXE=%~dp0node.exe"
) else (
    set "NODE_EXE=node"
)

REM Set production environment
set NODE_ENV=production

REM Open browser after a short delay (2 seconds)
start "" cmd /c "timeout /t 2 >nul && start http://localhost:3001"

REM Start the server (this blocks until closed)
"%NODE_EXE%" backend\server.js

echo.
echo  Server stopped. Press any key to exit.
pause >nul
