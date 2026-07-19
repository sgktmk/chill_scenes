# 新シーン作成ワークフロー（画像 → 動くドット絵シーン）

構図を画像で用意し、それを元に Claude Code が動き・音つきのシーンへ移植するための手順書。

```
あなたが作る画像 (base.png + 動くパーツのPNG群)
   ↓ ① tools/cutout.mjs（統一パレット量子化 → 背景 + パーツのスプライト分割）
背景データ + パーツデータ（+ 検証用プレビューPNG）
   ↓ ② PixelBuffer / createSprites() で描画（templates/scene-template.html がベース）
   ↓ ③ spec.md の指示に従って動き・音を実装（パーツは構造的に動く）
   ↓ ④ tools/screenshot.sh で元画像・各ポーズと見比べて検証
完成シーン
```

動くものが何もないシーンは従来どおり `tools/png2pixel.mjs` だけで変換できる。

## 1. 素材を用意する（人間の作業）

`refs/<scene-name>/` ディレクトリを作り、以下を置く:

| ファイル | 必須 | 内容 |
|---|---|---|
| `base.png` | ✅ | 構図の元画像。**全パーツがデフォルト状態で乗った完成形** |
| `spec.md` | ✅ | 動き・音・パーツの指示書（`refs/_template/spec.md` をコピーして記入） |
| `parts/NN-name.png` | 動くものがあるなら◎ | 動くパーツ1つにつき1枚（下記ルール参照） |
| `parts/NN-name@state.png` | 任意 | パーツの別状態（ドア開、翼上げなど） |
| `bg.png` | 任意（推奨） | 動くパーツを取り除いた背景 |
| `mask-name.png` | 任意 | パーツ画像を作れない場合の代替: 切り出す領域だけ塗った同サイズPNG |

### なぜパーツを分けるのか

動き（ドアの開閉、船の移動、鳥の羽ばたき…）を高品質にする鍵は、
**動くものを最初から独立した画像として渡す**こと。1枚絵から座標を推測して
ピクセルを揺らすような実装は品質が安定しない。パーツが分かれていれば:

- ドアが開けば**裏に描かれた背景（bg.png / 自動補完）が見える**
- パーツは位置ごと自動で切り出されるので、**座標の割り出しという誤りやすい
  工程が消える**
- 状態違いのファイルを置くだけでアニメのフレームになる

### パーツ画像のルール

- **base.png と同じキャンバスサイズの透過PNG**で、パーツをシーン内の位置に
  そのまま描く（別レイヤーを個別書き出しするだけなので、レイヤー機能のある
  ペイントツールなら手間は小さい）
- ファイル名 `NN-name.png`: NN は z 順（**小さいほど奥**）。例: `10-boat.png`
- 状態違いは `NN-name@state.png`（例: `20-door@open.png`）。**デフォルト状態
  （base.png に写っている状態）のファイルは必須**
- ドアの奥・物の陰など「パーツが動いてはじめて見える場所」が重要なシーンでは
  `bg.png`（パーツ抜きの背景全体）も書き出しておくと確実。無ければツールが
  周辺色から自動補完するが、複雑な背景では粗が出る

### 画像づくりのコツ

- **推奨解像度**: 240×160（GBA調）または 320×180。この解像度ぴったりで
  作れなくてもよい — 高解像度の画像（AI生成の「ドット絵風」画像など）は
  変換時に縮小・量子化される。ただし**縦横比は合わせておく**（3:2 か 16:9）。
- **色数はできるだけ絞る**（全素材合計で最大32色に量子化される。GB/GBC/GBA
  いずれの画風でもよいが、グラデーションやアンチエイリアスが多いと潰れる）。
- **空は透明にしておくとベスト**。昼夜サイクルで空をバンド状に動的描画する
  ため、空部分が透過PNGなら変換時に自動で `'none'`（透明インデックス）になる。
  塗ってあっても構わない（spec.md に「空は無視」と書けば実装時に対処する）。
- インターレースPNG（Adam7）は非対応。書き出し時にオフにする。

### spec.md の書き方

`refs/_template/spec.md` をコピーして記入する。動くパーツはテンプレートの
表に「ファイル・状態・動き方」を書く。音・その他の動きは箇条書きで
「何が・どこで・どのくらいの頻度で」が書いてあれば十分。既存シーン
（seascape / campfire / snowy-forest / rice-terrace）に似た要素があれば
「〜と同じ感じ」で通じる。

## 2. Claude Code に依頼する

素材をコミットしたら、次のように依頼する:

> refs/onsen/ の base.png と spec.md からシーンを作って

Claude Code は `.claude/skills/port-scene/`（ポーティング手順のスキル）に
従って以下を行う:

