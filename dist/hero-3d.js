// VICE HEIST ($HEIST) — 3D Neon-Noir Hero Showcase (Three.js)
// Production-grade mobile-optimized 3D Coastal Boulevard & Sports Coupe Tier Showcase

let scene, camera, renderer, coupeGroup, underglowMesh, carBodyMesh, spoilerMesh, turretsGroup;
let roadMesh, roadMaterial, animFrameId;
let currentTier = 'runner';

const TIER_COLORS = {
  runner: {
    body: 0xff007f, // Hot Magenta Pink
    underglow: 0xff007f,
    lights: 0x00f0ff,
    spoiler: false,
    turrets: false
  },
  captain: {
    body: 0x00f0ff, // Electric Cyan
    underglow: 0x00f0ff,
    lights: 0xff00ea,
    spoiler: true,
    turrets: false
  },
  kingpin: {
    body: 0xffb800, // Midnight Gold Chrome
    underglow: 0xffb800,
    lights: 0xff0055,
    spoiler: true,
    turrets: true
  }
};

export function initHero3D(canvas, fallback) {
  if (!canvas || typeof window === 'undefined' || !window.THREE) {
    if (fallback) fallback.style.display = 'block';
    if (canvas) canvas.style.display = 'none';
    return null;
  }

  // Check prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (fallback) fallback.style.display = 'block';
    canvas.style.display = 'none';
    return null;
  }

  const THREE = window.THREE;
  const width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
  const height = canvas.parentElement ? canvas.parentElement.clientHeight || 460 : 460;

  try {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060714, 0.025);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 3.2, 7.8);
    camera.lookAt(0, 0.8, 0);

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); // Mobile battery/GPU guard
    renderer.shadowMap.enabled = false;

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0x1a1233, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 2.2);
    dirLight.position.set(6, 12, 6);
    scene.add(dirLight);

    const pinkRim = new THREE.DirectionalLight(0xff007f, 3.0);
    pinkRim.position.set(-6, 8, -4);
    scene.add(pinkRim);

    // Wet Reflective Coastal Boulevard Road
    const roadGeo = new THREE.PlaneGeometry(16, 60, 16, 32);
    roadGeo.rotateX(-Math.PI / 2);

    // Procedural grid road shader/material
    roadMaterial = new THREE.MeshBasicMaterial({
      color: 0x070918,
      wireframe: false
    });
    roadMesh = new THREE.Mesh(roadGeo, roadMaterial);
    roadMesh.position.y = -0.05;
    scene.add(roadMesh);

    // Road Neon Speed Lines
    const lineGeo = new THREE.PlaneGeometry(0.16, 2.5);
    lineGeo.rotateX(-Math.PI / 2);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    for (let i = -24; i < 24; i += 5) {
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(0, 0.01, i);
      scene.add(line);
    }

    // Roadside Palm Tree Silhouettes
    for (let side = -1; side <= 1; side += 2) {
      for (let z = -20; z <= 20; z += 8) {
        const trunkGeo = new THREE.CylinderGeometry(0.08, 0.14, 4.5, 6);
        const trunkMat = new THREE.MeshBasicMaterial({ color: 0x0a0c20 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(side * 6.5, 2.25, z);
        trunk.rotation.z = side * -0.08;
        scene.add(trunk);

        // Palm fronds
        const frondGeo = new THREE.ConeGeometry(1.6, 0.8, 5);
        const frondMat = new THREE.MeshBasicMaterial({ color: 0x0e1230 });
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.set(side * 6.5 + (side * -0.3), 4.4, z);
        scene.add(frond);
      }
    }

    // Build the 3D Sports Coupe
    buildSportsCoupe(THREE);

    // Pointer / Touch Orbit Controls
    let isDragging = false;
    let prevPointerX = 0;
    let targetRotationY = 0;

    const onPointerDown = (e) => {
      isDragging = true;
      prevPointerX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    };

    const onPointerMove = (e) => {
      if (!isDragging || !coupeGroup) return;
      const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const deltaX = currentX - prevPointerX;
      targetRotationY += deltaX * 0.008;
      prevPointerX = currentX;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // Responsive Resize Handler
    const onResize = () => {
      if (!canvas || !renderer || !camera) return;
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : window.innerWidth;
      const h = parent ? parent.clientHeight || 460 : 460;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (coupeGroup) {
        // Slow idle turn + drag rotation
        if (!isDragging) {
          targetRotationY += 0.25 * delta;
        }
        coupeGroup.rotation.y += (targetRotationY - coupeGroup.rotation.y) * 0.08;

        // Subtle vehicle suspension bounce
        coupeGroup.position.y = 0.55 + Math.sin(elapsed * 4) * 0.015;
      }

      // Pulse underglow
      if (underglowMesh) {
        underglowMesh.material.opacity = 0.45 + Math.sin(elapsed * 5) * 0.15;
      }

      renderer.render(scene, camera);
    };
    animate();

    return {
      setTier: setHeroCoupeTier,
      destroy: () => {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        window.removeEventListener('resize', onResize);
      }
    };
  } catch (err) {
    console.warn('Three.js Hero initialization fallback:', err);
    if (fallback) fallback.style.display = 'block';
    canvas.style.display = 'none';
    return null;
  }
}

function buildSportsCoupe(THREE) {
  coupeGroup = new THREE.Group();
  coupeGroup.position.set(0, 0.55, 0);

  // 1. Lower Chassis (Chiseled Cyber Coupe)
  const chassisGeo = new THREE.BoxGeometry(2.1, 0.55, 4.4);
  carBodyMesh = new THREE.Mesh(
    chassisGeo,
    new THREE.MeshStandardMaterial({
      color: TIER_COLORS.runner.body,
      metalness: 0.85,
      roughness: 0.18,
      emissive: 0x220011,
      emissiveIntensity: 0.2
    })
  );
  coupeGroup.add(carBodyMesh);

  // 2. Aerodynamic Cockpit & Windshield
  const cabinGeo = new THREE.BoxGeometry(1.65, 0.48, 2.2);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x05060f,
    metalness: 0.95,
    roughness: 0.05,
    transparent: true,
    opacity: 0.88
  });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 0.46, -0.2);
  coupeGroup.add(cabin);

  // 3. Dual Headlights (LED Neon)
  const lightGeo = new THREE.BoxGeometry(0.35, 0.1, 0.08);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  
  const leftHeadlight = new THREE.Mesh(lightGeo, lightMat);
  leftHeadlight.position.set(-0.72, 0.05, 2.2);
  coupeGroup.add(leftHeadlight);

  const rightHeadlight = leftHeadlight.clone();
  rightHeadlight.position.x = 0.72;
  coupeGroup.add(rightHeadlight);

  // 4. Rear Taillight Bar (Neon Cyber Strip)
  const tailGeo = new THREE.BoxGeometry(1.8, 0.08, 0.08);
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
  const tailLight = new THREE.Mesh(tailGeo, tailMat);
  tailLight.position.set(0, 0.08, -2.2);
  coupeGroup.add(tailLight);

  // 5. Four Custom Mag Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.4, metalness: 0.7 });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  const wheelPositions = [
    [-1.05, -0.15, 1.3],
    [1.05, -0.15, 1.3],
    [-1.05, -0.15, -1.3],
    [1.05, -0.15, -1.3]
  ];

  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(...pos);

    // Neon Rim Accent
    const rimRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.35, 8), rimMat);
    rimRing.rotation.y = pos[0] > 0 ? Math.PI / 2 : -Math.PI / 2;
    rimRing.position.x = pos[0] > 0 ? 0.17 : -0.17;
    wheel.add(rimRing);

    coupeGroup.add(wheel);
  });

  // 6. Neon Underglow Plane
  const underglowGeo = new THREE.PlaneGeometry(2.6, 5.0);
  underglowGeo.rotateX(-Math.PI / 2);
  underglowMesh = new THREE.Mesh(
    underglowGeo,
    new THREE.MeshBasicMaterial({
      color: TIER_COLORS.runner.underglow,
      transparent: true,
      opacity: 0.55
    })
  );
  underglowMesh.position.y = -0.48;
  coupeGroup.add(underglowMesh);

  // 7. Carbon Rear Spoiler (Captain & Kingpin Tiers)
  const spoilerGroup = new THREE.Group();
  const wingGeo = new THREE.BoxGeometry(2.1, 0.06, 0.45);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x111118, metalness: 0.8 });
  const wing = new THREE.Mesh(wingGeo, wingMat);
  wing.position.set(0, 0.65, -1.9);

  const strutGeo = new THREE.BoxGeometry(0.06, 0.35, 0.12);
  const leftStrut = new THREE.Mesh(strutGeo, wingMat);
  leftStrut.position.set(-0.7, 0.45, -1.9);
  const rightStrut = leftStrut.clone();
  rightStrut.position.x = 0.7;

  spoilerGroup.add(wing, leftStrut, rightStrut);
  spoilerGroup.visible = false;
  spoilerMesh = spoilerGroup;
  coupeGroup.add(spoilerGroup);

  // 8. Dual Roof Blasters (Kingpin Tier Exclusive)
  turretsGroup = new THREE.Group();
  const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8);
  barrelGeo.rotateX(Math.PI / 2);
  const turretMat = new THREE.MeshStandardMaterial({ color: 0xffb800, metalness: 0.9 });

  const leftTurret = new THREE.Mesh(barrelGeo, turretMat);
  leftTurret.position.set(-0.45, 0.72, 0.1);
  const rightTurret = leftTurret.clone();
  rightTurret.position.x = 0.45;

  turretsGroup.add(leftTurret, rightTurret);
  turretsGroup.visible = false;
  coupeGroup.add(turretsGroup);

  scene.add(coupeGroup);
}

export function setHeroCoupeTier(tierName) {
  const tier = TIER_COLORS[tierName] || TIER_COLORS.runner;
  currentTier = tierName;

  if (carBodyMesh) {
    carBodyMesh.material.color.setHex(tier.body);
    carBodyMesh.material.emissive.setHex(tierName === 'kingpin' ? 0x442a00 : 0x220011);
  }
  if (underglowMesh) {
    underglowMesh.material.color.setHex(tier.underglow);
  }
  if (spoilerMesh) {
    spoilerMesh.visible = tier.spoiler;
  }
  if (turretsGroup) {
    turretsGroup.visible = tier.turrets;
  }
}
