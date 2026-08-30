'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Skins ─────────────────────────────────────────────────────────────────────
// Cosméticas: cada skin define silueta (shape), color de trazo, relleno opcional
// translúcido y color/soporte de la llama. Todas caben en el mismo volumen: no
// alteran la hitbox (radius) ni el punto de disparo (NOSE).
const SKINS = [
  {
    name: 'CLÁSICA',
    stroke: '#fff',
    shape: [[20, 0], [-12, -9], [-7, 0], [-12, 9]],
    flame: 'rgba(255, 130, 0, 0.85)',
  },
  {
    name: 'INTERCEPTOR',
    stroke: '#0f0',
    shape: [[22, 0], [-6, -5], [-14, -12], [-9, 0], [-14, 12], [-6, 5]],
    flame: 'rgba(0, 255, 120, 0.85)',
    flameX: -9,
  },
  {
    name: 'ORBE',
    stroke: '#0ff',
    fill: 'rgba(0, 255, 255, 0.15)',
    shape: [[16, 0], [0, -11], [-16, 0], [0, 11]],
    flame: 'rgba(140, 225, 255, 0.85)',
    flameX: -14,
    flameW: 3.5,
  },
  {
    name: 'PIRATA',
    stroke: '#f6f',
    shape: [[18, 0], [-10, -14], [-5, -4], [-9, 0], [-5, 4], [-10, 14]],
    flame: 'rgba(255, 90, 255, 0.85)',
    flameX: -10,
  },
  {
    name: 'ESPECTRO',
    stroke: '#ff5',
    fill: 'rgba(255, 255, 0, 0.12)',
    shape: [[24, 0], [-8, -5], [-13, 0], [-8, 5]],
    flame: 'rgba(255, 230, 100, 0.85)',
    flameX: -10,
    flameW: 3,
  },
];

// Skin activa, recordada entre sesiones
function loadSkinIndex() {
  try {
    const i = Number(localStorage.getItem('asteroids-skin'));
    return Number.isInteger(i) && i >= 0 && i < SKINS.length ? i : 0;
  } catch {
    return 0;
  }
}

let skinIndex = loadSkinIndex();
let skinToast = 0;   // segundos restantes del aviso 'SKIN: ...' en el HUD

