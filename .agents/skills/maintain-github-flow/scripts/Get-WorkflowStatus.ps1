[CmdletBinding()]
param(
    [string]$Repository = "hrkz777/youtube-video-filter"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")
$gh = Get-Command gh -ErrorAction Stop

Push-Location $repositoryRoot
try {
    Write-Host "[ローカル状態]"
    & git status --short --branch
    if ($LASTEXITCODE -ne 0) { throw "Git状態の取得に失敗しました。" }

    Write-Host "[未完了Pull Request]"
    & $gh.Source pr list --repo $Repository --state open --limit 50 `
        --json number,title,headRefName,baseRefName,mergeStateStatus,url
    if ($LASTEXITCODE -ne 0) { throw "Pull Request一覧の取得に失敗しました。" }
}
finally {
    Pop-Location
}
