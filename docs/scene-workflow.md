# 新シーン作成ワークフロー（画像 → 動くドット絵シーン）

構図を画像で用意し、それを元に Claude Code が動き・音つきのシーンへ移植するための手順書。

```
あなたが作る画像 (PNG) ＋ 部分アニメがあれば layers.json（§1.5）
   ↓ ⓪ tools/validate-refs.mjs（素材の整合性チェック）
   ↓ ① tools/png2pixel.mjs（縮小 + パレット量子化 → JSデータ。
        layers.json があれば --manifest で全レイヤー一括変換）
静的背景データ / レイヤー別データ
   ↓ ② PixelBuffer.fromImage() / sceneToSVG() → SVG 出力
        （templates/scene-template.html がベース、レイヤー実例は layered-demo.html）
   ↓ ③ spec.md・layers.json の指示に従って動き・音を実装
   ↓ ④ tools/screenshot.sh で元画像と見比べて検証（可動部は両端ポーズも）
完成シーン
```

## 1. 素材を用意する（人間の作業）

`refs/<scene-name>/` ディレクトリを作り、以下を置く:

| ファイル | 必須 | 内容 |
|---|---|---|
| `base.png` | ✅ | 構図の元画像 |
| `spec.md` | ✅ | 動き・音の指示書（`refs/_template/spec.md` をコピーして記入） |
| `layers.json` | 部分アニメ時は✅ | レイヤー構造の定義（§1.5参照。`refs/_template/layers.json` をコピー） |
| `mask-<part>.png` | 任意 | base.png から切り出す可動部分（同サイズPNG、部分だけ不透明） |
| `part-<name>.png` | 任意 | 別レイヤーとして重ねる部品スプライト（透過背景） |

**どちらのモードで作るかの判断基準:**

- 動きが「全体の色変化・粒子・上に重ねるスプライト」だけ → `base.png` 1枚でよい
- 画像の**一部分だけ**を独立して動かす（ドア開閉・つり革の揺れ・窓の外だけ
  スクロール・前景の奥で何かが動く）→ **`layers.json` が必須**。1枚絵のままだと
  実装側が「どのピクセルが可動部か」を座標推定するしかなく、結果が安定しない。

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

## 1.5. 部分アニメーション — layers.json でレイヤーを定義する

「電車のドアだけ開閉」「つり革だけ揺れる」「窓枠は固定で外の景色だけ流れる」の
ような部分アニメーションは、**レイヤー構造を layers.json で明示的に定義する**。
生きた実例: `refs/_fixture-train/`（つり革・スライドドア・窓外スクロールの
テスト用フィクスチャ）とそのレンダリング結果 `templates/layered-demo.html`。

```json
{
  "name": "TRAM_SCENE",
  "resolution": { "w": 240, "h": 160 },
  "layers": [
    { "id": "sky",     "role": "background" },
    { "id": "view",    "role": "movable", "src": "part-view.png", "at": [0, 0],
      "motion": "scroll-x: 左へループ、240pxで繰り返し" },
    { "id": "door",    "role": "movable", "src": "base.png", "mask": "mask-door.png",
      "motion": "slide-x: 左へ26pxスライドして開く" },
    { "id": "cabin",   "role": "static",  "src": "base.png" },
    { "id": "strap",   "role": "movable", "src": "part-strap.png",
      "at": [100, 20], "pivot": [105, 21], "motion": "swing: pivot中心に±8°" }
  ]
}
```

### 仕組み（3つのルールだけ）

1. **配列の順番 = 描画順**（先頭が最背面）。遮蔽は描画順だけで表現する —
   「壁の裏に隠れるドア」はドアを cabin より**前**（配列で上）に置く。
2. **mask 付きレイヤーは base.png からの切り出し**。切り出した跡は、同じ src を
   使う mask なしレイヤーに**自動で透明の穴**があく。ドアが開くと穴から奥の
   レイヤーが見える。
3. **透明ピクセルは奥が見える**。base.png の窓を透明にしておけば、その奥に
   置いた景色レイヤーが窓越しに見える。

### レイヤーの書き方

| キー | 意味 |
|---|---|
| `id` | レイヤー名（英小文字・数字・ハイフン）。SVGの `<g id="L-<id>">` になる |
| `role` | `background`（src なし・動的コンテンツ用の空グループ）/ `static` / `movable` / `occluder`（前景） |
| `src` | 素材PNG。`at` なし = フルフレーム（縮小あり）、`at: [x,y]` あり = 部品（等倍配置） |
| `mask` | `mask-<part>.png` — src と同サイズ。不透明部分がこのレイヤーになる |
| `pivot` | `[x, y]` シーン座標。回転系の動きの軸。**揺れる物には必ず書く**（推定させない） |
| `anchor` | `[x, y]` 位置基準点（任意、実装への情報） |
| `motion` | 動きの説明（自由記述。`scroll-x` / `slide-x` / `swing` など + 補足） |

- 窓外スクロールのような素材は、シーン幅より**横長の part PNG**（例: 幅2倍、
  パターンがシーン幅で繰り返す）にして `at: [0, 0]` で置くとループできる。
