# プロジェクト構造

## 目的

YouTubeの動画へ、WebGPUを使用したAnime4Kアップスケーリング、カラーレンジ変換、一般的な映像調整をリアルタイムに適用するManifest V3 Chrome拡張機能です。映像処理は端末内で完結し、動画フレームを外部へ送信しません。

このファイルはリポジトリを探索するための索引です。挙動や設定について内容が食い違う場合は、実際のソースコード、`public/manifest.json`、`package.json`、`build.mjs`を優先してください。

## 主要ディレクトリ

| パス | 責務 |
| --- | --- |
| `.agents/` | プロジェクト固有の開発・GitHub Flow保守手順と補助スクリプト |
| `.github/workflows/` | Pull Requestおよび`main`へのpushで実行するCodeQL解析 |
| `design/` | 拡張機能アイコンのデザイン素材 |
| `public/` | Manifest、PopupのHTML/CSS、Declarative Net Requestルールなどの静的配布素材 |
| `src/` | Background Service Worker、Content Script、Popup、WebGPU処理と共通ロジックの生成元 |
| `test/` | Node.jsで実行する決定的なテスト。Chrome API、WebGPU、DOMなどの境界は必要に応じてモックする |
| `dist/` | `npm run build`で再生成するChrome拡張機能の配布物。直接編集しない |

`node_modules/`と`dist/`はGit管理対象外です。

## エントリポイント

`build.mjs`はesbuildを使用し、次の3ファイルをChrome 113向けのIIFEへバンドルします。

| 生成元 | 配布物 | 役割 |
| --- | --- | --- |
| `src/background.js` | `dist/background.js` | タブ単位の設定を`chrome.storage.session`で管理するBackground Service Worker |
| `src/content.js` | `dist/content.js` | YouTubeの動画とプレイヤーを監視し、設定UIとWebGPU Rendererのライフサイクルを制御するContent Script |
| `src/popup.js` | `dist/popup.js` | 新しく開くYouTubeタブに使うデフォルト設定を`chrome.storage.local`へ保存するPopup |

`public/manifest.json`がこれらの配布物をBackground Service Worker、Content Script、Popupとして登録します。ビルド時には`public/`の静的ファイル、`design/icon.png`、`THIRD_PARTY_NOTICES.md`も`dist/`へコピーされます。

## 主要コンポーネント

### 設定とUI

- `src/settings-schema.js`: 設定キー、既定値、許容値、正規化、検証の唯一の定義元
- `src/background.js`: Content Scriptからの設定取得・更新・リセットメッセージを検証し、タブごとの処理を直列化
- `src/popup.js`: `chrome.storage.local`上のデフォルト設定を表示・保存
- `src/player-settings.js`: YouTubeプレイヤー内の設定メニュー、タブ上書き表示、統計表示を構築
- `src/anime4k-setting.js`: Anime4KのUI選択値と内部設定の変換
- `src/optimistic-setting.js`: プレイヤー設定の楽観的更新と保存失敗時の復元
- `src/settings-update.js`: 設定変更時に停止、再構築、表示用Uniform Bufferだけの更新のどれを行うか判定

### 映像処理

- `src/content.js`: 動画検出、Canvas配置、Anime4Kプリセット構築、画面サイズ変更・YouTube内遷移・タブ表示状態への追従、失敗時の元映像復元を統括
- `src/renderer.js`: 動画フレームをWebGPU Textureへ転送し、Anime4Kパイプライン、カラーレンジ変換、明るさ・コントラスト・彩度・ガンマ・色相調整を実行してCanvasへ描画
- `src/input-transfer.js`: 動画からの直接転送を使用できるか画素サンプルで検証。判定不能または不一致なら2D OffscreenCanvasとImageBitmapの互換経路を使用
- `src/webgpu-device.js`: 同一Content Script内で共有するWebGPU Deviceの取得、Device lost通知、ページ破棄時の解放
- `src/gpu-resources.js`: Renderer固有のTexture、Buffer、Anime4Kパイプライン資源を重複なく解放
- `src/filter-failure.js`: 動画・設定ごとの互換性エラーと再試行抑制を管理
- `src/resize-policy.js`: 表示サイズ変更時にRendererを再構築するか判定
- `src/video-viewport.js`: 動画の内在アスペクト比と`object-fit`を保つCanvasバッキング寸法を計算

Anime4Kパイプラインの実装には`anime4k-webgpu`を使用します。WebGPU DeviceはContent Script内で再利用し、Renderer停止時にはRenderer固有資源だけを解放します。

## データフロー

### 設定

1. Popupがデフォルト設定を`chrome.storage.local`へ保存します。
2. Content Scriptの起動時に、デフォルト設定とBackground Service Worker経由のタブ設定を取得します。
3. Background Service Workerはタブ設定を`chrome.storage.session`へ保存し、タブを閉じたときに削除します。
4. プレイヤー内UIからの変更は、`youtube-video-filter:set-tab-settings`メッセージで現在のタブ設定だけを更新します。
5. リセット時は`youtube-video-filter:reset-tab-settings`で、その時点のデフォルト設定からタブ設定を作り直します。
6. デフォルト設定の変更はContent Scriptが`chrome.storage.onChanged`で受け取ります。現在のタブではセッション設定が優先されるため、既存タブのフィルター設定は変更せず、セッション設定に含まれない診断設定だけを更新します。

### 映像

1. Content ScriptがYouTubeの`video`要素を検出し、表示領域に合わせたCanvasを配置します。
2. Rendererが動画フレームを入力Textureへ転送します。直接転送は初期画素検証に成功した環境だけで使用し、それ以外では2D CanvasとImageBitmapを経由します。
3. Content Scriptが設定に応じたAnime4Kパイプラインを構築し、Rendererがカラーレンジ変換と各映像調整を同じ表示パスで実行します。
4. 処理結果をWebGPU Canvasへ描画し、約1秒間隔の入出力FPS、解像度、フレーム破棄率をプレイヤー内UIへ渡します。
5. 初期化・実行時エラー、Device lost、互換性エラーでは処理を停止し、元の動画表示へ戻します。

`public/rules.json`は`*.googlevideo.com`のmediaレスポンスにYouTube向けCORSヘッダーを設定し、動画フレームをWebGPU入力として使用できるようにします。

## テスト

`test/`では、設定スキーマ、タブ設定、失敗時制御、GPU資源解放、動画転送判定、Rendererライフサイクル、リサイズ方針、設定更新、WebGPU Device再利用を個別に検証します。`test/validate.mjs`はビルド成果物のManifest、権限、バンドル内容、ライセンス通知などを検証します。

実GPUとYouTubeのDOMが必要な動作は自動テストに含めず、Pull Requestの手動確認項目として扱います。

## 開発コマンド

```powershell
npm install
npm run check
npm run build
npm test
```

- `npm run check`: `package.json`に列挙された生成元、ビルドスクリプト、テストのJavaScript構文を確認
- `npm run build`: `dist/`を削除して再作成し、JavaScriptのバンドルと静的ファイルのコピーを実行
- `npm test`: Node.jsテスト一式を実行。`test/validate.mjs`は事前に生成された`dist/`も検証するため、通常はビルド後に実行

独立した型チェックコマンドとlintコマンドはありません。CIではCodeQLによるJavaScript/TypeScript解析を実行します。
