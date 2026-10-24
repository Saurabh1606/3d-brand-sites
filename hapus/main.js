import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ---------------- data ---------------- */
const PRODUCTS = [
  { name: 'Aamras Nectar', mr: 'आमरस', liquid: '#f3940c', accent: '#e8590c', label: '#fff1d6',
    desc: "Pure Alphonso pulp, nothing else. Like nani's aamras, minus the puri.", meta: '300 ml · ₹149' },
  { name: 'Mango Lassi', mr: 'लस्सी', liquid: '#ffd27a', accent: '#c97f04', label: '#fff8ea',
    desc: 'Hapus pulp churned into thick Konkan dahi. Sunday-afternoon energy in a bottle.', meta: '300 ml · ₹129' },
  { name: 'Aam Panna', mr: 'पन्हं', liquid: '#c4d24e', accent: '#4d7c0f', label: '#f4f8e3',
    desc: "Raw kairi, roasted jeera and kala namak. Summer's original cooler.", meta: '300 ml · ₹99' },
];
const HARVEST = new Date('2027-04-01T00:00:00+05:30');

/* ---------------- helpers ---------------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rnd = (i) => { const s = Math.sin(i * 91.17 + 47.3) * 43758.5453; return s - Math.floor(s); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const isMobile = () => innerWidth < 820;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);

/* ---------------- renderer ---------------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 0.2, 10);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xfff6e0, 0x8a5a20, 0.8));
const key = new THREE.DirectionalLight(0xfff0d0, 2.6);
key.position.set(3, 6, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffc060, 2);
rim.position.set(-5, 3, -4);
scene.add(rim);

const world = new THREE.Group();
scene.add(world);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------- mango (splits into two halves) ---------------- */
// unit sphere -> Alphonso: broad shoulders, tapered base, a slight beak and a kidney curve in depth
function deform(x, y, z) {
  const w = 1 + 0.09 * y;
  return [
    x * 0.98 * w,
    y * 1.18,
    z * 0.84 * w + 0.09 * y * y - 0.05 + 0.16 * Math.pow(Math.max(0, -y - 0.35), 1.6),
  ];
}

const SKIN = new THREE.Color('#f6ae1c'), STEM_GREEN = new THREE.Color('#9fb43a'), BLUSH = new THREE.Color('#e2522a');

function mangoHalf(side) { // side -1 = left (x<0), +1 = right
  const geo = new THREE.SphereGeometry(1, 72, 56, side < 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    c.copy(SKIN).lerp(STEM_GREEN, smooth(0.5, 1, y) * 0.8).lerp(BLUSH, smooth(0, 0.9, -x * 0.5 + z * 0.6 + y * 0.3) * 0.55);
    col.set([c.r, c.g, c.b], i * 3);
    pos.setXYZ(i, ...deform(x, y, z));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const skin = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, side: THREE.DoubleSide,
  }));

  // the cut face: outline of the x = 0 section, mapped onto that plane
  const shape = new THREE.Shape();
  for (let i = 0; i <= 96; i++) {
    const a = i / 96 * Math.PI * 2;
    const [, y, z] = deform(0, Math.cos(a), Math.sin(a));
    const sx = side > 0 ? z : -z;
    i ? shape.lineTo(sx, y) : shape.moveTo(sx, y);
  }
  const capGeo = new THREE.ShapeGeometry(shape, 24);
  capGeo.computeBoundingBox();
  const bb = capGeo.boundingBox;
  const cp = capGeo.attributes.position, uv = capGeo.attributes.uv, nm = capGeo.attributes.normal;
  for (let i = 0; i < cp.count; i++) {
    const sx = cp.getX(i), sy = cp.getY(i);
    uv.setXY(i, (sx - bb.min.x) / (bb.max.x - bb.min.x), (sy - bb.min.y) / (bb.max.y - bb.min.y));
    cp.setXYZ(i, side * 0.002, sy, side > 0 ? sx : -sx);
    nm.setXYZ(i, -side, 0, 0);
  }
  const cap = new THREE.Mesh(capGeo, new THREE.MeshPhysicalMaterial({
    map: side > 0 ? fleshTex.right : fleshTex.left, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2,
  }));
  const g = new THREE.Group();
  g.add(skin, cap);
  g.userData.cap = cap;
  return g;
}

