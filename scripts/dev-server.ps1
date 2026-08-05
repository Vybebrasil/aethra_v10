param(
    [ValidateSet('start', 'stop', 'restart', 'status')]
    [string]$Action = 'start',
    [ValidateRange(1024, 65535)]
    [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$serverUrl = "http://127.0.0.1:$Port/"
$runtimeRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'aethra-dev-server'
$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
    $projectHash = $sha256.ComputeHash(
        [System.Text.Encoding]::UTF8.GetBytes($projectRoot.ToLowerInvariant())
    )
} finally {
    $sha256.Dispose()
}
$projectKey = ([System.BitConverter]::ToString($projectHash) -replace '-', '').Substring(0, 12).ToLowerInvariant()
$pidPath = Join-Path $runtimeRoot "$projectKey-$Port.pid"
$stdoutPath = Join-Path $runtimeRoot "$projectKey-$Port.out.log"
$stderrPath = Join-Path $runtimeRoot "$projectKey-$Port.err.log"

function Test-AethraServer {
    try {
        $response = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content -match 'id="game-container"'
    } catch {
        return $false
    }
}

function Get-TrackedProcess {
    if (-not (Test-Path -LiteralPath $pidPath)) {
        return $null
    }

    $trackedPid = 0
    if (-not [int]::TryParse((Get-Content -LiteralPath $pidPath -Raw).Trim(), [ref]$trackedPid)) {
        Remove-Item -LiteralPath $pidPath -Force
        return $null
    }

    $process = Get-Process -Id $trackedPid -ErrorAction SilentlyContinue
    if (-not $process) {
        Remove-Item -LiteralPath $pidPath -Force
    }
    return $process
}

function Stop-AethraServer {
    $process = Get-TrackedProcess
    if ($process) {
        try {
            Stop-Process -Id $process.Id -ErrorAction Stop
            if (-not $process.WaitForExit(3000)) {
                throw "O processo PID $($process.Id) nao encerrou em 3 segundos."
            }
        } catch {
            throw "Nao foi possivel parar o servidor rastreado (PID $($process.Id)). $($_.Exception.Message)"
        }
    }
    if (Test-AethraServer) {
        throw "A porta $Port continua ocupada por um servidor que nao foi iniciado por este projeto."
    }
    if (Test-Path -LiteralPath $pidPath) {
        Remove-Item -LiteralPath $pidPath -Force
    }
    Write-Host "Servidor local parado." -ForegroundColor Yellow
}

function Resolve-PythonCommand {
    $python = Get-Command 'python' -ErrorAction SilentlyContinue
    if ($python) {
        return @{ FilePath = $python.Source; Arguments = @('-m', 'http.server') }
    }

    $launcher = Get-Command 'py' -ErrorAction SilentlyContinue
    if ($launcher) {
        return @{ FilePath = $launcher.Source; Arguments = @('-3', '-m', 'http.server') }
    }

    throw 'Python 3 nao foi encontrado. Instale o Python ou adicione python/py ao PATH.'
}

function Remove-DuplicatePathEnvironmentKey {
    # Alguns hosts (incluindo terminais baseados em Unix sobre Windows) podem
    # entregar Path e PATH ao mesmo tempo. O Start-Process do PowerShell 5.1
    # trata as chaves sem diferenciar maiusculas e falha ao copiar o ambiente.
    $pathKeys = @([System.Environment]::GetEnvironmentVariables().Keys | Where-Object {
        $_ -ieq 'path'
    })
    if ($pathKeys.Count -gt 1 -and $pathKeys -ccontains 'PATH') {
        Remove-Item -LiteralPath 'Env:PATH' -ErrorAction SilentlyContinue
    }
}

function Start-AethraServer {
    if (Test-AethraServer) {
        $process = Get-TrackedProcess
        $pidLabel = if ($process) { " - PID $($process.Id)" } else { " - processo nao rastreado" }
        Write-Host "Servidor ja esta online em $serverUrl$pidLabel" -ForegroundColor Green
        return
    }

    $staleProcess = Get-TrackedProcess
    if ($staleProcess) {
        Stop-Process -Id $staleProcess.Id -ErrorAction SilentlyContinue
        $staleProcess.WaitForExit(2000) | Out-Null
    }

    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
    $python = Resolve-PythonCommand
    $arguments = @($python.Arguments) + @($Port.ToString(), '--bind', '127.0.0.1')
    $startOptions = @{
        FilePath = $python.FilePath
        ArgumentList = $arguments
        WorkingDirectory = $projectRoot
        WindowStyle = 'Hidden'
        RedirectStandardOutput = $stdoutPath
        RedirectStandardError = $stderrPath
        PassThru = $true
    }
    Remove-DuplicatePathEnvironmentKey
    $process = Start-Process @startOptions

    Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding ascii

    for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
        if (Test-AethraServer) {
            Write-Host "Cronicas de Aethra online em $serverUrl" -ForegroundColor Green
            Write-Host "PID $($process.Id) - logs em $runtimeRoot" -ForegroundColor DarkGray
            return
        }
        if ($process.HasExited) {
            break
        }
        Start-Sleep -Milliseconds 250
    }

    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $pidPath) {
        Remove-Item -LiteralPath $pidPath -Force
    }
    $details = if (Test-Path -LiteralPath $stderrPath) {
        (Get-Content -LiteralPath $stderrPath -Tail 8) -join [Environment]::NewLine
    } else {
        'sem log de erro'
    }
    throw "O servidor nao respondeu em $serverUrl.`n$details"
}

switch ($Action) {
    'start' { Start-AethraServer }
    'stop' { Stop-AethraServer }
    'restart' {
        $trackedProcess = Get-TrackedProcess
        if ($trackedProcess) {
            Stop-AethraServer
        } elseif (Test-AethraServer) {
            throw "Aethra esta online na porta $Port, mas o processo nao pertence a este iniciador. Use 'start' para manter o servidor atual ou encerre-o manualmente antes de reiniciar."
        }
        Start-AethraServer
    }
    'status' {
        if (Test-AethraServer) {
            $process = Get-TrackedProcess
            $pidLabel = if ($process) { " - PID $($process.Id)" } else { " - processo nao rastreado" }
            Write-Host "ONLINE $serverUrl$pidLabel" -ForegroundColor Green
            exit 0
        }
        Write-Host "OFFLINE $serverUrl" -ForegroundColor Yellow
        exit 1
    }
}
