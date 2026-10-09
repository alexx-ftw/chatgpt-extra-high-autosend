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


test('text, effort, URL, cancellation and single-send guards are unchanged from v1.3.5', () => {
  const { execFileSync } = require('node:child_process');
  const previous = execFileSync('git', ['show', 'v1.3.5:chatgpt-extra-high.user.js'], { cwd: root, encoding: 'utf8' });
  const extract = (text, name) => {
    const start = text.indexOf('  function ' + name + '(');
    const end = text.indexOf('\n  }\n', start);
    assert.ok(start >= 0 && end > start, 'Missing function: ' + name);
    return text.slice(start, end + 5);
  };
  for (const name of ['matchesPrompt', 'isExtraHigh', 'queryStatus', 'guard',
      'consumeQuery', 'sliderReactProps', 'notify', 'onInteraction']) {
    assert.equal(extract(source, name), extract(previous, name), name + ' must preserve its protections');
  }
});
