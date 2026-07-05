# Plan: L5 Implement missing roadmap features (OGP, screenshots)

## 目的

Future Roadmap に記載された次のフェーズ（OGP メタタグ、スクリーンショット機能、SNS シェア）を実装する。このループでは OGP メタタグと基本的なスクリーンショット機能に焦点を当てる。

---

## スコープ

- **OGP メタタグ**: 全シーンの `<head>` に OpenGraph / Twitter Card メタタグを追加
  - `og:title`, `og:description`, `og:image` (static preview image from card SVG)
  - `twitter:card`, `twitter:image`
- **Screenshot Capture**: SVG scene → Canvas → PNG 変換機能を実装
  - UI パネルに「📷 Capture」ボタンを追加
  - `shared/scene-capture.js` で SVG to Canvas to PNG 変換

## 非スコープ

- SNS Share ボタン実装（別ループ）
- Social Media 自動投稿機能
- OGP 画像の動的生成（static preview image のみ）

---

## Acceptance Criteria

- [ ] 全シーン（seascape, campfire, snowy-forest）に OGP メタタグが追加される
- [ ] リンクプレビュー（Twitter, Facebook）で scene title と description が表示される
- [ ] Screenshot Capture ボタンが全シーンの音声パネルに表示される
- [ ] 「Capture」ボタンをクリックすると PNG ファイルがダウンロードされる
- [ ] キャプチャ時刻がタイムスタンプとして PNG ファイル名に含まれる

---

## 変更対象候補

- `seascape.html`, `campfire.html`, `snowy-forest.html` （OGP メタタグ追加）
- `shared/scene-ui.html` （Capture ボタン追加）
- `shared/scene-ui.js` （Capture ボタンハンドラー）
- `shared/scene-capture.js` （新規、SVG to PNG 変換）
- `CLAUDE.md` （更新）

---

## 実装ステップ

1. OGP メタタグテンプレートを設計
2. 全シーンに OGP メタタグを手動追加（またはジェネレータースクリプト作成）
3. `shared/scene-capture.js` を実装（html2canvas API 使用）
4. 音声パネルに Capture ボタンを追加
5. ブラウザで動作確認

---

## Validation Commands

```bash
python3 -m http.server 8000
# Open each scene and test:
#  - Capture button visible
#  - PNG downloads with correct filename
# Open each scene URL in Twitter/Facebook OGP preview tester
```

## 手動確認

- [ ] OGP メタタグが HTML に存在する
- [ ] Twitter Card Preview で scene card が表示される
- [ ] Capture ボタンをクリックして PNG がダウンロードされる
- [ ] PNG ファイル名にタイムスタンプが含まれる
- [ ] キャプチャされた PNG が scene snapshot を正確に表現している
