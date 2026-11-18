// Vice Tides — every texture is painted on a canvas at boot: building facades with lit
// windows, asphalt with a dashed centre line, shopfronts, sand, water and the minimap-free
// billboard art. No image files, no network: the city paints itself.
const THREE = window.THREE;

function canvasTexture(w, h, paint, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A deterministic little RNG so the facades look the same on every visit. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const FACADE_BASES = ['#cbb59a', '#a8b6c4', '#d9a066', '#b58a7a', '#8fa3b8', '#e0cf9f', '#9db08a', '#c47f9d'];

function facade(seed, floors, shopfront) {
  const r = rng(seed);
  const base = FACADE_BASES[seed % FACADE_BASES.length];
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // subtle vertical shading
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.16)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const rows = floors, cols = 5;
    const cellH = (h - (shopfront ? 52 : 14)) / rows, cellW = w / cols;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = r() > 0.45;
        g.fillStyle = lit ? (r() > 0.5 ? '#ffd98a' : '#ffeec2') : '#2c3444';
        g.fillRect(x * cellW + 7, 8 + y * cellH + 4, cellW - 14, cellH - 10);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x * cellW + 7, 8 + y * cellH + 4, cellW - 14, 3);
      }
    }
    if (shopfront) {
      g.fillStyle = '#20242e'; g.fillRect(0, h - 52, w, 52);
      g.fillStyle = ['#ff5f9e', '#39c2d7', '#ffd94d', '#7dff8a'][seed % 4];
      g.fillRect(0, h - 52, w, 12);
      g.fillStyle = '#0e1116';
      for (let x = 0; x < 4; x++) g.fillRect(10 + x * 62, h - 34, 48, 26);
    }
  });
}

export function makeTextures() {
  const facades = [];
  for (let i = 0; i < 8; i++) facades.push(facade(100 + i * 37, 6 + (i % 4) * 2, i % 3 === 0));
  const asphalt = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#4a4a58'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.fillStyle = '#e8c95a'; g.fillRect(w / 2 - 2, 8, 4, 44); g.fillRect(w / 2 - 2, 76, 4, 44);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(4, 0, 2, h); g.fillRect(w - 6, 0, 2, h);
  });
  const sidewalk = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#b9a894'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,75,60,0.6)'; g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  }, 6, 6);
  const sand = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#ecc987'; g.fillRect(0, 0, w, h);
    const r = rng(21);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(160,120,60,${r() * 0.18})`; g.fillRect(r() * w, r() * h, 3, 2); }
  }, 30, 4);
  const water = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#1d6f8e'; g.fillRect(0, 0, w, h);
    const r = rng(33);
    g.strokeStyle = 'rgba(190,240,255,0.35)';
    for (let i = 0; i < 22; i++) { g.beginPath(); const y = r() * h; g.moveTo(r() * w, y); g.lineTo(r() * w + 26, y); g.stroke(); }
  }, 24, 24);
  const grass = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#5d8a4a'; g.fillRect(0, 0, w, h);
    const r = rng(49);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(30,60,20,${r() * 0.25})`; g.fillRect(r() * w, r() * h, 2, 4); }
  }, 8, 8);
  const sky = canvasTexture(64, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2e1a47'); grad.addColorStop(0.42, '#7a3d6e');
    grad.addColorStop(0.62, '#e2603f'); grad.addColorStop(0.78, '#ffb36b'); grad.addColorStop(1, '#ffd98a');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  const billboard = canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#1c1030'; g.fillRect(0, 0, w, h);
    g.font = '900 62px system-ui, sans-serif'; g.textAlign = 'center';
    const grad = g.createLinearGradient(0, 20, 0, 100);
    grad.addColorStop(0, '#ffe259'); grad.addColorStop(1, '#ff5f9e');
    g.fillStyle = grad; g.fillText('VICE TIDES', w / 2, 82);
    g.font = '700 20px system-ui, sans-serif'; g.fillStyle = '#bdf3ff';
    g.fillText('PALMERA BAY MARINA — BOATS • BAIT • SUNSETS', w / 2, 112);
  });
  return { facades, asphalt, sidewalk, sand, water, grass, sky, billboard };
}
