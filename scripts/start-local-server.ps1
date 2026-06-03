param(
  [int]$Port = 4317,
  [int]$MonitorIntervalSeconds = 10
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$HealthUrl = "http://127.0.0.1:$Port/api/health"
$PidPath = Join-Path $ProjectRoot "dev-server.pid"

function Test-LocalHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $HealthUrl -TimeoutSec 2
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
  } catch {
    return $false
  }
}

function Repair-PathEnvironment {
  $pathValue = [Environment]::GetEnvironmentVariable("Path", "Process")
  if (-not $pathValue) {
    $pathValue = [Environment]::GetEnvironmentVariable("PATH", "Process")
  }

  Remove-Item Env:\PATH -ErrorAction SilentlyContinue

  if ($pathValue) {
    [Environment]::SetEnvironmentVariable("Path", $pathValue, "Process")
  }
}

function Get-NodePath {
  $bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if (Test-Path $bundledNode) {
    return $bundledNode
  }

  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    return $nodeCommand.Source
  }

  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    return $nodeCommand.Source
  }

  throw "Node.js was not found. Please install Node.js 20+ or run this from the Codex desktop environment."
}

function Watch-LocalServer {
  Write-Host "AI Cooking Coach is running at http://127.0.0.1:$Port"
  Write-Host "Keep this cmd window open while generating cooking plans."
  Write-Host "Press Ctrl+C or close this window when you are finished."

  while ($true) {
    Start-Sleep -Seconds $MonitorIntervalSeconds
    if (-not (Test-LocalHealth)) {
      Write-Host "AI Cooking Coach is no longer responding at $HealthUrl"
      exit 1
    }
  }
}

Repair-PathEnvironment

if (Test-LocalHealth) {
  Write-Host "AI Cooking Coach is already running at $HealthUrl"
  Watch-LocalServer
}

$nodePath = Get-NodePath

$processInfo = [System.Diagnostics.ProcessStartInfo]::new()
$processInfo.FileName = $nodePath
$processInfo.Arguments = "server.mjs"
$processInfo.WorkingDirectory = $ProjectRoot
$processInfo.UseShellExecute = $false
$processInfo.EnvironmentVariables["PORT"] = [string]$Port

$process = [System.Diagnostics.Process]::Start($processInfo)
$process.Id | Set-Content -Path $PidPath -Encoding ASCII
$process.WaitForExit()
exit $process.ExitCode
