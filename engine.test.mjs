import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, WORLD_SIZE, HARD_CAP } from './engine.mjs';

// Legal agents: they only observe state and supply movement or offered upgrades.
function choose(s, route='seed') {
 const priority=route==='halo'?['lantern','reach','force','rapid','seed','wave','magnet','boots','heart','mend']:route==='tide'?['wave','force','rapid','seed','lantern','reach','magnet','boots','heart','mend']:['seed','rapid','force','wave','lantern','reach','magnet','boots','heart','mend'];
 if(s.p.hp<s.p.maxHp*.35){const h=s.choices.find(x=>x.id==='heart'||x.id==='mend');if(h)return h.id;}
 return [...s.choices].sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id))[0].id;
}
function controls(s, objective = null){
 const p=s.p; let target=objective,best=Infinity;
 for(const g of (objective ? [] : s.gems)){const d=Math.hypot(g.x-p.x,g.y-p.y);if(d<best){best=d;target=g;}}
 if(!target){for(const e of s.enemies){const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<best){best=d;target=e;}}}
 let tx=target?target.x:900+Math.sin(s.t*.1)*300,ty=target?target.y:900+Math.cos(s.t*.1)*300;
 let bestCost=Infinity,answer={x:0,y:0,dodge:false};
 for(let k=0;k<24;k++){
   const a=k/24*Math.PI*2,x=Math.cos(a),y=Math.sin(a),nx=p.x+x*p.speed*.7,ny=p.y+y*p.speed*.7;
   let cost=Math.hypot(nx-tx,ny-ty)*.8;
   if(nx<100||ny<100||nx>1700||ny>1700)cost+=500;
   for(const e of s.enemies){const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
     const ex=e.x+dx/d*e.speed*.6,ey=e.y+dy/d*e.speed*.6;
     const ed=Math.hypot(nx-ex,ny-ey)-e.r;
     if(ed<120)cost+=(120-ed)**2*.14;
     const near=Math.hypot(p.x-e.x,p.y-e.y);
     if(near<65&&x*dx+y*dy<0)cost+=300;
   }
   for(const b of s.bullets)if(b.owner==='enemy'){const d=Math.hypot(nx-(b.x+b.vx*.5),ny-(b.y+b.vy*.5));if(d<45)cost+=(45-d)*4;}
   if(cost<bestCost){bestCost=cost;answer={x,y,dodge:false};}
 }
 let nearest=Infinity;for(const e of s.enemies)nearest=Math.min(nearest,Math.hypot(e.x-p.x,e.y-p.y)-e.r);
 answer.dodge=nearest<50&&p.dodgeCooldown<=0;
 return answer;
}
function run(seed,route='seed',limit=13000){const g=new Engine(seed);let steps=0;while(['play','upgrade'].includes(g.state.mode)&&steps++<limit){if(g.state.mode==='upgrade')g.chooseUpgrade(choose(g.state,route));else g.update(1/30,controls(g.state));}return g;}

function assertBounds(s) {
  assert.ok(s.enemies.length <= 120);
  assert.ok(s.bullets.length <= 180);
  assert.ok(s.gems.length <= 220);
  assert.ok(s.effects.length <= 80);
  assert.ok(s.p.x >= s.p.r && s.p.x <= WORLD_SIZE-s.p.r);
  assert.ok(s.p.y >= s.p.r && s.p.y <= WORLD_SIZE-s.p.r);
  for (const group of [s.enemies, s.bullets, s.gems, s.effects]) {
    assert.equal(new Set(group.map(x=>x.id)).size,group.length);
    assert.ok(group.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)));
  }
}

test('legal full run wins through Acorn / Sunflower evolution', () => {
  const g = run('daily-2026-10-07','seed');
  assert.equal(g.state.mode,'won');
  assert.ok(g.state.t>=150&&g.state.t<HARD_CAP);
  assert.ok(g.state.evolutions.includes('sunflower'));
  assert.ok(g.state.kills>300);
  assert.equal(g.state.bossHp,0);
  assertBounds(g.state);
  const ended = JSON.stringify(g.state);
  for(let i=0;i<50;i++)g.update(.1,{x:1,y:1,dodge:true});
  assert.equal(JSON.stringify(g.state),ended,'terminal state stays frozen');
});

test('legal full run wins through Firefly / Solar Halo evolution', () => {
  const g=run('daily-2026-10-07','halo');
  assert.equal(g.state.mode,'won');
  assert.ok(g.state.evolutions.includes('halo'));
  assert.ok(g.state.orbitCount>=4);
  assertBounds(g.state);
});

test('legal full run wins through Quack / Tidal evolution', () => {
  const g=run('daily-2026-10-07','tide');
  assert.equal(g.state.mode,'won');
  assert.ok(g.state.evolutions.includes('tide'));
  assertBounds(g.state);
});

