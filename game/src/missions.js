// Vice Tides — Dario Venn's story chain, the taxi side-hustle and the hidden
// packages. Five jobs: steal a car, run a package against the clock, shake the
// law with a client aboard, thread a checkpoint race, then rob the Palmera Bank
// and vanish into the marina. A marker column, the objective line and Dario's
// phone carry the player through all of it.
const THREE = window.THREE;
import { PITCH, PACKAGE_REWARD, PACKAGE_BONUS, TAXI_MIN_FARE, TAXI_PER_METRE } from './config.js';
import { LANDMARKS, PACKAGE_SPOTS, groundY } from './world.js';
import { makeCar } from './vehicles.js';

const M = LANDMARKS;
export const MISSIONS = [
  {
    title: 'First Wheels', reward: 300,
    intro: 'Rico. I left a blue sports coupe at the beach bar, keys in. Take it, bring it to my garage. Quietly.',
    stages: [
      { type: 'steal', text: 'Steal the <b>sports coupe</b> at the beach bar', x: M.beachBar.x + 6, z: M.beachBar.z + 2 },
      { type: 'driveTo', text: 'Deliver the coupe to <b>Venn\'s Garage</b>', x: M.garage.x, z: M.garage.z, r: 7 },
    ],
    outro: 'Clean work. She purrs, doesn\'t she? There is more where that came from.',
  },
  {
    title: 'Hot Package', reward: 450,
    intro: 'A package washes up at the pier end at noon tides. Grab it, drop it downtown. The clock is not your friend.',
    stages: [
      { type: 'goto', text: 'Pick up the <b>package</b> at the pier end', x: M.pierEnd.x, z: M.pierEnd.z, r: 3.2 },
      { type: 'timedDrive', text: 'Deliver it <b>downtown</b> before the timer dies', x: -PITCH, z: -PITCH, r: 8, time: 95 },
    ],
    outro: 'On time and under the radar. The buyer sends his thanks — and your cut.',
  },
  {
    title: 'Heat Run', reward: 600,
    intro: 'A client needs out of downtown, and the law disagrees. Pick him up, lose the heat, THEN drop him at the marina.',
    stages: [
      { type: 'goto', text: 'Pick up the <b>client</b> downtown', x: PITCH / 2, z: -PITCH / 2, r: 6, needsCar: true },
      { type: 'loseCops', text: '<b>Lose the police</b> — break away and stay hidden', setStars: 3 },
      { type: 'driveTo', text: 'Drop the client at the <b>marina</b>', x: M.marinaDrop.x, z: M.marinaDrop.z, r: 8 },
    ],
    outro: 'He walked onto a boat like nothing happened. Ice cold, Rico.',
  },
  {
    title: 'Checkpoint Rush', reward: 750,
    intro: 'The syndicate times its couriers. Six gates, one clock, whole city watching. Show them a ghost.',
    stages: [
      {
        type: 'race', text: 'Hit every <b>checkpoint</b> before the clock dies', time: 150,
        points: [
          { x: PITCH, z: 0 }, { x: 2 * PITCH, z: -PITCH }, { x: PITCH, z: -2 * PITCH },
          { x: -PITCH, z: -2 * PITCH }, { x: -2 * PITCH, z: -PITCH }, { x: -PITCH, z: PITCH },
        ],
      },
    ],
    outro: 'Fastest ghost in Palmera Bay. The syndicate just raised your price.',
  },
  {
    title: 'The Palmera Job', reward: 2000,
    intro: 'Last one, Rico. The Palmera Bank vault truck loads at the door. Take the money, then disappear to the pier. Buy your boat back.',
    stages: [
      { type: 'rob', text: 'Hit the <b>Palmera Bank</b> — stand in the gold ring', x: M.bankDoor.x, z: M.bankDoor.z, r: 4 },
      { type: 'escape', text: '<b>Escape!</b> Lose the heat, then reach the pier', x: M.pierEnd.x, z: M.pierEnd.z, r: 6 },
    ],
    outro: 'It is done. The Marlin name is yours again. Palmera Bay keeps turning — the bay is yours now, Rico.',
  },
];

export function createMissionState() {
  return {
    index: 0, stage: 0, active: false, startAt: 4, // first job lands a few seconds in
    stageTime: 0, stageData: {}, storyDone: false, betweenAt: 0,
    taxi: { phase: 'idle', ped: null, dest: null, fare: 0, idleAt: 8 },
  };
}

