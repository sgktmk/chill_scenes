# Chill Scenes

A collection of relaxing, animated web scenes built with pure vanilla HTML, CSS, and JavaScript. No frameworks, no build tools, no dependencies.

Each scene features pixel-art visuals rendered with SVG and procedurally generated ambient audio powered by the Web Audio API.

## Scenes

### Seascape

A full day-night cycle over the sea. Watch ships drift across three depth lanes as the sky transitions through 11 color keyframes over 180 seconds. Procedural audio layers include brown noise, wave surges, foam hiss, wind, seabird calls (daytime), and cricket chirps (nighttime).

### Campfire

A pixel-art campfire under a starry sky. Multi-layered flames flicker with independent CSS animations while sparks and smoke wisps rise from the fire. Shooting stars streak across the sky. Procedural audio provides a warm crackle over layered brown noise.

### Astronaut Drift

A chill pixel-art astronaut stays fixed near the left-middle edge while the surrounding space scrolls sideways. Multiple depth layers (nebula haze, far stars, near stars, and cosmic dust) move at different speeds to create a calm parallax drift. Ambient procedural audio adds a soft sci-fi hum.

## Getting Started

No build step required. Just open `index.html` in a browser, or serve locally:

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

## Project Structure

```
index.html          — Landing page hub
seascape.html       — Seascape scene
campfire.html       — Campfire scene
astronaut_drift.html — Astronaut Drift scene
shared/
  scene-ui.css      — Shared audio panel & back button styles
  scene-ui.js       — Shared audio control logic
favicon.svg         — Site favicon
vercel.json         — Vercel clean URL routing
```

## Tech Stack

- **HTML / CSS / JavaScript** — No frameworks or libraries
- **SVG** — Pixel-art rendering with `crispEdges`
- **Web Audio API** — All sounds generated procedurally in the browser (no audio files)
- **CSS Animations** — Flame flicker, star twinkle, spark trajectories
- **Vercel** — Static site hosting with clean URLs

---

# Chill Scenes（日本語）

リラックスできるアニメーション付きWebシーンのコレクションです。ピュアなバニラ HTML、CSS、JavaScript で構築されており、フレームワーク、ビルドツール、外部依存は一切ありません。

各シーンは SVG によるピクセルアート風のビジュアルと、Web Audio API によるプロシージャル（手続き的）生成の環境音を特徴としています。

## シーン

### Seascape（海景）

海の上で繰り広げられる昼夜サイクル。180秒かけて空が11色のキーフレームを遷移する中、3つの奥行きレーンを船が横切ります。ブラウンノイズ、波のうねり、泡の音、風、カモメの鳴き声（昼間）、コオロギの鳴き声（夜間）など、多層のプロシージャルオーディオが楽しめます。

### Campfire（焚き火）

星空の下に揺れるピクセルアートの焚き火。複数レイヤーの炎がそれぞれ独立したCSSアニメーションで揺らめき、火の粉や煙が立ち上ります。流れ星が夜空を横切ることもあります。ブラウンノイズの上にパチパチという焚き火の音が重なるプロシージャルオーディオです。

### Astronaut Drift（宇宙飛行士）

左側中央付近に固定されたピクセルアートの宇宙飛行士を中心に、星や宇宙塵、星雲が横方向へ流れるシーンです。奥行きごとに速度を変えたパララックスで、ゆったり漂うような雰囲気を表現しています。音は穏やかなプロシージャル生成のSFアンビエンスです。

## はじめかた

ビルドは不要です。ブラウザで `index.html` を開くか、ローカルサーバーを起動してください：

```bash
python3 -m http.server 8000
# http://localhost:8000 を開く
```

## プロジェクト構成

```
index.html          — ランディングページ（ハブ）
seascape.html       — Seascape シーン
campfire.html       — Campfire シーン
astronaut_drift.html — Astronaut Drift シーン
shared/
  scene-ui.css      — 共有オーディオパネル・戻るボタンのスタイル
  scene-ui.js       — 共有オーディオ制御ロジック
favicon.svg         — サイトファビコン
vercel.json         — Vercel クリーンURL設定
```

## 技術スタック

- **HTML / CSS / JavaScript** — フレームワーク・ライブラリ不使用
- **SVG** — `crispEdges` によるピクセルアート描画
- **Web Audio API** — すべての音をブラウザ内でプロシージャル生成（音声ファイル不使用）
- **CSS Animations** — 炎の揺らめき、星の瞬き、火の粉の軌跡
- **Vercel** — クリーンURLによる静的サイトホスティング
