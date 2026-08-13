[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")

Push-Location $repositoryRoot
try {
    $commands = @(
        @{ Name = "構文検査"; Arguments = @("run", "check") },
        @{ Name = "ビルド"; Arguments = @("run", "build") },
        @{ Name = "テスト"; Arguments = @("test") }
    )

    foreach ($command in $commands) {
        Write-Host "[$($command.Name)] npm $($command.Arguments -join ' ')"
        & npm @($command.Arguments)
        if ($LASTEXITCODE -ne 0) {
            throw "$($command.Name)に失敗しました。終了コード: $LASTEXITCODE"
        }
    }

    Write-Host "[差分検査] git diff --check"
    & git diff --check
    if ($LASTEXITCODE -ne 0) {
        throw "差分検査に失敗しました。終了コード: $LASTEXITCODE"
    }

    Write-Host "[状態] git status --short --branch"
    & git status --short --branch
    if ($LASTEXITCODE -ne 0) {
        throw "Git状態の取得に失敗しました。終了コード: $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}
