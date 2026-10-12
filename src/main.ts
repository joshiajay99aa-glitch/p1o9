import * as THREE from 'three';

// ============================================================================
// CONFIGURATION SETTINGS
// Centralized parameters for robot look, materials, physics, and animations.
// ============================================================================
export const CONFIG = {
  // Color palette (glossy white toy droid with orange accents and dark glass eye)
  colors: {
    background: 0xdfdfdf,        // Flat scene background light grey (#dfdfdf)
    body: 0xf4f4f2,              // Glossy white body & dome (#f4f4f2)
    accentOrange: 0xff7a1a,      // Toy robot orange rings & stripes (#ff7a1a)
    panelGrey: 0x8a8f98,         // Recessed body panels & antenna stem (#8a8f98)
    eyeGlass: 0x11161d,          // Dark glossy glass lens
    eyeRingEmissive: 0x8ae4ff,   // Glowing blue-white eye ring
    keyLight: 0xfff5e6,          // Warm directional key light
    rimLight: 0xa8d0ff,          // Cool rim directional light
    ambientLight: 0xffffff,      // Soft ambient fill light
  },

  // Physics, movement, and damping
  physics: {
    bodyRadius: 1.0,             // Sphere radius = 1 unit
    maxSpeed: 8.0,               // Maximum velocity units/sec
    acceleration: 11.5,          // Acceleration rate toward target floor position
    damping: 0.90,               // Velocity decay factor (enables playful overshoot)
    stopDistance: 0.2,           // Deadzone threshold closer than 0.2 units
    maxTiltAngle: 0.26,          // Max head lean tilt in travel direction (radians)
    headTurnSpeed: 10.0,         // Head yaw interpolation speed
    headLeanSpeed: 12.0,         // Head lean interpolation speed
  },

  // Animation timings and dynamics
  animation: {
    jumpHeight: 1.6,             // Max vertical jump apex (units)
    reducedJumpHeight: 0.45,     // Soft jump height when prefers-reduced-motion is true
    jumpDuration: 0.88,          // Total jump cycle duration (seconds)
    squashFactor: 0.72,          // Y-scale during pre-takeoff squash
    stretchFactor: 1.28,         // Y-scale during mid-air leap
    idleDelay: 2.0,              // Inactivity delay before idle triggers (seconds)
    eyeGlowIntensityNormal: 2.2, // Default emissive intensity
    eyeGlowIntensityJump: 7.0,   // Flash emissive intensity during jump
    eyeGlowIntensityIdlePulse: 1.2, // Pulse amplitude during idle wobble
    loadingMinDuration: 1.2,     // Minimum loading screen display time (seconds)
    loadingFadeDuration: 0.6,    // Loading screen fade-out duration (seconds)
  },

  // Lighting & Shadows
  lighting: {
    keyIntensity: 2.5,           // Key light intensity
    rimIntensity: 1.8,           // Rim light intensity
    ambientIntensity: 0.65,      // Ambient light intensity
    shadowOpacity: 0.35,         // ShadowMaterial floor opacity
  },

  // Camera framing
  camera: {
    fov: 42,
    near: 0.1,
    far: 80,
    position: [0, 3.6, 6.2] as [number, number, number],
    lookAt: [0, 0.9, 0] as [number, number, number],
  },
};

// ============================================================================
// SYSTEM CHECKS & LOADING SCREEN HANDLER
// ============================================================================
const loadingStartTime = performance.now();

function dismissLoadingScreen(): void {
  const elapsed = (performance.now() - loadingStartTime) / 1000;
  const remaining = Math.max(0, CONFIG.animation.loadingMinDuration - elapsed);

  setTimeout(() => {
    const screen = document.getElementById('loading-screen');
    if (!screen) return;
    screen.style.opacity = '0';
    setTimeout(() => {
      screen.remove();
    }, CONFIG.animation.loadingFadeDuration * 1000);
  }, remaining * 1000);
}

function showWebGLError(message: string): void {
  const loading = document.getElementById('loading-screen');
  if (loading) loading.style.display = 'none';

  const fallback = document.getElementById('webgl-fallback');
  const reason = document.getElementById('fallback-reason');
  if (fallback && reason) {
    reason.textContent = message;
    fallback.classList.remove('hidden');
  }
}

function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

if (!checkWebGLSupport()) {
  showWebGLError('WebGL is not supported or hardware acceleration is disabled in this browser.');
  throw new Error('WebGL unsupported');
}

