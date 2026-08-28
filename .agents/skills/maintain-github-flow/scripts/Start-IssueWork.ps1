[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateRange(1, [int]::MaxValue)]
    [int]$IssueNumber,

    [ValidatePattern("^(feature|fix|docs|refactor|chore|perf)/[a-z0-9][a-z0-9._-]*$")]
    [string]$BranchName,

    [string]$Repository = "hrkz777/youtube-video-filter"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")
$gh = Get-Command gh -ErrorAction Stop

Push-Location $repositoryRoot
try {
    $changes = & git status --porcelain
    if ($LASTEXITCODE -ne 0) { throw "Git状態の取得に失敗しました。" }
    if ($changes) { throw "未コミット変更があります。Issue作業の開始を中止しました。" }

    $issueJson = & $gh.Source issue view $IssueNumber --repo $Repository `
        --json number,title,state,labels,body,url
    if ($LASTEXITCODE -ne 0) { throw "Issue #$IssueNumber の取得に失敗しました。" }
    $issue = $issueJson | ConvertFrom-Json
    if ($issue.state -ne "OPEN") { throw "Issue #$IssueNumber はOPENではありません。" }

    Write-Host "[Issue]"
    $issueJson

    & git fetch origin --prune
    if ($LASTEXITCODE -ne 0) { throw "originの取得に失敗しました。" }

    & git switch main
    if ($LASTEXITCODE -ne 0) { throw "mainへの切り替えに失敗しました。" }

    & git merge --ff-only origin/main
    if ($LASTEXITCODE -ne 0) { throw "mainをfast-forwardできませんでした。" }

    if ($BranchName) {
        $localBranch = & git branch --list $BranchName --format="%(refname)"
        if ($LASTEXITCODE -ne 0) { throw "ローカルブランチの確認に失敗しました。" }
        if ($localBranch) { throw "ローカルブランチ $BranchName は既に存在します。" }

        $remoteBranch = & git branch --remotes --list "origin/$BranchName" --format="%(refname)"
        if ($LASTEXITCODE -ne 0) { throw "リモートブランチの確認に失敗しました。" }
        if ($remoteBranch) { throw "リモートブランチ origin/$BranchName は既に存在します。" }

        & git switch -c $BranchName
        if ($LASTEXITCODE -ne 0) { throw "作業ブランチ $BranchName の作成に失敗しました。" }
    }

    Write-Host "[同期後の状態]"
    & git status --short --branch
    if ($LASTEXITCODE -ne 0) { throw "同期後のGit状態を取得できませんでした。" }
}
finally {
    Pop-Location
}
