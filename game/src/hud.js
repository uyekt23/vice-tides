// Vice Tides — the HUD: health, money, wanted stars, weapon, objective line,
// mission timer, toasts, Dario's phone, and the live circular minimap (roads,
// water, the player, police, traffic, packages and the objective, north-up).
import { V_ROADS, H_ROADS } from './world.js';
import { CITY_MAX_Z, SAND_END_Z } from './config.js';
import { currentObjectiveText } from './missions.js';

const el = (id) => document.getElementById(id);

export function createHud() {
  const hud = el('hud');
  const healthBar = el('healthBar'), moneyEl = el('money'), starsEl = el('stars');
  const weaponEl = el('weaponBox'), objectiveEl = el('objective'), timerEl = el('timer');
  const toastEl = el('toast'), promptEl = el('prompt'), phoneEl = el('phone');
  const phoneFrom = el('phoneFrom'), phoneText = el('phoneText');
  const crosshair = el('crosshair'), speedo = el('speedo');
  const map = el('minimap').getContext('2d');
  let toastUntil = 0, phoneUntil = 0, lastObjective = '', frame = 0;

  function toast(text, seconds = 2.6) {
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    toastUntil = performance.now() + seconds * 1000;
  }
  function phone(from, text, seconds = 7) {
    phoneFrom.textContent = from;
    phoneText.textContent = text;
    phoneEl.style.display = 'block';
    phoneUntil = performance.now() + seconds * 1000;
  }
  function setPrompt(html) {
    if (html) { promptEl.innerHTML = html; promptEl.style.display = 'block'; }
    else promptEl.style.display = 'none';
  }

  function drawMinimap(G) {
    const W = 188, C = W / 2, RANGE = 105; // metres across the disc
    const pp = G.playerPos();
    const px = (x) => C + ((x - pp.x) / RANGE) * C;
    const pz = (z) => C + ((z - pp.z) / RANGE) * C;
    map.clearRect(0, 0, W, W);
    map.fillStyle = '#46603c'; map.fillRect(0, 0, W, W);
    // sea and sand to the south
    map.fillStyle = '#1d6f8e';
    map.fillRect(0, pz(SAND_END_Z), W, W - pz(SAND_END_Z));
    map.fillStyle = '#ecc987';
    map.fillRect(0, pz(CITY_MAX_Z), W, pz(SAND_END_Z) - pz(CITY_MAX_Z));
    // roads
    map.strokeStyle = '#3a3a46'; map.lineCap = 'round';
    map.lineWidth = Math.max(3, (16 / RANGE) * C);
    for (const x of V_ROADS) { map.beginPath(); map.moveTo(px(x), 0); map.lineTo(px(x), W); map.stroke(); }
    for (const z of H_ROADS) { map.beginPath(); map.moveTo(0, pz(z)); map.lineTo(W, pz(z)); map.stroke(); }
    const dot = (x, z, color, r) => {
      const X = px(x), Z = pz(z);
      if (X < -6 || X > W + 6 || Z < -6 || Z > W + 6) return;
      map.fillStyle = color;
      map.beginPath(); map.arc(X, Z, r, 0, Math.PI * 2); map.fill();
    };
    for (const m of G.packageMeshes) if (m.visible) dot(m.position.x, m.position.z, '#7dff8a', 2.4);
    for (const car of G.cars) {
      if (car.driver === 'traffic') dot(car.mesh.position.x, car.mesh.position.z, '#c9ccd4', 2.2);
      else if (car.driver === 'police') dot(car.mesh.position.x, car.mesh.position.z, (frame >> 2) % 2 ? '#ff4455' : '#4488ff', 3.4);
    }
    const obj = G.objectivePos;
    if (obj) {
      const X = Math.max(8, Math.min(W - 8, px(obj.x))), Z = Math.max(8, Math.min(W - 8, pz(obj.z)));
      map.fillStyle = obj.taxi ? '#39c2d7' : '#ffd94d';
      map.beginPath(); map.arc(X, Z, 5, 0, Math.PI * 2); map.fill();
      map.strokeStyle = '#fff'; map.lineWidth = 1.6; map.stroke();
    }
    // player arrow, rotated to heading (north-up: heading 0 faces +z = down-screen)
    map.save();
    map.translate(C, C);
    map.rotate(Math.PI - G.playerHeading()); // arrow geometry points up; heading 0 is +z (down-screen)
    map.fillStyle = '#fff';
    map.beginPath(); map.moveTo(0, -7); map.lineTo(5, 6); map.lineTo(0, 3); map.lineTo(-5, 6); map.closePath(); map.fill();
    map.restore();
  }

  return {
    toast, phone, setPrompt,
    show() { hud.style.display = 'block'; },
    hide() { hud.style.display = 'none'; },
    update(G) {
      frame++;
      const p = G.player;
      healthBar.style.width = `${Math.max(0, p.health)}%`;
      healthBar.style.background = p.health < 30 ? '#ff3344' : 'linear-gradient(90deg,#ff5f6d,#ffc371)';
      moneyEl.textContent = `$${p.money}`;
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < G.wanted.stars ? '★' : '<span class="off">★</span>';
      starsEl.innerHTML = stars;
      weaponEl.textContent = p.inCar ? `${p.inCar.kind.toUpperCase()} — HEALTH ${Math.max(0, Math.round(p.inCar.health))}`
        : p.weapon === 'pistol' ? `PISTOL — ${p.ammo} ROUNDS` : 'FISTS';
      const objText = G.objectiveOverride ?? currentObjectiveText(G);
      if (objText !== lastObjective) { objectiveEl.innerHTML = objText; lastObjective = objText; }
      if (G.hudTimer !== null && G.hudTimer !== undefined) {
        timerEl.style.display = 'block';
        const s = Math.max(0, Math.ceil(G.hudTimer));
        timerEl.textContent = `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`;
        timerEl.style.color = s < 11 ? '#ff5566' : '#ffd94d';
      } else timerEl.style.display = 'none';
      crosshair.style.display = !p.inCar && p.weapon === 'pistol' ? 'block' : 'none';
      if (p.inCar) {
        speedo.style.display = 'block';
        speedo.textContent = `${Math.round(Math.abs(p.inCar.speed) * 3.6)} km/h`;
      } else speedo.style.display = 'none';
      const now = performance.now();
      if (now > toastUntil) toastEl.style.opacity = '0';
      if (now > phoneUntil) phoneEl.style.display = 'none';
      if (frame & 1) drawMinimap(G); // every other frame, starting with the first
    },
  };
}
