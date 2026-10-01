const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../out');
assert(fs.existsSync(path.join(root, 'index.html')), 'The static village entry must exist');
for (const route of ['editor', 'village-editor', 'api', 'admin', 'tools'])
  assert(!fs.existsSync(path.join(root, route)), `Local/server route leaked into export: ${route}`);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(!/village-editor|layout save API|\/api\/layout/.test(html), 'Editor UI must stay outside the public entry');
console.log('Static export contains no editor, save API or admin route.');
