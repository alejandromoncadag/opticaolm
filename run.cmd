@echo off
setlocal

if /I "%~1"=="backend" (
  call "%~dp0Run Backend.cmd"
  exit /b %errorlevel%
)

if /I "%~1"=="frontend" (
  call "%~dp0Run Frontend.cmd"
  exit /b %errorlevel%
)

if /I "%~1"=="all" (
  call "%~dp0Run Optica OLM.cmd"
  exit /b %errorlevel%
)

echo Uso:
echo   run backend
echo   run frontend
echo   run all
exit /b 1
