// Compile the four pure TS modules to the supplied directory; no test dependency required.
const assert = require('node:assert/strict');
const path = require('node:path');
const build = process.argv[2];
if (!build) throw new Error('Pass the absolute directory containing compiled movement.js, environment.js and composition.js.');
const { VillageMovement, MOVEMENT } = require(path.join(build, 'movement.js'));
const { BRIDGE, bridgeHeight } = require(path.join(build, 'environment.js'));
const { VillageScore } = require(path.join(build, 'composition.js'));
const input = { x: 0, z: -1, run: false, sprint: false, blocked: false };
const simulate = (m, seconds, fps, controls = input) => { for (let i = 0; i < Math.round(seconds * fps); i++) m.update(1 / fps, controls); };
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }

test('30/60/120 fps travel, jump height and contact counts agree', () => {
 const results = [30, 60, 120].map(fps => {
  const events = [], m = new VillageMovement([], e => events.push(e));
  m.jump(); let apex = 0;
  for(let i = 0; i < fps * 3; i++) { m.update(1 / fps, input); apex = Math.max(apex, m.position.y); }
  assert(m.grounded); assert(apex > .98 && apex < 1.15);
  assert.equal(events.filter(e => e.kind === 'takeoff').length, 1);
  assert.equal(events.filter(e => e.kind === 'landing').length, 1);
  return { z: m.position.z, apex, steps: events.filter(e => e.kind === 'footstep').length };
 });
 for (const result of results.slice(1)) { assert(Math.abs(result.z-results[0].z)<.03); assert(Math.abs(result.apex-results[0].apex)<.015); assert.equal(result.steps,results[0].steps); }
});
test('blocking wall stops displacement, sprint drain and footsteps', () => {
 const events = [], m = new VillageMovement([{x:0,z:18,w:10,d:1}], e=>events.push(e));
 simulate(m, 2, 60, {...input,sprint:true}); const energy=m.stamina; events.length=0;
 simulate(m, 2, 60, {...input,sprint:true});
 assert(m.position.z>=18.82-.01); assert.equal(m.speed,0); assert.equal(events.length,0); assert(m.stamina>=energy);
});
test('sprint drains, exhausts with hysteresis and recovers without blocking walking', () => {
 const m = new VillageMovement([],()=>{});m.settle(30,30);
 simulate(m,6,60,{...input,sprint:true});assert(m.exhausted);assert(m.stamina<10);assert(m.speed>4);
 simulate(m,.5,60,{...input,sprint:true});assert(m.exhausted);
 simulate(m,6,60,{...input,x:0,z:0});assert.equal(m.stamina,100);assert(!m.exhausted);
});
test('dialogs, focus loss and travel clear buffered jump and motion', () => {
 const events=[], m=new VillageMovement([],e=>events.push(e));m.jump();m.update(1/60,{...input,blocked:true});
 simulate(m,1,60,{...input,x:0,z:0});assert(!events.some(e=>e.kind==='takeoff'));
 m.jump();simulate(m,.1,60);assert(!m.grounded);m.settle(5,11);assert(m.grounded);assert.equal(m.velocity.y,0);
});
test('bridge deck matches physics on both approaches; parapet contains jumping',()=>{
 const m=new VillageMovement([],()=>{});m.settle(BRIDGE.x-BRIDGE.length/2-.2,BRIDGE.z);
 for(let i=0;i<Math.ceil((BRIDGE.length+1)*60/MOVEMENT.walk);i++){m.update(1/60,{...input,x:1,z:0});if(Math.abs(m.position.x-BRIDGE.x)<BRIDGE.length/2)assert(Math.abs(m.position.y-bridgeHeight(m.position.x))<.015);}
 assert(m.position.x>BRIDGE.x+BRIDGE.length/2);
 m.settle(BRIDGE.x,3);m.jump();simulate(m,1,60,{...input,x:0,z:-1});assert(m.position.z>=BRIDGE.z-BRIDGE.width/2+MOVEMENT.radius-.01);
});
test('low props block walking but support landing after a jump',()=>{
 const collider={x:.3,z:18.8,w:2,d:.8,top:.65};
 const m=new VillageMovement([collider],()=>{});simulate(m,.4,60);assert(m.position.z>=19.51);
 m.jump();for(let i=0;i<60;i++){m.update(1/60,{...input,z:i<35?-1:0});}assert(m.grounded);assert(Math.abs(m.position.y-.65)<.01);
});
test('water and pond remain impassable in the air',()=>{
 const m=new VillageMovement([],()=>{});m.settle(-4,20);m.jump();simulate(m,2,60,{...input,x:-1,z:0,sprint:true});assert(m.position.x>-5.5);
});
test('bounded catch-up prevents a background resume launch',()=>{
 const m=new VillageMovement([],()=>{});const z=m.position.z;m.update(30,{...input,sprint:true});assert(Math.abs(m.position.z-z)<.61);
});
test('a low ceiling stops ascending motion',()=>{
 const m=new VillageMovement([{x:0,z:20,w:3,d:3,bottom:2.3,top:2.6}],()=>{});m.jump();let high=0;
 for(let i=0;i<60;i++){m.update(1/60,{...input,x:0,z:0});high=Math.max(high,m.position.y);}
 assert(high<=.501);assert(m.grounded);
});
test('score is seed-reproducible, evolves over long sessions and keeps distinct orchestration',()=>{
 for(const vibe of ['piano','lofi','jazz']){
  const a=new VillageScore(62025),b=new VillageScore(62025),other=new VillageScore(42);let count=0, maxEvents=0;const instruments=new Set(),sections=new Set(),bars=[];
  for(let i=0;i<340;i++){
   const plan=a.next(vibe);assert.deepEqual(plan,b.next(vibe));sections.add(plan.section);bars.push(plan.events);maxEvents=Math.max(maxEvents,plan.events.length);
   for(const e of plan.events){assert(e.beat>=0&&e.beat<4);assert(e.duration>0&&Number.isFinite(e.velocity));assert(e.midi<=79&&e.midi>=0);instruments.add(e.instrument);count++;}
  }
  assert.equal(sections.size,5);assert.notDeepEqual(bars[0],bars[40]);assert.notDeepEqual(bars[0],other.next(vibe).events);
  if(vibe==='piano')assert.deepEqual([...instruments],['piano']);else assert(instruments.has('bass')&&instruments.has('brush'));
  assert(maxEvents<=32);assert(count>500);
  console.log(`  ${vibe}: 340 bars, ${count} events, max ${maxEvents}/bar`);
 }
});
console.log(`${passed} contract checks passed.`);
