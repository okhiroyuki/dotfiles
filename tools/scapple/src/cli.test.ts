import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = new URL("../bin/scapple.ts", import.meta.url).pathname;

interface RunResult {
  stdout: string;
  stderr: string;
  status: number;
}

function run(args: string[], input?: string): RunResult {
  try {
    const stdout = execFileSync("node", ["--import", "tsx", CLI, ...args], {
      input: input ?? "",
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", status: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", status: err.status ?? 1 };
  }
}

function tempFile(name: string, content: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "scapple-")), name);
  writeFileSync(path, content);
  return path;
}

const INPUT = JSON.stringify({
  notes: [
    { id: 0, text: "豆を挽く" },
    { id: 1, text: "お湯を注ぐ" },
    { id: 2, text: "味", pointsTo: [1] },
  ],
  stacks: [[0, 1]],
});

test("buildが標準入力を読んで標準出力に.scapを書く", () => {
  const { stdout, status } = run(["build"], INPUT);
  assert.equal(status, 0);
  assert.match(stdout, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(stdout, /<String>豆を挽く<\/String>/);
});

test("buildが-oで指定したファイルに書き出す", () => {
  const out = join(mkdtempSync(join(tmpdir(), "scapple-")), "out.scap");
  const { stdout, status } = run(["build", "-o", out], INPUT);
  assert.equal(status, 0);
  assert.equal(stdout, "");
  assert.match(readFileSync(out, "utf-8"), /<String>味<\/String>/);
});

test("buildがファイル引数からも標準入力からも同じ結果を出す", () => {
  // ドキュメントIDは実行ごとに変わるので、比較対象から外す。
  const strip = (xml: string) => xml.replace(/ ID="[0-9A-F-]{36}"/, "");
  const path = tempFile("in.json", INPUT);
  assert.equal(strip(run(["build", path]).stdout), strip(run(["build", "-"], INPUT).stdout));
});

test("CLIを通しても.scapとJSONを往復できる", () => {
  const scap = join(mkdtempSync(join(tmpdir(), "scapple-")), "out.scap");
  run(["build", "-o", scap], INPUT);
  const doc = JSON.parse(run([scap]).stdout);
  assert.deepEqual(
    doc.notes.map((n: { text: string }) => n.text),
    ["豆を挽く", "お湯を注ぐ", "味"],
  );
  assert.deepEqual(doc.notes[2].pointsTo, [1]);
  assert.deepEqual(doc.stacks, [[0, 1]]);
});

test("既存の.scap変換が壊れていない", () => {
  const scap = join(mkdtempSync(join(tmpdir(), "scapple-")), "out.scap");
  run(["build", "-o", scap], INPUT);
  const { stdout, status } = run([scap, "--format", "text"]);
  assert.equal(status, 0);
  assert.match(stdout, /\[0\] 豆を挽く/);
  assert.match(stdout, /\[スタック\]/);
});

test("JSONとして壊れた入力を終了コード1で拒否する", () => {
  const { stderr, status } = run(["build"], "notjson");
  assert.equal(status, 1);
  assert.match(stderr, /JSONとして解析できませんでした/);
});

test("スキーマに合わない入力を終了コード1で拒否する", () => {
  const { stderr, status } = run(["build"], '{"notes":[{"id":0,"connectedTo":[9]}]}');
  assert.equal(status, 1);
  assert.match(stderr, /存在しないノートID 9/);
});

test("読み込めないファイルを終了コード1で拒否する", () => {
  assert.equal(run(["build", "/nonexistent/x.json"]).status, 1);
  assert.equal(run(["/nonexistent/x.scap"]).status, 1);
});

test("未知の出力形式を終了コード1で拒否する", () => {
  const scap = join(mkdtempSync(join(tmpdir(), "scapple-")), "out.scap");
  run(["build", "-o", scap], INPUT);
  const { stderr, status } = run([scap, "--format", "yaml"]);
  assert.equal(status, 1);
  assert.match(stderr, /未知の形式/);
});

test("引数なしと--helpで使い方を表示して正常終了する", () => {
  for (const args of [[], ["--help"]]) {
    const { stdout, status } = run(args);
    assert.equal(status, 0);
    assert.match(stdout, /scapple build/);
  }
});
