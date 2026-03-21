# Plan: L2 Create scene templates and slash commands

## 目的

新しいピクセルアートシーンを安定した品質で追加するためのテンプレートとスラッシュコマンドを整備する。

---

## スコープ

- `templates/scene.html` — 標準化されたシーン HTML テンプレート（セクションコメント、パターン例、TODO マーク付き）
- `templates/card-snippet.html` — index.html カードテンプレート
- `.claude/commands/new-scene.md` — `/new-scene` スラッシュコマンド（7ステップのオーケストレーション）
- `.claude/commands/refine-scene.md` — `/refine-scene` スラッシュコマンド（フィードバック反映）
- `.claude/commands/scene-audit.md` — `/scene-audit` スラッシュコマンド（品質監査）
- `CLAUDE.md` にシーン作成システムの説明を追加

## 非スコープ

- 実際のシーン制作
- エージェント実装（別ループ）

---

## Acceptance Criteria

- [ ] `templates/scene.html` が完全なスケルトンを提供する
- [ ] テンプレート内のコメントが各セクションの役割と期待値を明確にしている
- [ ] `/new-scene`, `/refine-scene`, `/scene-audit` がスラッシュコマンドとして利用可能
- [ ] CLAUDE.md に シーン作成システムの説明が記載されている

---

## 変更対象候補

- `templates/scene.html` （新規）
- `templates/card-snippet.html` （新規）
- `.claude/commands/new-scene.md` （新規）
- `.claude/commands/refine-scene.md` （新規）
- `.claude/commands/scene-audit.md` （新規）
- `CLAUDE.md` （更新）

---

## 実装ステップ

1. uke-chord プロジェクトの PIV loop 構造を研究
2. `templates/` ディレクトリを作成
3. テンプレートファイルを実装（パターン例、TODO コメント付き）
4. `.claude/commands/` にスラッシュコマンド定義を作成
5. CLAUDE.md を更新

---

## Validation Commands

```bash
# スキルがロードされているか確認
/reload-plugins
# /new-scene, /refine-scene, /scene-audit が表示されるか確認
```

## 手動確認

- [ ] テンプレートファイルが存在する
- [ ] スラッシュコマンドが `/` から見つかる
- [ ] コマンドの説明が適切か