// ---------- marker visuals ----------
function makeMarker(color) {
  const grp = new THREE.Group();
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.3, 34, 18, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  col.position.y = 17; grp.add(col);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.3, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; grp.add(ring);
  grp.visible = false;
  return grp;
}

export function createMissionVisuals(G) {
  G.marker = makeMarker(0xffd94d);
  G.scene.add(G.marker);
  G.taxiMarker = makeMarker(0x39c2d7);
  G.scene.add(G.taxiMarker);
  // the mission-1 coupe, waiting at the beach bar with the keys in
  const coupe = makeCar('sport', 0x3d7bd9, M.beachBar.x + 6, M.beachBar.z + 2, 2.4);
  coupe.driver = 'parked';
  coupe.isMissionCar = true;
  G.scene.add(coupe.mesh);
  G.cars.push(coupe);
  G.missionCar = coupe;
  // the package prop for job 2 sits at the pier end
  const pkg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7),
    new THREE.MeshLambertMaterial({ color: 0xd9a94f, emissive: 0x664d12 }));
  pkg.position.set(M.pierEnd.x, 0.7, M.pierEnd.z);
  pkg.visible = false;
  G.scene.add(pkg);
  G.packageProp = pkg;
}

function setMarker(G, marker, x, z, show = true) {
  marker.visible = show;
  if (show) marker.position.set(x, groundY(x, z), z);
}

function startStage(G) {
  const ms = G.missions;
  const mission = MISSIONS[ms.index];
  const stage = mission.stages[ms.stage];
  ms.stageTime = 0;
  ms.stageData = {};
  if (stage.type === 'race') ms.stageData.point = 0;
  if (stage.type === 'loseCops' || (stage.type === 'escape')) {
    // the law arrives on cue
    G.wanted.heat = Math.max(G.wanted.heat, (stage.setStars || 5) * 100 - 10);
    G.wanted.stars = stage.setStars || 5;
    G.wanted.hideTimer = 0;
  }
  if (stage.type === 'rob') ms.stageData.holdTime = 0;
  if (G.packageProp) G.packageProp.visible = ms.index === 1 && ms.stage === 0;
  G.hudDirty = true;
}

function startMission(G) {
  const ms = G.missions;
  if (ms.index >= MISSIONS.length) { ms.storyDone = true; return; }
  ms.active = true; ms.stage = 0;
  const mission = MISSIONS[ms.index];
  G.phone('Dario Venn', mission.intro);
  G.toast(`NEW JOB — ${mission.title.toUpperCase()}`);
  startStage(G);
}

function completeMission(G) {
  const ms = G.missions;
  const mission = MISSIONS[ms.index];
  G.player.money += mission.reward;
  G.player.ammo += 24;
  G.audio.missionDone();
  G.audio.cash();
  G.toast(`JOB DONE — +$${mission.reward}`);
  G.phone('Dario Venn', mission.outro);
  ms.index++;
  ms.active = false;
  ms.betweenAt = G.time + 7;
  if (G.packageProp) G.packageProp.visible = false;
  setMarker(G, G.marker, 0, 0, false);
  G.objectivePos = null;
  if (ms.index >= MISSIONS.length) ms.storyDone = true;
  G.saveNow();
}

function failTimedStage(G, why) {
  G.phone('Dario Venn', why);
  G.audio.busted();
  startStage(G); // same stage, fresh clock — Palmera forgives, for a price of time
}

/** The position the HUD objective and minimap should point at right now. */
export function currentObjective(G) {
  const ms = G.missions;
  if (ms.taxi.phase === 'pickup') return { x: ms.taxi.ped.mesh.position.x, z: ms.taxi.ped.mesh.position.z, taxi: true };
  if (ms.taxi.phase === 'dropoff') return { x: ms.taxi.dest.x, z: ms.taxi.dest.z, taxi: true };
  if (!ms.active) return null;
  const stage = MISSIONS[ms.index].stages[ms.stage];
  if (stage.type === 'race') {
    const pt = stage.points[ms.stageData.point || 0];
    return pt ? { x: pt.x, z: pt.z } : null;
  }
  if (stage.type === 'loseCops') return null; // nowhere to go but away
  return { x: stage.x, z: stage.z };
}

