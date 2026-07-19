import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIdRange } from "./id-range.js";

test("undefinedと空文字は空配列を返す", () => {
  assert.deepEqual(parseIdRange(undefined), []);
  assert.deepEqual(parseIdRange(""), []);
});

test("単一の数値をパースする", () => {
  assert.deepEqual(parseIdRange(4), [4]);
  assert.deepEqual(parseIdRange("4"), [4]);
});

test("カンマ区切りとハイフン範囲が混在する文字列をパースする", () => {
  assert.deepEqual(parseIdRange("13, 20-22, 28, 31, 34"), [13, 20, 21, 22, 28, 31, 34]);
});

test("降順の範囲もパースする", () => {
  assert.deepEqual(parseIdRange("5-3"), [5, 4, 3]);
});

test("数値化できない断片は無視する", () => {
  assert.deepEqual(parseIdRange("1, x, 3"), [1, 3]);
});
