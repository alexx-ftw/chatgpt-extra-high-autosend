const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'chatgpt-extra-high.user.js'), 'utf8');
const header = source.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==/m)?.[0];
const meta = Object.fromEntries([...header.matchAll(/^\/\/\s+@(\S+)\s+(.+)$/gm)]
  .map(([, key, value]) => [key, value.trim()]));
const raw = 'https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/';

test('update and download URLs use the public stable GitHub endpoints', () => {
  assert.equal(meta.updateURL, raw + 'chatgpt-extra-high.meta.js');
  assert.equal(meta.downloadURL, raw + 'chatgpt-extra-high.user.js');
  for (const key of ['updateURL', 'downloadURL']) {
    const url = new URL(meta[key]);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.search + url.username + url.password + url.hash, '');
  }
});

test('generic script identity and unchanged permissions and execution context', () => {
  assert.equal(meta.name, 'ChatGPT - ?q= + Extra High + autoenviar');
  assert.equal(meta.namespace, 'chatgpt.extra-high-autosend');
  assert.equal(meta.grant, 'none');
  assert.equal(meta.match, 'https://chatgpt.com/*');
  assert.equal(meta.sandbox, 'raw');
  assert.equal(meta['inject-into'], 'page');
});

test('release version is newer than 1.3.1 and matches the diagnostic panel', () => {
  assert.match(meta.version, /^\d+\.\d+\.\d+$/);
  const current = meta.version.split('.').map(Number);
  const baseline = [1, 3, 1];
  const firstDifference = current.findIndex((n, i) => n !== baseline[i]);
  assert.ok(firstDifference >= 0 && current[firstDifference] > baseline[firstDifference]);
  assert.equal(source.match(/const VERSION = '([^']+)'/)[1], meta.version);
});

test('TXT distribution is byte-for-byte identical to the userscript', () => {
  assert.equal(fs.readFileSync(path.join(root, 'chatgpt-extra-high.txt'), 'utf8'), source);
});

test('lightweight update file exists and contains only the matching header', () => {
  const file = path.join(root, 'chatgpt-extra-high.meta.js');
  assert.ok(fs.existsSync(file), 'Missing metadata-only update file');
  assert.equal(fs.readFileSync(file, 'utf8'), header + '\n');
});


test('diagnostic helper uses the generic project name', () => {
  assert.ok(/window\.__chatgptExtraHighDebug =/.test(source));
});


test('runtime is unchanged from v1.3.3 except successful panel dismissal', () => {
  const { execFileSync } = require('node:child_process');
  const previous = execFileSync('git', ['show', 'v1.3.3:chatgpt-extra-high.user.js'], {cwd: root, encoding: 'utf8'});
  const workflow = text => text.slice(text.indexOf('  function menuScopes()'),
    text.indexOf('  // Expuesto localmente'));
  assert.ok(workflow(source).length > 10000);
  const previousSuccess = "        notify('La interfaz ha iniciado el mensaje con Extra High seleccionado.', false, 8_000);";
  const currentSuccess = "        record('La interfaz ha iniciado el mensaje con Extra High seleccionado.');\n        document.getElementById(STATUS_ID)?.remove();";
  assert.ok(workflow(previous).includes(previousSuccess));
  assert.equal(workflow(source), workflow(previous).replace(previousSuccess, currentSuccess));
});
