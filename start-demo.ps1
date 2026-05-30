# start-demo.ps1 — Launch the Nora demo stack
#
# Usage:
#   .\start-demo.ps1              # Full stack (nora-mobile + web research + banking/investment)
#   .\start-demo.ps1 -Minimal     # nora-mobile only (no Luca services)
#   .\start-demo.ps1 -NoAgent     # nora-mobile + web research (no banking/investment agent)
#
# Stop with: .\stop-demo.ps1

param(
    [switch]$Minimal,
    [switch]$NoAgent
)

$Root    = $PSScriptRoot
$Nora    = Join-Path $Root "nora-mobile"
$Luca    = Join-Path $Root "luca"
$PidFile = Join-Path $Root ".demo-pids"

if (Test-Path $PidFile) {
    Write-Host ""
    Write-Host "A demo session may already be running (.demo-pids exists)." -ForegroundColor Yellow
    Write-Host "Run stop-demo.ps1 first, or delete .demo-pids manually." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

function Start-Server {
    param([string]$Title, [string]$WorkDir, [string]$Command)

    # No -NoExit: when the server command ends, this terminal closes automatically.
    $ps = "Set-Location -LiteralPath '$WorkDir'; `$Host.UI.RawUI.WindowTitle = '$Title'; Write-Host '--- $Title ---' -ForegroundColor Cyan; try { $Command } finally { exit }"

	$p = Start-Process powershell `
    -WindowStyle Minimized `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $ps `
    -PassThru
	
    return $p.Id
}

$windowPids = @()

Write-Host ""
Write-Host "Starting nora-mobile  (port 3001)..." -ForegroundColor Cyan
$windowPids += Start-Server -Title "nora-mobile :3001" -WorkDir $Nora -Command "npm run dev"
Start-Sleep -Seconds 2

if (-not $Minimal) {
    Write-Host "Starting Luca web research  (port 8001)..." -ForegroundColor Cyan
    $windowPids += Start-Server -Title "Luca web :8001" -WorkDir $Luca -Command "uv run uvicorn server:app --port 8001 --reload"
    Start-Sleep -Seconds 2
}

if (-not $Minimal -and -not $NoAgent) {
    Write-Host "Starting Luca agent API  (port 8000)..." -ForegroundColor Cyan
    $windowPids += Start-Server -Title "Luca agent :8000" -WorkDir $Luca -Command "uv run uvicorn api:app --port 8000 --reload"
    Start-Sleep -Seconds 2
}

$windowPids | Out-File -FilePath $PidFile -Encoding utf8

Write-Host ""
Write-Host "Demo started." -ForegroundColor Green
Write-Host ""
Write-Host "  UI               ->  http://localhost:3001" -ForegroundColor White
if (-not $Minimal) {
    Write-Host "  Web research     ->  http://localhost:8001/health" -ForegroundColor White
}
if (-not $Minimal -and -not $NoAgent) {
    Write-Host "  Agent API        ->  http://localhost:8000/health" -ForegroundColor White
}
Write-Host ""
Write-Host "Stop with: .\stop-demo.ps1" -ForegroundColor Gray
Write-Host ""
Start-Sleep -Seconds 0
exit
