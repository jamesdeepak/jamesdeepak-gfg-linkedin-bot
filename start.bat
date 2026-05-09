@echo off
title GFG LinkedIn Bot
color 0A
cls

echo.
echo  ============================================
echo    GFG LinkedIn Bot - Starting...
echo  ============================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js is not installed!
    echo.
    echo  Please install Node.js from: https://nodejs.org
    echo  Download the LTS version, install it, then run this file again.
    echo.
    pause
    start https://nodejs.org
    exit /b
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo  [SETUP] First time setup - installing dependencies...
    echo  This may take 2-3 minutes. Please wait.
    echo.
    call npm install
    echo.
    echo  [SETUP] Installing browser (one-time only)...
    call npx playwright install chromium
    echo.
    echo  [SETUP] Setup complete!
    echo.
)

:: Check if .env exists
if not exist ".env" (
    echo  [SETUP] Creating configuration file...
    copy .env.example .env >nul
    echo  [INFO] Please fill in your credentials in the dashboard.
    echo.
)

echo  [OK] Starting GFG Bot server...
echo  [OK] Opening dashboard at http://localhost:3000
echo.
echo  Keep this window open while the bot is running.
echo  Press Ctrl+C to stop the bot.
echo.

:: Open browser after 2 seconds
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Start the server
node src/server.js

pause
