# stop-demo.ps1 — Stop all Nora demo processes and close their terminals

$Root    = $PSScriptRoot
$PidFile = Join-Path $Root ".demo-pids"

Write-Host ""
Write-Host "Stopping Nora demo..." -ForegroundColor Cyan
Write-Host ""

function Stop-ProcessTree {
    param([int]$ProcessId, [string]$Label = "process")

    if ($ProcessId -le 0) { return }

    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $proc) { return }

    # taskkill /T kills the whole child process tree. This matters for npm and uvicorn --reload.
    & taskkill.exe /PID $ProcessId /T /F | Out-Null
    Write-Host "  Killed $Label tree  PID $ProcessId  ($($proc.ProcessName))" -ForegroundColor Gray
}

$killed = @{}

# 1) Kill the terminal/window process trees that start-demo.ps1 saved.
# This is usually the most reliable path because it kills PowerShell + npm/node/uvicorn children.
if (Test-Path $PidFile) {
    $windowPids = Get-Content $PidFile | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ }

    foreach ($windowPid in $windowPids) {
        if (-not $killed.ContainsKey($windowPid)) {
            Stop-ProcessTree -ProcessId $windowPid -Label "terminal"
            $killed[$windowPid] = $true
        }
    }

    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

# 2) Fallback: kill anything still listening on the demo ports.
# This catches orphaned node/python processes if the terminal PID was stale.
$ports = @(3001, 8000, 8001)

foreach ($port in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            $serverPid = [int]$conn.OwningProcess
            if ($serverPid -and $serverPid -ne 0 -and -not $killed.ContainsKey($serverPid)) {
                Stop-ProcessTree -ProcessId $serverPid -Label ":$port server"
                $killed[$serverPid] = $true
            }
        }
    } catch {
        Write-Host "  Port $port`: $_" -ForegroundColor DarkGray
    }
}

if ($killed.Count -eq 0) {
    Write-Host "  No demo processes found." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 0
exit
