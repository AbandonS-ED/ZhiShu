# stop.ps1 - 干净停止所有后端和前端（PID 优先 + 全杀兜底）
# 改进：
# 1. 优先用 .service-pids.json 记录的 PID（精确杀）
# 2. 然后用 Get-Process 全杀 python + node 进程（兜底）
# 3. 检测孤儿 socket 并警告
# 4. 验证端口释放

$ErrorActionPreference = 'Continue'
$RepoRoot = $PSScriptRoot
$PidFile = Join-Path $RepoRoot '.service-pids.json'

Write-Host "正在停止服务..." -ForegroundColor Yellow

# 1. 优先按 PID 杀
if (Test-Path $PidFile) {
    $pids = Get-Content $PidFile -Raw | ConvertFrom-Json
    if ($pids.backend) {
        try {
            Stop-Process -Id $pids.backend -Force -ErrorAction Stop
            Write-Host "  ✅ 停止后端 PID $($pids.backend)" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️ 后端 PID $($pids.backend) 不存在（可能已退）" -ForegroundColor Yellow
        }
    }
    if ($pids.frontend) {
        try {
            Stop-Process -Id $pids.frontend -Force -ErrorAction Stop
            Write-Host "  ✅ 停止前端 PID $($pids.frontend)" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️ 前端 PID $($pids.frontend) 不存在（可能已退）" -ForegroundColor Yellow
        }
    }
    Remove-Item $PidFile -Force
    Start-Sleep -Seconds 1
} else {
    Write-Host "  ⚠️ 未找到 .service-pids.json，启用全杀兜底模式" -ForegroundColor Yellow
}

# 2. 全杀 python 进程 (uvicorn worker + 任何遗留)
$pyProcs = Get-Process python -ErrorAction SilentlyContinue
if ($pyProcs) {
    $pyProcs | Stop-Process -Force
    Write-Host "  ✅ 强制停止 $($pyProcs.Count) 个 python 进程" -ForegroundColor Green
}

# 3. 全杀 node 进程 (next dev + 任何遗留)
$nodeProcs = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcs) {
    $nodeProcs | Stop-Process -Force
    Write-Host "  ✅ 强制停止 $($nodeProcs.Count) 个 node 进程" -ForegroundColor Green
}

# 4. 等端口释放
Write-Host "  等待端口释放..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# 5. 验证端口
$port8001 = netstat -ano | Select-String ':8001.*LISTENING'
$port3000 = netstat -ano | Select-String ':3000.*LISTENING'

if (-not $port8001 -and -not $port3000) {
    Write-Host ""
    Write-Host "✅ 所有服务已干净停止，端口 8001/3000 已释放" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️ 端口仍被占用（可能是 Windows 孤儿 socket）:" -ForegroundColor Yellow
    if ($port8001) {
        $pid_line = ($port8001 -split '\s+')[-1]
        Write-Host "  8001: PID $pid_line （无进程对象，需要 netsh 或重启电脑）" -ForegroundColor Yellow
    }
    if ($port3000) {
        $pid_line = ($port3000 -split '\s+')[-1]
        Write-Host "  3000: PID $pid_line （无进程对象，需要 netsh 或重启电脑）" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "💡 清理孤儿 socket:" -ForegroundColor Cyan
    Write-Host "   1. 管理员运行 PowerShell: netsh int ipv4 reset" -ForegroundColor Cyan
    Write-Host "   2. 或重启电脑" -ForegroundColor Cyan
    Write-Host "   3. 或换端口 (修改 frontend/src/lib/api.ts BASE_URL)" -ForegroundColor Cyan
}
