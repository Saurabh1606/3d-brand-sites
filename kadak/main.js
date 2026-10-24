import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ---------------- data ---------------- */
const FLAVOURS = [
  { name: 'Classic Masala', hi: 'मसाला', color: '#9c3d1f', label: '#a8432a', text: '#f7ead2',
    desc: 'The OG. Assam leaf, elaichi, adrak, dalchini. Tastes like 5pm at the corner tapri.',
    notes: 'Strong · Spiced · Medium sweet' },
  { name: 'Elaichi Gold', hi: 'इलायची', color: '#c98a12', label: '#dc9f22', text: '#2b1a12',
    desc: 'Double the cardamom, a whisper of saffron. The one your nani would approve of.',
    notes: 'Floral · Smooth · Lightly sweet' },
  { name: 'Adrak Kick', hi: 'अदरक', color: '#c9561f', label: '#d7652b', text: '#fff3e2',
    desc: 'Fresh-pressed Wayanad ginger and black pepper. Built for monsoon mornings.',
    notes: 'Fiery · Bold · Less sweet' },
  { name: 'Kashmiri Kahwa', hi: 'कहवा', color: '#b4506c', label: '#c5607a', text: '#fff1ea',
    desc: 'Green tea, saffron, almond and rose. Light, golden and very, very calm.',
    notes: 'Delicate · Nutty · No milk' },
  { name: 'Cold Brew Latte', hi: 'लाटे', color: '#9a7550', label: '#dcc3a0', text: '#3a2416',
    desc: 'Our smoothest brew with extra whole milk. Chai for people who think they prefer coffee.',
    notes: 'Creamy · Mellow · Medium sweet' },
];

/* ---------------- helpers ---------------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rnd = (i) => { const s = Math.sin(i * 91.17 + 47.3) * 43758.5453; return s - Math.floor(s); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const isMobile = () => innerWidth < 820;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- renderer ---------------- */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 0.25, 10);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6b4a33, 0.7));
const key = new THREE.DirectionalLight(0xffe2bd, 2.4);
key.position.set(4, 6, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffb070, 1.8);
rim.position.set(-5, 2, -4);
scene.add(rim);

const world = new THREE.Group(); // tilted gently by the pointer
scene.add(world);

/* ---------------- textures ---------------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const clayTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#b85c36'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(90,35,15,${Math.random() * 0.07})`; g.fillRect(0, y, w, 1); }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = Math.random() < .5 ? 'rgba(80,30,10,.2)' : 'rgba(245,180,130,.16)';
    const s = Math.random() * 1.8;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
});

const softTex = canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});

const shadowTex = canvasTex(256, 64, (g, w, h) => {
  g.translate(w / 2, h / 2); g.scale(1, h / w);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  r.addColorStop(0, 'rgba(60,30,15,.55)');
  r.addColorStop(1, 'rgba(60,30,15,0)');
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, w / 2, 0, Math.PI * 2); g.fill();
});

/* ---------------- kulhad (cracks into shards) ---------------- */
const PROFILE = [
  [0, -1], [0.5, -1], [0.56, -0.97], [0.62, -0.85], [0.72, -0.4], [0.84, 0.3], [0.93, 0.9],
  [0.95, 0.98], [0.93, 1.03], [0.86, 1.0], [0.75, 0.3], [0.63, -0.4], [0.5, -0.8], [0, -0.84],
].map(([x, y]) => new THREE.Vector2(x, y));

const SHARDS = 7;
const tri = (x) => 2 * Math.abs(2 * (x - Math.floor(x + 0.5))) - 1;
// jagged crack line for boundary k, shared by the two shards that meet there
const crackLine = (k, y) => 0.13 * tri(y * 2.6 + k * 0.37) + 0.04 * Math.sin(y * 11 + k * 2.3);

