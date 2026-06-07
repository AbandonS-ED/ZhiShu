# 智枢(ZhiShu) 一键初始化脚本
# 用法: 在 backend/ 目录下执行 .\scripts\setup.ps1
# 前提: 已安装 Python 3.11+ 和 PostgreSQL 18+

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  智枢(ZhiShu) 环境初始化" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ---- 1. PostgreSQL 连接配置 ----
$PG_HOST = "127.0.0.1"
$PG_PORT = "5432"
$PG_USER = "postgres"
$PG_PASS = "123456"
$DB_NAME = "zhishu"

# ---- 2. 检查 Python ----
Write-Host "`n[1/5] 检查 Python..." -ForegroundColor Yellow
try {
    $pyVer = python --version 2>&1
    Write-Host "  ✅ $pyVer"
} catch {
    Write-Host "  ❌ 未找到 Python，请先安装 Python 3.11+" -ForegroundColor Red
    exit 1
}

# ---- 3. 检查 PostgreSQL ----
Write-Host "`n[2/5] 检查 PostgreSQL..." -ForegroundColor Yellow
$pgBin = ""
$possiblePaths = @(
    "D:\2026test\PostgreSQL\18\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\14\bin"
)
foreach ($p in $possiblePaths) {
    if (Test-Path "$p\psql.exe") {
        $pgBin = $p
        break
    }
}
if (-not $pgBin) {
    # 尝试系统 PATH
    try {
        $null = & psql --version 2>&1
        $pgBin = ""  # psql 在 PATH 中
    } catch {
        Write-Host "  ❌ 未找到 PostgreSQL，请先安装" -ForegroundColor Red
        exit 1
    }
}

$env:PGPASSWORD = $PG_PASS
if ($pgBin) {
    $psql = "$pgBin\psql.exe"
    $createdb = "$pgBin\createdb.exe"
} else {
    $psql = "psql"
    $createdb = "createdb"
}

# 测试连接
try {
    $ver = & $psql -U $PG_USER -h $PG_HOST -p $PG_PORT -t -c "SELECT version()" 2>&1
    Write-Host "  ✅ PostgreSQL 连接成功"
} catch {
    Write-Host "  ❌ 无法连接 PostgreSQL (host=$PG_HOST port=$PG_PORT user=$PG_USER)" -ForegroundColor Red
    Write-Host "     请确认 PostgreSQL 已启动，密码正确" -ForegroundColor Yellow
    exit 1
}

# ---- 4. 创建数据库 ----
Write-Host "`n[3/5] 创建数据库 $DB_NAME..." -ForegroundColor Yellow
$dbExists = & $psql -U $PG_USER -h $PG_HOST -p $PG_PORT -t -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>&1
if ($dbExists -match "1") {
    Write-Host "  ✅ 数据库 $DB_NAME 已存在"
} else {
    & $createdb -U $PG_USER -h $PG_HOST -p $PG_PORT $DB_NAME 2>&1
    Write-Host "  ✅ 数据库 $DB_NAME 创建完成"
}

# ---- 5. 创建 Python 虚拟环境 + 安装依赖 ----
Write-Host "`n[4/5] 安装 Python 依赖..." -ForegroundColor Yellow
$venvPath = Join-Path $PSScriptRoot "..\venv"
if (-not (Test-Path "$venvPath\Scripts\python.exe")) {
    Write-Host "  创建虚拟环境..."
    & python -m venv $venvPath
}
& "$venvPath\Scripts\pip.exe" install -q -r (Join-Path $PSScriptRoot "..\requirements.txt") -i https://pypi.tuna.tsinghua.edu.cn/simple
Write-Host "  ✅ 依赖安装完成"

# ---- 6. 创建 .env（如不存在）----
Write-Host "`n[5/5] 检查配置文件..." -ForegroundColor Yellow
$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) {
    @"
# MiniMax-M3 API Key（开发阶段用，上线前切讯飞星火 V4）
MINIMAX_API_KEY=your_minimax_api_key_here
MINIMAX_BASE_URL=https://api.minimax.chat/v1
MINIMAX_MODEL=MiniMax-M3

# PostgreSQL
DATABASE_URL=postgresql+asyncpg://postgres:${PG_PASS}@${PG_HOST}:${PG_PORT}/${DB_NAME}

# Redis
REDIS_URL=redis://${PG_HOST}:6379/0
"@ | Set-Content -Path $envFile -Encoding UTF8
    Write-Host "  ⚠️  已创建 .env 请填写 MINIMAX_API_KEY" -ForegroundColor Yellow
} else {
    Write-Host "  ✅ .env 已存在"
}

# ---- 完成 ----
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  ✅ 初始化完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n启动后端:" -ForegroundColor Cyan
Write-Host "  cd backend" -ForegroundColor White
Write-Host "  .\venv\Scripts\activate" -ForegroundColor White
Write-Host "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor White
Write-Host "`nSwagger UI: http://localhost:8000/docs" -ForegroundColor Cyan
