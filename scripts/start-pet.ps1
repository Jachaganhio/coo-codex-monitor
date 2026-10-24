param([string]$Coopanion = 'C:\code\Coopanion')
$ErrorActionPreference = 'Stop'
$monitorRoot = Split-Path $PSScriptRoot -Parent
$env:CORTICO_COMPANION_DATA = Join-Path $monitorRoot '.local\coopanion-data'
$env:COO_MONITOR_CONNECTION = Join-Path $monitorRoot '.local\connection.json'
if (-not (Test-Path -LiteralPath $env:COO_MONITOR_CONNECTION)) { throw 'Start Task Bridge first.' }
Push-Location $Coopanion
try { node node_modules/electron/cli.js . } finally { Pop-Location }