// ============================================================================
// THREE.JS INITIALIZATION
// ============================================================================
const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
if (!canvas) {
  showWebGLError('Canvas element not found in DOM.');
  throw new Error('Canvas not found');
}

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
} catch (err) {
  showWebGLError('Failed to initialize WebGL renderer: ' + (err instanceof Error ? err.message : String(err)));
  throw err;
}

// Renderer settings: Cap pixel ratio at 2, configure tone mapping & sRGB output
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.background);

// Camera setup: perspective, slightly above and in front, fixed framing
const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  CONFIG.camera.near,
  CONFIG.camera.far
);
camera.position.set(...CONFIG.camera.position);
camera.lookAt(...CONFIG.camera.lookAt);

// ============================================================================
// LIGHTING
// Warm key light with shadows from upper right, cool rim from behind, ambient
// ============================================================================
const ambientLight = new THREE.AmbientLight(CONFIG.colors.ambientLight, CONFIG.lighting.ambientIntensity);
scene.add(ambientLight);

// Key light (warm, upper right, shadow caster)
const keyLight = new THREE.DirectionalLight(CONFIG.colors.keyLight, CONFIG.lighting.keyIntensity);
keyLight.position.set(6.5, 9.5, 4.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.bias = -0.0004;
keyLight.shadow.camera.near = 1.0;
keyLight.shadow.camera.far = 28;
keyLight.shadow.camera.left = -6.5;
keyLight.shadow.camera.right = 6.5;
keyLight.shadow.camera.top = 6.5;
keyLight.shadow.camera.bottom = -6.5;
scene.add(keyLight);

// Cool rim light from behind to highlight silhouettes
const rimLight = new THREE.DirectionalLight(CONFIG.colors.rimLight, CONFIG.lighting.rimIntensity);
rimLight.position.set(-6, 6, -6.5);
scene.add(rimLight);

// Gentle soft fill from left
const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
fillLight.position.set(-4.5, 2.5, 3.5);
scene.add(fillLight);

// ============================================================================
// FLOOR & CONTACT SHADOW
// Flat floor that only shows soft shadows (ShadowMaterial)
// ============================================================================
const floorPlaneGeo = new THREE.PlaneGeometry(120, 120);
const floorShadowMat = new THREE.ShadowMaterial({
  opacity: CONFIG.lighting.shadowOpacity,
});
const floorMesh = new THREE.Mesh(floorPlaneGeo, floorShadowMat);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.y = 0;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// Ground contact shadow disc (built with basic CylinderGeometry)
const contactShadowGeo = new THREE.CylinderGeometry(1.08, 1.08, 0.001, 36);
const contactShadowMat = new THREE.MeshBasicMaterial({
  color: 0x242830,
  transparent: true,
  opacity: 0.24,
  depthWrite: false,
});
const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
contactShadowMesh.position.y = 0.001;
scene.add(contactShadowMesh);

// Raycasting floor target plane for pointer intersection
const raycastFloorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// ============================================================================
// ROBOT CONSTRUCTION (NO EXTERNAL MODELS/TEXTURES - BASIC GEOMETRIES ONLY)
// ============================================================================

// Root group that holds the entire robot for position, jump translation, squash & stretch
const robotRoot = new THREE.Group();
robotRoot.position.set(0, 0, 0);
scene.add(robotRoot);

// Hit-testing group to catch clicks/taps on any part of the robot
const clickableMeshes: THREE.Object3D[] = [];

// ----------------------------------------------------------------------------
// BODY: Large sphere, radius 1, glossy white MeshPhysicalMaterial
// Torus rings and circular grey panels are children of the body
// ----------------------------------------------------------------------------
const bodyGroup = new THREE.Group();
bodyGroup.position.set(0, CONFIG.physics.bodyRadius, 0); // Center at y = 1.0
robotRoot.add(bodyGroup);

const bodyGeo = new THREE.SphereGeometry(CONFIG.physics.bodyRadius, 64, 48);
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: CONFIG.colors.body,
  roughness: 0.25,
  metalness: 0.04,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
});
const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
bodyMesh.castShadow = true;
bodyMesh.receiveShadow = true;
bodyGroup.add(bodyMesh);
clickableMeshes.push(bodyMesh);

// Material for orange accent rings
const orangeAccentMat = new THREE.MeshStandardMaterial({
  color: CONFIG.colors.accentOrange,
  roughness: 0.35,
  metalness: 0.08,
});

