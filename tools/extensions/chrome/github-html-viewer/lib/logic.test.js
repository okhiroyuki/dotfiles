const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isHtmlBlobPage, toRawUrl, deriveFileName, withBaseHref } = require('./logic.js');

test('isHtmlBlobPage: blobビューのhtml/htmファイルにマッチする', () => {
  assert.equal(isHtmlBlobPage('/owner/repo/blob/main/index.html'), true);
  assert.equal(isHtmlBlobPage('/owner/repo/blob/feature/x/page.htm'), true);
  assert.equal(isHtmlBlobPage('/owner/repo/blob/main/docs/deep/path/report.HTML'), true);
});

test('isHtmlBlobPage: html以外や非blobページにはマッチしない', () => {
  assert.equal(isHtmlBlobPage('/owner/repo/blob/main/index.js'), false);
  assert.equal(isHtmlBlobPage('/owner/repo/tree/main'), false);
  assert.equal(isHtmlBlobPage('/owner/repo/raw/main/index.html'), false);
});

test('toRawUrl: blobをrawに変換しquery/hashを除去する', () => {
  assert.equal(
    toRawUrl('https://github.com/owner/repo/blob/main/index.html?plain=1#L10'),
    'https://github.com/owner/repo/raw/main/index.html',
  );
});

test('deriveFileName: パスの末尾要素をファイル名として返す', () => {
  assert.equal(deriveFileName('/owner/repo/blob/main/docs/index.html'), 'index.html');
  assert.equal(deriveFileName('/owner/repo/blob/main/index.html'), 'index.html');
});

test('withBaseHref: head要素の直後にbaseタグを挿入する', () => {
  const html = '<html><head><title>t</title></head><body></body></html>';
  const result = withBaseHref(html, 'https://raw.githubusercontent.com/owner/repo/main/docs/index.html');
  assert.equal(
    result,
    '<html><head><base href="https://raw.githubusercontent.com/owner/repo/main/docs/">'
      + '<title>t</title></head><body></body></html>',
  );
});

test('withBaseHref: head要素がなければhtml要素の直後に挿入する', () => {
  const html = '<html><body>no head</body></html>';
  const result = withBaseHref(html, 'https://raw.githubusercontent.com/owner/repo/main/index.html');
  assert.equal(
    result,
    '<html><base href="https://raw.githubusercontent.com/owner/repo/main/"><body>no head</body></html>',
  );
});

test('withBaseHref: html要素もなければ先頭に挿入する', () => {
  const html = '<p>fragment</p>';
  const result = withBaseHref(html, 'https://raw.githubusercontent.com/owner/repo/main/index.html');
  assert.equal(
    result,
    '<base href="https://raw.githubusercontent.com/owner/repo/main/"><p>fragment</p>',
  );
});