const kulhad = new THREE.Group();
const shards = [];
{
  const bounds = [];
  for (let k = 0; k < SHARDS; k++) bounds.push(k * Math.PI * 2 / SHARDS + (k ? (rnd(k) - .5) * 0.35 : 0));
  bounds.push(Math.PI * 2);
  const n = PROFILE.length;
  const SEG = 16;
  for (let i = 0; i < SHARDS; i++) {
    const geo = new THREE.LatheGeometry(PROFILE, SEG, bounds[i], bounds[i + 1] - bounds[i]);
    const pos = geo.attributes.position;
    for (let c = 0; c <= SEG; c++) {
      const t = c / SEG;
      for (let j = 0; j < n; j++) {
        const idx = c * n + j;
        const x = pos.getX(idx), y = pos.getY(idx), z = pos.getZ(idx);
        const r = Math.hypot(x, z);
        if (r < 1e-4) continue;
        const phi = Math.atan2(x, z) + lerp(crackLine(i, y), crackLine((i + 1) % SHARDS, y), t);
        pos.setXYZ(idx, r * Math.sin(phi), y, r * Math.cos(phi));
      }
    }
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const centre = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-centre.x, -centre.y, -centre.z);
    const mat = new THREE.MeshStandardMaterial({
      map: clayTex, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, transparent: true, envMapIntensity: 0.5,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(centre);
    const mid = (bounds[i] + bounds[i + 1]) / 2;
    mesh.userData = {
      home: centre.clone(),
      dir: new THREE.Vector3(Math.sin(mid), 0, Math.cos(mid)),
      lift: 0.4 + rnd(i + 10) * 0.9,
      spin: new THREE.Vector3(rnd(i + 20) - .5, rnd(i + 30) - .5, rnd(i + 40) - .5).multiplyScalar(5),
    };
    kulhad.add(mesh);
    shards.push(mesh);
  }
}
const chaiSurface = new THREE.Mesh(
  new THREE.CircleGeometry(0.83, 48).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x7a3e1e, roughness: 0.18, transparent: true }),
);
chaiSurface.position.y = 0.8;
kulhad.add(chaiSurface);
world.add(kulhad);

const steam = [];
for (let i = 0; i < 16; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
  s.userData.phase = rnd(i + 70);
  kulhad.add(s);
  steam.push(s);
}

/* ---------------- can ---------------- */
const labelCanvas = document.createElement('canvas');
labelCanvas.width = 2048; labelCanvas.height = 1024;
const labelTex = new THREE.CanvasTexture(labelCanvas);
labelTex.colorSpace = THREE.SRGBColorSpace;
labelTex.anisotropy = 8;

function drawLabel(f) {
  const g = labelCanvas.getContext('2d');
  const W = labelCanvas.width, H = labelCanvas.height, cx = W / 2;
  g.clearRect(0, 0, W, H);
  g.fillStyle = f.label; g.fillRect(0, 0, W, H);
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(255,255,255,.14)');
  shade.addColorStop(.5, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.18)');
  g.fillStyle = shade; g.fillRect(0, 0, W, H);

  // block-print bands
  g.save();
  g.globalAlpha = .28; g.fillStyle = f.text; g.strokeStyle = f.text; g.lineWidth = 3;
  for (const y of [72, H - 72]) {
    for (let x = 16; x < W; x += 64) {
      g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 18, y); g.lineTo(x, y + 20); g.lineTo(x - 18, y); g.closePath(); g.stroke();
      g.beginPath(); g.arc(x + 32, y, 5, 0, Math.PI * 2); g.fill();
    }
    g.fillRect(0, y - 40, W, 2); g.fillRect(0, y + 38, W, 2);
  }
  g.restore();

  g.fillStyle = f.text; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.letterSpacing = '10px';
  g.font = '600 32px Inter, sans-serif';
  g.fillText('COLD BREW · MASALA CHAI', cx, 200);
  g.letterSpacing = '6px';
  g.font = '270px Anton, Impact, sans-serif';
  g.fillText('KADAK', cx, 500);
  g.letterSpacing = '0px';
  g.font = 'italic 300 70px Fraunces, Georgia, serif';
  g.fillText(f.name, cx, 610);
  g.font = '96px "Tiro Devanagari Hindi", serif';
  g.fillText(f.hi, cx, 750);
  g.letterSpacing = '8px';
  g.font = '600 28px Inter, sans-serif';
  g.fillText('250 ML · BREWED 12 HRS · NO PRESERVATIVES', cx, 860);

  // side: vertical tagline
  for (const x of [cx - 520, cx + 520]) {
    g.save(); g.translate(x, H / 2); g.rotate(-Math.PI / 2);
    g.letterSpacing = '14px'; g.font = '600 30px Inter, sans-serif';
    g.fillText('CHAI, REIMAGINED.', 0, 10);
    g.restore();
  }

  // seal
  g.save(); g.translate(cx + 470, 330);
  g.strokeStyle = f.text; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 78, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, 64, 0, Math.PI * 2); g.stroke();
  g.letterSpacing = '0px'; g.font = '44px Anton, Impact, sans-serif'; g.fillText('12', 0, 6);
  g.font = '600 15px Inter, sans-serif'; g.fillText('HOUR BREW', 0, 30);
  g.restore();

  // back: ingredients + barcode
  g.save();
  g.textAlign = 'left'; g.letterSpacing = '2px';
  const bx = 150;
  g.font = '600 24px Inter, sans-serif'; g.fillText('INGREDIENTS', bx, 300);
  g.font = '22px Inter, sans-serif';
  ['Whole milk, water, Assam CTC tea,', 'jaggery, green cardamom, ginger,', 'cinnamon, black pepper, clove.', '', 'Shake well. Best served chilled.', 'Brewed & canned in Pune, MH.']
    .forEach((l, i) => g.fillText(l, bx, 345 + i * 34));
  g.fillStyle = '#fff'; g.fillRect(bx, 620, 260, 130);
  g.fillStyle = '#111';
  for (let i = 0, x = bx + 14; x < bx + 246; i++) { const w = 2 + (rnd(i + 99) * 4 | 0); if (i % 2 === 0) g.fillRect(x, 634, w, 90); x += w; }
  g.restore();

  labelTex.needsUpdate = true;
}