// 3 thin orange torus rings at different angles around the body
const ringAngles = [
  { x: Math.PI / 2, y: 0, z: 0 },
  { x: Math.PI / 4, y: Math.PI / 5, z: 0 },
  { x: -Math.PI / 3, y: 0, z: Math.PI / 4 },
];

ringAngles.forEach((angle) => {
  const ringGeo = new THREE.TorusGeometry(CONFIG.physics.bodyRadius * 1.002, 0.02, 16, 72);
  const ringMesh = new THREE.Mesh(ringGeo, orangeAccentMat);
  ringMesh.rotation.set(angle.x, angle.y, angle.z);
  ringMesh.castShadow = true;
  ringMesh.receiveShadow = true;
  bodyMesh.add(ringMesh);
});

// Flat grey circular panels set slightly into the surface (children of bodyMesh)
const greyPanelMat = new THREE.MeshStandardMaterial({
  color: CONFIG.colors.panelGrey,
  roughness: 0.44,
  metalness: 0.25,
});

const darkHubMat = new THREE.MeshStandardMaterial({
  color: 0x3e4249,
  roughness: 0.38,
  metalness: 0.35,
});

function createPanelMount(phi: number, theta: number, radius = 0.28): THREE.Group {
  const panelGroup = new THREE.Group();

  // Outer flat grey circular disc (CylinderGeometry with equal top/bottom radius)
  const discGeo = new THREE.CylinderGeometry(radius, radius, 0.024, 32);
  const discMesh = new THREE.Mesh(discGeo, greyPanelMat);
  discMesh.rotation.x = Math.PI / 2;
  discMesh.position.z = CONFIG.physics.bodyRadius * 0.994;
  discMesh.castShadow = true;
  discMesh.receiveShadow = true;
  panelGroup.add(discMesh);

  // Concentric orange torus ring detailing
  const innerRingGeo = new THREE.TorusGeometry(radius * 0.65, 0.014, 12, 32);
  const innerRingMesh = new THREE.Mesh(innerRingGeo, orangeAccentMat);
  innerRingMesh.position.z = CONFIG.physics.bodyRadius * 1.003;
  panelGroup.add(innerRingMesh);

  // Inner center hub
  const hubGeo = new THREE.CylinderGeometry(radius * 0.3, radius * 0.3, 0.028, 24);
  const hubMesh = new THREE.Mesh(hubGeo, darkHubMat);
  hubMesh.rotation.x = Math.PI / 2;
  hubMesh.position.z = CONFIG.physics.bodyRadius * 1.004;
  panelGroup.add(hubMesh);

  // Position on sphere via rotation
  panelGroup.rotation.y = theta;
  panelGroup.rotation.x = phi;
  return panelGroup;
}

// Add 6 recessed detail panels around the spherical body
const panelCoordinates = [
  { phi: 0.35, theta: 0.8 },
  { phi: -0.4, theta: 2.1 },
  { phi: 0.65, theta: -1.3 },
  { phi: -0.7, theta: -2.6 },
  { phi: 1.1, theta: 2.7 },
  { phi: -1.0, theta: 0.2 },
];

panelCoordinates.forEach((coord) => {
  const panel = createPanelMount(coord.phi, coord.theta, 0.26);
  bodyMesh.add(panel);
});

// ----------------------------------------------------------------------------
// HEAD: White half-sphere dome, radius 0.45, with orange stripe at base.
// Floats just above the body in its own group, NOT a child of body, so it doesn't roll.
// ----------------------------------------------------------------------------
const headGroup = new THREE.Group();
// Placed just above the top of the body sphere (top is y = 2.0)
headGroup.position.set(0, 1.96, 0);
robotRoot.add(headGroup);

// Pivot group inside headGroup to handle lean & yaw tracking smoothly
const headPivot = new THREE.Group();
headGroup.add(headPivot);