const fleshTex = {};
for (const side of ['left', 'right']) {
  fleshTex[side] = canvasTex(512, 512, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h * .52, 10, w / 2, h / 2, w * .55);
    r.addColorStop(0, '#ffd35a'); r.addColorStop(.55, '#ffa816'); r.addColorStop(1, '#f07c08');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
    // fibres
    g.strokeStyle = 'rgba(255,230,150,.25)'; g.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const a = i / 70 * Math.PI * 2;
      g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 70, h / 2 + Math.sin(a) * 120);
      g.lineTo(w / 2 + Math.cos(a) * 240, h / 2 + Math.sin(a) * 250); g.stroke();
    }
    // seed (gutli)
    g.save(); g.translate(w / 2 + (side === 'left' ? -14 : 14), h * .5);
    const s = g.createRadialGradient(0, 0, 5, 0, 0, 120);
    s.addColorStop(0, '#fbe7a6'); s.addColorStop(1, '#efc35c');
    g.fillStyle = s; g.beginPath(); g.ellipse(0, 0, 62, 132, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(190,130,30,.35)'; g.lineWidth = 2;
    for (let i = -110; i < 120; i += 14) { g.beginPath(); g.moveTo(-50, i); g.quadraticCurveTo(0, i + 10, 50, i); g.stroke(); }
    g.restore();
    // skin edge
    g.strokeStyle = '#d8a018'; g.lineWidth = 14;
    g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 6, h / 2 - 6, 0, 0, Math.PI * 2); g.stroke();
  });
}

const mango = new THREE.Group();
const halfL = mangoHalf(-1);
const halfR = mangoHalf(1);
{
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x5d4a22, roughness: .8 }));
  stem.position.set(-0.02, 1.25, 0.04);
  stem.rotation.z = 0.2;
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.28, 0.32, 0.95, 0.12); leafShape.quadraticCurveTo(0.3, -0.12, 0, 0);
  const leaf = new THREE.Mesh(
    new THREE.ExtrudeGeometry(leafShape, { depth: 0.012, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: .5, side: THREE.DoubleSide }),
  );
  leaf.position.set(-0.04, 1.32, 0.05);
  leaf.rotation.set(0.5, 2.4, 0.35);
  halfL.add(stem, leaf);
}
mango.add(halfL, halfR);
world.add(mango);

/* ---------------- bottle ---------------- */
const labelCanvas = document.createElement('canvas');
labelCanvas.width = 2048; labelCanvas.height = 640;
const labelTex = new THREE.CanvasTexture(labelCanvas);
labelTex.colorSpace = THREE.SRGBColorSpace;
labelTex.anisotropy = 8;

function drawMango(g, x, y, s, color) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = color;
  g.beginPath(); g.ellipse(0, 0, 40, 52, -0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f6b3a';
  g.beginPath(); g.moveTo(4, -50); g.quadraticCurveTo(40, -86, 70, -64); g.quadraticCurveTo(36, -46, 4, -50); g.fill();
  g.restore();
}

