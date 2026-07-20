@echo off
REM ============================================================
REM  ZhiShu SmartHub v1.0 - Stopper
REM  - ASCII output, Chinese via PowerShell
REM ============================================================
chcp 65001 >nul 2>&1
title ZhiShu SmartHub - Stop Service

powershell -NoProfile -Command "Write-Host ''; Write-Host '============================================================' -ForegroundColor Cyan; Write-Host '          ZhiShu SmartHub - Stopping services' -ForegroundColor White; Write-Host '============================================================' -ForegroundColor Cyan; Write-Host ''"

powershell -NoProfile -Command "Write-Host '[1/3] Stopping frontend (port 3000)...' -ForegroundColor Cyan; Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host '       [OK] Frontend stopped' -ForegroundColor Green; Write-Host ''"

powershell -NoProfile -Command "Write-Host '[2/3] Stopping backend (port 8001)...' -ForegroundColor Cyan; Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host '       [OK] Backend stopped' -ForegroundColor Green; Write-Host ''"

powershell -NoProfile -Command "Write-Host '[3/3] Cleaning up residual windows...' -ForegroundColor Cyan"
taskkill /FI "WINDOWTITLE eq ZhiShu-Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ZhiShu-Frontend*" /T /F >nul 2>&1
powershell -NoProfile -Command "Write-Host '       [OK] All windows closed' -ForegroundColor Green; Write-Host ''"

powershell -NoProfile -Command "Write-Host '============================================================' -ForegroundColor Cyan; Write-Host '  [DONE] ZhiShu SmartHub has been stopped' -ForegroundColor Green; Write-Host '============================================================' -ForegroundColor Cyan; Write-Host ''"

powershell -NoProfile -Command "Start-Sleep -Seconds 3" >nul 2>&1
exit /b 0