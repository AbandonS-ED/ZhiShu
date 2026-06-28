# start.ps1 - 一键启动后端和前端（孤儿 socket 检测 + PID 记录）
# 改进：
# 1. 启动前检查 8001/3000 端口，孤儿 socket 警告用户
# 2. 不用 cmd wrapper（直接用 python.exe + npm），Stop-Process 干净
# 3. 记录 PID 到 .pids 文件（stop.ps1 用）
# 4. 后端启动非 reload 模式（避免父子进程问题）
# 5. 启动失败立刻提示

$ErrorActionPreference = 'Continue'
$RepoRoot = $PSScriptRoot
$BackendDir = Join-Path $RepoRoot 'backend'
$FrontendDir = Join-Path $RepoRoot 'frontend'
$LogDir = Join-Path $RepoRoot 'logs'
$PidFile = Join-Path $RepoRoot '.service-pids.json'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Write-Host "正在启动服务..." -ForegroundColor Yellow

# 0. 启动前检查端口
Write-Host "[0/4] 检查端口占用..." -ForegroundColor Gray
$portCheck = @{
    '8001' = (netstat -ano | Select-String ':8001.*LISTENING')
    '3000' = (netstat -ano | Select-String ':3000.*LISTENING')
}

foreach ($port in @('8001', '3000')) {
    if ($portCheck[$port]) {
        $pid_line = ($portCheck[$port] -split '\s+')[-1]
        Write-Host "  ⚠️ 端口 $port 已被 PID $pid_line 占用" -ForegroundColor Yellow
        try {
            $proc = Get-Process -Id $pid_line -ErrorAction Stop
            Write-Host "    进程名: $($proc.ProcessName)" -ForegroundColor Yellow
        } catch {
            Write-Host "    进程已不存在（Windows 孤儿 socket）" -ForegroundColor Red
            Write-Host "    💡 建议：运行 .\stop.ps1 或重启电脑" -ForegroundColor Red
        }
    }
}

# 1. 启动后端（不用 --reload，避免父子进程问题）
Write-Host "[1/4] 启动后端 (端口 8001, 非 reload 模式)..." -ForegroundColor Cyan
$backendExe = Join-Path $BackendDir 'venv\Scripts\python.exe'
$backendLog = Join-Path $LogDir 'backend.log'
$backendErr = Join-Path $LogDir 'backend.err.log'

$backendProc = Start-Process -FilePath $backendExe `
    -ArgumentList '-m','uvicorn','app.main:app','--host','0.0.0.0','--port','8001' `
    -WorkingDirectory $BackendDir `
    -RedirectStandardOutput $backendLog `
    -RedirectStandardError $backendErr `
    -WindowStyle Hidden `
    -PassThru

Write-Host "  后端 PID: $($backendProc.Id)" -ForegroundColor Green

# 2. 启动前端
Write-Host "[2/4] 启动前端 (端口 3000)..." -ForegroundColor Cyan
$frontendLog = Join-Path $LogDir 'frontend.log'
$frontendErr = Join-Path $LogDir 'frontend.err.log'

$frontendProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c','npm run dev' `
    -WorkingDirectory $FrontendDir `
    -RedirectStandardOutput $frontendLog `
    -RedirectStandardError $frontendErr `
    -WindowStyle Hidden `
    -PassThru

Write-Host "  前端 PID: $($frontendProc.Id)" -ForegroundColor Green

# 3. 记录 PID
@{
    backend = $backendProc.Id
    frontend = $frontendProc.Id
    started_at = (Get-Date).ToString('o')
} | ConvertTo-Json | Set-Content -Path $PidFile

Write-Host "[3/4] 等待服务就绪..." -ForegroundColor Gray
$backendOK = $false
$frontendOK = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:8001/health' -UseBasicParsing -TimeoutSec 2
        if ($r.Content -like '*healthy*') { $backendOK = $true; break }
    } catch {}
}

for ($i = 1; $i -le 60; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { $frontendOK = $true; break }
    } catch {}
}

# 4. 验证状态
Write-Host "[4/4] 启动结果:" -ForegroundColor White
if ($backendOK) {
    Write-Host "  ✅ 后端: http://localhost:8001  (PID $($backendProc.Id))" -ForegroundColor Green
} else {
    Write-Host "  ❌ 后端: 30 秒内未就绪，查看 $backendErr" -ForegroundColor Red
}

if ($frontendOK) {
    Write-Host "  ✅ 前端: http://localhost:3000  (PID $($frontendProc.Id))" -ForegroundColor Green
} else {
    Write-Host "  ❌ 前端: 60 秒内未就绪，查看 $frontendErr" -ForegroundColor Red
}

Write-Host ""
Write-Host "💡 停止服务: .\stop.ps1" -ForegroundColor Cyan
