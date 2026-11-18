// Vice Tides — boot and the one game loop. Builds the renderer and every system,
// owns the screen state (title / play / pause / busted-or-wasted), the chase and
// on-foot cameras, the sun that follows the player so shadows stay crisp, saving,
// and the deterministic ?shot=1..4 staging the screenshots are taken with.
const THREE = window.THREE;
import { createInput } from './input.js';
import { makeTextures } from './textures.js';
import { createWorld, groundY } from './world.js';
import { createPlayer, updatePlayerOnFoot, tryEnterExit, nearestCar } from './player.js';
import { updatePlayerCar, collideCars } from './driving.js';
import { spawnTraffic, spawnParked, updateTraffic } from './traffic.js';
import { createWanted, addCrime, updatePolice, clearWanted } from './police.js';
import { spawnPeds, updatePeds, checkPedHits } from './pedestrians.js';
import { createPickups, checkPickups, updateCombat } from './combat.js';
import { createMissionState, createMissionVisuals, createPackages, updateMissions, checkPackages } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave, hasSave } from './save.js';
import { stageShotPre, stageShotPost } from './shots.js';
import { LANDMARKS } from './world.js';

const params = new URLSearchParams(window.location.search);
const shotParam = Number.parseInt(params.get('shot') ?? '', 10);
const SHOT = Number.isInteger(shotParam) && shotParam >= 1 && shotParam <= 4 ? shotParam : null;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(150, 60, 260);

const G = {
  scene, camera, renderer,
  time: 0, state: 'title',
  camYaw: Math.PI, camPitch: 0.12, shake: 0,
  cars: [], peds: [], packagesFound: new Set(),
  wanted: createWanted(),
  missions: createMissionState(),
  hudTimer: null, objectivePos: null, objectiveOverride: null,
  threatAt: null, flash: null, tracer: null, shotCam: null,
  saveAt: 0,
};
G.input = createInput(canvas);
G.audio = createAudio();
G.hud = createHud();
G.textures = makeTextures();
G.world = createWorld(scene, G.textures);
G.player = createPlayer(scene);
G.playerPos = () => (G.player.inCar ? G.player.inCar.mesh.position : G.player.mesh.position);
G.playerHeading = () => (G.player.inCar ? G.player.inCar.heading : G.player.heading);
G.addCrime = (points, pos) => addCrime(G, points, pos);
G.toast = (text, s) => G.hud.toast(text, s);
G.phone = (from, text) => { G.audio.phone(); G.hud.phone(from, text); };
G.saveNow = () => { if (G.state === 'play') writeSave(G); };

spawnParked(G);
spawnTraffic(G);
spawnPeds(G);
createMissionVisuals(G);
createPackages(G);
createPickups(G);

// ---------- save / continue ----------
function applySave(data) {
  if (!data) return;
  G.player.money = data.money | 0;
  G.player.health = Math.min(100, Math.max(30, data.health || 100));
  G.missions.index = Math.min(5, data.missionIndex | 0);
  G.missions.storyDone = !!data.storyDone;
  if (G.missions.storyDone) G.missions.index = 5;
  for (const i of data.packages || []) {
    G.packagesFound.add(i);
    if (G.packageMeshes[i]) G.packageMeshes[i].visible = false;
  }
  if (typeof data.x === 'number') G.player.mesh.position.set(data.x, 0, data.z || 0);
  if (data.hasPistol) {
    G.player.hasPistol = true; G.player.ammo = data.ammo || 24;
    if (G.pickups) { G.pickups.taken = true; G.pickups.pistol.visible = false; }
  }
  G.missions.betweenAt = 2;
  G.missions.startAt = 2;
}

// ---------- screens ----------
const titleScreen = document.getElementById('titleScreen');
const pauseScreen = document.getElementById('pauseScreen');
const endScreen = document.getElementById('endScreen');
const status = document.getElementById('status');

function showScreen(which) {
  titleScreen.style.display = which === 'title' ? 'flex' : 'none';
  pauseScreen.style.display = which === 'pause' ? 'flex' : 'none';
  endScreen.style.display = which === 'over' ? 'flex' : 'none';
}
function startPlay() {
  G.state = 'play';
  showScreen(null);
  G.hud.show();
  G.audio.wake(); G.audio.click();
  G.input.lock();
  status.textContent = 'Playing Vice Tides.';
}
function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'pause';
  document.getElementById('pauseStats').textContent =
    `Cash $${G.player.money} · Jobs done ${G.missions.index}/5 · Packages ${G.packagesFound.size}/10`;
  showScreen('pause');
  G.input.unlock();
  G.saveNow();
}
function endRun(kind) {
  G.state = 'over';
  G.audio.busted();
  G.audio.engine(false, 0, 0.1); G.audio.radio(false); G.audio.siren(false, 0);
  document.getElementById('endTitle').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  document.getElementById('endText').textContent = kind === 'busted'
    ? 'The Palmera PD finally boxed Rico in. The fine stings, the record stings more — but the bay is still out there.'
    : 'Rico wakes up in Palmera General with a headache and a hospital bill. The bay is still out there.';
  showScreen('over');
  G.input.unlock();
}
G.onBusted = () => { if (G.state === 'play') endRun('busted'); };
function respawn() {
  const P = G.player;
  if (P.inCar) { P.inCar.driver = 'parked'; P.inCar.speed = 0; P.inCar = null; P.mesh.visible = true; }
  P.health = 100;
  P.money = Math.max(0, P.money - 200);
  P.mesh.position.set(LANDMARKS.hospital.x, 0, LANDMARKS.hospital.z);
  P.heading = 0;
  clearWanted(G);
  G.state = 'play';
  showScreen(null);
  G.hud.show();
  G.input.lock();
  G.saveNow();
}