const can = new THREE.Group();
{
  const R = 0.62, bodyH = 1.94, sh = 0.16;
  const metal = new THREE.MeshStandardMaterial({ color: 0xdedad3, metalness: 1, roughness: 0.26 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0xb9b4ac, metalness: 1, roughness: 0.38 });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, bodyH, 96, 1, true),
    new THREE.MeshStandardMaterial({ map: labelTex, metalness: 0.3, roughness: 0.36 }),
  );
  body.rotation.y = Math.PI; // puts the label front (u = .5) towards the camera
  can.add(body);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86, R, sh, 96, 1, true), metal);
  shoulder.position.y = bodyH / 2 + sh / 2;
  can.add(shoulder);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, 0.03, 12, 96).rotateX(Math.PI / 2), metal);
  rimRing.position.y = bodyH / 2 + sh + 0.01;
  can.add(rimRing);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(R * 0.85, 64).rotateX(-Math.PI / 2), darkMetal);
  lid.position.y = bodyH / 2 + sh - 0.02;
  can.add(lid);
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.34), metal);
  tab.position.set(0, lid.position.y + 0.015, 0.12);
  can.add(tab);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.8, 0.12, 96, 1, true), metal);
  base.position.y = -bodyH / 2 - 0.06;
  can.add(base);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(R * 0.8, 64).rotateX(Math.PI / 2), darkMetal);
  bottom.position.y = -bodyH / 2 - 0.12;
  can.add(bottom);
}
world.add(can);

const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.6, 0.65),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 }),
);
world.add(shadow);

/* ---------------- spices ---------------- */
const spiceGroup = new THREE.Group();
world.add(spiceGroup);
const spices = [];
{
  const mat = (color, roughness = .7) => new THREE.MeshStandardMaterial({ color, roughness, transparent: true, envMapIntensity: .6 });

  const star = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, r = i % 2 ? 0.07 : 0.26;
    i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(r, 0);
  }
  const leaf = new THREE.Shape();
  leaf.moveTo(0, -0.22); leaf.quadraticCurveTo(0.16, 0, 0, 0.22); leaf.quadraticCurveTo(-0.16, 0, 0, -0.22);

  const makers = {
    cardamom: () => new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14).scale(1, 1.9, 1), mat(0x8f9f45)),
    cinnamon: () => new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 18), mat(0x7a4426, .85)),
    anise: () => new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.02, bevelSegments: 2 }), mat(0x5b2c18)),
    ginger: () => new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.06, 11).scale(1, 1, 0.78), mat(0xe2c27c, .6)),
    leaf: () => new THREE.Mesh(new THREE.ShapeGeometry(leaf), Object.assign(mat(0x46572a, .55), { side: THREE.DoubleSide })),
    pepper: () => new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), mat(0x2a1c14, .5)),
  };
  const order = ['cardamom', 'cinnamon', 'anise', 'ginger', 'leaf', 'cardamom', 'pepper', 'leaf',
    'cinnamon', 'anise', 'cardamom', 'ginger', 'leaf', 'pepper', 'cardamom', 'leaf', 'anise', 'cinnamon'];
  order.forEach((type, i) => {
    const m = makers[type]();
    const a = i * 2.399 + 0.6;
    const r = 1.65 + (i % 3) * 0.42;
    const home = new THREE.Vector3(Math.cos(a) * r, (rnd(i + 3) - .5) * 2.9, Math.sin(a) * r * .55 - .2);
    if (Math.abs(home.x) < 1.3) home.z = -1.4; // never cover the label
    m.userData = {
      home,
      axis: new THREE.Vector3(rnd(i + 5) - .5, rnd(i + 6) - .5, rnd(i + 7) - .5).normalize(),
      speed: 0.3 + rnd(i + 8) * 0.6,
      phase: rnd(i + 9) * Math.PI * 2,
    };
    m.rotation.set(rnd(i) * 6, rnd(i + 1) * 6, rnd(i + 2) * 6);
    spiceGroup.add(m);
    spices.push(m);
  });
}