// Head dome: white half-sphere (SphereGeometry with thetaLength = Math.PI / 2)
const headRadius = 0.45;
const domeGeo = new THREE.SphereGeometry(headRadius, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
const domeMat = new THREE.MeshPhysicalMaterial({
  color: CONFIG.colors.body,
  roughness: 0.25,
  metalness: 0.04,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
});
const domeMesh = new THREE.Mesh(domeGeo, domeMat);
domeMesh.castShadow = true;
domeMesh.receiveShadow = true;
headPivot.add(domeMesh);
clickableMeshes.push(domeMesh);

// Flat base seal disc under the dome
const baseDiscGeo = new THREE.CylinderGeometry(headRadius * 0.99, headRadius * 0.99, 0.02, 48);
const baseDiscMesh = new THREE.Mesh(baseDiscGeo, greyPanelMat);
baseDiscMesh.position.y = 0.005;
baseDiscMesh.castShadow = true;
headPivot.add(baseDiscMesh);

// Orange stripe at the base of the dome (CylinderGeometry)
const stripeGeo = new THREE.CylinderGeometry(headRadius * 1.008, headRadius * 1.008, 0.045, 48);
const stripeMesh = new THREE.Mesh(stripeGeo, orangeAccentMat);
stripeMesh.position.y = 0.028;
stripeMesh.castShadow = true;
headPivot.add(stripeMesh);

// Thin grey trim ring directly above orange stripe
const trimRingGeo = new THREE.TorusGeometry(headRadius * 0.995, 0.012, 12, 48);
const trimRingMesh = new THREE.Mesh(trimRingGeo, greyPanelMat);
trimRingMesh.rotation.x = Math.PI / 2;
trimRingMesh.position.y = 0.052;
headPivot.add(trimRingMesh);

// ----------------------------------------------------------------------------
// EYE: Round dark glass eye on the front of the head with glowing blue-white ring
// ----------------------------------------------------------------------------
const eyeContainer = new THREE.Group();
// Position eye on front of dome (+Z, elevated ~23 degrees)
const eyeAngleElevation = 0.42; // radians
const eyeDist = headRadius * 0.96;
eyeContainer.position.set(0, Math.sin(eyeAngleElevation) * eyeDist, Math.cos(eyeAngleElevation) * eyeDist);
eyeContainer.rotation.x = -eyeAngleElevation;
headPivot.add(eyeContainer);

// Dark glass spherical lens
const eyeGlassGeo = new THREE.SphereGeometry(0.115, 32, 24);
const eyeGlassMat = new THREE.MeshPhysicalMaterial({
  color: CONFIG.colors.eyeGlass,
  roughness: 0.08,
  metalness: 0.9,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
});
const eyeGlassMesh = new THREE.Mesh(eyeGlassGeo, eyeGlassMat);
eyeGlassMesh.scale.set(1, 1, 0.5);
eyeGlassMesh.castShadow = true;
eyeContainer.add(eyeGlassMesh);
clickableMeshes.push(eyeGlassMesh);

// Glowing blue-white emissive ring surrounding the dark glass eye
const eyeRingGeo = new THREE.TorusGeometry(0.125, 0.016, 16, 36);
const eyeRingMat = new THREE.MeshStandardMaterial({
  color: CONFIG.colors.eyeRingEmissive,
  emissive: CONFIG.colors.eyeRingEmissive,
  emissiveIntensity: CONFIG.animation.eyeGlowIntensityNormal,
  roughness: 0.2,
  metalness: 0.1,
});
const eyeRingMesh = new THREE.Mesh(eyeRingGeo, eyeRingMat);
eyeContainer.add(eyeRingMesh);

// Secondary small lower sensor optic (BB-8 style character detail)
const subOpticGroup = new THREE.Group();
subOpticGroup.position.set(0.16, 0.09, 0.40);
subOpticGroup.rotation.set(-0.25, 0.35, 0);
headPivot.add(subOpticGroup);

const subOpticGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.025, 24);
const subOpticMat = new THREE.MeshPhysicalMaterial({
  color: 0x141820,
  roughness: 0.1,
  metalness: 0.85,
  clearcoat: 1.0,
});
const subOpticMesh = new THREE.Mesh(subOpticGeo, subOpticMat);
subOpticMesh.rotation.x = Math.PI / 2;
subOpticGroup.add(subOpticMesh);

const subOpticBezelGeo = new THREE.TorusGeometry(0.044, 0.008, 12, 24);
const subOpticBezelMesh = new THREE.Mesh(subOpticBezelGeo, orangeAccentMat);
subOpticGroup.add(subOpticBezelMesh);

// ----------------------------------------------------------------------------
// ANTENNA: Thin grey antenna on the head with a small orange sphere at tip
// ----------------------------------------------------------------------------
const antennaGroup = new THREE.Group();
antennaGroup.position.set(-0.12, 0.38, -0.06);
antennaGroup.rotation.x = -0.06;
antennaGroup.rotation.z = 0.04;
headPivot.add(antennaGroup);

