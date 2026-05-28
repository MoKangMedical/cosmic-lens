/**
 * Cosmic Starfield Background — 可动的星空背景
 * 从首页提取，用于所有课程页面
 * 场景：多层星星 + 星云光晕 + 缓慢自转
 */
import * as THREE from 'three';

function initCanvasStarfield(container) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { stop: () => {} };
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  container.appendChild(canvas);

  let raf = 0;
  let width = 0;
  let height = 0;
  let stars = [];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(260, Math.max(120, Math.floor((width * height) / 6500)));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.35 + Math.random() * 1.25,
      speed: 0.04 + Math.random() * 0.18,
      alpha: 0.28 + Math.random() * 0.58,
      tint: Math.random(),
    }));
  }

  function drawNebula() {
    const g1 = ctx.createRadialGradient(width * 0.24, height * 0.18, 0, width * 0.24, height * 0.18, width * 0.55);
    g1.addColorStop(0, 'rgba(226,182,79,0.16)');
    g1.addColorStop(1, 'rgba(226,182,79,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, width, height);

    const g2 = ctx.createRadialGradient(width * 0.82, height * 0.28, 0, width * 0.82, height * 0.28, width * 0.5);
    g2.addColorStop(0, 'rgba(107,92,231,0.18)');
    g2.addColorStop(1, 'rgba(107,92,231,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, width, height);
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    drawNebula();
    for (const star of stars) {
      star.y += star.speed;
      if (star.y > height + 8) {
        star.y = -8;
        star.x = Math.random() * width;
      }
      const color = star.tint < 0.12 ? '246,211,101' : star.tint < 0.24 ? '124,58,237' : '220,240,255';
      ctx.beginPath();
      ctx.fillStyle = `rgba(${color},${star.alpha})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(animate);
  }

  resize();
  animate();
  window.addEventListener('resize', resize);
  return {
    stop: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.remove();
    },
  };
}

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

export function initStarfieldBackground(containerId = 'starfield-bg') {
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;';
    document.body.prepend(container);
  }

  if (!canUseWebGL()) {
    return initCanvasStarfield(container);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.3, 200);
  camera.position.set(0, 2, 20);
  camera.lookAt(0, 0, 0);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return initCanvasStarfield(container);
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  container.appendChild(renderer.domElement);

  // ── Nebula glow textures ──
  function createGlowTexture(innerColor, outerColor, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    g.addColorStop(0, innerColor);
    g.addColorStop(0.3, innerColor);
    g.addColorStop(0.7, outerColor);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }

  function nebulaSprite(tex, color, size, opacity) {
    const mat = new THREE.SpriteMaterial({
      map: tex, color, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    return s;
  }

  const goldTex = createGlowTexture('rgba(226,182,79,0.7)', 'rgba(226,182,79,0)');
  const purpleTex = createGlowTexture('rgba(107,92,231,0.6)', 'rgba(107,92,231,0)');
  const blueTex = createGlowTexture('rgba(60,120,220,0.5)', 'rgba(40,60,180,0)');
  const softTex = createGlowTexture('rgba(180,180,220,0.35)', 'rgba(100,100,160,0)');

  // ── Star layers ──
  function starLayer(radius, count, particleSize, opacity, colorMix) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const clr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius + (Math.random() - 0.5) * radius * 0.5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      const m = Math.random();
      if (m < (colorMix[0] || 0.08)) { // gold
        clr[i * 3] = 0.89; clr[i * 3 + 1] = 0.71; clr[i * 3 + 2] = 0.31;
      } else if (m < (colorMix[1] || 0.16)) { // purple
        clr[i * 3] = 0.42; clr[i * 3 + 1] = 0.36; clr[i * 3 + 2] = 0.91;
      } else if (m < (colorMix[2] || 0.26)) { // blue
        clr[i * 3] = 0.5; clr[i * 3 + 1] = 0.7; clr[i * 3 + 2] = 1.0;
      } else { // white/blue-white
        const w = 0.5 + Math.random() * 0.5;
        clr[i * 3] = w; clr[i * 3 + 1] = w; clr[i * 3 + 2] = w * 1.08;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(clr, 3));
    const mat = new THREE.PointsMaterial({
      size: particleSize, vertexColors: true, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity,
    });
    return new THREE.Points(geo, mat);
  }

  // Deep star layers
  const starsGroup = new THREE.Group();
  starsGroup.add(starLayer(55, 2000, 0.18, 0.45, [0.05, 0.1, 0.2]));
  starsGroup.add(starLayer(38, 1800, 0.12, 0.55, [0.08, 0.14, 0.25]));
  starsGroup.add(starLayer(25, 1200, 0.09, 0.65, [0.1, 0.18, 0.3]));
  scene.add(starsGroup);

  // ── Nebula sprites ──
  const nebulae = [
    { tex: goldTex, color: '#e2b64f', pos: [4, 1.5, -3], size: 12, op: 0.18 },
    { tex: purpleTex, color: '#6b5ce7', pos: [-5, -1, 3], size: 11, op: 0.16 },
    { tex: blueTex, color: '#4466cc', pos: [-1.5, 0.5, -6], size: 9, op: 0.13 },
    { tex: goldTex, color: '#d4a040', pos: [6, -0.5, 2], size: 10, op: 0.14 },
    { tex: purpleTex, color: '#8855cc', pos: [2.5, -1, 5], size: 10, op: 0.13 },
    { tex: softTex, color: '#8899cc', pos: [0, 2.5, -1.5], size: 13, op: 0.10 },
    { tex: blueTex, color: '#3355aa', pos: [-7, 0.8, -0.5], size: 8, op: 0.11 },
  ];
  const nebulaSprites = [];
  nebulae.forEach(n => {
    const s = nebulaSprite(n.tex, n.color, n.size, n.op);
    s.position.set(...n.pos);
    scene.add(s);
    n.sprite = s;  // store ref for animation
    nebulaSprites.push(s);
  });

  // ── Faint ring of dust particles (for depth) ──
  function ringDust(planeRadius, count, colorHex, opacity) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = planeRadius * (0.7 + Math.random() * 0.6);
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 3;
      pos[i * 3 + 2] = Math.sin(angle) * r * 0.3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.06, color: colorHex, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity,
    });
    return new THREE.Points(geo, mat);
  }
  const ringGroup = new THREE.Group();
  ringGroup.add(ringDust(16, 800, 0x665588, 0.15));
  ringGroup.add(ringDust(14, 600, 0x997744, 0.12));
  scene.add(ringGroup);

  // ── Animation ──
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    // Slow rotation: stars rotate around Y axis
    starsGroup.rotation.y += dt * 0.03;
    starsGroup.rotation.x += dt * 0.005;
    // Ring rotates faster
    ringGroup.rotation.y += dt * 0.06;
    ringGroup.rotation.x += dt * 0.01;
    // Nebulae gently pulse
    nebulae.forEach((n, i) => {
      const t = performance.now() * 0.0005 + i;
      n.sprite.material.opacity = n.op * (0.85 + 0.15 * Math.sin(t));
    });
    renderer.render(scene, camera);
  }
  animate();

  // ── Resize ──
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, stop: () => renderer.dispose() };
}
