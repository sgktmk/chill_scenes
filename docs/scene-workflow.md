# 新シーン作成ワークフロー（画像 → 動くドット絵シーン）

構図を画像で用意し、それを元に Claude Code が動き・音つきのシーンへ移植するための手順書。

```
あなたが作る画像 (PNG)
   ↓ ① tools/png2pixel.mjs（縮小 + パレット量子化 → JSデータ）
静的背景データ
   ↓ ② PixelBuffer.fromImage() → SVG 出力（templates/scene-template.html がベース）
   ↓ ③ spec.md の指示に従って動き・音を実装
   ↓ ④ tools/screenshot.sh で元画像と見比べて検証
完成シーン
```

## 1. 素材を用意する（人間の作業）

`refs/<scene-name>/` ディレクトリを作り、以下を置く:

| ファイル | 必須 | 内容 |
|---|---|---|
| `base.png` | ✅ | 構図の元画像 |
| `spec.md` | ✅ | 動き・音の指示書（`refs/_template/spec.md` をコピーして記入） |
| `mask-*.png` | 任意 | 動かす領域の指定（透過背景に領域だけ塗ったPNG） |

### 画像づくりのコツ

- **推奨解像度**: 240×160（GBA調）または 320×180。この解像度ぴったりで
  作れなくてもよい — 高解像度の画像（AI生成の「ドット絵風」画像など）は
  変換時に縮小・量子化される。ただし**縦横比は合わせておく**（3:2 か 16:9）。
- **色数はできるだけ絞る**（変換時に最大32色に量子化される。グラデーションや
  アンチエイリアスが多いと量子化で潰れる）。
- **空は透明にしておくとベスト**。昼夜サイクルで空をバンド状に動的描画する
  ため、空部分が透過PNGなら変換時に自動で `'none'`（透明インデックス）になる。
  塗ってあっても構わない（spec.md に「空は無視」と書けば実装時に対処する）。
- インターレースPNG（Adam7）は非対応。書き出し時にオフにする。

### spec.md の書き方

`refs/_template/spec.md` をコピーして記入する。動き・音は箇条書きで
「何が・どこで・どのくらいの頻度で」が書いてあれば十分。既存シーン
（seascape / campfire / snowy-forest / rice-terrace）に似た要素があれば
「〜と同じ感じ」で通じる。

## 2. Claude Code に依頼する

素材をコミットしたら、次のように依頼する:

> refs/onsen/ の base.png と spec.md からシーンを作って

Claude Code は `.claude/skills/port-scene/`（ポーティング手順のスキル）に
従って以下を行う:

1. `base.png` を見て構図を把握し、`spec.md` を読む
2. `node tools/png2pixel.mjs refs/onsen/base.png -w 240 -h 160` で変換
3. `templates/scene-template.html` をベースに `onsen.html` を作成
4. 動き・音を spec.md に沿って実装
5. `tools/screenshot.sh` で各時間帯を撮影し、`base.png` と見比べて調整
6. `index.html` のカード追加・`vercel.json`・`CLAUDE.md` の更新

## 3. ツールリファレンス

### tools/png2pixel.mjs — PNG → ピクセルデータ変換

```bash
node tools/png2pixel.mjs refs/onsen/base.png -w 240 -h 160          # 標準出力へ
node tools/png2pixel.mjs refs/onsen/base.png -w 240 -h 160 -o /tmp/onsen.js
node tools/png2pixel.mjs refs/onsen/mask-water.png -w 240 -h 160 --mask
```

| オプション | 意味 |
|---|---|
| `-w` / `-h` | 出力解像度（片方だけ指定すると縦横比から自動計算） |
| `--colors N` | 最大色数（既定 32、最大 52） |
| `--name ID` | 出力するJS定数名（既定: ファイル名から生成） |
| `--mask` | マスクモード: 不透明ピクセル→1、透明→0 |
| `-o file` | ファイルへ出力 |

出力は `{ w, h, palette, data }` のJS定数。透明ピクセルがあれば
`palette[0]` が `'none'` になる。読み込み側:

```javascript
const pb = PixelBuffer.fromImage(SCENE_IMG);   // 全体を読み込み
pb.blit(SPRITE_IMG, 40, 100);                  // (40,100)へ貼り付け（'none'はスキップ）
const mask = PixelBuffer.decodeRLE(MASK.data); // マスクは生インデックス配列として
```

### tools/screenshot.sh — ヘッドレス撮影

```bash
tools/screenshot.sh "onsen.html?t=0.3" day.png      # 昼（?t= で位相固定）
tools/screenshot.sh "onsen.html?t=0.85" night.png   # 夜
tools/screenshot.sh "onsen.html?t=0.62" dusk.png 960x600 4000  # サイズ・待機ms指定
```

ローカルHTMLは自動で一時HTTPサーバー経由で開かれる（共有JSが
ルート絶対パス `/shared/...` のため `file://` では動かない）。

### shared/cycle.js — 昼夜サイクル

キーフレーム補間エンジン。`?t=0.25` をURLに付けると位相が固定される。

```javascript
const cycle = createCycle({ cycle: 180, startOffset: 0.10, keyframes: [
  { p: 0.00, top: '#3a4878', br: 0.72, ni: 0.18 },  // チャンネル名は自由
  { p: 0.22, top: '#3f83dc', br: 1.05, ni: 0.00 },  // hex色/数値/配列を補間
]});
const K = cycle.sample(cycle.phase()); // → { top: 'rgb(..)', br: 0.9, ni: 0.1 }
```

### shared/audio-kit.js — プロシージャル音声

```javascript
engine = createAudioEngine(vol);                    // AudioContext + マスターゲイン
const wind = engine.filteredNoise({ type: 'bandpass', freq: 520, Q: 0.7, gain: 0.05 });
engine.ramp(wind.gain, 0.08, 3);                    // 3秒かけてスウェル
engine.schedule(fn, 10000, 30000);                  // 10〜30秒間隔でランダム実行
engine.stop();                                      // タイマー全解除 + close
```

一発ものの音（鳥の声・ししおどし等）はオシレーター＋ゲインエンベロープで
シーン側に書く。既存実装の例: rice-terrace（虫・トンビ・カエル）、
snowy-forest（フクロウ）、seascape（海鳥・コオロギ）。

## 4. 品質チェックリスト

- [ ] `base.png` と昼のスクリーンショットの構図・色が一致している
- [ ] 昼（t=0.3）・夕（t=0.62）・夜（t=0.85）・明け方（t=0.97）で破綻がない
- [ ] spec.md の動き・音がすべて実装されている
- [ ] `?t=` デバッグパラメータが効く
- [ ] `prefers-reduced-motion` でCSSアニメーションが止まる
- [ ] index.html にカード追加、CLAUDE.md 更新（vercel.json は `cleanUrls` が全体設定のため変更不要）