// Antenna stem: CylinderGeometry
const antennaStemGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.34, 16);
const antennaStemMat = new THREE.MeshStandardMaterial({
  color: CONFIG.colors.panelGrey,
  metalness: 0.65,
  roughness: 0.35,
});
const antennaStemMesh = new THREE.Mesh(antennaStemGeo, antennaStemMat);
antennaStemMesh.position.y = 0.17;
antennaStemMesh.castShadow = true;
antennaGroup.add(antennaStemMesh);
clickableMeshes.push(antennaStemMesh);

// Small orange sphere at tip: SphereGeometry
const antennaTipGeo = new THREE.SphereGeometry(0.032, 24, 16);
const antennaTipMesh = new THREE.Mesh(antennaTipGeo, orangeAccentMat);
antennaTipMesh.position.y = 0.34;
antennaTipMesh.castShadow = true;
antennaGroup.add(antennaTipMesh);

// Secondary smaller short stub antenna
const subAntennaGeo = new THREE.CylinderGeometry(0.006, 0.008, 0.14, 16);
const subAntennaMesh = new THREE.Mesh(subAntennaGeo, antennaStemMat);
subAntennaMesh.position.set(-0.17, 0.44, -0.04);
subAntennaMesh.castShadow = true;
headPivot.add(subAntennaMesh);

// ============================================================================
// MOTION, PHYSICS & INTERACTION STATE
// ============================================================================

// Target floor coordinate in world space
const targetPosition = new THREE.Vector2(0, 0);
let currentVelocity = new THREE.Vector2(0, 0);

// Head rotation state
let headYaw = 0;
let headTiltX = 0;
let headTiltZ = 0;

// Jump animation state
let isJumping = false;
let jumpStartTime = 0;

// Idle animation & pointer tracking
let lastPointerMoveTime = performance.now();
let isPointerIdle = false;

// Accessibility: prefers-reduced-motion check
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let prefersReducedMotion = motionQuery.matches;
motionQuery.addEventListener('change', (e) => {
  prefersReducedMotion = e.matches;
});

// Tab visibility
let isTabActive = !document.hidden;
document.addEventListener('visibilitychange', () => {
  isTabActive = !document.hidden;
});

// UI indicator element
const idleStatusEl = document.getElementById('idle-status');

// Raycaster for mouse-to-floor and click hit testing
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(0, 0);
const floorIntersectPoint = new THREE.Vector3();

// Track pointer interaction
let pointerDownPos = new THREE.Vector2();
let pointerDownTime = 0;
let isPointerDown = false;

// ============================================================================
// JUMP TRIGGER & ANIMATION
// ============================================================================
function triggerJump(): void {
  // Ignore extra clicks while jump is already executing
  if (isJumping) return;

  isJumping = true;
  jumpStartTime = performance.now();
}

