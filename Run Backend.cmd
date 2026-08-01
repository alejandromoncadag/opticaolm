@echo off
title Optica OLM - Backend
cd /d "%~dp0backend"

if not exist ".venv\Scripts\python.exe" (
  echo ERROR: No se encontro backend\.venv\Scripts\python.exe
  echo Primero crea o reinstala el entorno virtual del backend.
  pause
  exit /b 1
)

echo Iniciando backend en http://127.0.0.1:8000
echo Para detenerlo, presiona Ctrl+C.
echo.
".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000

if errorlevel 1 (
  echo.
  echo El backend se detuvo con un error.
  pause
)
