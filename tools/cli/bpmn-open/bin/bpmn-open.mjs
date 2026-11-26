#!/usr/bin/env node
// bpmn-open <file.bpmn>
// BPMN ファイルをブラウザの編集画面（bpmn-js）で開き、保存するとそのファイルへ書き戻す。
// 127.0.0.1 の空いているポートでサーバーを立て、Ctrl+C で止めるまで動く。
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { basename, dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureLayout } from '../lib/layout.mjs';

const MAX_BODY = 10 * 1024 * 1024;
const here = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(here, '../web');
const bpmnDist = resolve(dirname(fileURLToPath(import.meta.resolve('bpmn-js/package.json'))), 'dist');

const arg = process.argv[2];
if (!arg || arg === '-h' || arg === '--help') {
  console.error('usage: bpmn-open <file.bpmn>   (ファイルが無ければ新規に作る)');
  process.exit(arg ? 0 : 1);
}
if (arg === '__no_file__') {
  console.error('bpmn-open: Zed から開いているファイルを受け取れなかった。.bpmn ファイルのエディタにフォーカスしてから、もう一度タスクを実行する');
  process.exit(1);
}
const target = resolve(arg);
if (!['.bpmn', '.xml'].includes(extname(target).toLowerCase())) {
  console.error(`bpmn-open: ${arg} は .bpmn ファイルではない`);
  process.exit(1);
}
if (existsSync(target) && !(await stat(target)).isFile()) {
  console.error(`bpmn-open: ${arg} はファイルではない`);
  process.exit(1);
}
const token = randomBytes(16).toString('hex');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
  '.svg': 'image/svg+xml' };

async function mtimeOf(path) {
  return existsSync(path) ? String((await stat(path)).mtimeMs) : '0';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

// base 配下のファイルだけを返す（.. で外へ出られないようにする）
async function sendStatic(res, base, rel) {
  const path = normalize(join(base, rel));
  if (!path.startsWith(base + sep)) return send(res, 403, 'forbidden');
  try {
    send(res, 200, await readFile(path), { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
  } catch {
    send(res, 404, 'not found');
  }
}

function readBody(req) {
  return new Promise((ok, ng) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { ng(new Error('too large')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', ng);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      return sendStatic(res, webDir, 'modeler.html');
    }
    if (req.method === 'GET' && url.pathname.startsWith('/bpmn-js/')) {
      return sendStatic(res, bpmnDist, url.pathname.slice('/bpmn-js/'.length));
    }
    if (url.pathname === '/api/diagram') {
      if (req.headers['x-bpmn-open-token'] !== token) return send(res, 403, 'bad token');

      if (req.method === 'GET') {
        const raw = existsSync(target) ? await readFile(target, 'utf8') : '';
        const { xml, laidOut } = raw.trim() ? await ensureLayout(raw) : { xml: '', laidOut: false };
        return send(res, 200, JSON.stringify({ name: basename(target), path: target, xml, laidOut, mtime: await mtimeOf(target) }),
          { 'Content-Type': 'application/json' });
      }
      if (req.method === 'PUT') {
        // 開いた後にファイルが外で変更されていたら、上書きせずに断る
        if (req.headers['x-bpmn-open-mtime'] !== (await mtimeOf(target))) {
          return send(res, 409, 'ファイルが外で変更されている');
        }
        await writeFile(target, await readBody(req));
        console.error(`保存した: ${target}`);
        return send(res, 200, JSON.stringify({ mtime: await mtimeOf(target) }), { 'Content-Type': 'application/json' });
      }
    }
    send(res, 404, 'not found');
  } catch (err) {
    send(res, 500, String(err.message || err));
  }
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/#${token}`;
  console.error(`${target} を開いた: ${url}`);
  console.error('Ctrl+C で止める');
  if (!process.env.BPMN_OPEN_NO_BROWSER) execFile('open', [url]);
});
