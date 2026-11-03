@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas instalar Node.js primero: https://nodejs.org
  start https://nodejs.org
  pause
  exit /b
)
if not exist node_modules (
  echo Primera vez: instalando componentes, espera unos minutos...
  call npm install
)
start "" /b cmd /c "npm start"
