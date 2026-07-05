# Plan: L3 Create eight sub-agents for scene creation

## 目的

新しいシーン制作に特化した8つのエージェントを実装し、各工程で Claude の判断と実装を効果的に分離する。

---

## スコープ

8つの専用エージェント定義（`.claude/agents/` に配置）:
1. `reference-analyzer` — 既存シーンからパターン抽出
2. `palette-designer` — 32色パレット設計（美的・技術的観点）
3. `scene-renderer` — paintScene() 実装（最重要、Opus 使用）
4. `animation-designer` — JS/CSS アニメーション実装
5. `audio-designer` — Web Audio プロシージャル音声設計
6. `scene-scaffolder` — ボイラープレート生成・統合ファイル更新
7. `preview-card-designer` — index.html プレビューカード作成
8. `quality-reviewer` — 品質監査・チェックリスト確認

## 非スコープ

- スキル（`/new-scene` など）の修正（別ループ）
- 実際のシーン制作テスト

---

## Acceptance Criteria

- [ ] 8つのエージェント定義ファイルが `.claude/agents/` に存在
- [ ] 各エージェントが適切な `tools` と `model` を指定している
- [ ] `/agents` で 8つのエージェントが表示される
- [ ] 各エージェントの `description` が Claude の自動委譲を適切にガイドしている

---

## 変更対象候補

- `.claude/agents/reference-analyzer.md` （新規）
- `.claude/agents/palette-designer.md` （新規）
- `.claude/agents/scene-renderer.md` （新規）
- `.claude/agents/animation-designer.md` （新規）
- `.claude/agents/audio-designer.md` （新規）
- `.claude/agents/scene-scaffolder.md` （新規）
- `.claude/agents/preview-card-designer.md` （新規）
- `.claude/agents/quality-reviewer.md` （新規）

---

## 実装ステップ

1. 各エージェントの役割を明確に定義
2. エージェント定義ファイルを作成（Sonnet/Opus 指定）
3. 各エージェントの `tools` を最小必要に絞る
4. `/reload-plugins` で読み込み確認

---

## Validation Commands

```bash
/reload-plugins
/agents
```

## 手動確認

- [ ] `/agents` で 8つ全て表示される
- [ ] 各エージェントの description が明確
- [ ] 各エージェントの tools が適切
