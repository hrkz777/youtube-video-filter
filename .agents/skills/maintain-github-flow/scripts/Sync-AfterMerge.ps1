[CmdletBinding()]
param(
    [switch]$DeleteMergedBranches
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")

Push-Location $repositoryRoot
try {
    $changes = & git status --porcelain
    if ($LASTEXITCODE -ne 0) { throw "Git状態の取得に失敗しました。" }
    if ($changes) { throw "未コミット変更があります。mainの同期を中止しました。" }

    & git fetch origin main
    if ($LASTEXITCODE -ne 0) { throw "origin/mainの取得に失敗しました。" }

    & git switch main
    if ($LASTEXITCODE -ne 0) { throw "mainへの切り替えに失敗しました。" }

    & git merge --ff-only origin/main
    if ($LASTEXITCODE -ne 0) { throw "mainをfast-forwardできませんでした。" }

    if ($DeleteMergedBranches) {
        & git delete-merged-branch
        if ($LASTEXITCODE -ne 0) { throw "マージ済みブランチの削除に失敗しました。" }
    }

    & git status --short --branch
    if ($LASTEXITCODE -ne 0) { throw "同期後のGit状態を取得できませんでした。" }
}
finally {
    Pop-Location
}
