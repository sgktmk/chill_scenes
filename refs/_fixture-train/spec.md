# _fixture-train — Pipeline test fixture (not a real scene)

レイヤー分割パイプライン（`layers.json` + マスク + 部品PNG）の動作検証用
フィクスチャ。`make-fixture.mjs` が PNG を再生成する。実シーンとしては
公開しない — レンダリング確認は `templates/layered-demo.html` で行う。

## 検証している構造

- **窓外スクロール**: `scenery.png`（240×80、周期120pxのループ素材）が
  `cabin` レイヤーの透明な窓穴の**奥**を流れる
- **ドア開閉**: `mask-door.png` で `base.png` からドアを切り出し、
  切り出し跡は自動で穴になる。ドアは `cabin` の**背面**レイヤーなので、
  左へスライドすると壁の裏に隠れる（ペイント順による遮蔽）
- **つり革スイング**: `part-strap.png`（11×24 部品スプライト）を
  `at: [55, 8]` に配置し、`pivot: [60, 9]` を軸に回転

## 再生成と検証

```bash
node refs/_fixture-train/make-fixture.mjs
node tools/validate-refs.mjs refs/_fixture-train
node tools/png2pixel.mjs --manifest refs/_fixture-train/layers.json
tools/screenshot.sh "templates/layered-demo.html?pose=0.05" /tmp/closed.png
tools/screenshot.sh "templates/layered-demo.html?pose=0.5"  /tmp/open.png
```
