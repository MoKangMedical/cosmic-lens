/**
 * Cosmic Lens - 3D Lesson Visualization Framework
 * Shared Three.js module for course content 3D visualization.
 * Each lesson page defines LESSON_3D_CONFIG with scene-specific parameters.
 * 
 * Usage: Include three.js + this script + define LESSON_3D_CONFIG before load.
 */
(function() {
  'use strict';

  const CONFIG = window.LESSON_3D_CONFIG || {};
  if (!CONFIG.scene) return;

  // ── Constants ──────────────────────────────────────────────
  const GOLD = 0xe2b64f;
  const GOLD_LIGHT = 0xf0d478;
  const GOLD_DIM = 0xb8922e;
  const PURPLE = 0x6b5ce7;
  const BLUE = 0x3b82f6;
  const CYAN = 0x22d3ee;
  const WHITE = 0xf5f5f7;

  // ── Container Setup ────────────────────────────────────────
  const container = document.getElementById('lesson-3d-viewer');
  if (!container) return;

  const W = container.clientWidth;
  const H = container.clientHeight || Math.min(W * 0.56, 420);

  // ── Three.js Init ──────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
  camera.position.set(0, 0.5, 8);

  const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // ── Lighting ───────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x222233, 1.5);
  scene.add(ambient);
  
  const keyLight = new THREE.DirectionalLight(GOLD, 1.2);
  keyLight.position.set(5, 8, 5);
  scene.add(keyLight);
  
  const fillLight = new THREE.DirectionalLight(BLUE, 0.4);
  fillLight.position.set(-3, -2, -3);
  scene.add(fillLight);
  
  const rimLight = new THREE.PointLight(PURPLE, 0.6, 15);
  rimLight.position.set(0, -1, -4);
  scene.add(rimLight);

  // ── Common Elements ────────────────────────────────────────
  const group = new THREE.Group();
  scene.add(group);

  // Background particles (common to all scenes)
  const bgGeom = new THREE.BufferGeometry();
  const bgCount = CONFIG.bgParticles || 300;
  const bgPositions = new Float32Array(bgCount * 3);
  for (let i = 0; i < bgCount * 3; i += 3) {
    bgPositions[i] = (Math.random() - 0.5) * 14;
    bgPositions[i+1] = (Math.random() - 0.5) * 10;
    bgPositions[i+2] = (Math.random() - 0.5) * 8 - 1;
  }
  bgGeom.setAttribute('position', new THREE.BufferAttribute(bgPositions, 3));
  const bgMat = new THREE.PointsMaterial({ 
    color: GOLD, 
    size: 0.03, 
    transparent: true, 
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const bgStars = new THREE.Points(bgGeom, bgMat);
  scene.add(bgStars);

  // ── Scene Builders ─────────────────────────────────────────
  const builders = {
    /**
     * Lesson 1: Universe as Simulation - Wireframe sphere with quantum particles
     */
    simulation() {
      // Main wireframe sphere (the universe)
      const sphereGeo = new THREE.IcosahedronGeometry(2.5, 2);
      const sphereMat = new THREE.MeshBasicMaterial({ 
        color: GOLD, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.15 
      });
      const universe = new THREE.Mesh(sphereGeo, sphereMat);
      group.add(universe);

      // Inner grid structure
      const gridGeo = new THREE.SphereGeometry(2.2, 32, 32);
      const gridMat = new THREE.MeshBasicMaterial({
        color: BLUE,
        wireframe: true,
        transparent: true,
        opacity: 0.08
      });
      group.add(new THREE.Mesh(gridGeo, gridMat));

      // Quantum particles (appear/disappear)
      const qCount = 80;
      const qGeom = new THREE.BufferGeometry();
      const qPositions = new Float32Array(qCount * 3);
      const qSizes = new Float32Array(qCount);
      group.userData.qParticles = { positions: qPositions, sizes: qSizes, phases: new Float32Array(qCount) };
      for (let i = 0; i < qCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 2.4 + Math.random() * 0.6;
        qPositions[i*3] = r * Math.sin(phi) * Math.cos(theta);
        qPositions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        qPositions[i*3+2] = r * Math.cos(phi);
        qSizes[i] = 0.02 + Math.random() * 0.06;
        group.userData.qParticles.phases[i] = Math.random() * Math.PI * 2;
      }
      qGeom.setAttribute('position', new THREE.BufferAttribute(qPositions, 3));
      qGeom.setAttribute('size', new THREE.BufferAttribute(qSizes, 1));
      const qMat = new THREE.PointsMaterial({ 
        color: GOLD_LIGHT, 
        size: 0.06, 
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.8
      });
      qMat.onBeforeCompile = null;
      const qParticles = new THREE.Points(qGeom, qMat);
      qParticles.name = 'qParticles';
      group.add(qParticles);

      // Orbiting "code" rings
      for (let j = 0; j < 3; j++) {
        const ringGeo = new THREE.TorusGeometry(2.7 + j * 0.3, 0.02, 16, 80);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ 
          color: j === 0 ? GOLD : j === 1 ? PURPLE : CYAN, 
          transparent: true, 
          opacity: 0.3 
        }));
        ring.rotation.x = Math.PI / 3 + j * 0.5;
        ring.rotation.y = j * 0.8;
        ring.name = `ring${j}`;
        group.add(ring);
      }
    },

    /**
     * Lesson 2: Bostrom's Trilemma - Three nested spheres
     */
    trilemma() {
      const colors = [GOLD, PURPLE, CYAN];
      const sizes = [1.2, 2.0, 2.8];
      const speeds = [0.3, -0.2, 0.15];
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.IcosahedronGeometry(sizes[i], 1);
        const mat = new THREE.MeshBasicMaterial({ 
          color: colors[i], 
          wireframe: true, 
          transparent: true, 
          opacity: 0.25 
        });
        const sphere = new THREE.Mesh(geo, mat);
        sphere.name = `nest${i}`;
        sphere.userData.rotSpeed = speeds[i];
        group.add(sphere);
      }
      // Connecting energy threads
      for (let k = 0; k < 30; k++) {
        const lineGeo = new THREE.BufferGeometry();
        const r1 = 1.2, r2 = 2.8;
        const a = Math.random() * Math.PI * 2;
        const b = Math.random() * Math.PI;
        const p1 = new THREE.Vector3(r1 * Math.sin(b) * Math.cos(a), r1 * Math.cos(b), r1 * Math.sin(b) * Math.sin(a));
        const p2 = new THREE.Vector3(r2 * Math.sin(b) * Math.cos(a), r2 * Math.cos(b), r2 * Math.sin(b) * Math.sin(a));
        lineGeo.setFromPoints([p1, p2]);
        const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ 
          color: GOLD, 
          transparent: true, 
          opacity: 0.15 
        }));
        group.add(line);
      }
    },

    /**
     * Lesson 3: Computational Cosmology - Pulsating CPU/clock
     */
    computeCosmos() {
      // Central core
      const coreGeo = new THREE.OctahedronGeometry(0.6, 0);
      const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true }));
      core.name = 'core';
      group.add(core);

      // Data rings (like a processor)
      for (let i = 0; i < 5; i++) {
        const ringGeo = new THREE.TorusGeometry(1.2 + i * 0.4, 0.03, 16, 64);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ 
          color: i % 2 === 0 ? GOLD : BLUE, 
          transparent: true, 
          opacity: 0.4 
        }));
        ring.rotation.x = 0.2 * i;
        ring.name = `dring${i}`;
        group.add(ring);
      }

      // Planck-scale dots on rings
      const dotGeom = new THREE.SphereGeometry(0.04, 4, 4);
      const dotMat = new THREE.MeshBasicMaterial({ color: GOLD_LIGHT });
      for (let i = 0; i < 5; i++) {
        const r = 1.2 + i * 0.4;
        for (let j = 0; j < 12; j++) {
          const angle = (j / 12) * Math.PI * 2;
          const dot = new THREE.Mesh(dotGeom, dotMat);
          dot.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
          dot.name = `dot${i}_${j}`;
          group.add(dot);
        }
      }
    },

    /**
     * Lesson 4: Quantum Superposition - Double slit interference pattern
     */
    superposition() {
      // Wave plane
      const waveGeo = new THREE.PlaneGeometry(5, 5, 40, 40);
      const wavePos = waveGeo.attributes.position;
      group.userData.waveGeo = waveGeo;
      group.userData.waveOffset = { base: wavePos.array.slice() };
      const waveMat = new THREE.MeshBasicMaterial({ 
        color: GOLD, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.2 
      });
      const wave = new THREE.Mesh(waveGeo, waveMat);
      wave.rotation.x = -Math.PI / 2.5;
      wave.position.y = -0.5;
      wave.name = 'wave';
      group.add(wave);

      // Two "slit" sources
      for (let s = -1; s <= 1; s += 2) {
        const slitGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const slit = new THREE.Mesh(slitGeo, new THREE.MeshBasicMaterial({ 
          color: CYAN, 
          transparent: true, 
          opacity: 0.9 
        }));
        slit.position.set(s * 0.5, 1.5, 0);
        slit.name = `slit${s}`;
        group.add(slit);

        // Wave emission rings
        for (let r = 0; r < 4; r++) {
          const ringGeo = new THREE.TorusGeometry(0.3 + r * 0.4, 0.02, 8, 32);
          const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ 
            color: CYAN, 
            transparent: true, 
            opacity: 0.3 - r * 0.06 
          }));
          ring.position.copy(slit.position);
          ring.name = `sring${s}_${r}`;
          group.add(ring);
        }
      }
    },

    /**
     * Lesson 5: Quantum Entanglement - Two linked particles
     */
    entanglement() {
      const colors = [GOLD, PURPLE];
      for (let i = 0; i < 2; i++) {
        const x = (i - 0.5) * 3;
        // Central particle
        const particleGeo = new THREE.SphereGeometry(0.4, 32, 32);
        const particle = new THREE.Mesh(particleGeo, new THREE.MeshPhongMaterial({ 
          color: colors[i], 
          emissive: colors[i], 
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.9
        }));
        particle.position.set(x, 0, 0);
        particle.name = `particle${i}`;
        group.add(particle);

        // Bloch sphere wireframe
        const blochGeo = new THREE.SphereGeometry(0.7, 24, 24);
        const bloch = new THREE.Mesh(blochGeo, new THREE.MeshBasicMaterial({ 
          color: colors[i], 
          wireframe: true, 
          transparent: true, 
          opacity: 0.2 
        }));
        bloch.position.copy(particle.position);
        bloch.name = `bloch${i}`;
        group.add(bloch);
      }

      // Entanglement connection (vibrating line)
      const connGeo = new THREE.BufferGeometry();
      const connVerts = new Float32Array(60);
      for (let i = 0; i < 60; i++) {
        connVerts[i] = (i / 59) * 3 - 1.5;
      }
      connGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(connVerts.length * 3), 3));
      for (let i = 0; i < 60; i++) {
        const idx = i * 3;
        connGeo.attributes.position.array[idx] = connVerts[i];
        connGeo.attributes.position.array[idx+1] = 0;
        connGeo.attributes.position.array[idx+2] = 0;
      }
      const connLine = new THREE.Line(connGeo, new THREE.LineBasicMaterial({ 
        color: GOLD, 
        transparent: true, 
        opacity: 0.6 
      }));
      connLine.name = 'connection';
      group.add(connLine);
    },

    /**
     * Lesson 6: Fine-Tuning - 26 parameter orbs
     */
    fineTuning() {
      // Central universe
      const centerGeo = new THREE.SphereGeometry(0.8, 32, 32);
      const center = new THREE.Mesh(centerGeo, new THREE.MeshPhongMaterial({ 
        color: GOLD, 
        emissive: GOLD, 
        emissiveIntensity: 0.4 
      }));
      group.add(center);

      // 26 parameter orbs
      const paramColors = [GOLD, GOLD_LIGHT, BLUE, CYAN, PURPLE, GOLD_DIM];
      for (let i = 0; i < 26; i++) {
        const theta = Math.acos(2 * Math.random() - 1);
        const phi = Math.random() * Math.PI * 2;
        const r = 2.0 + Math.random() * 1.5;
        const orbGeo = new THREE.SphereGeometry(0.06 + Math.random() * 0.08, 8, 8);
        const orb = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ 
          color: paramColors[Math.floor(Math.random() * paramColors.length)],
          transparent: true,
          opacity: 0.8
        }));
        orb.position.set(
          r * Math.sin(theta) * Math.cos(phi),
          r * Math.sin(theta) * Math.sin(phi),
          r * Math.cos(theta)
        );
        orb.name = `param${i}`;
        orb.userData.basePos = orb.position.clone();
        group.add(orb);
      }

      // Fine-structure constant ring
      const alphaRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.3, 0.03, 16, 100),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.5 })
      );
      alphaRing.name = 'alphaRing';
      group.add(alphaRing);
    },

    /**
     * Lesson 7: Turing Complete Universe - Game of Life blocks
     */
    turingComplete() {
      // 3D cellular automaton grid
      const gridSize = 7;
      const cellGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
      group.userData.cells = [];
      for (let x = -3; x <= 3; x++) {
        for (let y = -3; y <= 3; y++) {
          const alive = Math.random() > 0.7;
          const cell = new THREE.Mesh(cellGeo, new THREE.MeshBasicMaterial({ 
            color: alive ? GOLD : 0x111122, 
            transparent: true, 
            opacity: alive ? 0.9 : 0.3
          }));
          cell.position.set(x * 0.3, y * 0.3, 0);
          cell.userData.alive = alive;
          cell.name = `cell${x}_${y}`;
          group.add(cell);
          group.userData.cells.push(cell);
        }
      }
      group.userData.cellTimer = 0;
      group.userData.cellInterval = 2.0;
    },

    /**
     * Lesson 8: Black Hole Information - Black hole with radiation
     */
    blackHole() {
      // Event horizon (dark sphere with glow rings)
      const horizonGeo = new THREE.SphereGeometry(1.2, 32, 32);
      const horizon = new THREE.Mesh(horizonGeo, new THREE.MeshBasicMaterial({ 
        color: 0x000011,
        transparent: true,
        opacity: 0.9
      }));
      horizon.name = 'horizon';
      group.add(horizon);

      // Accretion disk rings
      for (let i = 0; i < 4; i++) {
        const diskGeo = new THREE.TorusGeometry(1.4 + i * 0.25, 0.04 + i * 0.03, 16, 80);
        const disk = new THREE.Mesh(diskGeo, new THREE.MeshBasicMaterial({ 
          color: i < 2 ? GOLD : PURPLE, 
          transparent: true, 
          opacity: 0.5 - i * 0.1 
        }));
        disk.name = `disk${i}`;
        group.add(disk);
      }

      // Hawking radiation particles escaping
      group.userData.hawkingParticles = [];
      const hpGeom = new THREE.SphereGeometry(0.04, 4, 4);
      for (let i = 0; i < 40; i++) {
        const p = new THREE.Mesh(hpGeom, new THREE.MeshBasicMaterial({ 
          color: GOLD_LIGHT, 
          transparent: true, 
          opacity: 0.7 
        }));
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const dist = 1.4 + Math.random() * 2.5;
        p.position.set(
          dist * Math.sin(phi) * Math.cos(theta),
          dist * Math.sin(phi) * Math.sin(theta),
          dist * Math.cos(phi)
        );
        p.userData.startDist = dist;
        p.userData.phase = Math.random() * Math.PI * 2;
        p.name = `hp${i}`;
        group.add(p);
        group.userData.hawkingParticles.push(p);
      }
    },

    /**
     * Lesson 9: Dark Energy - Accelerating expansion
     */
    darkEnergy() {
      // Expanding particles
      group.userData.expParticles = [];
      const epGeom = new THREE.SphereGeometry(0.05, 6, 6);
      for (let i = 0; i < 120; i++) {
        const p = new THREE.Mesh(epGeom, new THREE.MeshBasicMaterial({ 
          color: i % 3 === 0 ? GOLD : i % 3 === 1 ? PURPLE : CYAN,
          transparent: true,
          opacity: 0.8
        }));
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 0.3 + Math.random() * 0.5;
        p.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
        p.userData.basePos = p.position.clone();
        p.userData.expSpeed = 0.3 + Math.random() * 0.7;
        p.userData.phase = Math.random() * Math.PI * 2;
        p.name = `ep${i}`;
        group.add(p);
        group.userData.expParticles.push(p);
      }

      // Cosmic web threads
      const threadMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.1 });
      for (let i = 0; i < 15; i++) {
        const geo = new THREE.BufferGeometry();
        const p1 = new THREE.Vector3((Math.random()-0.5)*5, (Math.random()-0.5)*4, (Math.random()-0.5)*4);
        const p2 = new THREE.Vector3((Math.random()-0.5)*5, (Math.random()-0.5)*4, (Math.random()-0.5)*4);
        geo.setFromPoints([p1, p2]);
        group.add(new THREE.Line(geo, threadMat));
      }
    },

    /**
     * Lesson 10: Many Worlds - Branching tree
     */
    manyWorlds() {
      const branchMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.5 });
      
      function addBranch(start, dir, depth, maxDepth) {
        if (depth > maxDepth) return;
        const len = 2.5 / (depth + 1);
        const end = start.clone().add(dir.clone().normalize().multiplyScalar(len));
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const line = new THREE.Line(geo, branchMat.clone());
        line.name = `branch${depth}_${Math.random()}`;
        group.add(line);

        if (depth < maxDepth) {
          const n1 = dir.clone().normalize().multiplyScalar(len).applyAxisAngle(new THREE.Vector3(0,1,0), 0.6);
          const n2 = dir.clone().normalize().multiplyScalar(len).applyAxisAngle(new THREE.Vector3(0,1,0), -0.6);
          const n3 = dir.clone().normalize().multiplyScalar(len).applyAxisAngle(new THREE.Vector3(1,0,0), 0.4);
          addBranch(end, n1, depth + 1, maxDepth);
          addBranch(end, n2, depth + 1, maxDepth);
          if (depth < 2) addBranch(end, n3, depth + 1, maxDepth);
        }
      }

      addBranch(new THREE.Vector3(0, -2.8, 0), new THREE.Vector3(0, 1, 0), 1, 4);

      // Leaf nodes (worlds)
      const leafGeo = new THREE.SphereGeometry(0.1, 6, 6);
      const leafColors = [GOLD, PURPLE, CYAN, BLUE, GOLD_LIGHT];
      for (let i = 0; i < 50; i++) {
        const leaf = new THREE.Mesh(leafGeo, new THREE.MeshBasicMaterial({ 
          color: leafColors[Math.floor(Math.random() * leafColors.length)],
          transparent: true,
          opacity: 0.7
        }));
        leaf.position.set((Math.random()-0.5)*2.5, 1.5 + Math.random() * 2, (Math.random()-0.5)*2);
        leaf.name = `leaf${i}`;
        group.add(leaf);
      }
    },

    /**
     * Lesson 11: Anthropic Principle - Observer-centered universe
     */
    anthropic() {
      // Observer eye at center
      const eyeGeo = new THREE.SphereGeometry(0.3, 16, 16);
      const eye = new THREE.Mesh(eyeGeo, new THREE.MeshPhongMaterial({ 
        color: GOLD, 
        emissive: GOLD, 
        emissiveIntensity: 0.8 
      }));
      group.add(eye);

      // Concentric parameter shells
      for (let s = 1; s <= 5; s++) {
        const shellGeo = new THREE.SphereGeometry(s * 0.8, 24, 24);
        const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ 
          color: s % 2 === 0 ? PURPLE : GOLD,
          wireframe: true,
          transparent: true,
          opacity: 0.15
        }));
        shell.name = `shell${s}`;
        group.add(shell);
      }

      // "Observer" rays
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const rayGeo = new THREE.BufferGeometry();
        const end = new THREE.Vector3(Math.cos(angle) * 4, 0, Math.sin(angle) * 4);
        rayGeo.setFromPoints([new THREE.Vector3(0, 0, 0), end]);
        const ray = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ 
          color: GOLD, 
          transparent: true, 
          opacity: 0.15 
        }));
        group.add(ray);
      }
    },

    /**
     * Lesson 12: Universe as Quantum Computer - Circuit board
     */
    quantumComputer() {
      // Grid base
      const gridHelper = new THREE.PolarGridHelper(3, 24, 16, 64, GOLD_DIM, GOLD_DIM);
      group.add(gridHelper);

      // Qubit orbs
      const qubitGeo = new THREE.SphereGeometry(0.2, 16, 16);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const r = 2.0;
        const qubit = new THREE.Mesh(qubitGeo, new THREE.MeshPhongMaterial({ 
          color: i % 2 === 0 ? GOLD : PURPLE, 
          emissive: i % 2 === 0 ? GOLD : PURPLE, 
          emissiveIntensity: 0.5 
        }));
        qubit.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        qubit.name = `qubit${i}`;
        group.add(qubit);
      }

      // Quantum gate rings
      for (let i = 0; i < 3; i++) {
        const gateGeo = new THREE.TorusGeometry(1.5 + i * 0.5, 0.03, 16, 64);
        const gate = new THREE.Mesh(gateGeo, new THREE.MeshBasicMaterial({ 
          color: CYAN, 
          transparent: true, 
          opacity: 0.4 
        }));
        gate.rotation.x = Math.PI / 3;
        gate.name = `gate${i}`;
        group.add(gate);
      }
    },

    /**
     * Lesson 13: Essence of Computation - Turing machine tape
     */
    computation() {
      // Infinite tape illusion
      for (let i = -20; i <= 20; i++) {
        const cellGeo = new THREE.BoxGeometry(0.22, 0.08, 0.22);
        const val = Math.random() > 0.5;
        const cell = new THREE.Mesh(cellGeo, new THREE.MeshBasicMaterial({ 
          color: val ? GOLD : 0x222233,
          transparent: true,
          opacity: 0.8
        }));
        cell.position.set(i * 0.25, 0, 0);
        cell.name = `tape${i}`;
        group.add(cell);
      }

      // Read/write head
      const headGeo = new THREE.ConeGeometry(0.15, 0.4, 8);
      const head = new THREE.Mesh(headGeo, new THREE.MeshPhongMaterial({ 
        color: PURPLE, 
        emissive: PURPLE, 
        emissiveIntensity: 0.5 
      }));
      head.position.set(0, 0.3, 0);
      head.name = 'head';
      group.add(head);

      // State indicator
      const stateGeo = new THREE.RingGeometry(0.25, 0.35, 32);
      const state = new THREE.Mesh(stateGeo, new THREE.MeshBasicMaterial({ 
        color: CYAN, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.7 
      }));
      state.position.copy(head.position);
      state.name = 'state';
      group.add(state);
    },

    /**
     * Lesson 14: Conway's Game of Life - Live simulation
     */
    gameOfLife() {
      const size = 11;
      group.userData.golCells = [];
      group.userData.golState = [];
      group.userData.golTimer = 0;
      group.userData.golInterval = 0.8;
      
      const cellGeo = new THREE.BoxGeometry(0.35, 0.08, 0.35);
      for (let x = 0; x < size; x++) {
        group.userData.golState[x] = [];
        for (let z = 0; z < size; z++) {
          const alive = Math.random() > 0.65;
          group.userData.golState[x][z] = alive;
          const cell = new THREE.Mesh(cellGeo, new THREE.MeshBasicMaterial({ 
            color: alive ? GOLD : 0x111122, 
            transparent: true, 
            opacity: alive ? 0.9 : 0.25
          }));
          cell.position.set((x - size/2) * 0.4, 0, (z - size/2) * 0.4);
          cell.name = `gol${x}_${z}`;
          group.add(cell);
          group.userData.golCells.push({ mesh: cell, x, z });
        }
      }
    },

    /**
     * Lesson 15: Digital Physics - Bit → Reality
     */
    digitalPhysics() {
      // Bottom: bit grid
      const bitGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      for (let x = -6; x <= 6; x++) {
        for (let z = -6; z <= 6; z++) {
          const on = (x + z) % 2 === 0 || Math.random() > 0.5;
          const bit = new THREE.Mesh(bitGeo, new THREE.MeshBasicMaterial({ 
            color: on ? GOLD : 0x111122, 
            transparent: true, 
            opacity: on ? 0.8 : 0.3
          }));
          bit.position.set(x * 0.25, -2, z * 0.25);
          bit.name = `bit${x}_${z}`;
          group.add(bit);
        }
      }

      // Top: emerging reality (sphere)
      const realityGeo = new THREE.SphereGeometry(1.5, 32, 32);
      const reality = new THREE.Mesh(realityGeo, new THREE.MeshBasicMaterial({ 
        color: GOLD, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.2 
      }));
      reality.position.y = 1.5;
      reality.name = 'reality';
      group.add(reality);

      // Connection rays
      for (let i = 0; i < 30; i++) {
        const rayGeo = new THREE.BufferGeometry();
        const bx = (Math.random() - 0.5) * 3;
        const bz = (Math.random() - 0.5) * 3;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const rx = 1.5 * Math.sin(phi) * Math.cos(theta);
        const ry = 1.5 + 1.5 * Math.cos(phi);
        const rz = 1.5 * Math.sin(phi) * Math.sin(theta);
        rayGeo.setFromPoints([new THREE.Vector3(bx, -2, bz), new THREE.Vector3(rx, ry, rz)]);
        group.add(new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ 
          color: GOLD, transparent: true, opacity: 0.12 
        })));
      }
    },

    /**
     * Lesson 16: Holographic Principle - 2D → 3D projection
     */
    holographic() {
      // Bottom 2D surface
      const surfaceGeo = new THREE.PlaneGeometry(5, 5, 20, 20);
      const surface = new THREE.Mesh(surfaceGeo, new THREE.MeshBasicMaterial({ 
        color: GOLD, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.25,
        side: THREE.DoubleSide
      }));
      surface.rotation.x = -Math.PI / 2;
      surface.position.y = -1.5;
      surface.name = 'surface';
      group.add(surface);

      // Top hologram (3D sphere)
      const holoGeo = new THREE.IcosahedronGeometry(1.8, 3);
      const holo = new THREE.Mesh(holoGeo, new THREE.MeshBasicMaterial({ 
        color: PURPLE, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.3 
      }));
      holo.position.y = 1.5;
      holo.name = 'hologram';
      group.add(holo);

      // Projection beams (from surface points to sphere surface)
      for (let i = 0; i < 40; i++) {
        const beamGeo = new THREE.BufferGeometry();
        const sx = (Math.random() - 0.5) * 4;
        const sz = (Math.random() - 0.5) * 4;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const hx = 1.8 * Math.sin(phi) * Math.cos(theta);
        const hy = 1.5 + 1.8 * Math.cos(phi);
        const hz = 1.8 * Math.sin(phi) * Math.sin(theta);
        beamGeo.setFromPoints([new THREE.Vector3(sx, -1.5, sz), new THREE.Vector3(hx, hy, hz)]);
        group.add(new THREE.Line(beamGeo, new THREE.LineBasicMaterial({ 
          color: CYAN, transparent: true, opacity: 0.12 
        })));
      }
    },

    /**
     * Lesson 17: Quantum Information - Bloch spheres
     */
    quantumInfo() {
      const blochGeo = new THREE.SphereGeometry(1.2, 24, 24);
      const blochMat = new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true, transparent: true, opacity: 0.15 });
      
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 1.2;
        const bloch = new THREE.Mesh(blochGeo, blochMat.clone());
        bloch.position.set(x, 0, 0);
        bloch.name = `bloch${i}`;
        group.add(bloch);

        // State vector arrow
        const arrowGeo = new THREE.ConeGeometry(0.06, 0.3, 8);
        const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: GOLD_LIGHT }));
        arrow.position.set(x, 1.1, 0);
        arrow.name = `arrow${i}`;
        group.add(arrow);
      }
    },

    /**
     * Lesson 18: Great Filter - Filter layers
     */
    greatFilter() {
      // Filter planes
      for (let i = 0; i < 5; i++) {
        const y = -2 + i * 1;
        const filterGeo = new THREE.PlaneGeometry(5, 0.05);
        const filter = new THREE.Mesh(filterGeo, new THREE.MeshBasicMaterial({ 
          color: i < 3 ? GOLD : i === 3 ? PURPLE : CYAN,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide
        }));
        filter.position.y = y;
        filter.name = `filter${i}`;
        group.add(filter);
      }

      // Civilization dots trying to rise
      const civGeo = new THREE.SphereGeometry(0.1, 8, 8);
      for (let i = 0; i < 30; i++) {
        const civ = new THREE.Mesh(civGeo, new THREE.MeshBasicMaterial({ 
          color: i % 2 === 0 ? GOLD_LIGHT : CYAN,
          transparent: true,
          opacity: 0.8
        }));
        civ.position.set((Math.random()-0.5)*4, -3, (Math.random()-0.5)*4);
        civ.userData.baseY = civ.position.y;
        civ.userData.targetY = -3 + Math.random() * 4;
        civ.userData.phase = Math.random() * Math.PI * 2;
        civ.userData.speed = 0.3 + Math.random() * 0.5;
        civ.name = `civ${i}`;
        group.add(civ);
      }
    },

    /**
     * Lesson 19: Consciousness - Neural network
     */
    consciousness() {
      // Brain-like nodes
      const nodes = [];
      const nodeGeo = new THREE.SphereGeometry(0.12, 8, 8);
      for (let i = 0; i < 40; i++) {
        const node = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ 
          color: GOLD, 
          transparent: true, 
          opacity: 0.8 
        }));
        node.position.set((Math.random()-0.5)*5, (Math.random()-0.5)*4, (Math.random()-0.5)*3);
        node.name = `neuron${i}`;
        nodes.push(node);
        group.add(node);
      }

      // Synaptic connections
      const connMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.12 });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[i].position.distanceTo(nodes[j].position) < 1.8 && Math.random() > 0.5) {
            const geo = new THREE.BufferGeometry().setFromPoints([nodes[i].position, nodes[j].position]);
            group.add(new THREE.Line(geo, connMat.clone()));
          }
        }
      }

      // Central "I" glow
      const selfGeo = new THREE.SphereGeometry(0.5, 16, 16);
      const self = new THREE.Mesh(selfGeo, new THREE.MeshPhongMaterial({ 
        color: PURPLE, 
        emissive: PURPLE, 
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.6
      }));
      self.name = 'self';
      group.add(self);
    },

    /**
     * Lesson 20: Phase Summary - Combined journey
     */
    phaseSummary() {
      // Mini universe with all elements
      const miniGeo = new THREE.IcosahedronGeometry(2, 1);
      const mini = new THREE.Mesh(miniGeo, new THREE.MeshBasicMaterial({ 
        color: GOLD, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.2 
      }));
      mini.name = 'universe';
      group.add(mini);

      // Orbiting path
      const pathGeo = new THREE.TorusGeometry(2.5, 0.02, 16, 100);
      const path = new THREE.Mesh(pathGeo, new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3 }));
      path.name = 'path';
      group.add(path);

      // Journey markers (lesson orbs)
      const markerGeo = new THREE.SphereGeometry(0.08, 6, 6);
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ 
          color: i < 10 ? GOLD : PURPLE,
          transparent: true,
          opacity: 0.7
        }));
        marker.position.set(Math.cos(angle) * 2.5, 0, Math.sin(angle) * 2.5);
        marker.name = `marker${i}`;
        group.add(marker);
      }

      // Central completion star
      const starGeo = new THREE.OctahedronGeometry(0.5, 0);
      const star = new THREE.Mesh(starGeo, new THREE.MeshPhongMaterial({ 
        color: GOLD, 
        emissive: GOLD, 
        emissiveIntensity: 1.0 
      }));
      group.add(star);
    }
  };

  // ── Main OrbitControls ──────────────────────────────────────
  const useOrbit = CONFIG.orbit !== false; // true by default
  let controls = null;
  if (useOrbit && THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = CONFIG.autoRotate !== false;
    controls.autoRotateSpeed = CONFIG.autoRotateSpeed || 0.5;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI * 0.7;
    controls.enableZoom = CONFIG.enableZoom !== false;
  }

  // ── Mouse interaction ──────────────────────────────────────
  let mouseX = 0, mouseY = 0;
  const onMouseMove = (e) => {
    const rect = container.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / W) * 2 - 1;
    mouseY = -((e.clientY - rect.top) / H) * 2 + 1;
  };
  container.addEventListener('mousemove', onMouseMove);

  // ── Touch interaction ──────────────────────────────────────
  container.addEventListener('touchmove', (e) => {
    const rect = container.getBoundingClientRect();
    mouseX = ((e.touches[0].clientX - rect.left) / W) * 2 - 1;
    mouseY = -((e.touches[0].clientY - rect.top) / H) * 2 + 1;
  }, { passive: true });

  // ── Build Scene ────────────────────────────────────────────
  if (builders[CONFIG.scene]) {
    builders[CONFIG.scene]();
  }

  // ── Animation Loop ─────────────────────────────────────────
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (controls) controls.update();

    // ─ Per-scene animations ────────────────────────────────
    switch (CONFIG.scene) {
      case 'simulation':
        // Quantum particles blink
        const qps = group.userData.qParticles;
        if (qps) {
          const arr = qps.positions;
          for (let i = 0; i < 80; i++) {
            const phase = qps.phases[i];
            const alpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3 + phase));
          }
          // Update particle opacity
          const qMesh = group.children.find(c => c.name === 'qParticles');
          if (qMesh) qMesh.material.opacity = 0.5 + 0.3 * Math.sin(t * 2);
        }
        // Rotate rings at different speeds
        for (let j = 0; j < 3; j++) {
          const ring = group.children.find(c => c.name === `ring${j}`);
          if (ring) ring.rotation.z += 0.003 * (j + 1) * (j % 2 === 0 ? 1 : -1);
        }
        // Rotate universe slightly
        group.rotation.y += 0.002;
        break;

      case 'trilemma':
        for (let i = 0; i < 3; i++) {
          const sphere = group.children.find(c => c.name === `nest${i}`);
          if (sphere) {
            sphere.rotation.x += 0.003 * (i + 1) * 0.5;
            sphere.rotation.y += 0.004 * (i + 1) * 0.3;
          }
        }
        break;

      case 'computeCosmos':
        const core = group.children.find(c => c.name === 'core');
        if (core) core.rotation.y += 0.02;
        for (let i = 0; i < 5; i++) {
          const ring = group.children.find(c => c.name === `dring${i}`);
          if (ring) {
            ring.rotation.z += 0.005 * (i % 2 === 0 ? 1 : -1);
            ring.scale.setScalar(1 + 0.03 * Math.sin(t * 2 + i));
          }
        }
        break;

      case 'superposition':
        const waveMesh = group.children.find(c => c.name === 'wave');
        if (waveMesh && group.userData.waveGeo) {
          const pos = group.userData.waveGeo.attributes.position;
          const base = group.userData.waveOffset.base;
          for (let i = 0; i < pos.count; i++) {
            const x = base[i*3];
            const y = base[i*3+1];
            pos.array[i*3+2] = Math.sin(x * 2 + t) * Math.cos(y * 2 + t) * 0.3;
          }
          pos.needsUpdate = true;
        }
        for (let s = -1; s <= 1; s += 2) {
          for (let r = 0; r < 4; r++) {
            const ring = group.children.find(c => c.name === `sring${s}_${r}`);
            if (ring) ring.scale.setScalar(1 + 0.1 * Math.sin(t * 2 + r));
          }
        }
        break;

      case 'entanglement':
        // Vibrating connection
        const conn = group.children.find(c => c.name === 'connection');
        if (conn) {
          const pos = conn.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const idx = i * 3;
            const x = pos.array[idx];
            pos.array[idx+1] = Math.sin(x * 4 + t * 6) * 0.15;
          }
          pos.needsUpdate = true;
        }
        // Rotate Bloch spheres
        for (let i = 0; i < 2; i++) {
          const bloch = group.children.find(c => c.name === `bloch${i}`);
          if (bloch) bloch.rotation.y += 0.008;
        }
        break;

      case 'fineTuning':
        // Orbiting parameters
        for (let i = 0; i < 26; i++) {
          const p = group.children.find(c => c.name === `param${i}`);
          if (p && p.userData.basePos) {
            p.position.copy(p.userData.basePos);
            p.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), t * 0.3 * (0.5 + i * 0.02));
          }
        }
        const ar = group.children.find(c => c.name === 'alphaRing');
        if (ar) ar.rotation.z += 0.008;
        break;

      case 'turingComplete':
        // Auto-update Game of Life
        group.userData.cellTimer += 0.016;
        if (group.userData.cellTimer > group.userData.cellInterval) {
          group.userData.cellTimer = 0;
          // Count neighbors and update
          const cells = group.userData.cells;
          const states = cells.map(c => c.userData.alive);
          cells.forEach((cell, idx) => {
            const pos = cell.position;
            let neighbors = 0;
            cells.forEach((other, j) => {
              if (j !== idx && pos.distanceTo(other.position) < 0.6) {
                if (states[j]) neighbors++;
              }
            });
            const wasAlive = states[idx];
            const alive = (wasAlive && (neighbors === 2 || neighbors === 3)) || (!wasAlive && neighbors === 3);
            cell.userData.alive = alive;
            cell.material.color.set(alive ? GOLD : 0x111122);
            cell.material.opacity = alive ? 0.9 : 0.3;
          });
        }
        break;

      case 'blackHole':
        // Rotating accretion disk
        for (let i = 0; i < 4; i++) {
          const disk = group.children.find(c => c.name === `disk${i}`);
          if (disk) disk.rotation.z += 0.01 * (i + 1) * 0.5;
        }
        // Hawking radiation
        if (group.userData.hawkingParticles) {
          group.userData.hawkingParticles.forEach(p => {
            const d = p.userData.startDist + Math.sin(t * 2 + p.userData.phase) * 0.3 + t * 0.15;
            const dir = p.position.clone().normalize();
            p.position.copy(dir.multiplyScalar(d));
            p.material.opacity = 0.3 + 0.4 / (d * 0.5);
          });
        }
        break;

      case 'darkEnergy':
        if (group.userData.expParticles) {
          group.userData.expParticles.forEach(p => {
            const factor = 1 + t * 0.05 * p.userData.expSpeed;
            p.position.copy(p.userData.basePos.clone().multiplyScalar(factor));
            p.material.opacity = Math.max(0.2, 1 - t * 0.03);
          });
        }
        break;

      case 'manyWorlds':
        group.rotation.y += 0.003;
        break;

      case 'anthropic':
        // Pulsing shells
        for (let s = 1; s <= 5; s++) {
          const shell = group.children.find(c => c.name === `shell${s}`);
          if (shell) shell.scale.setScalar(1 + 0.05 * Math.sin(t + s));
        }
        break;

      case 'quantumComputer':
        // Orbit qubits
        for (let i = 0; i < 8; i++) {
          const q = group.children.find(c => c.name === `qubit${i}`);
          if (q) {
            const r = 2.0;
            const angle = (i / 8) * Math.PI * 2 + t * 0.3;
            q.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
          }
        }
        for (let i = 0; i < 3; i++) {
          const gate = group.children.find(c => c.name === `gate${i}`);
          if (gate) gate.rotation.z += 0.01 * (i % 2 === 0 ? 1 : -1);
        }
        break;

      case 'computation':
        // Moving tape
        const head = group.children.find(c => c.name === 'head');
        if (head) head.position.x = Math.sin(t * 2) * 2;
        for (let i = -20; i <= 20; i++) {
          const cell = group.children.find(c => c.name === `tape${i}`);
          if (cell) {
            cell.position.x = i * 0.25 + Math.sin(t * 2) * 0.05;
          }
        }
        break;

      case 'gameOfLife':
        group.userData.golTimer += 0.016;
        if (group.userData.golTimer > group.userData.golInterval) {
          group.userData.golTimer = 0;
          const size = 11;
          const nextState = [];
          for (let x = 0; x < size; x++) {
            nextState[x] = [];
            for (let z = 0; z < size; z++) {
              let neighbors = 0;
              for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                  if (dx === 0 && dz === 0) continue;
                  const nx = (x + dx + size) % size;
                  const nz = (z + dz + size) % size;
                  if (group.userData.golState[nx][nz]) neighbors++;
                }
              }
              const wasAlive = group.userData.golState[x][z];
              nextState[x][z] = (wasAlive && (neighbors === 2 || neighbors === 3)) || (!wasAlive && neighbors === 3);
            }
          }
          group.userData.golState = nextState;
          group.userData.golCells.forEach(c => {
            const alive = nextState[c.x][c.z];
            c.mesh.material.color.set(alive ? GOLD : 0x111122);
            c.mesh.material.opacity = alive ? 0.9 : 0.25;
          });
        }
        break;

      case 'digitalPhysics':
        group.rotation.y += 0.005;
        const reality = group.children.find(c => c.name === 'reality');
        if (reality) reality.rotation.y += 0.01;
        break;

      case 'holographic':
        const hologram = group.children.find(c => c.name === 'hologram');
        if (hologram) hologram.rotation.y += 0.008;
        break;

      case 'quantumInfo':
        for (let i = 0; i < 5; i++) {
          const arrow = group.children.find(c => c.name === `arrow${i}`);
          if (arrow) arrow.rotation.z += 0.015 * (i + 1) * 0.5;
          const bloch = group.children.find(c => c.name === `bloch${i}`);
          if (bloch) bloch.rotation.y += 0.005;
        }
        break;

      case 'greatFilter':
        const civs = group.children.filter(c => c.name && c.name.startsWith('civ'));
        civs.forEach(civ => {
          const progress = 0.5 + 0.5 * Math.sin(t * civ.userData.speed + civ.userData.phase);
          civ.position.y = civ.userData.baseY + (civ.userData.targetY - civ.userData.baseY) * progress;
        });
        break;

      case 'consciousness':
        // Pulse the "self" glow
        const self = group.children.find(c => c.name === 'self');
        if (self) self.scale.setScalar(1 + 0.2 * Math.sin(t * 1.5));
        // Neuron pulses
        const neurons = group.children.filter(c => c.name && c.name.startsWith('neuron'));
        neurons.forEach((n, i) => {
          n.material.opacity = 0.5 + 0.4 * Math.sin(t * 2 + i * 0.3);
        });
        break;

      case 'phaseSummary':
        group.rotation.y += 0.004;
        // Orbiting markers
        for (let i = 0; i < 20; i++) {
          const marker = group.children.find(c => c.name === `marker${i}`);
          if (marker) {
            const angle = (i / 20) * Math.PI * 2 + t * 0.2;
            marker.position.set(Math.cos(angle) * 2.5, Math.sin(t * 0.5 + i) * 0.5, Math.sin(angle) * 2.5);
          }
        }
        break;
    }

    // Gentle background stars rotation
    bgStars.rotation.y += 0.0005;
    bgStars.rotation.x += 0.0002;

    renderer.render(scene, camera);
  }

  // ── Responsive Resize ──────────────────────────────────────
  function onResize() {
    const newW = container.clientWidth;
    const newH = container.clientHeight || Math.min(newW * 0.56, 420);
    if (newW === W && newH === H) return;
    camera.aspect = newW / newH;
    camera.updateProjectionMatrix();
    renderer.setSize(newW, newH);
  }
  window.addEventListener('resize', onResize);

  animate();
})();
