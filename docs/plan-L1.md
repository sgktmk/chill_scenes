# Plan: L1 Extract PixelBuffer helper from snowy-forest

## 目的

snowy-forest.html に内在するピクセル描画プリミティブ（sp, fr, fe, ft, PRNG, RLE SVG出力）を `shared/pixel.js` に抽出し、今後のピクセルアートシーン制作で再利用可能にする。

---

## スコープ

- `shared/pixel.js` に `PixelBuffer` クラスを実装（描画プリミティブ + PRNG + RLE SVG出力）
- snowy-forest.html をリファクタして `PixelBuffer` を使うように変更
- 既存の描画ロジックは変わらない（視覚的には同じ）

## 非スコープ

- 他のシーン（seascape, campfire）への PixelBuffer 適用（別ループ）
- 新規シーン作成（別ループ）
- パフォーマンス最適化

---

## Acceptance Criteria

- [ ] `shared/pixel.js` が 160行程度で実装される
- [ ] snowy-forest.html が PixelBuffer を使って正常に動作する
- [ ] ブラウザで `/snowy-forest` を開くと、変更前と視覚的に同じシーンが表示される
- [ ] アニメーション（月のシマー、星のまたたき、雪のパーティクル）が正常に動作する
- [ ] 音声の toggle・volume control が正常に動作する

---

## 変更対象候補

- `shared/pixel.js` （新規）
- `snowy-forest.html` （既存コード削除、PixelBuffer 使用に）
- `CLAUDE.md` （ファイル一覧更新）

---

## 実装ステップ

1. snowy-forest.html から描画ヘルパー（sp, fr, fe, ft, PRNG）を分析
2. `shared/pixel.js` に `PixelBuffer` クラスを実装
3. snowy-forest.html をリファクタ（ローカルラッパー経由で PixelBuffer を使う）
4. ブラウザで動作確認

---

## Validation Commands

```bash
python3 -m http.server 8000
# Open http://localhost:8000/snowy-forest
```

## 手動確認

- [ ] シーンが正しく描画される（月、星、木、雪、地面）
- [ ] 月のシマーが動く
- [ ] 星がまたたく
- [ ] 雪が降ってくる
- [ ] 音声パネルが動く
- [ ] コンソールエラーなし
