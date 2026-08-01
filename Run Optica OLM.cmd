@echo off
title Optica OLM - Inicio local
cd /d "%~dp0"

start "Optica OLM - Backend" "%~dp0Run Backend.cmd"
start "Optica OLM - Frontend" "%~dp0Run Frontend.cmd"

echo Backend y frontend se abrieron en ventanas separadas.
timeout /t 2 /nobreak >nul