function updateJumpAnimation(now: number): void {
  if (!isJumping) return;

  const elapsed = (now - jumpStartTime) / 1000;
  const totalDuration = CONFIG.animation.jumpDuration;
  const progress = elapsed / totalDuration;

  if (progress >= 1.0) {
    // Jump complete: settle back to clean resting state
    isJumping = false;
    robotRoot.position.y = 0;
    robotRoot.rotation.y = 0;
    robotRoot.scale.set(1, 1, 1);
    eyeRingMat.emissiveIntensity = CONFIG.animation.eyeGlowIntensityNormal;
    contactShadowMesh.scale.set(1, 1, 1);
    contactShadowMat.opacity = 0.24;
    return;
  }

  const apexHeight = prefersReducedMotion
    ? CONFIG.animation.reducedJumpHeight
    : CONFIG.animation.jumpHeight;

  // Jump timeline:
  // 1. Squash anticipation (0.0 -> 0.15)
  // 2. Upward flight & spin (0.15 -> 0.55)
  // 3. Downward flight (0.55 -> 0.85)
  // 4. Landing impact & elastic recovery (0.85 -> 1.0)

  if (progress < 0.15) {
    // Phase 1: Pre-jump anticipation squash
    const p = progress / 0.15;
    const squash = Math.sin(p * Math.PI * 0.5);
    const scaleY = 1.0 - (1.0 - CONFIG.animation.squashFactor) * squash;
    const scaleXZ = 1.0 + (1.0 - CONFIG.animation.squashFactor) * squash * 0.5;

    robotRoot.scale.set(scaleXZ, scaleY, scaleXZ);
    robotRoot.position.y = -(1.0 - scaleY) * 0.45; // keep bottom grounded during squash
    robotRoot.rotation.y = 0;

    // Flash eye ring
    eyeRingMat.emissiveIntensity =
      CONFIG.animation.eyeGlowIntensityNormal +
      squash * (CONFIG.animation.eyeGlowIntensityJump - CONFIG.animation.eyeGlowIntensityNormal);

    contactShadowMesh.scale.set(scaleXZ, 1, scaleXZ);
    contactShadowMat.opacity = 0.24 + squash * 0.08;
  } else if (progress < 0.85) {
    // Phase 2 & 3: Airborne leap, full 360 spin, stretch
    const p = (progress - 0.15) / 0.70; // 0 to 1
    const arc = Math.sin(p * Math.PI); // Parabolic rise & fall

    robotRoot.position.y = apexHeight * arc;

    // Full 360-degree spin around Y axis during the jump
    if (!prefersReducedMotion) {
      robotRoot.rotation.y = p * Math.PI * 2;
    }

    // Stretch during vertical takeoff and flight
    const stretchAmount = arc;
    const scaleY = 1.0 + (CONFIG.animation.stretchFactor - 1.0) * stretchAmount;
    const scaleXZ = 1.0 - (CONFIG.animation.stretchFactor - 1.0) * stretchAmount * 0.4;
    robotRoot.scale.set(scaleXZ, scaleY, scaleXZ);

    // Eye glow flash decay
    eyeRingMat.emissiveIntensity =
      CONFIG.animation.eyeGlowIntensityNormal +
      (1.0 - p) * (CONFIG.animation.eyeGlowIntensityJump - CONFIG.animation.eyeGlowIntensityNormal) * 0.8;

    // Floor shadow shrinks and softens while robot is up in the air
    const heightFactor = robotRoot.position.y / apexHeight;
    const shadowScale = Math.max(0.48, 1.0 - heightFactor * 0.52);
    contactShadowMesh.scale.set(shadowScale, 1, shadowScale);
    contactShadowMat.opacity = Math.max(0.08, 0.24 * (1.0 - heightFactor * 0.55));
  } else {
    // Phase 4: Touchdown impact squash & elastic rebound
    const p = (progress - 0.85) / 0.15; // 0 to 1
    robotRoot.position.y = 0;
    robotRoot.rotation.y = prefersReducedMotion ? 0 : Math.PI * 2;

    // Elastic settle bounce
    const settle = Math.sin(p * Math.PI) * Math.exp(-p * 3.5);
    const scaleY = 1.0 - 0.22 * settle;
    const scaleXZ = 1.0 + 0.12 * settle;
    robotRoot.scale.set(scaleXZ, scaleY, scaleXZ);

    eyeRingMat.emissiveIntensity = CONFIG.animation.eyeGlowIntensityNormal;
    contactShadowMesh.scale.set(1, 1, 1);
    contactShadowMat.opacity = 0.24;
  }
}

// ============================================================================
// POINTER & TOUCH EVENT LISTENERS
// ============================================================================

function updateTargetFromPointer(clientX: number, clientY: number): void {
  lastPointerMoveTime = performance.now();

  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointerNDC, camera);

  // Intersect with ground plane y = 0
  if (raycaster.ray.intersectPlane(raycastFloorPlane, floorIntersectPoint)) {
    // Keep target comfortably within stage framing
    targetPosition.x = THREE.MathUtils.clamp(floorIntersectPoint.x, -5.5, 5.5);
    targetPosition.y = THREE.MathUtils.clamp(floorIntersectPoint.z, -3.8, 3.8);
  }
}

// Check if a click or tap was directly on the robot
function checkRobotHit(clientX: number, clientY: number): boolean {
  const ndc = new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);

  // Test against clickable robot meshes (body, dome, eye, antenna)
  const intersects = raycaster.intersectObjects(clickableMeshes, true);
  if (intersects.length > 0) {
    return true;
  }

  // Also test proximity to robot center for easy mobile tap ergonomics
  const robotCenter = new THREE.Vector3(robotRoot.position.x, 1.2, robotRoot.position.z);
  const distToCenter = raycaster.ray.distanceToPoint(robotCenter);
  return distToCenter < 1.35;
}

// Pointer movement
window.addEventListener(
  'pointermove',
  (e) => {
    updateTargetFromPointer(e.clientX, e.clientY);
  },
  { passive: true }
);