function drawLabel(p) {
  const g = labelCanvas.getContext('2d');
  const W = labelCanvas.width, H = labelCanvas.height, cx = W / 2;
  g.fillStyle = p.label; g.fillRect(0, 0, W, H);
  g.fillStyle = p.accent; g.fillRect(0, 0, W, 26); g.fillRect(0, H - 26, W, 26);
  g.globalAlpha = .5; g.fillRect(0, 36, W, 4); g.fillRect(0, H - 40, W, 4); g.globalAlpha = 1;

  g.textAlign = 'center';
  g.fillStyle = '#1f2a14';
  g.letterSpacing = '10px'; g.font = '600 24px "DM Sans", sans-serif';
  g.fillText('RATNAGIRI ALPHONSO · GI TAGGED', cx, 116);
  g.letterSpacing = '-8px'; g.fillStyle = p.accent; g.font = '800 200px "Bricolage Grotesque", sans-serif';
  g.fillText('HAPUS', cx, 310);
  g.letterSpacing = '0px'; g.fillStyle = '#1f2a14';
  g.font = '68px "Tiro Devanagari Marathi", serif';
  g.fillText(p.mr, cx, 405);
  g.font = 'italic 58px "Instrument Serif", serif';
  g.fillText(p.name, cx, 490);
  g.letterSpacing = '8px'; g.font = '600 20px "DM Sans", sans-serif';
  g.fillText('300 ML · NOT FROM CONCENTRATE · KEEP CHILLED', cx, 570);

  drawMango(g, cx - 440, 330, 1.5, p.liquid);
  drawMango(g, cx + 440, 330, 1.5, p.liquid);

  g.textAlign = 'left'; g.letterSpacing = '2px';
  g.font = '600 22px "DM Sans", sans-serif'; g.fillText('NUTRITION / 100 ML', 170, 150);
  g.font = '20px "DM Sans", sans-serif';
  ['Energy ........ 64 kcal', 'Carbs ......... 15.2 g', 'Protein ....... 0.6 g', 'Vitamin A ..... 38% RDA', 'Vitamin C ..... 41% RDA', '', 'Pulped in Ratnagiri, MH.', 'Shake well. Serve cold.']
    .forEach((l, i) => g.fillText(l, 170, 190 + i * 34));

  labelTex.needsUpdate = true;
}

const bottle = new THREE.Group();
const liquidMat = new THREE.MeshPhysicalMaterial({ color: PRODUCTS[0].liquid, roughness: 0.25, clearcoat: 0.6 });
{
  const v = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(
    new THREE.LatheGeometry(v([[0, -1.3], [0.48, -1.3], [0.55, -1.24], [0.565, -1.1], [0.565, 0.35], [0.53, 0.62], [0.37, 0.92], [0.255, 1.04], [0.245, 1.2]]), 72),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.03,
      envMapIntensity: 2.2, depthWrite: false,
    }),
  );
  glass.renderOrder = 2;
  const liquid = new THREE.Mesh(
    new THREE.LatheGeometry(v([[0, -1.26], [0.5, -1.26], [0.535, -1.1], [0.535, 0.33], [0.5, 0.58], [0.34, 0.86], [0, 0.86]]), 72),
    liquidMat,
  );
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.572, 0.572, 1.1, 96, 1, true),
    new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.6 }),
  );
  label.position.y = -0.42;
  label.rotation.y = Math.PI; // label front (u = .5) faces the camera
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.34, 48),
    new THREE.MeshStandardMaterial({ color: 0xd2a540, metalness: 1, roughness: 0.3 }),
  );
  cap.position.y = 1.3;
  bottle.add(liquid, label, cap, glass);
}
world.add(bottle);

const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.6, 0.65),
  new THREE.MeshBasicMaterial({
    map: canvasTex(256, 64, (g, w, h) => {
      g.translate(w / 2, h / 2); g.scale(1, h / w);
      const r = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
      r.addColorStop(0, 'rgba(150,70,0,.5)'); r.addColorStop(1, 'rgba(150,70,0,0)');
      g.fillStyle = r; g.beginPath(); g.arc(0, 0, w / 2, 0, Math.PI * 2); g.fill();
    }),
    transparent: true, depthWrite: false, opacity: 0,
  }),
);
world.add(shadow);

