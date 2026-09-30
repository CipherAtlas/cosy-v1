const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
let now = 10000;
const source = fs.readFileSync('worker/index.js', 'utf8').replace(/^import .*;\n/gm, '')
  .replace('export class VillageWorld', 'class VillageWorld').replace('export default {', 'const workerDefault = {');
const mod = { exports: {} };
const socket = visitor => ({ visitor, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); },
  close(code) { this.closedWith = code; },
  serializeAttachment(value) { this.visitor = JSON.parse(JSON.stringify(value)); }, deserializeAttachment() { return this.visitor; } });
vm.runInNewContext(`${source}\nmodule.exports = VillageWorld;`, {
  module: mod, crypto: webcrypto, Date: class extends Date { static now() { return now; } },
  DurableObject: class { constructor(ctx) { this.ctx = ctx; } },
  freshGarden: () => ({ beds: [] }), readGarden: raw => JSON.parse(raw),
  WebSocketPair: class { constructor() { this.client = {}; this.server = socket(null); } },
  Response: class { constructor(body, options) { Object.assign(this, options); } },
  URL,
});
const records = new Map(), a = socket({ id:'a', name:'A', x:1,z:2,heading:0,lastMove:0 }),
  b = socket({ id:'b', name:'B', x:1,z:2,heading:0,lastMove:0 });
const sockets = [a,b], ctx = { getWebSockets: () => sockets, acceptWebSocket: s => sockets.push(s),
  storage: { kv: { get: key => records.get(key), put: (key,value) => records.set(key,value) }, setAlarm: () => {} } };
const World = mod.exports, world = new World(ctx);
const send = (s,message) => world.webSocketMessage(s,JSON.stringify(message));
const ride = { id:'sunrise-meadow-swings', index:0, angle:.5, velocity:1 };
(async () => {
  await send(a,{type:'move',x:1,z:2,heading:0,swing:ride});
  assert.equal(b.messages.at(-1).swing.angle,.5);
  await send(b,{type:'move',x:1,z:2,heading:0,swing:ride});
  assert.equal(b.visitor.swing,null); assert(b.messages.some(m=>m.type==='swing_taken'));
  now+=120; await send(b,{type:'move',x:1,z:2,heading:0,swing:{...ride,index:1}});
  assert.equal(b.visitor.swing.index,1);
  const upgraded = await world.fetch({url:'http://local/',headers:{get:()=> 'websocket'}});
  assert.equal(upgraded.status,101);
  assert.equal(sockets.at(-1).messages.find(m=>m.type==='welcome').visitors.find(v=>v.id==='a').swing.index,0);
  now+=120; await send(a,{type:'move',x:2,z:2,heading:0});
  assert.equal(a.visitor.swing,null); assert.equal(b.messages.at(-1).swing,null);
  now+=120; await send(a,{type:'move',x:2,z:2,heading:0,swing:{...ride,angle:999,velocity:999}});
  assert(a.visitor.swing.angle<1.37 && a.visitor.swing.velocity<=4);
  now+=120; await send(a,{type:'move',x:2,z:2,heading:0,swing:{...ride,index:3}});
  assert.equal(a.visitor.swing,null);
  const trick={id:'mochi-corgi',command:'dance',x:2,z:3,heading:0,startedAt:-5000};
  await send(a,{type:'puppy_trick',trick});
  assert.equal(b.messages.at(-1).type,'puppy_trick');
  assert.equal(b.messages.at(-1).trick.startedAt,now);
  assert.equal(world.puppyTricks.size,1);
  const accepted = b.messages.length;
  await send(a,{type:'puppy_trick',trick:{...trick,command:'roll'}});
  assert.equal(b.messages.length,accepted);
  now+=200;
  for(const invalid of [{...trick,x:100},{...trick,x:null},{...trick,command:'__proto__'},{...trick,id:'bad/id'}]) {
    await send(a,{type:'puppy_trick',trick:invalid}); assert.equal(b.messages.length,accepted);
  }
  const awakened=new World(ctx);
  assert.equal(awakened.puppyTricks.get(trick.id).command,'dance');
  await awakened.fetch({url:'http://local/',headers:{get:()=> 'websocket'}});
  assert.equal(sockets.at(-1).messages.find(m=>m.type==='welcome').puppyTricks.length,1);
  now+=6000;
  const expired=new World(ctx);
  assert.equal(expired.puppyTricks.size,0);
  await expired.fetch({url:'http://local/',headers:{get:()=> 'websocket'}});
  assert.equal(sockets.at(-1).messages.find(m=>m.type==='welcome').puppyTricks.length,0);
  await world.webSocketClose(a); assert.equal(a.closedWith,1000);
  assert.equal(b.messages.at(-1).type,'leave');
  let clientSocket, tick, trickTimer, pose={x:1,z:2,heading:0};
  const sent=[], tricks=[]; let rejected=0;
  class ClientSocket {
    static OPEN=1;
    readyState=1;
    constructor(){clientSocket=this;}
    send(raw){sent.push(JSON.parse(raw));}
    close(){this.readyState=3;}
  }
  const clientModule={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('features/village/sharedWorld.ts','utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText,{
    exports:clientModule.exports,require:()=>({readGarden:raw=>JSON.parse(raw)}),process:{env:{}},
    WebSocket:ClientSocket,Date:class extends Date{static now(){return now;}},
    window:{setInterval:cb=>{tick=cb;return 1;},clearInterval:()=>{},
      setTimeout:cb=>{trickTimer=cb;return 2;},clearTimeout:id=>{if(id===2)trickTimer=null;}},
  });
  const joining=clientModule.exports.connectSharedWorld({getPose:()=>pose,onState:()=>{},onChat:()=>{},
    onChatCooldown:()=>{},onAction:()=>{},onDisconnect:()=>{},onSwingTaken:()=>rejected++,onPuppyTrick:t=>tricks.push(t)});
  const receive=message=>clientSocket.onmessage({data:JSON.stringify(message)});
  receive({type:'welcome',selfId:'a',visitors:[],garden:{beds:[]},chatHour:1,chat:[],puppyTricks:[trick]});
  const connection=await joining;
  assert.equal(tricks.length,1);
  tick(); tick(); assert.equal(sent.length,1);
  pose={...pose,swing:{...ride,angle:0,velocity:0}};tick();
  assert.equal(sent.length,2); assert.equal(sent[1].swing.index,0);
  pose={...pose,swing:null};tick();
  assert.equal(sent.length,3);assert.equal(sent[2].swing,null);
  receive({type:'swing_taken'});assert.equal(rejected,1);
  receive({type:'puppy_trick',actor:'a',trick});assert.equal(tricks.length,2);
  connection.sendPuppyTrick(trick);assert(trickTimer);
  connection.sendPuppyTrick({...trick,command:'roll'});now+=200;trickTimer();
  assert.equal(sent.at(-1).type,'puppy_trick');assert.equal(sent.at(-1).trick.command,'roll');
  connection.close();const before=sent.length;connection.sendPuppyTrick(trick);assert.equal(sent.length,before);
  console.log('Shared seats, races, legacy movement, bounded input, trick validation/rate limits, hibernation and late-join expiry pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