/* ---------------- scroll choreography ---------------- */
const $ = (s) => document.querySelector(s);
const hero = $('#hero');
const sections = [...document.querySelectorAll('[data-chapter]')];

function poses() {
  const m = isMobile();
  return {
    heroStart: { x: 0, y: m ? -0.55 : -0.75, s: m ? 0.6 : 0.72, ry: -2.8, rz: 0, spice: 0, spread: .3, shadow: 0 },
    heroEnd: { x: 0, y: m ? 0.1 : 0.05, s: m ? 0.8 : 1, ry: 0, rz: 0.12, spice: 1, spread: m ? .62 : 1, shadow: .5 },
    story: m ? { x: 0, y: 1.45, s: .55, ry: -.5, rz: .08, spice: .25, spread: .6, shadow: 0 }
      : { x: 2.3, y: 0, s: 1.05, ry: -.55, rz: -.1, spice: .35, spread: 1.5, shadow: 0 },
    spices: m ? { x: 0, y: 1.45, s: .55, ry: .7, rz: -.06, spice: 1, spread: .55, shadow: 0 }
      : { x: -2.4, y: -.05, s: .95, ry: .75, rz: .12, spice: 1, spread: .85, shadow: 0 },
    flavours: m ? { x: 0, y: .65, s: .72, ry: 0, rz: .04, spice: 0, spread: .7, shadow: .35 }
      : { x: 1.5, y: -.15, s: 1.15, ry: 0, rz: .05, spice: 0, spread: 1.6, shadow: .4 },
    city: { x: m ? 0 : 1, y: 5.5, s: .8, ry: 1.2, rz: .3, spice: 0, spread: 1, shadow: 0 },
    order: m ? { x: 0, y: 5.5, s: .8, ry: 1.2, rz: .3, spice: 0, spread: 1, shadow: 0 }
      : { x: 2.4, y: -.1, s: 1.1, ry: -.35, rz: -.12, spice: .6, spread: 1.2, shadow: .4 },
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
      [centre('#story'), P.story],
      [centre('#spices'), P.spices],
      [centre('#flavours'), P.flavours],
      [centre('#city'), P.city],
      [centre('#order'), P.order],
    ];
    return;
  }
  // phones: the can sits in the gap above each text block, then flies up and out of the way
  const top = (id) => $(id).offsetTop;
  const away = (p) => ({ ...p, y: 4.5, spice: 0 });
  anchors = [
    [heroEnd, P.heroEnd],
    [top('#story'), P.story],
    [top('#story') + vh * .7, away(P.story)],
    [top('#spices') - vh * .1, away(P.spices)],
    [top('#spices'), P.spices],
    [top('#spices') + vh * .7, away(P.spices)],
    [centre('#flavours') - vh * .5, away(P.flavours)],
    [centre('#flavours'), P.flavours],
    [centre('#city'), P.city],
    [centre('#order'), P.order],
  ].filter((a, i, all) => i === 0 || a[0] > all[i - 1][0]);
}

const KEYS = ['x', 'y', 's', 'ry', 'rz', 'spice', 'spread', 'shadow'];
const mix = (a, b, t) => Object.fromEntries(KEYS.map((k) => [k, lerp(a[k], b[k], t)]));