/* ---------------- flying bits: cubes, drops, leaves ---------------- */
const bitsGroup = new THREE.Group();
world.add(bitsGroup);
const bits = [];
{
  const flesh = new THREE.MeshPhysicalMaterial({ color: 0xffa41c, roughness: .3, clearcoat: .9, transparent: true });
  const drop = new THREE.MeshPhysicalMaterial({ color: 0xff9a0a, roughness: .05, clearcoat: 1, transparent: true });
  const leafM = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: .5, side: THREE.DoubleSide, transparent: true });
  const cube = new RoundedBoxGeometry(0.24, 0.24, 0.24, 3, 0.05);
  const ball = new THREE.SphereGeometry(1, 18, 14);
  const lf = new THREE.Shape();
  lf.moveTo(0, -0.3); lf.quadraticCurveTo(0.17, 0, 0, 0.3); lf.quadraticCurveTo(-0.17, 0, 0, -0.3);
  const leafGeo = new THREE.ShapeGeometry(lf);
  for (let i = 0; i < 22; i++) {
    const kind = i % 7 === 3 ? 'leaf' : i % 2 ? 'drop' : 'cube';
    const m = kind === 'cube' ? new THREE.Mesh(cube, flesh.clone())
      : kind === 'drop' ? new THREE.Mesh(ball, drop.clone()) : new THREE.Mesh(leafGeo, leafM.clone());
    m.userData.base = kind === 'drop' ? 0.05 + rnd(i + 2) * 0.05 : 1;
    const a = i * 2.399 + 0.4;
    const r = 1.6 + (i % 3) * 0.5;
    const home = new THREE.Vector3(Math.cos(a) * r, (rnd(i + 3) - .5) * 3, Math.sin(a) * r * .5 - .2);
    if (Math.abs(home.x) < 1.3) home.z = -1.5; // keep the label clear
    Object.assign(m.userData, {
      home,
      axis: new THREE.Vector3(rnd(i + 5) - .5, rnd(i + 6) - .5, rnd(i + 7) - .5).normalize(),
      speed: 0.3 + rnd(i + 8) * 0.6,
      phase: rnd(i + 9) * Math.PI * 2,
    });
    m.rotation.set(rnd(i) * 6, rnd(i + 1) * 6, rnd(i + 2) * 6);
    bitsGroup.add(m);
    bits.push(m);
  }
}

/* ---------------- scroll choreography ---------------- */
const hero = $('#hero');
const sections = [...document.querySelectorAll('[data-chapter]')];
const KEYS = ['x', 'y', 's', 'ry', 'rz', 'halves', 'bits', 'spread', 'shadow', 'badges'];
const mix = (a, b, t) => Object.fromEntries(KEYS.map((k) => [k, lerp(a[k], b[k], t)]));

function poses() {
  const m = isMobile();
  const base = { halves: 0, bits: 0, spread: 1, shadow: 0, badges: 0, rz: 0 };
  return {
    heroStart: { ...base, x: m ? 0 : 1.7, y: m ? -0.6 : -0.2, s: m ? .4 : .5, ry: -2.6, halves: 1, spread: .3 },
    heroEnd: { ...base, x: 0, y: m ? 0.05 : 0, s: m ? .78 : 1, ry: 0, rz: -.08, halves: 1, bits: 1, spread: m ? .62 : 1, shadow: .5 },
    origin: m ? { ...base, x: 0, y: 1.5, s: .52, ry: .5, bits: .5, spread: .55 }
      : { ...base, x: -2.4, y: 0, s: 1.02, ry: .55, rz: .1, bits: .6, spread: 1.15, shadow: .35 },
    process: m ? { ...base, x: 0, y: 1.5, s: .52, ry: -.5, bits: .3, spread: .55 }
      : { ...base, x: 2.4, y: -.05, s: 1.02, ry: -.6, rz: -.1, bits: .35, spread: 1.4, shadow: .35 },
    product: m ? { ...base, x: 0, y: -.2, s: .72, ry: 0, shadow: .35, badges: 1 }
      : { ...base, x: 1.4, y: -.38, s: .98, ry: 0, shadow: .45, badges: 1 },
    season: { ...base, x: m ? 0 : 1, y: 5.5, s: .8, ry: 1.2, rz: .3 },
    order: m ? { ...base, x: 0, y: 5.5, s: .8, ry: 1.2, rz: .3 }
      : { ...base, x: 2.4, y: -.1, s: 1.08, ry: -.35, rz: -.1, bits: .7, spread: 1.2, shadow: .4 },
  };
}

