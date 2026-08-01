@echo off
title Optica OLM - Frontend
cd /d "%~dp0frontend"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro npm.cmd. Verifica que Node.js este instalado.
  pause
  exit /b 1
)

echo Iniciando frontend en http://127.0.0.1:5173
echo Para detenerlo, presiona Ctrl+C.
echo.
npm.cmd run dev -- --host 127.0.0.1

if errorlevel 1 (
  echo.
  echo El frontend se detuvo con un error.
  pause
)
