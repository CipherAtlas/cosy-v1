// Fast checks for the current village contract. Browser and real-client checks have a separate runner.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const env = { ...process.env, NODE_PATH: path.join(root, 'node_modules') };
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${command} ${args.join(' ')} failed (${result.status})`);
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cosy-contracts-'));
try {
  for (const file of fs.readdirSync(path.join(root, 'scripts/village/tests')).filter(file => file.endsWith('.cjs')))
    run(process.execPath, ['--check', `scripts/village/tests/${file}`]);
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'worker/tsconfig.json', '--noEmit']);
  run('python3', ['scripts/village/split_puppies.py', '--check']);
  for (const name of ['device-gate', 'shared-world-worker', 'shared-actions-worker', 'bird-circuits', 'chat-hour', 'chat-cooldown', 'chat-admin', 'player-kick', 'notes', 'write-cleanup'])
    run(process.execPath, [`scripts/village/tests/${name}.cjs`]);
  fs.writeFileSync(path.join(temporary, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', strict: true, skipLibCheck: true,
      esModuleInterop: true, outDir: path.join(temporary, 'compiled'), rootDir: root, types: ['node'], typeRoots: [path.join(root, 'node_modules/@types')] },
    files: ['movement', 'composition'].map(name => path.join(root, `features/village/${name}.ts`)),
  }));
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', path.join(temporary, 'tsconfig.json')]);
  run(process.execPath, ['scripts/village/tests/contracts.cjs', path.join(temporary, 'compiled/features/village')]);
  console.log('Current village contract checks passed.');
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
