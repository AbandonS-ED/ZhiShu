$ErrorActionPreference = 'Stop'
$env:PYTHONPATH = 'D:\桌面\软件杯项目\ZhiShu\backend'
Set-Location 'D:\桌面\软件杯项目\ZhiShu\backend'
& 'D:\桌面\软件杯项目\ZhiShu\backend\venv\Scripts\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8000