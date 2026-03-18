@echo off
setlocal

call pnpm check:fast
if errorlevel 1 exit /b 1