function poseAt(y) {
  const heroLen = hero.offsetHeight - innerHeight;
  if (y <= anchors[0][0]) {
    const hp = clamp(y / heroLen);
    const p = mix(P.heroStart, P.heroEnd, easeInOut(smooth(0.28, 0.85, hp)));
    p.spice = smooth(0.5, 0.95, hp);
    p.spread = lerp(.3, P.heroEnd.spread, p.spice);
    p.shadow = P.heroEnd.shadow * smooth(.7, 1, hp);
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
const hudIdx = $('#hudIdx'), hudName = $('#hudName'), bar = $('#progressBar');
let flavour = 0;
let spin = 0, spinTarget = 0, pendingLabel = -1;

const pills = $('#flavPills');
const orderFlav = $('#orderFlav');
FLAVOURS.forEach((f, i) => {
  const p = document.createElement('button');
  p.className = 'pill'; p.setAttribute('role', 'tab'); p.style.setProperty('--c', f.label);
  p.innerHTML = `<i></i>${f.name}`;
  p.onclick = () => setFlavour(i);
  pills.append(p);
  const c = document.createElement('button');
  c.className = 'chip'; c.style.setProperty('--c', f.label);
  c.innerHTML = `<i></i>${f.name}`;
  c.onclick = () => setFlavour(i, false);
  orderFlav.append(c);
});

const info = $('.flav-info');
function setFlavour(i, animate = true) {
  if (i === flavour && pills.children[i].getAttribute('aria-selected') === 'true') return;
  flavour = i;
  const f = FLAVOURS[i];
  [...pills.children].forEach((p, j) => p.setAttribute('aria-selected', String(j === i)));
  [...orderFlav.children].forEach((c, j) => c.classList.toggle('active', j === i));
  root.style.setProperty('--flavour', f.color);
  info.classList.add('swap');
  setTimeout(() => {
    $('#flavHi').textContent = f.hi;
    $('#flavName').textContent = f.name;
    $('#flavDesc').textContent = f.desc;
    $('#flavNotes').textContent = f.notes;
    info.classList.remove('swap');
  }, 300);
  if (animate && !reduceMotion) { spinTarget += Math.PI * 2; pendingLabel = i; }
  else drawLabel(f);
  updateOrder();
}

let pack = $('#orderPack .chip.active');
document.querySelectorAll('#orderPack .chip').forEach((c) => {
  c.onclick = () => { pack.classList.remove('active'); pack = c; c.classList.add('active'); updateOrder(); };
});
function updateOrder() {
  const n = +pack.dataset.pack, price = +pack.dataset.price;
  $('#orderTotal').textContent = `₹${price.toLocaleString('en-IN')}`;
  $('#orderPer').textContent = `₹${Math.round(price / n)} per can · free delivery in metros`;
  const msg = `Hi KADAK! I'd like to order a ${n}-can crate of ${FLAVOURS[flavour].name} (₹${price.toLocaleString('en-IN')}).`;
  $('#orderWa').href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX / innerWidth - .5;
  pointer.y = e.clientY / innerHeight - .5;
});

/* ---------------- loop ---------------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1.5 : 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.z = isMobile() ? 11.5 : 10;
  camera.updateProjectionMatrix();
  measure();
}
addEventListener('resize', resize);

let smoothY = scrollY;
let last = performance.now();
measure();
const cur = { ...poseAt(0) };

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;
  smoothY = reduceMotion ? scrollY : damp(smoothY, scrollY, 7, dt);

  // hero progress drives CSS + the crack
  const hp = clamp(smoothY / (hero.offsetHeight - innerHeight));
  root.style.setProperty('--hero', hp.toFixed(4));
  const crack = smooth(0.08, 0.6, hp);

  // kulhad
  kulhad.visible = crack < 0.999;
  const km = isMobile() ? 0.82 : 1.05;
  kulhad.scale.setScalar(km);
  kulhad.position.y = isMobile() ? -0.25 : -0.4;
  const tremble = crack > 0 && crack < 0.14 ? Math.sin(t * 70) * 0.012 * (1 - crack / 0.14) : 0;
  kulhad.position.x = tremble;
  kulhad.rotation.set(0.32, t * 0.15, 0); // tipped towards camera so the chai shows
  const split = smooth(0, 0.14, crack) * 0.05; // hairline cracks first
  const fly = Math.pow(smooth(0.14, 1, crack), 1.3);
  shards.forEach((s) => {
    const u = s.userData;
    s.position.copy(u.home)
      .addScaledVector(u.dir, split + fly * 3.2)
      .add(new THREE.Vector3(0, fly * u.lift - fly * fly * 2.6, fly * 0.6));
    s.rotation.set(u.spin.x * fly, u.spin.y * fly, u.spin.z * fly);
    s.material.opacity = 1 - smooth(0.6, 1, crack);
  });
  chaiSurface.material.opacity = 1 - smooth(0.12, 0.3, crack);
  chaiSurface.position.y = 0.8 - smooth(0.12, 0.3, crack) * 0.3;
  steam.forEach((s) => {
    const p = (t * 0.22 + s.userData.phase) % 1;
    s.position.set(Math.sin(p * 6 + s.userData.phase * 10) * 0.28 * p, 1.0 + p * 1.9, 0);
    s.scale.set(0.35 + p * 0.6, 0.5 + p * 0.9, 1);
    s.material.opacity = Math.sin(p * Math.PI) * 0.28 * (1 - smooth(0, 0.15, crack));
  });

  // can + spices follow the scroll pose
  const target = poseAt(smoothY);
  for (const k of KEYS) cur[k] = reduceMotion ? target[k] : damp(cur[k], target[k], 10, dt);
  spin = damp(spin, spinTarget, 5, dt);
  if (pendingLabel >= 0 && spinTarget - spin < Math.PI) { drawLabel(FLAVOURS[pendingLabel]); pendingLabel = -1; }

  const bob = reduceMotion ? 0 : Math.sin(t * 1.3) * 0.05;
  can.position.set(cur.x, cur.y + bob, 0);
  can.scale.setScalar(cur.s);
  can.rotation.set(0, cur.ry + spin + Math.sin(t * 0.6) * 0.08, cur.rz);
  can.visible = hp > 0.02;

  shadow.position.set(cur.x, cur.y - 1.32 * cur.s, -0.8);
  shadow.scale.setScalar(cur.s);
  shadow.material.opacity = cur.shadow;

  spiceGroup.position.set(cur.x, cur.y, 0);
  spiceGroup.visible = cur.spice > 0.01;
  spices.forEach((m) => {
    const u = m.userData;
    const e = cur.spice;
    m.position.copy(u.home).multiplyScalar(cur.spread * (0.35 + 0.65 * e));
    m.position.y += Math.sin(t * u.speed + u.phase) * 0.08;
    m.rotateOnAxis(u.axis, dt * u.speed);
    m.scale.setScalar(Math.max(e, 0.001) * (isMobile() ? .8 : 1));
    m.material.opacity = e;
  });

  // pointer parallax
  pointer.sx = damp(pointer.sx, pointer.x, 3, dt);
  pointer.sy = damp(pointer.sy, pointer.y, 3, dt);
  world.rotation.set(pointer.sy * 0.12, pointer.sx * 0.2, 0);

  renderer.render(scene, camera);

  // HUD
  let idx = 0;
  sections.forEach((s, i) => { if (s.offsetTop <= scrollY + innerHeight * .5) idx = i; });
  const label = `${String(idx + 1).padStart(2, '0')} / ${String(sections.length).padStart(2, '0')}`;
  if (hudIdx.textContent !== label) { hudIdx.textContent = label; hudName.textContent = sections[idx].dataset.chapter; }
  const city = $('#city').getBoundingClientRect();
  document.body.classList.toggle('on-dark', city.top < 40 && city.bottom > 60);
  bar.style.width = `${(scrollY / (document.documentElement.scrollHeight - innerHeight)) * 100}%`;

  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */
async function boot() {
  const fonts = Promise.all([
    document.fonts.load('270px Anton'),
    document.fonts.load('italic 300 70px Fraunces'),
    document.fonts.load('96px "Tiro Devanagari Hindi"', 'कड़कमसाला'),
    document.fonts.load('600 32px Inter'),
  ]);
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 3000))]);
  drawLabel(FLAVOURS[0]);
  setFlavour(0, false);
  resize();
  requestAnimationFrame((n) => { last = n; frame(n); });
  setTimeout(() => $('#loader').classList.add('done'), 250);
}
boot();