// Pointer down (mouse click or touch start)
window.addEventListener('pointerdown', (e) => {
  isPointerDown = true;
  pointerDownPos.set(e.clientX, e.clientY);
  pointerDownTime = performance.now();
  updateTargetFromPointer(e.clientX, e.clientY);

  if (checkRobotHit(e.clientX, e.clientY)) {
    triggerJump();
  }
});

window.addEventListener('pointerup', (e) => {
  isPointerDown = false;
  const dist = pointerDownPos.distanceTo(new THREE.Vector2(e.clientX, e.clientY));
  const time = performance.now() - pointerDownTime;

  // Quick tap on robot triggers jump
  if (dist < 18 && time < 400 && checkRobotHit(e.clientX, e.clientY)) {
    triggerJump();
  }
});

// When cursor leaves the window: robot rolls back to center
function onPointerLeave(): void {
  targetPosition.set(0, 0);
  lastPointerMoveTime = performance.now();
}

window.addEventListener('mouseout', (e) => {
  // If leaving the window/document completely
  if (!e.relatedTarget) {
    onPointerLeave();
  }
});

document.addEventListener('pointerleave', () => {
  onPointerLeave();
});

// Handle resize
function handleResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

window.addEventListener('resize', handleResize);

// ============================================================================
// MAIN LOOP & PHYSICS SIMULATION
// ============================================================================
let lastFrameTime = performance.now();

// Scratch vectors for math
const moveDirection = new THREE.Vector3();
const rollAxis = new THREE.Vector3();
const deltaQuat = new THREE.Quaternion();
const upVector = new THREE.Vector3(0, 1, 0);

