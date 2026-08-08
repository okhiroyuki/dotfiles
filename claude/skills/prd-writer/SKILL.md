---
name: prd-writer
description: Writes, drafts, or restructures a PRD (Product Requirements Document / 要件定義書 / プロダクト要求仕様書) in Japanese using a fixed 11-section template — summary, background/problem, goals & success metrics, stakeholders, timeline & scope, system overview, user scenarios, screen mockups, prerequisites/constraints, open issues, Q&A log. MUST trigger on any request to produce a PRD for a feature or product, including phrasings like "PRDを書いて/作って/まとめて", "◯◯機能のPRDが欲しい", "この機能アイデアを要件ドキュメントにして", "既存のPRDをテンプレートに合わせて整形して" — even without the literal word "PRD" if the ask is for a Why/What-level requirements doc to hand off to stakeholders and engineers. Interviews the user section by section instead of guessing, keeps content at Why/What only and never How (no tech stack, architecture, or implementation approach), and refines prose sections via the japanese-tech-writing skill. Do not use for technical design docs, architecture decision records (ADR), meeting notes, or after-the-fact documentation of an already-shipped feature.
model: opus
---

# PRD作成

## 目的

関係者にWhy（なぜやるか）とWhat（何をやるか）を理解してもらい、後続のエンジニアに要件をパスするためのPRDを作成する。
**How（どう実装するか）には踏み込まない。** 技術選定・実装方式の提案が混ざりそうになったら、それは設計ドキュメント側の責務として除外する。

## 原則

- **Why/What の純度**: Howが混入した瞬間に、PRDは設計ドキュメントに変質する。エンジニアが「なぜ作るか」を自分で考える余地を奪わない。
- **空欄より TBD**: 憶測で埋めた文章は後工程を誤誘導する。わからないことはわからないと書く。
- **サマリーは最後**: 全体像が固まる前に書いたサマリーは嘘をつく。

## テンプレート

セクション構成は [references/template.md](references/template.md) に固定されている。順序・見出し・表の列を変えない。

セクション順: サマリー → 背景・問題定義 → 目標・成功指標 → 関係者 → タイムラインとスコープ → システム概要 → ユーザーシナリオ → 画面イメージ → 前提条件・依存関係・制約 → オープンイシュー → Q&A・意思決定ログ

## 進め方

1. `references/template.md` を読み込み、コピーして作業ファイルとする。
2. 対象のプロダクト・機能が何かをユーザーに確認する（曖昧なまま埋め始めない）。
3. セクションを順番に埋める。各セクションで情報が不足している場合は、憶測で埋めずユーザーに質問する。特に以下は省略しやすいので注意する：
   - 「目標・成功指標」の数値KPI（定性的な言葉だけで済ませない）
   - 「タイムラインとスコープ」のスコープ外
   - 「システム概要」のmermaid図（文章だけで済ませず、簡易でも図を描く）
4. 「サマリー」は他のセクションを埋め終えてから最後に書く（全体像が固まってから3〜5行に要約する方が精度が高い）。
5. 各セクションの記述がHowに踏み込んでいないか確認する。実装方法・技術スタック・ライブラリ名などが出てきたら、その記述を削除するかオープンイシューへ移す。
6. 文章として書くセクション（サマリー、背景・問題定義、ユーザーシナリオなど）は `japanese-tech-writing` スキルの規範に従って推敲する。
7. 完成したPRDをユーザーに提示し、レビューを受ける。

## アウトプット

- ファイル名: `prd-{機能名}-{YYYY-MM-DD}.md`
- 保存先: ユーザーが指定した場所。未指定の場合はファイルを作らず、チャット上にインラインで提示する。

## 対象外（このスキルを使わないケース）

- 技術設計ドキュメント（Howに踏み込む必要があるもの）
- アーキテクチャ決定記録（ADR）
- 会議メモ・議事録
- すでに実装済みの機能の事後ドキュメント化

## 成功基準

- 全11セクションが揃っている（画面イメージのみTODOで許容）
- サマリーが3〜5行で、関係者が読んで概要を把握できる
- 目標・成功指標の表に数値KPIが入っている（「TBD」の場合はオープンイシューに記載されている）
- スコープ外が具体的に列挙されている（空欄のまま提出していない）
- How（実装方法・技術選定）に関する記述が本文に残っていない
- システム概要にmermaid図が含まれている
- 憶測で埋めた空欄がなく、不明点は「TBD」またはオープンイシューとして明示されている
- 文章セクションが `japanese-tech-writing` スキルの規範で推敲されている
