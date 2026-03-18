@echo off
setlocal

call pnpm check
if errorlevel 1 exit /b 1
