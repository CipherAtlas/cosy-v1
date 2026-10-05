// Japanese content coverage and localized controls with the production layout/state helpers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { VILLAGERS } = require('../../../features/village/villagers.ts');
const { villageNotice, villageName, preferredVillageLanguage } = require('../../../features/village/localization.ts');
const { TownInteractions } = require('../../../features/village/townInteractions.ts');
const { projectWorldLayout } = require('../../../features/village/worldLayout.ts');
const { townPoint, farmCrop } = require('../../../features/village/townShared.ts');
const root = path.resolve(__dirname, '../../..');
let checks = 0;
const check = (condition, label) => { assert(condition, label); checks++; };
const japanese = text => /[\u3040-\u30ff\u3400-\u9fff]/u.test(text);
for (const villager of VILLAGERS) for (const line of [villager.name, villager.greeting, ...villager.ambient, ...villager.chat, villager.rain, villager.dusk]) {
  check(japanese(line.ja) && line.en.trim() && line.ja !== line.en, `${villager.id} has both authored languages`);
}
for (const file of ['worker/index.js', 'worker/simulation.ts', 'worker/town.ts', 'features/village/sharedWorld.ts', 'features/village/VillageEngine.ts']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const notices = [...source.matchAll(/(?:reason:|message:|sharedNotice\?\.)\s*(?:\(\s*)?"([^"]+)"/g)].map(match => match[1]);
  for (const notice of notices) check(japanese(villageNotice(notice, 'ja')), `${file}: ${notice}`);
}
for (const crop of ['carrot', 'radish', 'mint']) check(japanese(villageNotice(`This farm only grows ${crop}.`, 'ja')), 'Crop refusal translates');
for (const food of ['apple', 'mushroom']) check(japanese(villageNotice(`Your basket has no ${food}. Pick an apple or receive a hedgehog gift first.`, 'ja')), 'Food refusal translates');
check(preferredVillageLanguage('en', 'ja-JP') === 'en', 'Explicit English overrides browser Japanese');
check(preferredVillageLanguage('ja', 'en-US') === 'ja', 'Saved Japanese overrides browser English');
check(preferredVillageLanguage(undefined, 'ja-JP') === 'ja', 'Japanese browsers start in Japanese');
check(preferredVillageLanguage(undefined, 'en-US') === 'en', 'English browsers start in English');
check(villageNotice('未知の通知', 'ja') === '未知の通知', 'Unknown notices retain their original meaning');
check(villageNotice('That seat is unavailable.', 'en') === 'That seat is unavailable.', 'English notices retain their original text');
check(villageName('Custom animal name', 'ja') === 'Custom animal name', 'Custom layout names survive localization');
const layout = projectWorldLayout(JSON.parse(fs.readFileSync(path.join(root, 'public/village/world-layout.json'), 'utf8')));
const interactions = new TownInteractions(layout);
const inventory = { apples: 1, mushrooms: 1 };
const town = { animals: [], beds: [], hayFeeds: [], owlUntil: 0, applePickedAt: {} };
const context = (x, z, state = town, language = 'ja') => interactions.context(state, 'test', x, z, null, null, true, 1000, inventory, language);
for (const row of layout.items.filter(item => item.asset === 'farm-row')) {
  const [x, , z] = row.position;
  const required = farmCrop(row);
  const empty = { ...town, beds: [{ id: row.id, crop: null, growAt: null, wateredAt: null }] };
  const ja = context(x, z, empty), en = context(x, z, empty, 'en');
  check(japanese(ja.title) && japanese(ja.actions[0].label), 'Farm row title and planting action translate');
  check(JSON.stringify(ja.actions[0].request) === JSON.stringify(en.actions[0].request), 'Localization preserves shared farm requests');
  const growing = context(x, z, { ...town, beds: [{ id: row.id, crop: required, growAt: 2000, wateredAt: 0 }] });
  check(growing.actions[0].disabled && growing.actions[0].label === '収穫する', 'Japanese growing row keeps harvest disabled');
}
for (const item of layout.items.filter(item => ['apple-tree', 'owl-feeding-perch'].includes(item.asset))) {
  const [x, z] = townPoint(item, 0, 1.8), value = context(x, z);
  check(japanese(value.title) && value.actions.every(action => japanese(action.label)), 'Orchard and owl controls translate');
}
for (const [species, name] of [['cow', 'Honey the Highland cow'], ['sheep', 'Clover the sheep'], ['lamb', 'Buttercup the lamb'], ['hedgehog', 'Bramble the garden hedgehog']]) {
  check(japanese(villageName(name, 'ja')), 'Authored animal names translate');
  const value = context(0, 0, { ...town, animals: [{ id: 'language-test', x: 0, z: 0, species, mode: 'graze', until: 0 }] });
  check(japanese(value.title) && value.actions.every(action => japanese(action.label)), 'Animal controls translate');
}
console.log(`${checks} Japanese content/control checks passed.`);
