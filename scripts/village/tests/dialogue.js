import * as T from 'three';
import { DEFAULT_KEYBINDINGS } from './modules/features/village/keybindings.js';
import { VillagerDialogue, VILLAGERS } from './modules/features/village/dialogue.js';

// Browser checks use real projection, DOM layout and the production dialogue controller.
export async function checkDialogue(engine) {
  const results = [];
  const check = (condition, name) => { if (!condition) throw Error(name); results.push(name); };
  const host = document.createElement('div');
  host.className = 'village v-dialogue-fixture';
  host.style.cssText = 'position:absolute;left:-2000px;top:0;width:1280px;height:720px';
  // QA loads village.css without the application's global border-box reset.
  const sizing = document.createElement('style');
  sizing.textContent = '.v-dialogue-fixture,.v-dialogue-fixture *{box-sizing:border-box}';
  host.append(sizing);
  document.body.append(host);
  const residents = VILLAGERS.map(() => ({ root: new T.Group(), chatting: false }));
  const life = { residents, sharedState: () => undefined, available: () => true };
  const camera = new T.PerspectiveCamera(55, 1280 / 720, .12, 100);
  const player = new T.Vector3(0, 0, 2.4);
  camera.position.set(0, 3, 7); camera.lookAt(0, 1.3, 0); camera.updateMatrixWorld();
  const reset = () => residents.forEach((r, i) => r.root.position.set(i ? 100 : 0, 0, 0));
  reset();
  let interactions = 0;
  let dialogue = new VillagerDialogue(host, life, [], () => interactions++);
  const update = (dt = .016, weather = 'golden') => dialogue.update(dt, camera, player, weather);
  const visible = () => [...host.querySelectorAll('.v-villager-bubble')].filter(b => !b.hidden);
  try {
    dialogue.resize(1280, 720);
    update();
    check(visible().length === 0, 'Arrival hides speech and chat controls');
    dialogue.setEnabled(true); update();
    check(visible().length === 1 && visible()[0].textContent.includes(VILLAGERS[0].greeting.en), 'Nearby resident greets the player');
    const original = visible()[0].getBoundingClientRect(), hostBounds = host.getBoundingClientRect();
    const hud = document.createElement('section'); hud.className = 'v-shared-chat';
    hud.style.cssText = `position:absolute;margin:0;min-width:0;min-height:0;left:${original.left-hostBounds.left}px;top:${original.top-hostBounds.top}px;width:${original.width}px;height:${original.height}px`;
    host.append(hud); await new Promise(resolve => setTimeout(resolve, 180)); update();
    check(visible().length === 1, 'Nearby Chat control relocates around an actual visible chat panel');
    const moved = visible()[0].getBoundingClientRect(), blocked = hud.getBoundingClientRect();
    check(moved.right <= blocked.left || moved.left >= blocked.right || moved.bottom <= blocked.top || moved.top >= blocked.bottom,
      'Relocated dialogue does not overlap the chat panel');
    hud.remove(); await new Promise(resolve => setTimeout(resolve, 180)); update();

    check(residents[0].chatting, 'Greeting pauses the resident');
    dialogue.setKeybindings({ ...DEFAULT_KEYBINDINGS, talk: ' ', jump: 'f' }); update();
    const remappedCap = visible()[0].querySelector('.v-villager-footer kbd');
    const capStyle = getComputedStyle(remappedCap);
    check(remappedCap.textContent === 'Space' && remappedCap.dataset.wide === 'true' && remappedCap.scrollWidth <= remappedCap.clientWidth
      && parseFloat(capStyle.paddingLeft) >= 8 && parseFloat(capStyle.paddingRight) >= 8,
      'Remapped NPC Space shortcut keeps its text inside a padded keycap');
    dialogue.setKeybindings(DEFAULT_KEYBINDINGS); update();

    check(!host.querySelector('[aria-live]').textContent, 'Ambient speech does not announce repeatedly to screen readers');
    const lines = [];
    for (let i = 0; i < 5; i++) { dialogue.talk(); lines.push(visible()[0].querySelector('p').textContent); }
    check(new Set(lines).size === 5 && interactions === 5, 'Explicit chat cycles through five different personality lines');
    check(host.querySelector('[aria-live]').textContent.startsWith('Pip:'), 'Explicit chat has a named polite announcement');
    dialogue.setLanguage('ja'); update();
    check(visible()[0].textContent.includes(VILLAGERS[0].chat[4].ja), 'Language switches the current line without resetting it');
    check(visible()[0].querySelector('button').getAttribute('aria-label') === 'ピップと話す', 'Chat control has a Japanese accessible name');
    dialogue.setLanguage('en');
    host.style.width = '390px'; host.style.height = '844px';
    dialogue.resize(390, 844); camera.aspect = 390 / 844; camera.updateProjectionMatrix(); update();
    const mobile = visible()[0].getBoundingClientRect(), bounds = host.getBoundingClientRect();
    check(mobile.left >= bounds.left && mobile.right <= bounds.right, 'Portrait bubble stays within the viewport');
    check(visible()[0].querySelector('button').getBoundingClientRect().height >= 44, 'Chat target is at least 44 pixels high');
    update(6.1);
    check(visible()[0].classList.contains('is-compact') && visible()[0].querySelector('button').offsetHeight >= 44,
      'Expired speech becomes a compact, touchable Chat control');
    dialogue.talk(); update();
    check(!visible()[0].classList.contains('is-compact'), 'Chat reopens the full conversation');
    residents[0].following = true;
    update(6.1);
    check(visible()[0].classList.contains('is-compact'), 'Walking companion speech folds away after six seconds');
    const companionLine = visible()[0].querySelector('p').textContent;
    update(60);
    check(visible()[0].classList.contains('is-compact') && visible()[0].querySelector('p').textContent === companionLine,
      'Walking companions do not repeat ambient lines');
    residents[0].following = false;
    dialogue.setEnabled(false); update();
    check(host.querySelector('.v-villager-dialogue').hidden && !residents.some(r => r.chatting), 'Disabling dialogue hides bubbles and releases residents');
    dialogue.talk(0); check(interactions === 6, 'Hidden dialogue cannot be activated');
    dialogue.setEnabled(true);
    residents[0].root.position.z = 12; update(); check(!visible().length, 'Behind-camera speech is hidden');
    residents[0].root.position.set(0, 0, -30); update(); check(!visible().length, 'Distant speech is hidden');
    reset(); player.set(0, 0, 6); update(30, 'rain');
    check(visible()[0]?.textContent.includes(VILLAGERS[0].rain.en), 'Rain has a character-specific remark');
    update(30, 'dusk'); update(30, 'dusk');
    check(visible()[0]?.textContent.includes(VILLAGERS[0].dusk.en), 'Dusk has a character-specific remark');
    dialogue.dispose();
    check(!host.querySelector('.v-villager-dialogue'), 'Disposal removes the overlay');
    host.style.width = '1280px'; host.style.height = '720px';
    camera.aspect = 1280 / 720; camera.updateProjectionMatrix(); player.set(0, 0, 3);
    dialogue = new VillagerDialogue(host, life, [{ x: 0, z: 3.5, w: 8, d: 1, top: 8 }], () => interactions++);
    dialogue.resize(1280, 720); dialogue.setEnabled(true); update();
    check(!visible().length, 'Building collider occludes speech');
    dialogue.dispose();
    dialogue = new VillagerDialogue(host, life, [], () => interactions++);
    dialogue.resize(1280, 720); dialogue.setEnabled(true);
    for (let i = 0; i < residents.length; i++) {
      residents.forEach((r, j) => r.root.position.set(j === i ? 0 : 100, 0, 0)); update(); dialogue.talk();
      check(visible()[0]?.textContent.includes(VILLAGERS[i].chat[0].en), `${VILLAGERS[i].name.en} has the correct voice and identity`);
    }
    residents.forEach(r => r.root.position.set(0, 0, 0)); update();
    check(visible().length === 1, 'Overlapping residents do not stack unreadable bubbles');
    residents.forEach((r, i) => r.root.position.set(-4.5 + i * 3, 0, -3)); update(30);
    check(visible().length <= 2, 'At most two ambient bubbles appear together');
    dialogue.dispose();
    let teaVisits = 0;
    dialogue = new VillagerDialogue(host, life, [], () => interactions++, {
      companion: () => {}, crumbs: () => {}, visitTea: () => teaVisits++,
    });
    dialogue.resize(1280, 720); dialogue.setEnabled(true);
    residents.forEach((r, i) => r.root.position.set(i === 3 ? 0 : 100, 0, 0));
    player.set(0, 0, 2.4); update();
    const luma = host.querySelector('[data-villager="luma"]');
    const tea = luma.querySelector('[data-tea]');
    const mark = host.querySelector('.v-luma-attention');
    check(tea.querySelector('kbd')?.textContent === 'E' &&
      luma.querySelector('.v-villager-actions button kbd')?.textContent === 'C',
      'Luma actions show boxed E and C keys beside their buttons');
    check(mark.hidden && !tea.classList.contains('has-harvest'), 'Luma has no harvest cue before mint is picked');
    dialogue.setMintAvailable(true); update();
    check(!mark.hidden && tea.classList.contains('has-harvest'), 'Mint highlights tea and shows Luma attention cue');
    check(tea.getAttribute('aria-label').startsWith('Mint ready.'), 'The mint cue has an accessible action name');
    dialogue.setLanguage('ja');
    check(tea.getAttribute('aria-label').startsWith('ミントの収穫があります。'), 'The mint cue is named in Japanese too');
    dialogue.setLanguage('en');
    update(6.1);
    check(!luma.classList.contains('is-compact') && !tea.hidden, 'Luma keeps the harvest action visible after greeting expires');
    tea.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    check(teaVisits === 1, 'E on the focused tea button enters the same interaction');
    dialogue.setMintAvailable(false); update();
    check(mark.hidden && !tea.classList.contains('has-harvest'), 'Sharing the last mint clears both cues');
    check(!dialogue.visitTea(), 'E cannot activate tea while its button is folded away');
    dialogue.talk(3); update();
    check(dialogue.visitTea() && teaVisits === 2, 'Tea remains directly available when its button is visible without mint');
    player.set(0, 0, 10); update();
    check(!dialogue.visitTea() && teaVisits === 2, 'Tea shortcut cannot activate from far away');
    if (engine) {
      engine.setBlocked(true);
      check(engine.dialogue.layer.hidden, 'Engine menus suppress conversations');
      engine.setBlocked(false); engine.setPlace('mood');
      check(engine.dialogue.layer.hidden, 'Activities suppress conversations');
      engine.setPlace(null);
      check(!engine.dialogue.layer.hidden, 'Leaving an activity restores conversations');
      // Luma now roams away from the garden; stage her here to isolate exit readability.
      const resident = engine.life.residents[3];
      resident.movement.settle(...resident.route[0]);
      resident.root.position.set(resident.movement.position.x, resident.movement.position.y, resident.movement.position.z);
      resident.pause = 2;
      engine.travel('mood'); engine.setPlace(null);
      await new Promise(resolve => setTimeout(resolve, 700));
      const luma = engine.dialogue.bubbles[3];
      check(!luma.element.hidden, 'Tea garden exit keeps Luma readable');
    }
    return { pass: true, checks: results.length, results, browser: navigator.userAgent };
  } finally { dialogue.dispose(); host.remove(); }
}
