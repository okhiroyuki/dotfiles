# bpmn-open

BPMN ファイルをブラウザの編集画面（[bpmn-js](https://bpmn.io/toolkit/bpmn-js/) の Modeler）で開き、保存するとそのファイルへ書き戻す CLI。Zed には BPMN を図として表示する拡張が無いため、Zed のタスクからこの CLI を呼んで図を編集する。

## セットアップ

初回のみ、グローバルコマンドとしてインストールする。ソースへのリンクとして入るので、ソースを直すと再インストールなしで反映される。

```bash
cd ~/dotfiles
mise run install:bpmn-open
```

Zed から使う場合は、`config/zed/tasks.json` を rcup でリンクする（`~/.config/zed/tasks.json` になる）。

## 使い方

```bash
bpmn-open <file.bpmn>   # ファイルが無ければ新規の図で始め、保存時に作る
```

127.0.0.1 の空いているポートでサーバーが立ち、ブラウザで編集画面が開く。保存は「保存」ボタンか Cmd+S で行う。サーバーは Ctrl+C で止めるまで動く。

Zed では、`.bpmn` ファイルを開いた状態でコマンドパレットの「task: spawn」から「BPMN を編集画面で開く」を選ぶ。

## 動作

- 座標（`bpmndi`）が無い XML は、開くときに [bpmn-auto-layout](https://github.com/bpmn-io/bpmn-auto-layout) で自動配置する。保存すると座標がファイルに書き込まれる。
  - bpmn-auto-layout は各ノードの `<bpmn:incoming>`/`<bpmn:outgoing>` をたどって配置する。そのため、それが無い XML では `sequenceFlow` の `sourceRef`/`targetRef` から補ってから配置する。補わないと、図形が縦一列に並び矢印が描かれない。
  - レーンとプールは bpmn-auto-layout が座標を出力しないため描かれない。レーン付きの図は、この編集画面で座標付きで描いて保存する。
- 開いた後にファイルが外（Zed など）で変更されていたら、保存を断って上書きしない。「ファイルから読み直す」で取り込んでから直す。
- ファイルの読み書きには、起動ごとに作るトークン（URL の `#` の後ろ）が要る。トークンの無いリクエストは 403 で断る。

## 開発

```bash
mise run test:bpmn-open                                  # 自動配置のテスト
BPMN_OPEN_NO_BROWSER=1 node bin/bpmn-open.mjs x.bpmn     # ブラウザを開かずに起動する
```
