@echo off
REM Requiere Node.js instalado (https://nodejs.org). Ejecutar en Windows.
call npm install
call npm run dist
echo.
echo Pronto: dist\PelisLD-PC.exe
pause
