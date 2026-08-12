# Anime4K for YouTube

YouTubeの動画へAnime4Kフィルターをリアルタイム適用する、Manifest V3対応のChrome拡張機能です。処理は端末上のWebGPUで完結し、動画フレームを外部へ送信しません。

## 特徴

- YouTubeだけで動作
- Anime4K v4.x Mode AのCNN復元・アップスケールパイプライン
- Anime4K v4.1 Low resolution experimentの推奨GAN/CNNパイプライン
- 表示領域に合わせた自動解像度調整（最大4096ピクセル）
- ポップアップから有効・無効を切り替え可能
- WebGPUが利用できない場合や初期化に失敗した場合は元の映像へ安全にフォールバック

## 開発版のインストール

```powershell
npm install
npm run build
```

1. Chromeで `chrome://extensions` を開く
2. 「デベロッパー モード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」を選択する
4. このプロジェクトの `dist` フォルダを指定する
5. YouTubeの動画ページを開き、ツールバーの拡張機能アイコンからAnime4Kを有効にする

## 技術上の注意

- Chrome 113以降とWebGPU対応GPUが必要です。
- YouTubeの動画配信元をWebGPUテクスチャとして利用するため、`*.googlevideo.com` のメディアレスポンスにYouTube向けCORSヘッダーを設定します。それ以外のサイトや通信には適用しません。
- HDR動画、DRM保護された動画、非常に高い解像度では、ブラウザやGPUの制約により適用できない場合があります。
- v4.1 Low resolution experimentは360p以下の動画だけで有効になります。公式推奨の `Restore GAN UUL → Upscale GAN x4 UUL → Restore CNN Soft M → Upscale CNN x2 M` を使用するため、通常モードより大幅に高いGPU性能とVRAMが必要です。
- 公式Anime4Kの安定版リリースはv4.0.1です。公式READMEでv4.1は低解像度向け実験として扱われています。本拡張は本家READMEに掲載されている第三者製WebGPU移植を使用するため、mpv向けGLSLファイルをそのまま実行するものではありません。

## 出典とライセンス

- [Anime4K](https://github.com/bloc97/Anime4K) — MIT License
- [Anime4K-WebGPU](https://github.com/Anime4KWebBoost/Anime4K-WebGPU) — MIT License

本プロジェクトの依存パッケージには、それぞれのライセンスが適用されます。
配布物には [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) を同梱します。