let P = poses();
let anchors = [];
function measure() {
  P = poses();
  const vh = innerHeight;
  const centre = (id) => { const el = $(id); return el.offsetTop + el.offsetHeight / 2 - vh / 2; };
  const heroEnd = hero.offsetTop + hero.offsetHeight - vh;
  if (!isMobile()) {
    anchors = [
      [heroEnd, P.heroEnd],
      [centre('#origin'), P.origin],
      [centre('#process'), P.process],
      [centre('#product'), P.product],
      [centre('#season'), P.season],
      [centre('#order'), P.order],
    ];
    return;
  }
  // phones: the bottle sits in the gap above each text block, then flies up and out of the way
  const top = (id) => $(id).offsetTop;
  const away = (p) => ({ ...p, y: 4.5, bits: 0, badges: 0 });
  anchors = [
    [heroEnd, P.heroEnd],
    [top('#origin'), P.origin],
    [top('#origin') + vh * .7, away(P.origin)],
    [top('#process') - vh * .1, away(P.process)],
    [top('#process'), P.process],
    [top('#process') + vh * .7, away(P.process)],
    [top('#product') - vh * .5, away(P.product)],
    [top('#product') + 50, P.product], // heading sits just under the nav, bottle below it
    [centre('#season'), P.season],
    [centre('#order'), P.order],
  ].filter((a, i, all) => i === 0 || a[0] > all[i - 1][0]);
}

const heroX = (hp) => lerp(P.heroStart.x, P.heroEnd.x, easeInOut(smooth(0.03, 0.45, hp)));

function poseAt(y) {
  const heroLen = hero.offsetHeight - innerHeight;
  if (y <= anchors[0][0]) {
    const hp = clamp(y / heroLen);
    const p = mix(P.heroStart, P.heroEnd, easeInOut(smooth(0.25, 0.8, hp)));
    p.x = heroX(hp); // bottle stays inside the mango while it glides to centre
    p.bits = smooth(0.4, 0.95, hp);
    p.spread = lerp(.3, P.heroEnd.spread, p.bits);
    p.shadow = P.heroEnd.shadow * smooth(.7, 1, hp);
    p.halves = 1;
    return p;
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    const [y0, a] = anchors[i], [y1, b] = anchors[i + 1];
    if (y <= y1) return mix(a, b, easeInOut(clamp((y - y0) / (y1 - y0))));
  }
  return { ...anchors[anchors.length - 1][1] };
}

/* ---------------- UI ---------------- */
const root = document.documentElement;
let product = 0, spin = 0, spinTarget = 0, pendingLabel = -1;
const liquidTarget = new THREE.Color(PRODUCTS[0].liquid);
const tabs = $('#prodTabs');
const info = $('#prodInfo');
PRODUCTS.forEach((p, i) => {
  const b = document.createElement('button');
  b.className = 'tab'; b.setAttribute('role', 'tab'); b.style.setProperty('--c', p.liquid);
  b.innerHTML = `<i></i>${p.name}`;
  b.onclick = () => setProduct(i);
  tabs.append(b);
});

function setProduct(i, animate = true) {
  product = i;
  const p = PRODUCTS[i];
  [...tabs.children].forEach((t, j) => t.setAttribute('aria-selected', String(j === i)));
  root.style.setProperty('--accent', p.accent);
  liquidTarget.set(p.liquid);
  info.classList.add('swap');
  setTimeout(() => {
    $('#prodMr').textContent = p.mr;
    $('#prodName').textContent = p.name;
    $('#prodDesc').textContent = p.desc;
    $('#prodMeta').textContent = p.meta;
    info.classList.remove('swap');
  }, 300);
  if (animate && !reduceMotion) { spinTarget += Math.PI * 2; pendingLabel = i; }
  else drawLabel(p);
}