export function currentObjectiveText(G) {
  const ms = G.missions;
  if (ms.active) {
    const mission = MISSIONS[ms.index];
    const stage = mission.stages[ms.stage];
    let text = stage.text;
    if (stage.type === 'race') text = `Checkpoint ${(ms.stageData.point || 0) + 1}/${stage.points.length} — ${text}`;
    return `<b>${mission.title}:</b> ${text}`;
  }
  if (ms.taxi.phase === 'pickup') return 'Taxi: pick up the <b>passenger</b>';
  if (ms.taxi.phase === 'dropoff') return `Taxi: drop off — fare <b>$${ms.taxi.fare}</b>`;
  if (ms.storyDone) return 'Free roam — the bay is yours. Taxi fares and packages still pay.';
  return 'Wait for Dario\'s call…';
}

export function updateMissions(G, dt) {
  const ms = G.missions;
  const pp = G.playerPos();
  if (!ms.active && !ms.storyDone && G.time > Math.max(ms.startAt, ms.betweenAt)) startMission(G);
  if (G.marker.visible) G.marker.rotation.y += dt * 0.8;
  if (G.taxiMarker.visible) G.taxiMarker.rotation.y -= dt * 0.8;

  if (ms.active) {
    const mission = MISSIONS[ms.index];
    const stage = mission.stages[ms.stage];
    ms.stageTime += dt;
    let markerAt = currentObjective(G);
    if (stage.type === 'loseCops') markerAt = null;
    if (markerAt) setMarker(G, G.marker, markerAt.x, markerAt.z);
    else setMarker(G, G.marker, 0, 0, false);
    G.objectivePos = markerAt;

    const distTo = (s) => Math.hypot(pp.x - s.x, pp.z - s.z);
    let done = false;
    switch (stage.type) {
      case 'goto':
        done = distTo(stage) < stage.r && (!stage.needsCar || !!G.player.inCar);
        break;
      case 'steal':
        done = !!G.player.inCar && G.player.inCar === G.missionCar;
        if (done) G.missionCar.isMissionCar = false;
        break;
      case 'driveTo':
        done = !!G.player.inCar && distTo(stage) < stage.r;
        break;
      case 'timedDrive': {
        G.hudTimer = Math.max(0, stage.time - ms.stageTime);
        if (G.player.inCar && distTo(stage) < stage.r) done = true;
        else if (ms.stageTime > stage.time) { G.hudTimer = null; failTimedStage(G, 'Too slow — the buyer walked. Get the next one there on time.'); }
        break;
      }
      case 'loseCops':
        done = G.wanted.stars === 0;
        break;
      case 'race': {
        G.hudTimer = Math.max(0, stage.time - ms.stageTime);
        const pt = stage.points[ms.stageData.point || 0];
        if (pt && G.player.inCar && Math.hypot(pp.x - pt.x, pp.z - pt.z) < 11) {
          ms.stageData.point++;
          G.audio.pickup();
          if (ms.stageData.point >= stage.points.length) done = true;
        } else if (ms.stageTime > stage.time) { G.hudTimer = null; failTimedStage(G, 'The clock ate you. The gates are reset — run it again.'); }
        break;
      }
      case 'rob': {
        if (!G.player.inCar && distTo(stage) < stage.r) {
          ms.stageData.holdTime += dt;
          G.hudTimer = Math.ceil(3 - ms.stageData.holdTime);
          if (ms.stageData.holdTime === dt) G.toast('TAKING THE VAULT CASH…');
          if (ms.stageData.holdTime >= 3) {
            done = true;
            G.player.money += 400;
            G.toast('+$400 VAULT CASH — NOW RUN');
          }
        } else { ms.stageData.holdTime = 0; G.hudTimer = null; }
        break;
      }
      case 'escape': {
        if (G.wanted.stars === 0 && distTo(stage) < stage.r) done = true;
        break;
      }
    }
    if (done) {
      if (stage.type === 'timedDrive' || stage.type === 'race') G.hudTimer = null;
      ms.stage++;
      if (ms.stage >= mission.stages.length) completeMission(G);
      else { G.audio.pickup(); startStage(G); }
    }
  } else {
    setMarker(G, G.marker, 0, 0, false);
    G.objectivePos = currentObjective(G);
    if (G.objectivePos) setMarker(G, G.taxiMarker, G.objectivePos.x, G.objectivePos.z);
    else setMarker(G, G.taxiMarker, 0, 0, false);
  }
  updateTaxi(G, dt);
  if (G.objectivePos && ms.active) { /* mission marker already placed */ }
  else if (G.objectivePos) setMarker(G, G.taxiMarker, G.objectivePos.x, G.objectivePos.z);
  else setMarker(G, G.taxiMarker, 0, 0, false);
}

