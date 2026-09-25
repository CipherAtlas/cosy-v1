import * as T from 'three';
import { VillagerDialogue, VILLAGERS } from './modules/features/village/dialogue.js';

// Browser checks use real projection, DOM layout and the production dialogue controller.
export async function checkDialogue(engine) {
  const results = [];
  const check = (condition, name) => { if (!condition) throw Error(name); results.push(name); };
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-2000px;top:0;width:1280px;height:720px';
  document.body.append(host);
  const residents = VILLAGERS.map(() => ({ root: new T.Group(), chatting: false }));
  const camera = new T.PerspectiveCamera(55, 1280 / 720, .12, 100);
  const player = new T.Vector3(0, 0, 2.4);
  camera.position.set(0, 3, 7); camera.lookAt(0, 1.3, 0); camera.updateMatrixWorld();
  const reset = () => residents.forEach((r, i) => r.root.position.set(i ? 100 : 0, 0, 0));
  reset();
  let interactions = 0;
  let dialogue = new VillagerDialogue(host, { residents }, [], () => interactions++);
  const update = (dt = .016, weather = 'golden') => dialogue.update(dt, camera, player, weather);
  const visible = () => [...host.querySelectorAll('.v-villager-bubble')].filter(b => !b.hidden);
  try {
    dialogue.resize(1280, 720);
    update();
    check(visible().length === 0, 'Arrival hides speech and chat controls');
    dialogue.setEnabled(true); update();
    check(visible().length === 1 && visible()[0].textContent.includes(VILLAGERS[0].greeting.en), 'Nearby resident greets the player');
    check(residents[0].chatting, 'Greeting pauses the resident');
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
    dialogue.setEnabled(false); update();
    check(host.querySelector('.v-villager-dialogue').hidden && !residents.some(r => r.chatting), 'Disabling dialogue hides bubbles and releases residents');
    dialogue.talk(0); check(interactions === 5, 'Hidden dialogue cannot be activated');
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
    dialogue = new VillagerDialogue(host, { residents }, [{ x: 0, z: 3.5, w: 8, d: 1, top: 8 }], () => interactions++);
    dialogue.resize(1280, 720); dialogue.setEnabled(true); update();
    check(!visible().length, 'Building collider occludes speech');
    dialogue.dispose();
    dialogue = new VillagerDialogue(host, { residents }, [], () => interactions++);
    dialogue.resize(1280, 720); dialogue.setEnabled(true);
    for (let i = 0; i < residents.length; i++) {
      residents.forEach((r, j) => r.root.position.set(j === i ? 0 : 100, 0, 0)); update(); dialogue.talk();
      check(visible()[0]?.textContent.includes(VILLAGERS[i].chat[0].en), `${VILLAGERS[i].name.en} has the correct voice and identity`);
    }
    residents.forEach(r => r.root.position.set(0, 0, 0)); update();
    check(visible().length === 1, 'Overlapping residents do not stack unreadable bubbles');
    residents.forEach((r, i) => r.root.position.set(-4.5 + i * 3, 0, -3)); update(30);
    check(visible().length <= 2, 'At most two ambient bubbles appear together');
    if (engine) {
      engine.setBlocked(true);
      check(engine.dialogue.layer.hidden, 'Engine menus suppress conversations');
      engine.setBlocked(false); engine.setPlace('mood');
      check(engine.dialogue.layer.hidden, 'Activities suppress conversations');
      engine.setPlace(null);
      check(!engine.dialogue.layer.hidden, 'Leaving an activity restores conversations');
      engine.travel('mood'); engine.setPlace(null);
      await new Promise(resolve => setTimeout(resolve, 700));
      const luma = engine.dialogue.bubbles[3];
      check(!luma.element.hidden, 'Tea garden exit keeps Luma readable');
    }
    return { pass: true, checks: results.length, results, browser: navigator.userAgent };
  } finally { dialogue.dispose(); host.remove(); }
}
