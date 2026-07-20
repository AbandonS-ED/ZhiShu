@echo off
REM ============================================================
REM  ZhiShu SmartHub v1.0 - Launcher
REM  - ASCII output, Chinese via PowerShell (UTF-8 safe)
REM  - Port check via PowerShell Test-NetConnection -> tmp file
REM ============================================================
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title ZhiShu SmartHub v1.0

set ROOT=%~dp0
set TMPPORT=%TEMP%\zhishu_port_check_%RANDOM%.txt

powershell -NoProfile -Command "Write-Host ''; Write-Host '============================================================' -ForegroundColor Cyan; Write-Host '                    ZhiShu SmartHub v1.0' -ForegroundColor White; Write-Host '      Multi-Agent Personalized Learning System' -ForegroundColor Gray; Write-Host '============================================================' -ForegroundColor Cyan; Write-Host ''"

echo [1/5] Checking runtime environment...

where python >nul 2>&1
if errorlevel 1 goto :need_python

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PYVER=%%v
powershell -NoProfile -Command "Write-Host ('  [OK] Python ' + $env:PYVER) -ForegroundColor Green"

where node >nul 2>&1
if errorlevel 1 goto :need_node

for /f "tokens=1" %%v in ('node --version') do set NODEVER=%%v
powershell -NoProfile -Command "Write-Host ('  [OK] Node.js ' + $env:NODEVER) -ForegroundColor Green"
powershell -NoProfile -Command "Write-Host ''"
goto :env_ok

:need_python
powershell -NoProfile -Command "Write-Host '  [ERROR] Python not found. Please install Python 3.11+' -ForegroundColor Red; Write-Host '          Download: https://www.python.org/downloads/' -ForegroundColor Yellow; Write-Host '          IMPORTANT: Check [Add Python to PATH] during install' -ForegroundColor Yellow; Write-Host ''"
pause
exit /b 1

:need_node
powershell -NoProfile -Command "Write-Host '  [ERROR] Node.js not found. Please install Node.js 18+' -ForegroundColor Red; Write-Host '          Download: https://nodejs.org/' -ForegroundColor Yellow; Write-Host '          IMPORTANT: Check [Add to PATH] during install' -ForegroundColor Yellow; Write-Host ''"
pause
exit /b 1

:env_ok

REM ---------- Step 2: Start Backend ----------
powershell -NoProfile -Command "Write-Host '[2/5] Starting backend service (port 8001)...' -ForegroundColor Cyan; Write-Host '       First run will auto-install dependencies (~1-3 min)' -ForegroundColor Gray"
start "ZhiShu-Backend" /D "%ROOT%后端" "%ROOT%后端\SmartHub-Backend.exe"
powershell -NoProfile -Command "Write-Host '       [OK] Backend window launched' -ForegroundColor Green; Write-Host ''"

REM ---------- Step 3: Wait for Backend port 8001 ----------
powershell -NoProfile -Command "Write-Host '[3/5] Waiting for backend (port 8001)...' -ForegroundColor Cyan"
set COUNT=0
:wait_backend
powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1
powershell -NoProfile -Command "$ok = Test-NetConnection -ComputerName localhost -Port 8001 -InformationLevel Quiet -WarningAction SilentlyContinue; if ($ok) { 'READY' | Out-File -FilePath '%TMPPORT%' -Encoding ascii -Force } else { 'WAIT' | Out-File -FilePath '%TMPPORT%' -Encoding ascii -Force }" >nul 2>&1
set /p STATUS=<%TMPPORT%
if /i not "%STATUS%"=="READY" (
    set /a COUNT+=1
    if !COUNT! GEQ 60 (
        powershell -NoProfile -Command "Write-Host '  [TIMEOUT] Backend failed to start within 120s' -ForegroundColor Red; Write-Host '            Check the backend window for error messages' -ForegroundColor Yellow"
        del "%TMPPORT%" >nul 2>&1
        pause
        exit /b 1
    )
    goto :wait_backend
)
powershell -NoProfile -Command "Write-Host '       [OK] Backend port 8001 ready' -ForegroundColor Green; Write-Host ''"

REM ---------- Step 4: Start Frontend ----------
powershell -NoProfile -Command "Write-Host '[4/5] Starting frontend service (port 3000)...' -ForegroundColor Cyan"
start "ZhiShu-Frontend" /D "%ROOT%前端" "%ROOT%前端\SmartHub-Frontend.exe"
powershell -NoProfile -Command "Write-Host '       [OK] Frontend window launched' -ForegroundColor Green; Write-Host ''"

REM ---------- Step 5: Wait for Frontend port 3000 ----------
powershell -NoProfile -Command "Write-Host '[5/5] Waiting for frontend (port 3000)...' -ForegroundColor Cyan"
set COUNT=0
:wait_frontend
powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1
powershell -NoProfile -Command "$ok = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue; if ($ok) { 'READY' | Out-File -FilePath '%TMPPORT%' -Encoding ascii -Force } else { 'WAIT' | Out-File -FilePath '%TMPPORT%' -Encoding ascii -Force }" >nul 2>&1
set /p STATUS=<%TMPPORT%
if /i not "%STATUS%"=="READY" (
    set /a COUNT+=1
    if !COUNT! GEQ 60 (
        powershell -NoProfile -Command "Write-Host '  [TIMEOUT] Frontend failed to start within 120s' -ForegroundColor Red; Write-Host '            Check the frontend window for error messages' -ForegroundColor Yellow"
        del "%TMPPORT%" >nul 2>&1
        pause
        exit /b 1
    )
    goto :wait_frontend
)
powershell -NoProfile -Command "Write-Host '       [OK] Frontend port 3000 ready' -ForegroundColor Green; Write-Host ''"

del "%TMPPORT%" >nul 2>&1
start "" "http://localhost:3000"

powershell -NoProfile -Command "Write-Host '============================================================' -ForegroundColor Cyan; Write-Host '  [DONE] ZhiShu SmartHub is running!' -ForegroundColor Green; Write-Host ''; Write-Host '     Frontend:    http://localhost:3000' -ForegroundColor White; Write-Host '     Backend API: http://localhost:8001' -ForegroundColor White; Write-Host '     Swagger:     http://localhost:8001/docs' -ForegroundColor White; Write-Host ''; Write-Host '     Admin Panel: http://localhost:3000/admin/login' -ForegroundColor White; Write-Host '     Default:     admin / admin123' -ForegroundColor White; Write-Host ''; Write-Host '     To stop:     double-click [Stop-ZhiShu.bat]' -ForegroundColor Yellow; Write-Host '============================================================' -ForegroundColor Cyan; Write-Host ''"

powershell -NoProfile -Command "Start-Sleep -Seconds 5" >nul 2>&1
exit /b 0