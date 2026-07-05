# Plan: L4 Test scene creation system with first new scene

## 目的

新しく構築したシーン制作システム（テンプレート、スラッシュコマンド、8つのエージェント）を実運用テストし、実際に高品質のピクセルアートシーンを1つ完成させる。

---

## スコープ

`/new-scene` を使ってシステムの全フローを実行し、品質基準を満たすシーンを1つ完成させる:

- Reference Analysis（既存パターン抽出）
- Palette Design（パレット設計）
- Scene Rendering（paintScene() 実装）
- Animation（アニメーション実装）
- Audio（音声設計実装）
- Preview Card（プレビュー SVG）
- Quality Review（監査）
- User Review（ブラウザ確認）

## 非スコープ

- 2つ以上のシーン制作
- システムの改善（別ループ）
- ユーザーフィードバック反映（別ループ）

---

## Acceptance Criteria

- [ ] `/new-scene "test-scene" "Test Scene" "description"` が実行でき、各ステップが完了する
- [ ] 完成したシーン（`test-scene.html`）がブラウザで正常に表示される
- [ ] アニメーション（CSS パーティクルと JS requestAnimationFrame）が動作する
- [ ] 音声パネルが toggle・volume control 両方で動作する
- [ ] `index.html` にカードが追加され、プレビュー SVG が表示される
- [ ] `CLAUDE.md` に記載される
- `/scene-audit test-scene` で品質チェックが全て PASS

---

## 変更対象候補

- `test-scene.html` （新規、制作対象）
- `index.html` （test-scene カード追加）
- `CLAUDE.md` （test-scene 記載）

---

## 実装ステップ

1. `/new-scene "test-scene" "Test Scene" "description"` を実行
2. 各エージェントステップが成功したか確認
3. `test-scene.html` をブラウザで開いて視覚的確認
4. 音声パネル、アニメーション、描画が期待通りか確認
5. `/scene-audit test-scene` で品質チェック
6. 必要な調整は `/refine-scene` で実施

---

## Validation Commands

```bash
python3 -m http.server 8000
# Open http://localhost:8000/test-scene
# Check:
#  - Scene renders correctly
#  - Animations work
#  - Audio controls work
#  - No console errors
```

## 手動確認

- [ ] Scene visual rendered correctly (sky, elements, foreground)
- [ ] CSS particle overlay animates
- [ ] JS requestAnimationFrame animations (shimmer, twinkle)
- [ ] Audio toggle works (🔇↔🔊)
- [ ] Volume slider adjusts gain
- [ ] Mute button works
- [ ] Preview card in index.html shows the scene
- [ ] No console errors or warnings
- [ ] `/scene-audit test-scene` reports all PASS