// ---------- taxi side-hustle ----------
function updateTaxi(G, dt) {
  const ms = G.missions, taxi = ms.taxi;
  const pp = G.playerPos();
  if (taxi.phase === 'idle') {
    if (G.player.inCar && G.time > taxi.idleAt && !ms.active) {
      // a pedestrian flags Rico down
      let best = null, bestD = 60;
      for (const ped of G.peds) {
        if (ped.down) continue;
        const d = Math.hypot(ped.mesh.position.x - pp.x, ped.mesh.position.z - pp.z);
        if (d < bestD) { bestD = d; best = ped; }
      }
      if (best) {
        taxi.phase = 'pickup'; taxi.ped = best;
        best.target = { x: pp.x, z: pp.z };
        G.toast('TAXI FARE — pick up the passenger');
        G.audio.phone();
      } else taxi.idleAt = G.time + 6;
    }
    return;
  }
  if (taxi.phase === 'pickup') {
    const ped = taxi.ped;
    if (!ped || ped.down || !G.player.inCar) { taxi.phase = 'idle'; taxi.idleAt = G.time + 8; return; }
    ped.target = { x: pp.x, z: pp.z };
    if (Math.hypot(ped.mesh.position.x - pp.x, ped.mesh.position.z - pp.z) < 3.4) {
      ped.mesh.visible = false; // in the back seat
      const dests = [M.marinaDrop, M.bankDoor, { x: -2 * PITCH, z: 2 * PITCH }, { x: 3 * PITCH, z: -2 * PITCH }, { x: -3 * PITCH, z: -PITCH }, M.garage];
      taxi.dest = dests[(Math.random() * dests.length) | 0];
      taxi.fare = Math.round(TAXI_MIN_FARE + Math.hypot(taxi.dest.x - pp.x, taxi.dest.z - pp.z) * TAXI_PER_METRE);
      taxi.phase = 'dropoff';
      G.toast('Passenger in — follow the blue marker');
    }
    return;
  }
  if (taxi.phase === 'dropoff') {
    if (!G.player.inCar) { // dumped the fare
      if (taxi.ped) { taxi.ped.mesh.visible = true; }
      taxi.phase = 'idle'; taxi.idleAt = G.time + 8;
      return;
    }
    if (Math.hypot(pp.x - taxi.dest.x, pp.z - taxi.dest.z) < 8) {
      G.player.money += taxi.fare;
      G.audio.cash();
      G.toast(`FARE PAID — +$${taxi.fare}`);
      if (taxi.ped) {
        taxi.ped.mesh.visible = true;
        taxi.ped.mesh.position.set(pp.x + 2, groundY(pp.x + 2, pp.z), pp.z);
      }
      taxi.phase = 'idle'; taxi.idleAt = G.time + 10;
      G.saveNow();
    }
  }
}

// ---------- hidden packages ----------
export function createPackages(G) {
  G.packageMeshes = PACKAGE_SPOTS.map((s, i) => {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55),
      new THREE.MeshBasicMaterial({ color: 0x7dff8a }),
    );
    m.position.set(s.x, groundY(s.x, s.z) + 1.1, s.z);
    m.userData.index = i;
    G.scene.add(m);
    return m;
  });
}

export function checkPackages(G, dt) {
  const pp = G.playerPos();
  for (const m of G.packageMeshes) {
    if (!m.visible) continue;
    m.rotation.y += dt * 2.4;
    m.position.y += Math.sin(G.time * 3 + m.userData.index) * dt * 0.14;
    if (Math.hypot(pp.x - m.position.x, pp.z - m.position.z) < 2.1) {
      m.visible = false;
      G.packagesFound.add(m.userData.index);
      G.player.money += PACKAGE_REWARD;
      G.audio.pickup(); G.audio.cash();
      const left = PACKAGE_SPOTS.length - G.packagesFound.size;
      G.toast(left > 0 ? `PACKAGE FOUND — +$${PACKAGE_REWARD} (${left} left)` : 'ALL PACKAGES FOUND!');
      if (left === 0) { G.player.money += PACKAGE_BONUS; G.toast(`ALL PACKAGES — BONUS +$${PACKAGE_BONUS}`); }
      G.saveNow();
    }
  }
}