test('standing still and choosing utility upgrades loses naturally', () => {
  const g=new Engine('idle');
  const priority=['boots','magnet','heart','reach','rapid','seed','force','wave','lantern','mend'];
  for(let n=0;n<10000&&['play','upgrade'].includes(g.state.mode);n++) {
    if(g.state.mode==='upgrade')g.chooseUpgrade([...g.state.choices].sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id))[0].id);
    else g.update(1/30,{});
  }
  assert.equal(g.state.mode,'lost');
  assert.equal(g.state.reason,'health');
  assert.equal(g.state.p.hp,0);
  assert.ok(g.state.t<150);
});

test('legal evasive run reaches enforced 210 second cap', () => {
  const g=new Engine('timeout');
  for(let n=0;n<10000&&['play','upgrade'].includes(g.state.mode);n++) {
    if(g.state.mode==='upgrade'){g.chooseUpgrade(g.state.choices[0].id);continue;}
    const s=g.state;
    const target={x:900+Math.cos(s.t*.26)*660,y:900+Math.sin(s.t*.26)*660};
    g.update(1/30,controls(s,target));
    if(n%300===0)assertBounds(g.state);
  }
  assert.equal(g.state.mode,'lost');
  assert.equal(g.state.reason,'timeout');
  assert.equal(g.state.t,HARD_CAP);
  assert.ok(g.state.p.hp>0);
  assert.ok(g.state.bossSpawned);
  assertBounds(g.state);
});

test('same daily seed and controls reproduce exact simulation', () => {
  const a=new Engine('daily-repro'),b=new Engine('daily-repro'),c=new Engine('different-day');
  for(let i=0;i<900;i++) {
    const input={x:Math.sin(i*.011),y:Math.cos(i*.011),dodge:i%160===0};
    a.update(1/60,input);b.update(1/60,input);c.update(1/60,input);
  }
  assert.deepEqual(a.state,b.state);
  assert.notDeepEqual(a.state.enemies,c.state.enemies);
});

test('upgrade pauses time; only a unique offered choice can resume it', () => {
  const g=new Engine('pause');
  for(let i=0;i<3000&&g.state.mode==='play';i++)g.update(1/30,controls(g.state));
  assert.equal(g.state.mode,'upgrade');
  assert.equal(g.state.choices.length,3);
  assert.equal(new Set(g.state.choices.map(c=>c.id)).size,3);
  const before=JSON.stringify(g.state);
  g.update(.25,{x:1,y:1,dodge:true});
  assert.equal(JSON.stringify(g.state),before);
  assert.equal(g.chooseUpgrade('nonexistent'),false);
  assert.equal(JSON.stringify(g.state),before);
  assert.equal(g.chooseUpgrade(g.state.choices[0].id),true);
  assert.equal(g.state.mode,'play');
  assert.equal(g.state.choices.length,0);
});

test('claimed gem IDs never return; experience is conserved through level pauses', () => {
  const g=new Engine('gem-ledger'),claimed=new Set();
  let earned=0,spent=0;
  for(let n=0;n<2400&&['play','upgrade'].includes(g.state.mode);n++) {
    if(g.state.mode==='upgrade'){g.chooseUpgrade(choose(g.state));continue;}
    const prior=new Map(g.state.gems.map(x=>[x.id,x.value]));
    const level=g.state.level,threshold=g.state.nextXp;
    g.update(1/30,controls(g.state));
    const present=new Set(g.state.gems.map(x=>x.id));
    for(const id of present)assert.ok(!claimed.has(id));
    for(const [id,value] of prior)if(!present.has(id)){claimed.add(id);earned+=value;}
    if(g.state.level>level)spent+=threshold;
    // Gems created and immediately collected in the same frame are also legitimate.
    assert.ok(g.state.xp+spent>=earned);
    assertBounds(g.state);
  }
  assert.ok(claimed.size>50);
});

test('fresh engines reset all transient state and remain independent', () => {
  const first=new Engine('restart');
  for(let i=0;i<300;i++)first.update(1/60,{x:1,y:0,dodge:i===0});
  const second=new Engine('restart'),third=new Engine('restart');
  assert.deepEqual(second.state,third.state);
  assert.equal(second.state.t,0);
  assert.equal(second.state.p.hp,100);
  assert.equal(second.state.p.dodgeCooldown,0);
  assert.equal(second.state.level,1);
  assert.equal(second.state.kills,0);
  assert.equal(second.state.enemies.length,0);
  assert.notEqual(second.state,first.state);
  assert.notEqual(second.state.p,first.state.p);
  assert.notEqual(second.state.upgrades,first.state.upgrades);
});

test('invalid deltas and axes cannot poison state; long frame catch-up is bounded', () => {
  const g=new Engine('defensive');
  for(const dt of [NaN,Infinity,-1,0])g.update(dt,{x:Infinity,y:NaN});
  assert.equal(g.state.t,0);
  g.update(100000,{x:Infinity,y:NaN});
  assert.ok(g.state.t<=.251);
  assertBounds(g.state);
  assert.equal(g.state.p.x,900);
  assert.equal(g.state.p.y,900);
});