- パレットは**全レイヤー共通で一括量子化**されるので、素材PNGを分けても
  色は破綻しない。

### 検証と変換

```bash
node tools/validate-refs.mjs refs/<scene>          # 素材の整合性チェック
node tools/png2pixel.mjs --manifest refs/<scene>/layers.json -o /tmp/scene.js
```

validate-refs は「mask と src のサイズ不一致」「pivot が画面外」「揺れる
レイヤーに pivot がない」等を実装前に検出する。変換出力は全レイヤーが
1つの共有パレットを持つ `{ w, h, palette, layers: [...] }` で、シーン側は:

```javascript
const els = PixelBuffer.sceneToSVG(svgEl, TRAM_SCENE); // 描画順に <g id="L-*">
els.door.setAttribute('transform', 'translate(-26 0)');            // スライド
els.strap.setAttribute('transform', 'rotate(8 105 21)');           // pivot回転
els.view.setAttribute('transform', 'translate(' + (-t % 240) + ' 0)'); // ループ
```

## 2. Claude Code に依頼する

素材をコミットしたら、次のように依頼する:

> refs/onsen/ からシーンを作って（layers.json があればそれに従う）

Claude Code は `.claude/skills/port-scene/`（ポーティング手順のスキル）に
従って以下を行う:

1. `node tools/validate-refs.mjs refs/onsen` で素材を検証
2. `base.png` を見て構図を把握し、`spec.md`（+ `layers.json`）を読む
3. 変換: `layers.json` があれば `--manifest`、なければ `base.png` を単体変換
4. `templates/scene-template.html` をベースに `onsen.html` を作成
   （レイヤー構成は `templates/layered-demo.html` が実例）
5. 動き・音を spec.md / layers.json の `motion` に沿って実装
6. `tools/screenshot.sh` で各時間帯・各ポーズを撮影し、`base.png` と見比べて調整
7. `index.html` のカード追加・`CLAUDE.md` の更新

## 3. ツールリファレンス

### tools/png2pixel.mjs — PNG → ピクセルデータ変換

```bash
node tools/png2pixel.mjs refs/onsen/base.png -w 240 -h 160          # 標準出力へ
node tools/png2pixel.mjs refs/onsen/base.png -w 240 -h 160 -o /tmp/onsen.js
node tools/png2pixel.mjs refs/onsen/mask-water.png -w 240 -h 160 --mask
node tools/png2pixel.mjs --manifest refs/tram/layers.json -o /tmp/tram.js  # レイヤー一括変換
```

| オプション | 意味 |
|---|---|
| `-w` / `-h` | 出力解像度（片方だけ指定すると縦横比から自動計算） |
| `--colors N` | 最大色数（既定 32、最大 52） |
| `--name ID` | 出力するJS定数名（既定: ファイル名から生成） |
| `--mask` | マスクモード: 不透明ピクセル→1、透明→0 |
| `--manifest f` | layers.json の全レイヤーを共有パレットで一括変換（§1.5） |
| `-o file` | ファイルへ出力 |

単体変換の出力は `{ w, h, palette, data }`、manifest 変換の出力は
`{ w, h, palette, layers: [...] }` のJS定数。透明ピクセルがあれば
`palette[0]` が `'none'` になる。読み込み側:

```javascript
const pb = PixelBuffer.fromImage(SCENE_IMG);   // 全体を読み込み
pb.blit(SPRITE_IMG, 40, 100);                  // (40,100)へ貼り付け（'none'はスキップ）
const mask = PixelBuffer.decodeRLE(MASK.data); // マスクは生インデックス配列として
const els = PixelBuffer.sceneToSVG(svgEl, SCENE); // manifest出力 → レイヤー別<g>
```

### tools/validate-refs.mjs — 素材の整合性チェック

```bash
node tools/validate-refs.mjs refs/onsen
```

実装を始める前に必ず通す。layers.json のスキーマ、参照PNGの存在・サイズ、
mask と src の寸法一致、pivot の画面内チェック、インターレースPNG検出などを
行い、エラーがあれば exit 1。素材を作った人間側のセルフチェックにも使える。

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

- [ ] `node tools/validate-refs.mjs refs/<scene>` がエラーなしで通る
- [ ] `base.png` と昼のスクリーンショットの構図・色が一致している
- [ ] 昼（t=0.3）・夕（t=0.62）・夜（t=0.85）・明け方（t=0.97）で破綻がない
- [ ] spec.md の動き・音がすべて実装されている
- [ ] layers.json の可動レイヤーがすべて `motion` どおりに動く
      （動きの両端ポーズをスクリーンショットで確認 — layered-demo の `?pose=` 方式）
- [ ] 可動部の移動先・回転軸が layers.json の値そのままで、コード内に
      推定座標のマジックナンバーがない
- [ ] `?t=` デバッグパラメータが効く
- [ ] `prefers-reduced-motion` でCSSアニメーションが止まる
- [ ] index.html にカード追加、CLAUDE.md 更新（vercel.json は `cleanUrls` が全体設定のため変更不要）