document.getElementById('startBtn').addEventListener('click', () => { clearSave(); G.missions.index = 0; startPlay(); });
document.getElementById('continueBtn').addEventListener('click', () => startPlay());
document.getElementById('resumeBtn').addEventListener('click', () => { G.state = 'play'; showScreen(null); G.input.lock(); });
document.getElementById('restartBtn').addEventListener('click', () => { clearSave(); window.location.reload(); });
document.getElementById('respawnBtn').addEventListener('click', respawn);
if (hasSave()) document.getElementById('continueBtn').style.display = 'block';
document.addEventListener('pointerlockchange', () => {
  if (!G.input.isLocked() && G.state === 'play' && !SHOT) pauseGame();
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- camera ----------
const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();
function updateCamera(dt) {
  const pp = G.playerPos();
  const inCar = !!G.player.inCar;
  camTarget.set(pp.x, pp.y + (inCar ? 1.5 : 1.65), pp.z);
  const dist = inCar ? 10.5 : 7.4;
  const lift = (inCar ? 3.4 : 2.5) + G.camPitch * 7;
  camDesired.set(
    camTarget.x - Math.sin(G.camYaw) * dist,
    camTarget.y + lift,
    camTarget.z - Math.cos(G.camYaw) * dist,
  );
  camDesired.y = Math.max(camDesired.y, groundY(camDesired.x, camDesired.z) + 0.6);
  const k = 1 - Math.exp(-dt * (inCar ? 7 : 9));
  camera.position.lerp(camDesired, SHOT ? 1 : k);
  if (G.shake > 0.003) {
    camera.position.x += (Math.random() - 0.5) * G.shake;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.6;
    G.shake *= Math.exp(-dt * 7);
  }
  const look = camTarget.clone();
  look.x += Math.sin(G.camYaw) * 3.5; look.z += Math.cos(G.camYaw) * 3.5;
  camera.lookAt(look);
  // the sun (and its shadow box) travels with the player
  G.world.sun.position.set(pp.x - 320, 190, pp.z + 260);
  G.world.sun.target.position.set(pp.x, 0, pp.z);
}

// ---------- the loop ----------
function step(dt) {
  G.time += dt;
  const input = G.input;
  if (input.takePressed('KeyP')) { pauseGame(); return; }
  // mouse camera (pointer-locked); arrow keys nudge it when there is no lock
  const mouse = input.takeMouse();
  if (!G.player.inCar) {
    G.camYaw -= mouse.dx * 0.0026;
    G.camPitch = Math.max(-0.25, Math.min(0.75, G.camPitch + mouse.dy * 0.0022));
  }
  if (input.takePressed('KeyE')) tryEnterExit(G);
  if (input.takePressed('KeyQ') && G.player.hasPistol && !G.player.inCar) {
    G.player.weapon = G.player.weapon === 'pistol' ? 'fists' : 'pistol';
    G.audio.click();
  }
  if (G.player.inCar) updatePlayerCar(G, dt);
  else updatePlayerOnFoot(G, dt);
  updateTraffic(G, dt);
  updatePolice(G, dt);
  updatePeds(G, dt);
  checkPedHits(G);
  collideCars(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);
  checkPackages(G, dt);
  checkPickups(G);
  G.world.update(dt);
  // interaction prompt
  if (!G.player.inCar) {
    const car = nearestCar(G);
    G.hud.setPrompt(car ? `<b>E</b> Enter ${car.kind}` : null);
  } else G.hud.setPrompt(Math.abs(G.player.inCar.speed) < 3 ? '<b>E</b> Exit vehicle' : null);
  if (G.player.health <= 0 && G.state === 'play') { endRun('wasted'); return; }
  if (G.time > G.saveAt) { G.saveAt = G.time + 6; G.saveNow(); }
  updateCamera(dt);
  G.hud.update(G);
  input.endFrame();
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.state === 'play') step(dt);
  else if (G.state === 'title') {
    // a slow aerial drift over the bay behind the title
    G.time += dt;
    updateTraffic(G, dt);
    updatePeds(G, dt);
    G.world.update(dt);
    const t = G.time * 0.045;
    camera.position.set(Math.sin(t) * 190, 64, 120 + Math.cos(t) * 150);
    camera.lookAt(0, 0, 30);
  }
  renderer.render(scene, camera);
}

// ---------- screenshot staging ----------
if (SHOT) {
  applySave(null);
  G.state = 'play';
  showScreen(null);
  G.hud.show();
  stageShotPre(G, SHOT);
  const DT = 1 / 30;
  for (let i = 0; i < 80; i++) {
    G.time += DT;
    updateTraffic(G, DT);
    updatePeds(G, DT);
    // police are staged, not simulated: a frozen frame of the chase reads better
    // than 2.7 s of AI converging on a parked hero car
    G.world.update(DT);
  }
  stageShotPost(G, SHOT);
  const c = G.shotCam;
  camera.position.set(c.x, c.y, c.z);
  camera.lookAt(c.lx, c.ly, c.lz);
  G.world.sun.position.set(G.playerPos().x - 320, 190, G.playerPos().z + 260);
  G.world.sun.target.position.copy(G.playerPos());
  G.hud.update(G);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  window.__shotReady = true;
} else {
  showScreen('title');
  if (hasSave()) applySave(loadSave());
  requestAnimationFrame(frame);
}
