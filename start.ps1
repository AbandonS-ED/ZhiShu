# start.ps1 - 一键启动后端和前端（孤儿 socket 检测 + PID 记录）
# 改进：
# 1. 启动前检查 8001/3000 端口，孤儿 socket 警告用户
# 2. 不用 cmd wrapper（直接用 python.exe + npm），Stop-Process 干净
# 3. 记录 PID 到 .pids 文件（stop.ps1 用）
# 4. 后端启动非 reload 模式（避免父子进程问题）
# 5. 启动失败立刻提示
# 6. 默认生产模式（next build + next start），-Dev 切开发模式

param([switch]$Dev)

$ErrorActionPreference = 'Continue'
$RepoRoot = $PSScriptRoot
$BackendDir = Join-Path $RepoRoot 'backend'
$FrontendDir = Join-Path $RepoRoot 'frontend'
$LogDir = Join-Path $RepoRoot 'logs'
$PidFile = Join-Path $RepoRoot '.service-pids.json'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if ($Dev) {
    Write-Host "正在启动服务 (开发模式 - 支持热更新)..." -ForegroundColor Yellow
} else {
    Write-Host "正在启动服务 (生产模式 - 最佳性能)..." -ForegroundColor Yellow
}

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

$nextExe = Join-Path $FrontendDir 'node_modules\next\dist\bin\next'
if ($Dev) {
    # 开发模式：next dev（支持热更新，首次加载慢）
    if (-not (Test-Path $nextExe)) {
        $nextExe = 'npx.cmd'
        $nextArgs = @('--no-install','next','dev')
    } else {
        $nextExe = 'node.exe'
        $nextArgs = @('node_modules\next\dist\bin\next','dev')
    }
} else {
    # 生产模式：先 build 再 start（首次加载快，无热更新）
    Write-Host "  正在构建前端 (next build)..." -ForegroundColor Gray
    $buildProc = Start-Process -FilePath 'node.exe' `
        -ArgumentList 'node_modules\next\dist\bin\next','build' `
        -WorkingDirectory $FrontendDir `
        -NoNewWindow `
        -Wait `
        -PassThru
    if ($buildProc.ExitCode -ne 0) {
        Write-Host "  ❌ 前端构建失败，回退到开发模式..." -ForegroundColor Yellow
        $Dev = $true
    } else {
        Write-Host "  ✅ 前端构建完成" -ForegroundColor Green
    }
    if (-not $Dev) {
        $nextExe = 'node.exe'
        $nextArgs = @('node_modules\next\dist\bin\next','start')
    }
}

if ($Dev) {
    if (-not (Test-Path (Join-Path $FrontendDir 'node_modules\next\dist\bin\next'))) {
        $nextExe = 'npx.cmd'
        $nextArgs = @('--no-install','next','dev')
    } else {
        $nextExe = 'node.exe'
        $nextArgs = @('node_modules\next\dist\bin\next','dev')
    }
}

$frontendProc = Start-Process -FilePath $nextExe `
    -ArgumentList $nextArgs `
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
    mode = if ($Dev) { 'dev' } else { 'prod' }
    started_at = (Get-Date).ToString('o')
} | ConvertTo-Json | Set-Content -Path $PidFile

Write-Host "[3/4] 等待服务就绪..." -ForegroundColor Gray
$backendOK = $false
$frontendOK = $false
# 后端 60s (startup 期间 scheduled_analysis 后台任务会偶发抢占 health 请求,需要更长等待窗口)
for ($i = 1; $i -le 60; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:8001/health' -UseBasicParsing -TimeoutSec 3
        if ($r.Content -like '*healthy*') { $backendOK = $true; break }
    } catch {}
}

$frontendTimeout = if ($Dev) { 60 } else { 30 }
for ($i = 1; $i -le $frontendTimeout; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $frontendOK = $true; break }
    } catch {}
}

# 4. 验证状态
Write-Host "[4/4] 启动结果:" -ForegroundColor White
$modeLabel = if ($Dev) { '开发模式' } else { '生产模式' }
if ($backendOK) {
    Write-Host "  ✅ 后端: http://localhost:8001  (PID $($backendProc.Id))" -ForegroundColor Green
} else {
    Write-Host "  ❌ 后端: 60 秒内未就绪，查看 $backendErr" -ForegroundColor Red
}

if ($frontendOK) {
    Write-Host "  ✅ 前端: http://localhost:3000  (PID $($frontendProc.Id)) [$modeLabel]" -ForegroundColor Green
} else {
    Write-Host "  ❌ 前端: $frontendTimeout 秒内未就绪，查看 $frontendErr" -ForegroundColor Red
}

Write-Host ""
if ($Dev) {
    Write-Host "💡 开发模式：改代码自动热更新，但首次加载慢" -ForegroundColor Cyan
    Write-Host "💡 生产模式：.\start.ps1（首次加载秒开，但改代码需重新 build）" -ForegroundColor Cyan
} else {
    Write-Host "💡 生产模式：首次加载秒开，改代码需重新 .\start.ps1" -ForegroundColor Cyan
    Write-Host "💡 开发模式：.\start.ps1 -Dev（支持热更新，但首次加载慢）" -ForegroundColor Cyan
}
Write-Host "💡 停止服务: .\stop.ps1" -ForegroundColor Cyan
