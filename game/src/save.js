// Vice Tides — progress in localStorage: money, story progress, packages found and
// where Rico was standing. Storage failures (private windows) are swallowed: the
// game still plays, it just forgets between visits.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch { return null; }
}

export function writeSave(G) {
  try {
    const p = G.player.inCar ? G.player.inCar.mesh.position : G.player.mesh.position;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: G.player.money,
      missionIndex: G.missions.index,
      storyDone: G.missions.storyDone,
      packages: [...G.packagesFound],
      hasPistol: G.player.hasPistol,
      ammo: G.player.ammo,
      health: Math.round(G.player.health),
      x: Math.round(p.x * 10) / 10,
      z: Math.round(p.z * 10) / 10,
    }));
  } catch { /* storage off: play on without it */ }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}

export function hasSave() { return loadSave() !== null; }
