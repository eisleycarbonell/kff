
$ErrorActionPreference = "Stop"

$root = "C:\kff"

function Invoke-Checked {
    param([scriptblock]$Command)

    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE"
    }
}

try {
    Write-Host "Updating source code..." -ForegroundColor Cyan

    Set-Location $root
    Invoke-Checked { git pull --ff-only origin main }

    Write-Host "Stopping applications..." -ForegroundColor Yellow

    Stop-Service KFFFrontend
    Stop-Service KFFBackend

    Write-Host "Building backend..." -ForegroundColor Cyan

    Set-Location "$root\backend"
    Invoke-Checked { npm ci --include=dev }
    Invoke-Checked { npm run build }

    Write-Host "Building frontend..." -ForegroundColor Cyan

    Set-Location "$root\frontend"
    Invoke-Checked { npm ci --include=dev }
    Invoke-Checked { npm run build }

    Write-Host "Starting applications..." -ForegroundColor Cyan

    Start-Service KFFBackend
    Start-Service KFFFrontend

    Get-Service KFF*

    Write-Host "Deployment completed." -ForegroundColor Green
}
catch {
    Write-Host "Deployment failed: $_" -ForegroundColor Red
    exit 1
}
