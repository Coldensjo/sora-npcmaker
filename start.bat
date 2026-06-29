@echo off
REM Launches the Sorairei NPC Maker over http so the browser can read the
REM Tibia.dat / Tibia.spr / items.otb / items.xml / outfits.xml game files.
cd /d "%~dp0"
node serve.js
if errorlevel 1 (
    echo.
    echo Node.js was not found. Install it from https://nodejs.org/ ,
    echo or run a server manually, e.g.:  python -m http.server 8080
    pause
)