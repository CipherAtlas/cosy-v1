// Requires the isolated QA preview, exported site and local Worker described in README.md.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const output = process.env.OUTPUT_DIR || '/tmp/cosy-village-browser-checks';
const env = { ...process.env, VILLAGE_URL: process.env.VILLAGE_URL || 'http://127.0.0.1:3051', QA_URL: process.env.QA_URL || 'http://127.0.0.1:3063', URL: process.env.QA_URL || 'http://127.0.0.1:3063' };
require.resolve(process.env.PLAYWRIGHT_PATH || 'playwright');
for (const name of ['shared-physics', 'shared-resident-motion', 'resident-motion-browser', 'audit-fixes', 'camera', 'puppies', 'keyboard-map-ui', 'shared-interactions', 'cottage-ui']) {
  const directory = path.join(output, name); fs.mkdirSync(directory, { recursive: true });
  const result = spawnSync(process.execPath, [`scripts/village/tests/${name}.cjs`], { cwd: root,
    env: { ...env, ...(name === 'resident-motion-browser' ? { NETWORK_JITTER: '1' } : {}), OUTPUT_DIR: directory }, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) { process.exitCode = result.status || 1; break; }
}