function animate(): void {
  requestAnimationFrame(animate);

  // Pause rendering and simulation when the tab is hidden
  if (!isTabActive) {
    lastFrameTime = performance.now();
    return;
  }

  const now = performance.now();
  const delta = Math.min((now - lastFrameTime) / 1000, 0.05); // Cap delta to prevent large physics jumps
  lastFrameTime = now;

  // --------------------------------------------------------------------------
  // 1. POINTER IDLE STATE DETECTION
  // --------------------------------------------------------------------------
  const idleElapsed = (now - lastPointerMoveTime) / 1000;
  const wasIdle = isPointerIdle;
  isPointerIdle = idleElapsed >= CONFIG.animation.idleDelay && !isJumping;

  if (idleStatusEl) {
    if (isPointerIdle !== wasIdle) {
      if (isPointerIdle) {
        idleStatusEl.classList.remove('hidden');
        requestAnimationFrame(() => idleStatusEl.classList.remove('opacity-0'));
      } else {
        idleStatusEl.classList.add('opacity-0');
        setTimeout(() => {
          if (!isPointerIdle) idleStatusEl.classList.add('hidden');
        }, 300);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. PHYSICS: ACCELERATION, DAMPING, OVERSHOOT & ROLLING
  // --------------------------------------------------------------------------
  const robotPosX = robotRoot.position.x;
  const robotPosZ = robotRoot.position.z;

  const dx = targetPosition.x - robotPosX;
  const dz = targetPosition.y - robotPosZ;
  const distToTarget = Math.hypot(dx, dz);

  // Acceleration & damping logic
  if (distToTarget > CONFIG.physics.stopDistance) {
    // Steer & accelerate toward target
    const dirX = dx / distToTarget;
    const dirZ = dz / distToTarget;

    currentVelocity.x += dirX * CONFIG.physics.acceleration * delta;
    currentVelocity.y += dirZ * CONFIG.physics.acceleration * delta;

    // Cap maximum speed
    const currentSpeed = currentVelocity.length();
    if (currentSpeed > CONFIG.physics.maxSpeed) {
      currentVelocity.multiplyScalar(CONFIG.physics.maxSpeed / currentSpeed);
    }
  } else {
    // Closer than 0.2 units: damp smoothly to a stop (allows natural slight overshoot)
    const settleDamp = Math.pow(0.78, delta * 60);
    currentVelocity.multiplyScalar(settleDamp);

    if (currentVelocity.length() < 0.05) {
      currentVelocity.set(0, 0);
    }
  }

  // Standard damping factor applied every frame
  const frameDamping = Math.pow(CONFIG.physics.damping, delta * 60);
  currentVelocity.multiplyScalar(frameDamping);

  // Compute displacement for this frame
  const moveX = currentVelocity.x * delta;
  const moveZ = currentVelocity.y * delta;
  const moveDist = Math.hypot(moveX, moveZ);

  // Apply horizontal movement to robot root position
  robotRoot.position.x += moveX;
  robotRoot.position.z += moveZ;

  // Move contact shadow along with robot
  contactShadowMesh.position.x = robotRoot.position.x;
  contactShadowMesh.position.z = robotRoot.position.z;

  // --------------------------------------------------------------------------
  // 3. PHYSICALLY CORRECT ROLLING (Body rotates around perpendicular axis)
  // Distance moved / radius, quaternion representation
  // --------------------------------------------------------------------------
  if (moveDist > 0.00001) {
    moveDirection.set(moveX / moveDist, 0, moveZ / moveDist);

    // Roll axis = up x moveDirection = (moveDirection.z, 0, -moveDirection.x)
    rollAxis.crossVectors(upVector, moveDirection).normalize();

    // Roll angle = distance / radius
    const rollAngle = moveDist / CONFIG.physics.bodyRadius;

    // Apply rotation to bodyMesh quaternion in world space
    deltaQuat.setFromAxisAngle(rollAxis, rollAngle);
    bodyMesh.quaternion.premultiply(deltaQuat);
  }

  // --------------------------------------------------------------------------
  // 4. HEAD BEHAVIOUR (Leans in travel direction, turns smoothly to look at target)
  // Head is NOT a child of bodyMesh, so it stays upright and doesn't roll
  // --------------------------------------------------------------------------
  const currentSpeed = currentVelocity.length();

  // Head lean in direction of travel (forward pitch + lateral roll)
  let targetTiltX = 0;
  let targetTiltZ = 0;

  if (currentSpeed > 0.05) {
    const tiltRatio = Math.min(1.0, currentSpeed / CONFIG.physics.maxSpeed);
    const tiltAngle = tiltRatio * CONFIG.physics.maxTiltAngle;

    // Pitch along velocity vector
    targetTiltX = (currentVelocity.y / currentSpeed) * tiltAngle;
    targetTiltZ = (-currentVelocity.x / currentSpeed) * tiltAngle;
  }

  // Smoothly interpolate head lean
  const leanLerp = Math.min(1.0, CONFIG.physics.headLeanSpeed * delta);
  headTiltX += (targetTiltX - headTiltX) * leanLerp;
  headTiltZ += (targetTiltZ - headTiltZ) * leanLerp;

  // Head yaw: turn smoothly to face the pointer target position
  let targetYaw = headYaw;
  if (distToTarget > 0.08) {
    targetYaw = Math.atan2(dx, dz);
  }

  // Shortest angular difference interpolation for yaw
  let yawDiff = targetYaw - headYaw;
  while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
  while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
  headYaw += yawDiff * Math.min(1.0, CONFIG.physics.headTurnSpeed * delta);

  // --------------------------------------------------------------------------
  // 5. IDLE ANIMATION (small head wobble, slow pulse of eye glow)
  // Skipped when prefers-reduced-motion is active
  // --------------------------------------------------------------------------
  let idleWobbleX = 0;
  let idleWobbleY = 0;
  let idleWobbleZ = 0;

  if (isPointerIdle && !isJumping && !prefersReducedMotion) {
    const idleT = idleElapsed;
    idleWobbleX = Math.sin(idleT * 2.4) * 0.07;
    idleWobbleY = Math.sin(idleT * 1.5) * 0.09;
    idleWobbleZ = Math.cos(idleT * 1.8) * 0.05;

    // Slow pulse of eye glow
    const pulse = Math.sin(idleT * 3.0) * CONFIG.animation.eyeGlowIntensityIdlePulse;
    eyeRingMat.emissiveIntensity = Math.max(
      0.8,
      CONFIG.animation.eyeGlowIntensityNormal + pulse
    );
  } else if (!isJumping) {
    // Normal steady eye glow
    eyeRingMat.emissiveIntensity = CONFIG.animation.eyeGlowIntensityNormal;
  }

  // Apply rotation to headPivot
  headPivot.rotation.y = headYaw + idleWobbleY;
  headPivot.rotation.x = headTiltX + idleWobbleX;
  headPivot.rotation.z = headTiltZ + idleWobbleZ;

  // --------------------------------------------------------------------------
  // 6. JUMP ANIMATION UPDATE
  // --------------------------------------------------------------------------
  updateJumpAnimation(now);

  // Render scene
  renderer.render(scene, camera);
}

// Start rendering loop
animate();

// Remove loading screen after initial render
dismissLoadingScreen();
