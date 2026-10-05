const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const { jsx } = require('react/jsx-runtime');

const sourcePath = path.resolve(__dirname, '../../../features/village/Village.tsx');
const source = ts.createSourceFile(sourcePath, fs.readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const entry = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'Village');
assert(entry, 'The exported village entry exists');
const compiled = ts.transpileModule(entry.getText(source), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

let checks = 0;
const check = (condition, label) => { assert(condition, label); checks++; };
const cases = [
  ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1', undefined, true],
  ['Android Chrome', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0 Mobile Safari/537.36', undefined, true],
  ['Windows Phone', 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0) Mobile Safari/537.36', undefined, true],
  ['mobile client hint with reduced UA', 'Mozilla/5.0 Chrome/140.0 Safari/537.36', true, true],
  ['phone UA with a false client hint', 'Mozilla/5.0 (iPhone) Mobile Safari/604.1', false, true],
  ['iPad Safari mobile identity', 'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) Mobile Safari/604.1', true, false, 5],
  ['iPad desktop identity', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15', true, false, 5],
  ['Android tablet', 'Mozilla/5.0 (Linux; Android 15; Tablet) Chrome/140.0 Safari/537.36', true, false, 5],
  ['Android tablet without Tablet token', 'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) Chrome/140.0 Safari/537.36', false, false, 5],
  ['Mac laptop Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15', undefined, false],
  ['Windows PC Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36', false, false],
  ['Linux PC Firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', undefined, false],
];

// Exercise the real entry function with controlled hook phases and a scene sentinel.
for (const [name, userAgent, mobile, phone, maxTouchPoints = 0] of cases) {
  const states = [null, false, "en"];
  let hookIndex = 0, mounts = 0, onKick;
  const effects = [];
  const context = {
    exports: {}, require, navigator: { userAgent, maxTouchPoints, ...(mobile === undefined ? {} : { userAgentData: { mobile } }) },
    window: { innerWidth: 320 },
    useState: () => { const index = hookIndex++; return [states[index], value => { states[index] = value; }]; },
    readVillageLanguage: () => "en",
    useCallback: callback => callback,
    useEffect: effect => effects.push(effect),
    VillageScene: props => { mounts++; onKick = props.onKicked; return jsx('div', { children: 'scene sentinel' }); },
    KickedScreen: () => jsx('div', { children: 'kick screen sentinel' }),
  };
  vm.runInNewContext(compiled, context, { filename: sourcePath });
  const render = () => { hookIndex = 0; return renderToStaticMarkup(context.exports.Village()); };
  const initial = render();
  check(initial.includes('Opening the village') && mounts === 0, `${name}: no scene mounts before device detection`);
  effects[0]();
  const result = render();
  check(states[0] === phone, `${name}: correct device decision`);
  if (phone) {
    check(result.includes('Please open the village on an iPad, tablet, laptop or PC.') && mounts === 0, `${name}: guidance replaces the entire scene`);
  } else {
    check(result.includes('scene sentinel') && mounts === 1, `${name}: a 320 px desktop window still mounts the scene`);
    onKick();
    check(render().includes('kick screen sentinel') && mounts === 1, `${name}: a kick replaces the whole scene`);
  }
}
console.log(`${checks} device-gate checks passed`);
