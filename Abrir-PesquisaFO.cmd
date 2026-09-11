@echo off
cd /d "%~dp0"
start "PesquisaFO" http://127.0.0.1:8765/app.html
node server.cjs
pause