1. `base.png`・`parts/` を見て構図を把握し、`spec.md` を読む
2. `node tools/cutout.mjs refs/onsen -w 240 -h 160 --preview ...` で変換し、
   プレビューPNGで分割品質を確認（動くパーツが無ければ `png2pixel.mjs`）
3. `templates/scene-template.html` をベースに `onsen.html` を作成
4. 動き・音を spec.md に沿って実装（パーツは `shared/sprite.js` で構造的に動かす）
5. `tools/screenshot.sh` で各時間帯・各ポーズを撮影し、`base.png` と見比べて調整
6. `index.html` のカード追加・`CLAUDE.md` の更新

## 3. ツールリファレンス

### tools/cutout.mjs — 背景 + 動くパーツへの分割

```bash
node tools/cutout.mjs refs/onsen -w 240 -h 160 -o /tmp/onsen.js --preview /tmp/onsen-prev
```

| オプション | 意味 |
|---|---|
| `-w` / `-h` | 出力解像度（必須） |
| `--colors N` | 最大色数（既定 32、最大 52。**全素材共通のパレット**） |
| `--name ID` | 出力するJS定数のプレフィックス（既定: ディレクトリ名） |
| `--preview dir` | 検証用プレビューPNG（背景 / 各パーツ / 合成 vs 参照）を出力 |
| `-o file` | ファイルへ出力 |

出力: `<NAME>_PALETTE`（統一パレット） / `<NAME>_BG`（背景） /
`<NAME>_PARTS`（パーツ群。状態ごとに `{ w, h, ox, oy, palette, data }`、
ox/oy はシーン内の元位置）。読み込み側:

```javascript
const pb = PixelBuffer.fromImage(ONSEN_BG);
pb.toSVG(document.getElementById('terrainG'));
const sprites = createSprites(document.getElementById('partsG'), ONSEN_PARTS);
sprites.door.setState('open');   // 状態切替（裏の背景が見える）
sprites.boat.moveBy(0.3, 0);     // シーン座標で移動
sprites.bird.setFlip(true);      // 左右反転
```

### tools/png2pixel.mjs — PNG → ピクセルデータ変換（1枚もの）

```bash
node tools/png2pixel.mjs refs/onsen/base.png -w 240 -h 160          # 標準出力へ
node tools/png2pixel.mjs refs/onsen/base.png -w 240 -h 160 -o /tmp/onsen.js
node tools/png2pixel.mjs extra-frame.png -w 240 -h 160 --palette 'none,#112233,#445566'
```

| オプション | 意味 |
|---|---|
| `-w` / `-h` | 出力解像度（片方だけ指定すると縦横比から自動計算） |
| `--colors N` | 最大色数（既定 32、最大 52） |
| `--name ID` | 出力するJS定数名（既定: ファイル名から生成） |
| `--mask` | マスクモード: 不透明ピクセル→1、透明→0 |
| `--palette L` | 量子化せず**指定パレットに固定**（カンマ区切り or JSONファイル）。変換済みシーンにフレームを追加するとき、インデックスを揃えるために使う |
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
tools/screenshot.sh "onsen.html?t=0.3&pose=open" open.png  # ポーズ強制（デバッグ用パラメータ）
tools/screenshot.sh "onsen.html?t=0.62" dusk.png 960x600 4000  # サイズ・待機ms指定
```

ローカルHTMLは自動で一時HTTPサーバー経由で開かれる（共有JSが
ルート絶対パス `/shared/...` のため `file://` では動かない）。

### tools/selftest.mjs — ツール群の自己テスト

```bash
node tools/selftest.mjs   # tools/ や shared/ を変更したら実行（ALL PASS を確認）
```

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

- [ ] cutout のプレビューで、背景にパーツの残骸が無い / インペイントが破綻していない
- [ ] `base.png` と昼のスクリーンショットの構図・色が一致している
- [ ] 動くパーツがすべて `createSprites()` のスプライトとして実装されている
      （フラット画像のピクセルを揺らす・にじませる実装は不可）
- [ ] パーツの各状態・ポーズをデバッグ用URLパラメータで再現でき、
      スクリーンショットで確認済み（例: ドア開時に裏の背景が見える）
- [ ] 昼（t=0.3）・夕（t=0.62）・夜（t=0.85）・明け方（t=0.97）で破綻がない
- [ ] spec.md の動き・音がすべて実装されている
- [ ] `?t=` デバッグパラメータが効く
- [ ] `prefers-reduced-motion` でCSSアニメーションが止まる
- [ ] index.html にカード追加、CLAUDE.md 更新（vercel.json は `cleanUrls` が全体設定のため変更不要）
