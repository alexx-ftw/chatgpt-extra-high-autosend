#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'chatgpt-extra-high.user.js'), 'utf8');
const header = source.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==/m)?.[0];
if (!header) throw new Error('Userscript metadata header not found');
const outputs = {
  'chatgpt-extra-high.txt': source,
  'chatgpt-extra-high.meta.js': header + '\n'
};
for (const [name, content] of Object.entries(outputs)) {
  const target = path.join(root, name);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
      throw new Error('Distribution file out of sync: ' + name);
    }
  } else {
    fs.writeFileSync(target, content, 'utf8');
  }
}
console.log(process.argv.includes('--check') ? 'Distribution files verified' : 'Distribution files synchronized');
