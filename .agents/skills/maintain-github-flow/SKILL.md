---
name: maintain-github-flow
description: このリポジトリで作業ブランチの開始、コミット、push、Pull Request作成、CI確認、競合解消、マージ後の同期とブランチ整理を行うときに使用する。実装設計の代替には使用しない。
---

# GitHub Flow保守

## 作業開始

1. `scripts/Get-WorkflowStatus.ps1`で作業ツリー、現在ブランチ、未完了PRを確認する。
2. 作業ツリーがクリーンであることを確認する。
3. 最新の`origin/main`から目的別ブランチを作る。
4. 1つのPRを単一目的に限定する。

## コミットとPR

- コミットは論理的な責務ごとに分け、Conventional Commits形式の日本語で記述する。
- push、PR作成・更新、レビュー対応、チェック確認は個別確認なしで進める。
- PR本文へ変更内容、確認方法、影響範囲、実機確認事項、関連Issueを書く。
- PRをマージしない。マージはユーザーが手動で行う。

## 後続PRと競合

- 独立した変更は`main`から別ブランチを作る。
- 先行変更が必要ならStacked PRとし、直前の親ブランチをbaseにする。
- 公開済みブランチのrebaseとforce pushは、対象と影響を説明して明示的許可を得る。
- 許可なく履歴を書き換えない。競合解消でmainをマージする場合は、両変更のテスト登録やimportを消していないか確認する。
- 親PRのマージ後は後続PRを直ちに再確認する。

## マージ後

1. `scripts/Sync-AfterMerge.ps1`を実行してmainをfast-forwardする。
2. マージ済みブランチも削除するときだけ`-DeleteMergedBranches`を付ける。
3. 未完了PR、CI、作業ツリーを再確認する。

## Issue操作

- Issueの書き込みは、リポジトリのAGENTS.mdで指定されたGitHub Appラッパーを使う。
- PRとGit操作には従来のユーザー認証を使う。
- 複数Issueの変更前には対象、変更前後、理由を表で示し、承認後に一括更新する。