function cycleSkin(dir) {
  skinIndex = wrap(skinIndex + dir, SKINS.length);
  skinToast = 1.5;
  try { localStorage.setItem('asteroids-skin', String(skinIndex)); } catch {}
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
const SHIELD_R = 26;   // radio visual del campo de escudo

class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.boost         = 0;   // segundos de TURBO restantes
    this.shield        = 0;   // segundos de ESCUDO restantes
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.boost         > 0) this.boost         -= dt;
    if (this.shield        > 0) this.shield        -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260 * (this.boost > 0 ? 2 : 1);  // TURBO: doble empuje
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = SKINS[skinIndex];

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.stroke;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta de la skin activa
    ctx.beginPath();
    ctx.moveTo(skin.shape[0][0], skin.shape[0][1]);
    for (let i = 1; i < skin.shape.length; i++)
      ctx.lineTo(skin.shape[i][0], skin.shape[i][1]);
    ctx.closePath();
    if (skin.fill) {
      ctx.fillStyle = skin.fill;
      ctx.fill();
    }
    ctx.stroke();

    // Llama del propulsor (cian fijo durante el TURBO)
    if (this.thrusting && Math.random() > 0.35) {
      const fx = skin.flameX ?? -8;
      const fw = skin.flameW ?? 4;
      ctx.beginPath();
      ctx.moveTo(fx, -fw);
      ctx.lineTo(fx - rand(6, 14), 0);
      ctx.lineTo(fx,  fw);
      ctx.strokeStyle = this.boost > 0 ? 'rgba(0, 255, 255, 0.9)' : skin.flame;
      ctx.stroke();
    }

    // Campo del ESCUDO (parpadea en el último segundo)
    if (this.shield > 0 && !(this.shield <= 1 && Math.floor(this.shield * 8) % 2 === 0)) {
      const pulse = 1 + Math.sin(this.shield * 6) * 0.08;
      ctx.fillStyle   = 'rgba(0, 255, 127, 0.10)';
      ctx.strokeStyle = 'rgba(0, 255, 127, 0.8)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, SHIELD_R * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-ups (TURBO / ESCUDO) ────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, kind = 'turbo') {
    this.kind = kind;
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 45);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = 10;
    this.ttl  = 10;   // desaparece a los 10 s si no se recoge
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo en los últimos 3 segundos
    if (this.ttl < 3 && Math.floor(this.ttl * 6) % 2 === 0) return;

    const turbo = this.kind === 'turbo';

    ctx.save();
    ctx.translate(this.x, this.y);

    // Aura pulsante
    const pulse = 1 + Math.sin(this.ttl * 5) * 0.15;
    ctx.strokeStyle = turbo ? 'rgba(255, 210, 0, 0.55)' : 'rgba(0, 255, 127, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, (this.radius + 4) * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Símbolo: rayo (velocidad) o cresta (escudo)
    ctx.fillStyle   = turbo ? 'rgba(255, 210, 0, 0.25)' : 'rgba(0, 255, 127, 0.25)';
    ctx.strokeStyle = turbo ? '#ffd200' : '#00ff7f';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    if (turbo) {
      ctx.moveTo( 2, -8);
      ctx.lineTo(-4,  1);
      ctx.lineTo(-1,  1);
      ctx.lineTo(-2,  8);
      ctx.lineTo( 4, -1);
      ctx.lineTo( 1, -1);
    } else {
      ctx.moveTo( 0, -8);
      ctx.lineTo( 6, -5);
      ctx.lineTo( 6,  2);
      ctx.lineTo( 0,  8);
      ctx.lineTo(-6,  2);
      ctx.lineTo(-6, -5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function destroyAsteroid(a) {
  a.dead = true;
  score += POINTS[a.size];
  explode(a.x, a.y, a.size * 5);
  // 10% de probabilidad de soltar un power-up (TURBO o ESCUDO)
  if (Math.random() < 0.1)
    powerUps.push(new PowerUp(a.x, a.y, Math.random() < 0.5 ? 'turbo' : 'shield'));
  return a.split();
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  // Cambio de skin: S siguiente, Q anterior (válido en cualquier estado)
  if (pressed('KeyS')) cycleSkin(1);
  if (pressed('KeyQ')) cycleSkin(-1);
  if (skinToast > 0) skinToast -= dt;

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerUps.forEach(p => p.update(dt));
    powerUps = powerUps.filter(p => !p.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(p => !p.dead);

  // Nave vs power-up: TURBO (5 s de doble empuje) o ESCUDO (3 s de protección)
  for (const pu of powerUps) {
    if (!pu.dead && dist(ship, pu) < ship.radius + pu.radius) {
      pu.dead = true;
      if (pu.kind === 'turbo') ship.boost  = 5;
      else                     ship.shield = 3;
      explode(pu.x, pu.y, 8);
    }
  }

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        newAsteroids.push(...destroyAsteroid(a));
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs asteroide: con ESCUDO activo se destruye el asteroide
  if (ship.invincible <= 0) {
    const hitR = ship.shield > 0 ? SHIELD_R : ship.radius;
    const newAst = [];
    for (const a of asteroids) {
      if (!a.dead && dist(ship, a) < hitR + a.radius * 0.82) {
        if (ship.shield > 0) newAst.push(...destroyAsteroid(a));
        else { killShip(); break; }
      }
    }
    asteroids = asteroids.filter(a => !a.dead).concat(newAst);
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  const skin = SKINS[skinIndex];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.scale(0.45, 0.45);
  ctx.strokeStyle = skin.stroke;
  ctx.lineWidth   = 2.7;   // ~1.2 visual tras el escalado
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(skin.shape[0][0], skin.shape[0][1]);
  for (let i = 1; i < skin.shape.length; i++)
    ctx.lineTo(skin.shape[i][0], skin.shape[i][1]);
  ctx.closePath();
  if (skin.fill) {
    ctx.fillStyle = skin.fill;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

function drawTimerPanel(rgb, title, t, max, bx) {
  // Panel lateral de cuenta regresiva, reutilizado por TURBO y ESCUDO
  const secs  = Math.ceil(t);
  const frac  = t / max;
  const hot   = t <= 1;                  // último segundo: aviso
  const color = hot ? '#ffa500' : `rgb(${rgb})`;

  const bw = 70;
  const bh = 168;
  const by = 54;
  const cx = bx + bw / 2;

  // Marco del panel
  ctx.fillStyle   = hot ? 'rgba(255, 165, 0, 0.10)' : `rgba(${rgb}, 0.08)`;
  ctx.strokeStyle = hot ? 'rgba(255, 165, 0, 0.60)' : `rgba(${rgb}, 0.5)`;
  ctx.lineWidth   = 1;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx, by, bw, bh);

  // Título y segundos restantes
  ctx.fillStyle = color;
  ctx.font      = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, cx, by + 20);

  ctx.font = 'bold 32px monospace';
  ctx.fillText(String(secs), cx, by + 58);

  // Barra vertical que se vacía
  const barX = cx - 16;
  const barY = by + 74;
  const barW = 32;
  const barH = bh - 94;
  ctx.strokeStyle = hot ? 'rgba(255, 165, 0, 0.4)' : `rgba(${rgb}, 0.4)`;
  ctx.strokeRect(barX, barY, barW, barH);
  const fillH = (barH - 4) * frac;
  ctx.fillRect(barX + 2, barY + barH - 2 - fillH, barW - 4, fillH);
}

function drawBoostBar() {
  // Panel derecho: cuenta regresiva del TURBO (5 → 1 s)
  if (ship.boost <= 0) return;
  drawTimerPanel('0, 255, 255', 'VELOCIDAD', Math.max(ship.boost, 0), 5, W - 70 - 14);
}

function drawShieldBar() {
  // Panel izquierdo: cuenta regresiva del ESCUDO (3 → 1 s)
  if (ship.shield <= 0) return;
  drawTimerPanel('0, 255, 127', 'ESCUDO', Math.max(ship.shield, 0), 3, 14);
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  drawBoostBar();
  drawShieldBar();

  // Aviso temporal al cambiar de skin (se desvanece al final)
  if (skinToast > 0) {
    const skin = SKINS[skinIndex];
    ctx.globalAlpha = Math.min(1, skinToast * 2);
    ctx.textAlign   = 'center';
    ctx.fillStyle   = skin.stroke;
    ctx.font        = 'bold 15px monospace';
    ctx.fillText(`SKIN: ${skin.name}`, W / 2, 52);
    ctx.globalAlpha = 1;
  }

  // Pista de controles
  ctx.textAlign   = 'left';
  ctx.fillStyle   = 'rgba(255, 255, 255, 0.35)';
  ctx.font        = '11px monospace';
  ctx.fillText('S/Q: SKIN', 14, H - 14);
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  powerUps.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