// drag to spin (only inside the product section)
let drag = 0, dragVel = 0, dragging = false, lastX = 0;
const productEl = $('#product');
productEl.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  dragging = true; lastX = e.clientX;
});
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointercancel', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX / innerWidth - .5;
  pointer.y = e.clientY / innerHeight - .5;
  if (!dragging) return;
  dragVel = (e.clientX - lastX) * 0.012;
  drag += dragVel;
  lastX = e.clientX;
});
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

// shop
let pack = $('#packs .pack.active');
document.querySelectorAll('#packs .pack').forEach((b) => {
  b.onclick = () => { pack.classList.remove('active'); pack = b; b.classList.add('active'); updateOrder(); };
});
function updateOrder() {
  const name = pack.dataset.name, price = (+pack.dataset.price).toLocaleString('en-IN');
  $('#orderWaText').textContent = `Order ${name} on WhatsApp`;
  $('#orderWa').href = `https://wa.me/?text=${encodeURIComponent(`Hi HAPUS! I'd like the ${name} (₹${price}).`)}`;
}
$('#prebook').href = `https://wa.me/?text=${encodeURIComponent('Hi HAPUS! Please pre-book a dozen 2027 Ratnagiri Alphonso for me (₹1,499).')}`;

// countdown
const cd = Object.fromEntries([...document.querySelectorAll('#countdown b')].map((b) => [b.dataset.k, b]));
function tick() {
  let s = Math.max(0, Math.floor((HARVEST - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  cd.d.textContent = String(d).padStart(3, '0');
  cd.h.textContent = String(h).padStart(2, '0');
  cd.m.textContent = String(m).padStart(2, '0');
  cd.s.textContent = String(s).padStart(2, '0');
}
tick();
setInterval(tick, 1000);

const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ---------------- loop ---------------- */
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.position.z = isMobile() ? 11.5 : 10;
  camera.updateProjectionMatrix();
  measure();
}
addEventListener('resize', resize);

const hudIdx = $('#hudIdx'), hudName = $('#hudName'), bar = $('#progressBar');
const badgeEls = [...document.querySelectorAll('.badge')];
const BADGE_Y = [0.75, -0.15, 0.3, -0.7];
const tmp = new THREE.Vector3();
let smoothY = scrollY;
let last = performance.now();
measure();
const cur = { ...poseAt(0) };

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;
  const m = isMobile();
  smoothY = reduceMotion ? scrollY : damp(smoothY, scrollY, 7, dt);

  const hp = clamp(smoothY / (hero.offsetHeight - innerHeight));
  root.style.setProperty('--hero', hp.toFixed(4));
  const split = smooth(0.06, 0.5, hp);

  const target = poseAt(smoothY);
  for (const k of KEYS) cur[k] = reduceMotion ? target[k] : damp(cur[k], target[k], 10, dt);

  // mango: whole, then two halves turning their flesh towards us, then out of frame
  const gone = 1 - cur.halves;
  const spreadX = (m ? 1.2 : 2.1) * split + gone * 4;
  mango.visible = gone < 0.98;
  mango.scale.setScalar(m ? 0.8 : 1);
  mango.position.set(heroX(hp), (m ? -0.45 : -0.05) + Math.sin(t * 1.1) * 0.04 * (1 - split), 0);
  halfL.userData.cap.visible = halfR.userData.cap.visible = split > 0.002; // no seam on the whole fruit
  mango.rotation.y = (1 - split) * Math.sin(t * 0.5) * 0.35;
  halfL.position.set(-spreadX, -split * 0.2 - gone, 0);
  halfR.position.set(spreadX, -split * 0.25 - gone, 0);
  halfL.rotation.set(0, -split * 1.05 - gone, split * 0.22);
  halfR.rotation.set(0, split * 1.05 + gone, -split * 0.22);

  // bottle
  spin = damp(spin, spinTarget, 5, dt);
  if (pendingLabel >= 0 && spinTarget - spin < Math.PI) { drawLabel(PRODUCTS[pendingLabel]); pendingLabel = -1; }
  if (!dragging) { dragVel *= Math.pow(0.04, dt); drag += dragVel; }
  liquidMat.color.lerp(liquidTarget, 1 - Math.exp(-4 * dt));
  const bob = reduceMotion ? 0 : Math.sin(t * 1.3) * 0.05;
  bottle.position.set(cur.x, cur.y + bob, 0);
  bottle.scale.setScalar(cur.s);
  bottle.rotation.set(0, cur.ry + spin + drag + Math.sin(t * 0.6) * 0.08, cur.rz);
  bottle.visible = hp > 0.03;

  shadow.position.set(cur.x, cur.y - 1.4 * cur.s, -0.8);
  shadow.scale.setScalar(cur.s);
  shadow.material.opacity = cur.shadow;

  bitsGroup.position.set(cur.x, cur.y, 0);
  bitsGroup.visible = cur.bits > 0.01;
  bits.forEach((b) => {
    const u = b.userData;
    b.position.copy(u.home).multiplyScalar(cur.spread * (0.3 + 0.7 * cur.bits));
    b.position.y += Math.sin(t * u.speed + u.phase) * 0.08;
    b.rotateOnAxis(u.axis, dt * u.speed);
    b.scale.setScalar(Math.max(cur.bits, 0.001) * u.base * (m ? .8 : 1));
    b.material.opacity = cur.bits;
  });

  pointer.sx = damp(pointer.sx, pointer.x, 3, dt);
  pointer.sy = damp(pointer.sy, pointer.y, 3, dt);
  world.rotation.set(pointer.sy * 0.1, pointer.sx * 0.18, 0);
  world.updateMatrixWorld();

  renderer.render(scene, camera);

  // nutrition badges orbit the bottle
  badgeEls.forEach((el, i) => {
    if (cur.badges < 0.01) { el.style.opacity = 0; return; }
    const a = t * 0.45 + i * Math.PI / 2;
    const r = m ? 1.25 : 1.45;
    tmp.set(Math.cos(a) * r, BADGE_Y[i], Math.sin(a) * r).multiplyScalar(cur.s).add(bottle.position);
    tmp.applyMatrix4(world.matrixWorld).project(camera);
    const front = smooth(-0.35, 0.25, Math.sin(a)); // fade out as it passes behind the bottle
    const x = (tmp.x + 1) / 2 * innerWidth, y = (1 - tmp.y) / 2 * innerHeight;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${.8 + front * .2})`;
    el.style.opacity = (cur.badges * front).toFixed(3);
  });

  let idx = 0;
  sections.forEach((s, i) => { if (s.offsetTop <= scrollY + innerHeight * .5) idx = i; });
  const label = `${String(idx + 1).padStart(2, '0')} / ${String(sections.length).padStart(2, '0')}`;
  if (hudIdx.textContent !== label) { hudIdx.textContent = label; hudName.textContent = sections[idx].dataset.chapter; }
  const season = $('#season').getBoundingClientRect();
  document.body.classList.toggle('on-bright', season.top < innerHeight && season.bottom > 0);
  bar.style.width = `${(scrollY / (root.scrollHeight - innerHeight)) * 100}%`;

  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */
async function boot() {
  const fonts = Promise.all([
    document.fonts.load('800 200px "Bricolage Grotesque"'),
    document.fonts.load('italic 58px "Instrument Serif"'),
    document.fonts.load('68px "Tiro Devanagari Marathi"', 'आमरसलस्सीपन्हं'),
    document.fonts.load('600 24px "DM Sans"'),
  ]);
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 3000))]);
  setProduct(0, false);
  updateOrder();
  resize();
  requestAnimationFrame((n) => { last = n; frame(n); });
  setTimeout(() => $('#loader').classList.add('done'), 250);
}
boot();
