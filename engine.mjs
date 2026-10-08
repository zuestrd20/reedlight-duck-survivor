// Original, deterministic simulation. Rendering and sound deliberately live elsewhere.
export const WORLD_SIZE = 1800;
export const RUN_DURATION = 180;
export const HARD_CAP = 210;
const STEP = 1 / 60;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const finite = v => Number.isFinite(v) ? v : 0;
const DEFINITIONS = {
  seed: { name: '橡果連弩', icon: '🌰', max: 5, desc: '橡果傷害提升。橡果連弩 3 級＋疾風羽翼 3 級可進化。' },
  rapid: { name: '疾風羽翼', icon: '⚡', max: 4, desc: '橡果發射間隔縮短 18%。可與橡果連弩搭配進化。' },
  lantern: { name: '螢火提燈', icon: '✨', max: 5, desc: '環繞身旁的螢火灼燒敵人。螢火提燈 3 級＋長明光域 2 級可進化。' },
  reach: { name: '長明光域', icon: '🌻', max: 3, desc: '擴大螢火環繞與鳴叫範圍。可與螢火提燈搭配進化。' },
  wave: { name: '鴨鳴震波', icon: '🫧', max: 5, desc: '鳴叫震退周遭敵人。鴨鳴震波 3 級＋荒野之心 2 級可進化。' },
  force: { name: '荒野之心', icon: '💥', max: 3, desc: '所有武器傷害提升 20%。可與鴨鳴震波搭配進化。' },
  boots: { name: '輕盈鴨蹼', icon: '🪶', max: 3, desc: '移動速度提升 12%，翻滾冷卻縮短。' },
  heart: { name: '暖絨護身', icon: '💛', max: 4, desc: '生命上限增加 25，立即恢復 35 點生命。' },
  magnet: { name: '拾光石', icon: '🧲', max: 3, desc: '從更遠處吸取光點，並恢復 12 點生命。' },
  mend: { name: '莓果野餐', icon: '🍓', max: Infinity, desc: '立即恢復 45 點生命。' }
};
function hashSeed(seed) {
  const str = String(seed ?? 'duck');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export class Engine {
  constructor(seed = 'woodland') {
    this.seed = String(seed); this.rng = hashSeed(seed); this.id = 0;
    this.accumulator = 0; this.shotTimer = 0; this.waveTimer = 3; this.spawnTimer = .2;
    this.orbitTick = 0; this.lastDodge = false; this.bossVolley = 3;
    this.state = {
      seed: this.seed, worldSize: WORLD_SIZE, duration: RUN_DURATION, hardCap: HARD_CAP,
      mode: 'play', t: 0, kills: 0, level: 1, xp: 0, nextXp: 5, score: 0,
      p: { x: 900, y: 900, r: 17, hp: 100, maxHp: 100, speed: 205, invuln: 0,
        dodgeCooldown: 0, dodgeDuration: 0, facingX: 1, facingY: 0, dashX: 1, dashY: 0 },
      enemies: [], bullets: [], gems: [], effects: [], choices: [],
      upgrades: { seed: 1, rapid: 0, lantern: 0, reach: 0, wave: 0, force: 0, boots: 0, heart: 0, magnet: 0, mend: 0 },
      evolutions: [], bossSpawned: false, bossHp: 0, bossMaxHp: 0, damageTaken: 0, dodges: 0,
      reason: '', orbitAngle: 0, orbitRadius: 75, orbitCount: 0, waveRadius: 0
    };
  }
  random() {
    this.rng = (this.rng + 0x6D2B79F5) >>> 0;
    let t = this.rng; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  effect(kind, x, y, r = 20, text = '', life = .45) {
    const a = this.state.effects;
    if (a.length >= 80) a.shift();
    a.push({ id: ++this.id, kind, x, y, r, life, maxLife: life, text });
  }
  update(dt, input = {}) {
    if (this.state.mode !== 'play' || !Number.isFinite(dt) || dt <= 0) return this.state;
    // One call can never create an unbounded catch-up loop after tab suspension.
    this.accumulator += Math.min(dt, .25);
    const controls = { x: finite(input.x), y: finite(input.y), dodge: !!input.dodge };
    let count = 0;
    while (this.accumulator + 1e-10 >= STEP && this.state.mode === 'play' && count++ < 16) {
      this.accumulator = Math.max(0, this.accumulator - STEP);
      this.step(STEP, controls);
    }
    if (this.state.mode !== 'play') this.accumulator = 0;
    return this.state;
  }
  chooseUpgrade(id) {
    const s = this.state;
    if (s.mode !== 'upgrade' || !s.choices.some(c => c.id === id)) return false;
    const d = DEFINITIONS[id];
    if (!d || s.upgrades[id] >= d.max) return false;
    s.upgrades[id]++;
    if (id === 'heart') { s.p.maxHp += 25; s.p.hp = Math.min(s.p.maxHp, s.p.hp + 35); }
    if (id === 'mend') s.p.hp = Math.min(s.p.maxHp, s.p.hp + 45);
    if (id === 'magnet') s.p.hp = Math.min(s.p.maxHp, s.p.hp + 12);
    s.p.speed = 205 * (1 + .12 * s.upgrades.boots);
    s.p.invuln = Math.max(s.p.invuln, .75);
    s.choices = []; s.mode = 'play'; this.checkEvolutions(); this.checkLevel();
    return true;
  }
  checkEvolutions() {
    const s = this.state, u = s.upgrades;
    const ready = [
      ['sunflower', '向日葵齊射', u.seed >= 3 && u.rapid >= 3],
      ['halo', '日輪提燈', u.lantern >= 3 && u.reach >= 2],
      ['tide', '破曉潮音', u.wave >= 3 && u.force >= 2]
    ];
    for (const [id, name, eligible] of ready) if (eligible && !s.evolutions.includes(id)) {
      s.evolutions.push(id); this.effect('evolution', s.p.x, s.p.y, 180, name, 2);
      s.p.hp = Math.min(s.p.maxHp, s.p.hp + 20);
    }
  }
  checkLevel() {
    const s = this.state;
    if (s.mode !== 'play' || s.xp < s.nextXp) return;
    s.xp -= s.nextXp; s.level++; s.nextXp = Math.floor(5 + (s.level - 1) * 2.1);
    s.mode = 'upgrade';
    let pool = Object.keys(DEFINITIONS).filter(id => s.upgrades[id] < DEFINITIONS[id].max && id !== 'mend');
    // Uniform sampling without replacement; upgrades on active weapons remain discoverable.
    const ids = [];
    if (s.level === 2) ids.push('lantern', 'wave', 'rapid');
    else {
      const synergy = [];
      if (s.upgrades.seed >= 3 && s.upgrades.rapid < 3) synergy.push('rapid');
      if (s.upgrades.rapid >= 3 && s.upgrades.seed < 3) synergy.push('seed');
      if (s.upgrades.lantern >= 3 && s.upgrades.reach < 2) synergy.push('reach');
      if (s.upgrades.reach >= 2 && s.upgrades.lantern < 3) synergy.push('lantern');
      if (s.upgrades.wave >= 3 && s.upgrades.force < 2) synergy.push('force');
      if (s.upgrades.force >= 2 && s.upgrades.wave < 3) synergy.push('wave');
      if (synergy.length) ids.push(synergy[Math.floor(this.random() * synergy.length)]);
      pool = pool.filter(id => !ids.includes(id));
      while (ids.length < 3 && pool.length) ids.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    }
    if (s.p.hp < s.p.maxHp * .5 && !ids.includes('heart') && !ids.includes('mend')) ids[ids.length - 1] = s.upgrades.heart < 4 ? 'heart' : 'mend';
    if (ids.length < 3) ids.push('mend');
    s.choices = ids.map(id => ({ id, name: DEFINITIONS[id].name, desc: DEFINITIONS[id].desc, icon: DEFINITIONS[id].icon, level: s.upgrades[id] + 1 }));
    this.effect('level', s.p.x, s.p.y, 90, `第 ${s.level} 級`, 1);
  }
  spawnEnemy(boss = false) {
    const s = this.state;
    if (s.enemies.length >= 120 && !boss) return;
    const angle = this.random() * TAU;
    let x = clamp(s.p.x + Math.cos(angle) * 570, 35, WORLD_SIZE - 35);
    let y = clamp(s.p.y + Math.sin(angle) * 570, 35, WORLD_SIZE - 35);
    if ((x - s.p.x) ** 2 + (y - s.p.y) ** 2 < 420 ** 2) {
      x = clamp(s.p.x - Math.cos(angle) * 570, 35, WORLD_SIZE - 35);
      y = clamp(s.p.y - Math.sin(angle) * 570, 35, WORLD_SIZE - 35);
    }
    const roll = this.random();
    const kind = boss ? 'boss' : s.t > 55 && roll < .16 ? 'boar' : s.t > 25 && roll < .33 ? 'beetle' : s.t > 12 && roll > .73 ? 'wasp' : 'slug';
    const stats = {
      slug: [10, 67, 15, 1, 9], wasp: [12, 109, 12, 1, 8],
      beetle: [32, 48, 21, 3, 14], boar: [27, 77, 19, 2, 13], boss: [1050, 43, 48, 30, 24]
    }[kind];
    const hp = boss ? stats[0] : stats[0] * (1 + Math.max(0, s.t - 75) / 240);
    const e = { id: ++this.id, kind, x, y, r: stats[2], hp, maxHp: hp, speed: stats[1], value: stats[3], damage: stats[4],
      hitFlash: 0, isBoss: boss, phase: this.random() * TAU, timer: 1.5 + this.random() * 2, charge: 0, vx: 0, vy: 0, knockX: 0, knockY: 0 };
    if (boss && s.enemies.length >= 120) s.enemies.shift();
    s.enemies.push(e);
    if (boss) { s.bossSpawned = true; s.bossHp = hp; s.bossMaxHp = hp; this.effect('boss', x, y, 120, '霧冠巨靈甦醒', 2); }
  }
  hurtEnemy(e, damage, knock = 0) {
    if (e.hp <= 0) return;
    e.hp -= damage; e.hitFlash = .1;
    if (knock && !e.isBoss) {
      const dx = e.x - this.state.p.x, dy = e.y - this.state.p.y, d = Math.hypot(dx, dy) || 1;
      e.knockX += dx / d * knock; e.knockY += dy / d * knock;
    }
    if (e.isBoss) this.state.bossHp = Math.max(0, e.hp);
    if (e.hp <= 0) {
      const s = this.state; s.kills++; s.score += e.isBoss ? 1000 : e.value * 10;
      this.effect('pop', e.x, e.y, e.r * 1.7, '', .28);
      if (e.isBoss && s.p.hp > 0 && s.mode === 'play') { s.mode = 'won'; s.reason = 'boss'; this.effect('victory', e.x, e.y, 200, '晨光重返森林', 4); }
      else this.dropGem(e.x, e.y, e.value);
    }
  }
  dropGem(x, y, value) {
    const a = this.state.gems;
    if (a.length < 220) a.push({ id: ++this.id, x, y, r: value >= 3 ? 7 : 5, value, magnetized: false });
    else { let closest = a[0]; for (const g of a) if ((g.x-x)**2+(g.y-y)**2 < (closest.x-x)**2+(closest.y-y)**2) closest = g; closest.value += value; closest.r = 8; }
  }
  hurtPlayer(damage) {
    const s = this.state, p = s.p;
    if (p.invuln > 0 || s.mode !== 'play') return;
    p.hp = Math.max(0, p.hp - damage); p.invuln = .8; s.damageTaken += damage;
    this.effect('hurt', p.x, p.y, 45, `−${damage}`, .65);
    if (p.hp <= 0) { s.mode = 'lost'; s.reason = 'health'; }
  }
  addBullet(b) {
    if (this.state.bullets.length < 180) this.state.bullets.push({ id: ++this.id, ...b, hits: [] });
  }
  fireSeed() {
    const s = this.state, p = s.p, u = s.upgrades;
    let target = null, best = 710 ** 2;
    for (const e of s.enemies) if (e.hp > 0) { const d = dist2(p, e); if (d < best) { best = d; target = e; } }
    if (!target) return false;
    const evo = s.evolutions.includes('sunflower');
    const count = evo ? 3 : u.seed >= 4 ? 2 : 1;
    const angle = Math.atan2(target.y-p.y, target.x-p.x);
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count-1)/2) * .13;
      this.addBullet({ kind: evo ? 'sunflower' : 'seed', owner: 'player', x: p.x, y: p.y,
        vx: Math.cos(a)*575, vy: Math.sin(a)*575, r: evo ? 7 : 5, life: 1.45,
        damage: (10 + (u.seed-1)*6) * (1 + u.force*.2) * (evo ? 1.3 : 1), pierce: evo ? 3 : u.seed >= 4 ? 2 : 1 });
    }
    return true;
  }
  step(dt, input) {
    const s = this.state, p = s.p, u = s.upgrades;
    s.t += dt;
    if (s.t + 1e-8 >= HARD_CAP) { s.t = HARD_CAP; s.mode = 'lost'; s.reason = 'timeout'; return; }
    p.invuln = Math.max(0, p.invuln-dt); p.dodgeCooldown = Math.max(0, p.dodgeCooldown-dt);
    const mag = Math.hypot(input.x, input.y);
    const mx = mag > 0 ? input.x / Math.max(1, mag) : 0, my = mag > 0 ? input.y / Math.max(1, mag) : 0;
    if (mag > .05) { p.facingX = input.x / mag; p.facingY = input.y / mag; }
    if (input.dodge && !this.lastDodge && p.dodgeCooldown <= 0) {
      p.dodgeDuration = .22; p.dodgeCooldown = Math.max(1.6, 3.2 - .4*u.boots); p.invuln = .42;
      p.dashX = p.facingX; p.dashY = p.facingY; s.dodges++; this.effect('dash',p.x,p.y,30,'',.25);
    }
    this.lastDodge = input.dodge;
    if (p.dodgeDuration > 0) {
      p.x += p.dashX * 640 * dt; p.y += p.dashY * 640 * dt; p.dodgeDuration = Math.max(0,p.dodgeDuration-dt);
    } else { p.x += mx * p.speed * dt; p.y += my * p.speed * dt; }
    p.x = clamp(p.x,p.r,WORLD_SIZE-p.r); p.y = clamp(p.y,p.r,WORLD_SIZE-p.r);
    if (s.t + 1e-8 >= 150 && !s.bossSpawned) this.spawnEnemy(true);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy(); this.spawnTimer += 1 / (s.bossSpawned ? 2.1 : 1.25 + Math.min(s.t,150)*.027);
    }
    this.shotTimer -= dt;
    if (this.shotTimer <= 0) {
      if (this.fireSeed()) this.shotTimer += .46 * Math.pow(.82,u.rapid);
      else this.shotTimer = .06;
    }
    s.orbitAngle += dt * (2.1 + .12*u.lantern);
    s.orbitRadius = (75 + u.reach*20) * (s.evolutions.includes('halo') ? 1.15 : 1);
    s.orbitCount = u.lantern > 0 ? Math.min(6, 1+u.lantern) : 0;
    this.orbitTick -= dt;
    const orbitActive = this.orbitTick <= 0 && u.lantern > 0;
    if (orbitActive) this.orbitTick += .12;
    this.waveTimer -= dt;
    if (u.wave && this.waveTimer <= 0) {
      const evo = s.evolutions.includes('tide');
      const radius = (140 + u.wave*18 + u.reach*24) * (evo ? 1.5 : 1);
      const damage = (14 + u.wave*9) * (1+u.force*.2) * (evo ? 1.65 : 1);
      this.waveTimer = Math.max(1.65,4.2-u.wave*.35);
      s.waveRadius = radius; this.effect('wave',p.x,p.y,radius,evo ? '嘎——！' : '',.6);
      for (const e of s.enemies) if (dist2(p,e) < (radius+e.r)**2) this.hurtEnemy(e,damage,210);
    }
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      e.hitFlash = Math.max(0,e.hitFlash-dt);
      const dx = p.x-e.x, dy = p.y-e.y, distance = Math.hypot(dx,dy) || 1;
      let vx = dx/distance*e.speed, vy = dy/distance*e.speed;
      if (e.kind === 'wasp') { vx += -dy/distance*Math.sin(s.t*3+e.phase)*28; vy += dx/distance*Math.sin(s.t*3+e.phase)*28; }
      if (e.kind === 'boar') {
        e.timer -= dt;
        if (e.timer <= 0 && e.charge <= 0) { e.charge = .6; e.timer = 3.5; e.vx = dx/distance*265; e.vy = dy/distance*265; }
        if (e.charge > 0) { e.charge -= dt; vx = e.vx; vy = e.vy; }
      }
      if (e.isBoss) {
        this.bossVolley -= dt;
        if (this.bossVolley <= 0) {
          this.bossVolley = e.hp < e.maxHp*.5 ? 2.4 : 3.4;
          this.effect('stomp',e.x,e.y,100,'',.5);
          for (let j = 0; j < 10; j++) {
            const a = j/10*TAU+s.t*.31;
            this.addBullet({kind:'spore',owner:'enemy',x:e.x,y:e.y,vx:Math.cos(a)*132,vy:Math.sin(a)*132,r:8,life:5,damage:10,pierce:1});
          }
        }
      }
      e.x = clamp(e.x+(vx+e.knockX)*dt,e.r,WORLD_SIZE-e.r); e.y = clamp(e.y+(vy+e.knockY)*dt,e.r,WORLD_SIZE-e.r);
      e.knockX *= Math.exp(-8*dt); e.knockY *= Math.exp(-8*dt);
      if (orbitActive) {
        for (let i=0;i<s.orbitCount;i++) {
          const a=s.orbitAngle+i/s.orbitCount*TAU;
          const ox=p.x+Math.cos(a)*s.orbitRadius, oy=p.y+Math.sin(a)*s.orbitRadius;
          const radius=s.evolutions.includes('halo') ? 31 : 22;
          if ((e.x-ox)**2+(e.y-oy)**2 < (e.r+radius)**2) this.hurtEnemy(e,(8+u.lantern*5)*(1+u.force*.2),45);
        }
      }
      if (e.hp > 0 && dist2(p,e) < (p.r+e.r-3)**2) this.hurtPlayer(e.damage);
    }
    for (const b of s.bullets) {
      b.life -= dt; const oldX=b.x, oldY=b.y; b.x += b.vx*dt; b.y += b.vy*dt;
      if (b.owner === 'enemy') {
        if (segmentHit(oldX,oldY,b.x,b.y,p.x,p.y,p.r+b.r)) { this.hurtPlayer(b.damage); b.life = 0; }
      } else {
        for (const e of s.enemies) {
          if (e.hp <= 0 || b.life <= 0 || b.hits.includes(e.id)) continue;
          if (segmentHit(oldX,oldY,b.x,b.y,e.x,e.y,e.r+b.r)) {
            b.hits.push(e.id); this.hurtEnemy(e,b.damage,35); b.pierce--;
            if (b.pierce <= 0) b.life=0;
          }
        }
      }
    }
    s.enemies = s.enemies.filter(e=>e.hp>0);
    s.bullets = s.bullets.filter(b=>b.life>0 && b.x>-30 && b.y>-30 && b.x<WORLD_SIZE+30 && b.y<WORLD_SIZE+30);
    const magnetRadius = 105 + u.magnet*65;
    const remaining = [];
    for (const g of s.gems) {
      const dx=p.x-g.x,dy=p.y-g.y,d=Math.hypot(dx,dy);
      if (d < magnetRadius) g.magnetized=true;
      if (g.magnetized && d>1) { const step=Math.min(d,(285+u.magnet*45)*dt); g.x+=dx/d*step; g.y+=dy/d*step; }
      if (dist2(p,g) < (p.r+g.r+5)**2) { s.xp+=g.value; s.score+=g.value; }
      else remaining.push(g);
    }
    s.gems = remaining;
    for (const f of s.effects) f.life-=dt;
    s.effects=s.effects.filter(f=>f.life>0);
    this.checkLevel();
  }
}
function segmentHit(ax,ay,bx,by,cx,cy,r) {
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
  const t=den ? clamp(((cx-ax)*dx+(cy-ay)*dy)/den,0,1) : 0;
  return (ax+t*dx-cx)**2+(ay+t*dy-cy)**2 <= r*r;
}
export default Engine;
