---
name: develop-youtube-video-filter
description: YouTube Video Filterの機能追加、不具合修正、性能改善、設定UI、WebGPU・Anime4K処理、Chrome拡張機能のビルドやテストを扱うときに使用する。一般的なGitHub運用だけの作業には使用しない。
---

# YouTube Video Filter開発

## 作業手順

1. 適用済みのAGENTS instructionsと`コーディング規約.md`を確認する。
2. 変更対象に応じて以下の参照資料だけを読む。
   - 設定、プレイヤーUI、タブ別状態: `references/settings-and-ui.md`
   - Anime4K、WebGPU、フレーム処理: `references/rendering.md`
3. 既存のモジュール境界と命名を維持し、生成物の`dist/`を直接編集しない。
4. 不具合修正では再現条件を特定し、可能な限り`test/`へ回帰テストを追加する。
5. 権限、外部通信、メッセージ処理を変更する場合は入力検証と最小権限を確認する。
6. 変更後に`scripts/Verify-Project.ps1`を実行する。
7. Chrome・YouTube・実GPUが必要な確認項目をPR本文へ明記する。

## 重要な制約

- フレーム処理が遅れた場合は時間同期を優先し、古いフレームを後追い処理しない。
- 複数タブは独立させ、GPU投入制御や設定状態をブラウザ全体で共有しない。
- 負荷に応じてFPSや画質を自動変更しない。統計を提示し、調整はユーザーへ委ねる。
- WebGPU失敗時は元映像へ安全に戻し、黒いCanvasを表示し続けない。
- プレイヤー内設定は現在のタブ、拡張機能ポップアップは新規タブのデフォルト値を扱う。

## 完了条件

- `Verify-Project.ps1`が成功する。
- ユーザー操作が変わる場合はREADMEを更新する。
- 実機確認が必要な事項を未確認のまま成功扱いにしない。
- 敵対的に改善余地を確認し、既存Issueと重複しない具体案だけをIssue化する。
