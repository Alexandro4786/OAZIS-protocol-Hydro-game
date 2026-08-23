import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from '../config.js';

export class SceneManager {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#101826');
    this.scene.fog = new THREE.FogExp2('#101826', 0.015);

    // 2. Camera (Isometric Orthographic-like perspective)
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
    this.cameraTarget = new THREE.Vector3(
      (GRID_SIZE * TILE_SIZE) / 2,
      0,
      (GRID_SIZE * TILE_SIZE) / 2
    );
    this.cameraDistance = 38;
    this.cameraAngle = Math.PI / 4; // 45 deg
    this.cameraPitch = Math.PI / 3.2; // ~55 deg
    this.updateCameraPosition();

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    this.initLights();

    // 4.1. Volumetric 3D Drifting Clouds (Bulutlar)
    this.cloudsGroup = new THREE.Group();
    this.scene.add(this.cloudsGroup);
    this.initClouds();

    // Lightning Flash holati
    this.nextLightningTime = 5;
    this.isLightning = false;
    this.lightningTimer = 0;

    // 5. Interaction / Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.hoveredTile = null;
    this.selectedTile = null;

    // Hover Highlight Mesh
    const hoverGeo = new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.1, TILE_SIZE * 0.98);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    this.hoverMesh = new THREE.Mesh(hoverGeo, hoverMat);
    this.hoverMesh.visible = false;
    this.scene.add(this.hoverMesh);

    // Selected Highlight Mesh
    const selectGeo = new THREE.BoxGeometry(TILE_SIZE * 1.02, 0.2, TILE_SIZE * 1.02);
    const selectMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      wireframe: true,
      transparent: true,
      opacity: 1.0
    });
    this.selectMesh = new THREE.Mesh(selectGeo, selectMat);
    this.selectMesh.visible = false;
    this.scene.add(this.selectMesh);

    // Ground Plane for exact 1:1 Map Dragging (Google Maps / Yandex Maps style)
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.isPanningMap = false;
    this.isOrbiting = false;
    this.hasMovedMap = false;
    this.panStartGroundPoint = new THREE.Vector3();
    this.dragStartPixel = { x: 0, y: 0 };

    // Controls setup
    this.setupControls();

    // Resize listener
    window.addEventListener('resize', () => this.onResize());
  }

  initLights() {
    this.ambientLight = new THREE.AmbientLight(0xd4e4ff, 0.7);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    this.dirLight.position.set(30, 45, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 150;
    const d = 35;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Hemisphere light for desert warmth
    const hemiLight = new THREE.HemisphereLight(0x4fc3f7, 0x8d6e63, 0.4);
    this.scene.add(hemiLight);
  }

  getGroundPoint(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const tempRay = new THREE.Raycaster();
    tempRay.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    
    const hitPoint = new THREE.Vector3();
    const hasHit = tempRay.ray.intersectPlane(this.groundPlane, hitPoint);
    return hasHit ? hitPoint : null;
  }

  updateCameraPosition() {
    const x = this.cameraTarget.x + this.cameraDistance * Math.sin(this.cameraAngle) * Math.cos(this.cameraPitch);
    const y = this.cameraTarget.y + this.cameraDistance * Math.sin(this.cameraPitch);
    const z = this.cameraTarget.z + this.cameraDistance * Math.cos(this.cameraAngle) * Math.cos(this.cameraPitch);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  setupControls() {
    let prevMouse = { x: 0, y: 0 };
    let initialTouchDist = null;

    this.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    // MOUSE DOWN
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      prevMouse = { x: e.clientX, y: e.clientY };
      this.dragStartPixel = { x: e.clientX, y: e.clientY };
      this.hasMovedMap = false;

      if (e.button === 0) { // Chap tugma (Google Maps kabi surish)
        this.isPanningMap = true;
        const ground = this.getGroundPoint(e.clientX, e.clientY);
        if (ground) {
          this.panStartGroundPoint.copy(ground);
        }
      } else if (e.button === 2 || e.button === 1) { // O'ng yoki g'ildirak (Kamerani burish)
        this.isOrbiting = true;
      }
    });

    // MOUSE MOVE
    window.addEventListener('mousemove', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // 1. Google Maps / Yandex Maps uslubidagi tekis surish (1:1 Ground Pan)
      if (this.isPanningMap) {
        const moveDist = Math.hypot(e.clientX - this.dragStartPixel.x, e.clientY - this.dragStartPixel.y);
        if (moveDist > 4) {
          this.hasMovedMap = true;
          this.container.classList.add('grabbing');
        }

        if (this.hasMovedMap) {
          const currentGround = this.getGroundPoint(e.clientX, e.clientY);
          if (currentGround) {
            const delta = this.panStartGroundPoint.clone().sub(currentGround);
            this.cameraTarget.add(delta);

            // Xarita chegaralaridan chiqib ketmasligi uchun chegara
            const maxBound = GRID_SIZE * TILE_SIZE + 12;
            this.cameraTarget.x = Math.max(-12, Math.min(maxBound, this.cameraTarget.x));
            this.cameraTarget.z = Math.max(-12, Math.min(maxBound, this.cameraTarget.z));

            this.updateCameraPosition();

            // Qayta hisoblash (1:1 bog'lanish uchun)
            const newGround = this.getGroundPoint(e.clientX, e.clientY);
            if (newGround) {
              this.panStartGroundPoint.copy(newGround);
            }
          }
        }
      }

      // 2. Kamerani burish (Orbit rotate)
      if (this.isOrbiting) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        this.cameraAngle -= dx * 0.008;
        this.cameraPitch = Math.max(0.2, Math.min(Math.PI / 2.1, this.cameraPitch + dy * 0.008));
        this.updateCameraPosition();
        prevMouse = { x: e.clientX, y: e.clientY };
      }
    });

    // MOUSE UP
    window.addEventListener('mouseup', () => {
      this.isPanningMap = false;
      this.isOrbiting = false;
      this.container.classList.remove('grabbing');
    });

    // WHEEL (Zoom)
    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance = Math.max(12, Math.min(75, this.cameraDistance + e.deltaY * 0.04));
      this.updateCameraPosition();
    }, { passive: false });

    // TOUCH EVENTS (Sensor ekranlar va planshetlar uchun)
    this.renderer.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        this.dragStartPixel = { x: t.clientX, y: t.clientY };
        this.hasMovedMap = false;
        this.isPanningMap = true;
        const ground = this.getGroundPoint(t.clientX, t.clientY);
        if (ground) this.panStartGroundPoint.copy(ground);
      } else if (e.touches.length === 2) {
        this.isPanningMap = false;
        initialTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    this.renderer.domElement.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isPanningMap) {
        const t = e.touches[0];
        const moveDist = Math.hypot(t.clientX - this.dragStartPixel.x, t.clientY - this.dragStartPixel.y);
        if (moveDist > 6) {
          this.hasMovedMap = true;
        }
        if (this.hasMovedMap) {
          const currentGround = this.getGroundPoint(t.clientX, t.clientY);
          if (currentGround) {
            const delta = this.panStartGroundPoint.clone().sub(currentGround);
            this.cameraTarget.add(delta);
            this.updateCameraPosition();
            const newGround = this.getGroundPoint(t.clientX, t.clientY);
            if (newGround) this.panStartGroundPoint.copy(newGround);
          }
        }
      } else if (e.touches.length === 2 && initialTouchDist) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = initialTouchDist - currentDist;
        this.cameraDistance = Math.max(12, Math.min(75, this.cameraDistance + diff * 0.08));
        this.updateCameraPosition();
        initialTouchDist = currentDist;
      }
    }, { passive: false });

    this.renderer.domElement.addEventListener('touchend', () => {
      this.isPanningMap = false;
      initialTouchDist = null;
    });

    // Keyboard Pan
    window.addEventListener('keydown', (e) => {
      const panSpeed = 1.0;
      const forward = new THREE.Vector3().subVectors(this.cameraTarget, this.camera.position).setY(0).normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      if (e.key === 'w' || e.key === 'ArrowUp') this.cameraTarget.addScaledVector(forward, panSpeed);
      if (e.key === 's' || e.key === 'ArrowDown') this.cameraTarget.addScaledVector(forward, -panSpeed);
      if (e.key === 'a' || e.key === 'ArrowLeft') this.cameraTarget.addScaledVector(right, -panSpeed);
      if (e.key === 'd' || e.key === 'ArrowRight') this.cameraTarget.addScaledVector(right, panSpeed);
      if (e.key === 'q') this.cameraAngle += 0.15;
      if (e.key === 'e') this.cameraAngle -= 0.15;
      this.updateCameraPosition();
    });
  }

  setHoveredTile(coords) {
    if (coords) {
      this.hoverMesh.position.set(coords.x * TILE_SIZE + TILE_SIZE / 2, 0.1, coords.y * TILE_SIZE + TILE_SIZE / 2);
      this.hoverMesh.visible = true;
    } else {
      this.hoverMesh.visible = false;
    }
  }

  setSelectedTile(coords) {
    if (coords) {
      this.selectMesh.position.set(coords.x * TILE_SIZE + TILE_SIZE / 2, 0.15, coords.y * TILE_SIZE + TILE_SIZE / 2);
      this.selectMesh.visible = true;
    } else {
      this.selectMesh.visible = false;
    }
  }

  initClouds() {
    this.clouds = [];
    const mapSize = GRID_SIZE * TILE_SIZE;
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true,
      transparent: true,
      opacity: 0.85
    });

    for (let i = 0; i < 10; i++) {
      const cloudGroup = new THREE.Group();
      const puffsCount = 4 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffsCount; p++) {
        const radius = 1.4 + Math.random() * 1.2;
        const puffGeo = new THREE.DodecahedronGeometry(radius, 1);
        const puffMesh = new THREE.Mesh(puffGeo, cloudMat);
        puffMesh.position.set(
          (p - puffsCount / 2) * 1.5 + (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 1.2
        );
        puffMesh.castShadow = true;
        cloudGroup.add(puffMesh);
      }

      cloudGroup.position.set(
        Math.random() * mapSize * 1.6 - mapSize * 0.3,
        18 + Math.random() * 6,
        Math.random() * mapSize * 1.6 - mapSize * 0.3
      );
      cloudGroup.userData = {
        speed: 1.2 + Math.random() * 1.0,
        driftY: cloudGroup.position.y
      };

      this.cloudsGroup.add(cloudGroup);
      this.clouds.push(cloudGroup);
    }
  }

  updateLighting(timeOfDay, crisis, weather = {}, dt = 0.016, audioManager = null) {
    const mapSize = GRID_SIZE * TILE_SIZE;
    const hour = timeOfDay % 24;
    const sunAngle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    
    const sunX = Math.cos(sunAngle) * 45 + mapSize / 2;
    const sunY = Math.max(2, Math.sin(sunAngle) * 50);
    const sunZ = Math.sin(sunAngle) * 35 + mapSize / 2;
    this.dirLight.position.set(sunX, sunY, sunZ);

    // 1. Bulutlar harakati (Drifting Volumetric Clouds)
    const cloudCover = weather.cloudCover !== undefined ? weather.cloudCover : 0.2;
    const windSpeed = weather.windSpeed || 5;
    this.cloudsGroup.visible = cloudCover > 0.05;

    if (this.cloudsGroup.visible) {
      this.clouds.forEach((cloud, idx) => {
        cloud.position.x += windSpeed * 0.15 * cloud.userData.speed * dt;
        cloud.position.y = cloud.userData.driftY + Math.sin(Date.now() * 0.001 + idx) * 0.2;
        if (cloud.position.x > mapSize * 1.4) {
          cloud.position.x = -mapSize * 0.4;
          cloud.position.z = Math.random() * mapSize * 1.4 - mapSize * 0.2;
        }
        const scale = Math.min(1.4, 0.4 + cloudCover * 1.0);
        cloud.scale.set(scale, scale, scale);
      });
    }

    // 2. Chaqmoq va Momaqaldiroq (Storm Lightning)
    if (weather.id === 'storm_flood') {
      this.nextLightningTime -= dt;
      if (this.nextLightningTime <= 0) {
        this.isLightning = true;
        this.lightningTimer = 0.18;
        this.nextLightningTime = 3.5 + Math.random() * 5.0;
        if (audioManager) audioManager.playThunder();
      }
    }

    if (this.isLightning) {
      this.lightningTimer -= dt;
      this.dirLight.intensity = 3.8;
      this.dirLight.color.set('#e0f7fa');
      this.ambientLight.intensity = 1.2;
      this.scene.background.set('#1a233a');
      if (this.lightningTimer <= 0) {
        this.isLightning = false;
      }
      return;
    }

    // 3. Meteorologik va Kun/Tun Yoritishi
    const isDay = hour >= 6 && hour <= 19;
    let baseSunIntensity = weather.sunIntensity !== undefined ? weather.sunIntensity : 1.3;
    let skyHex = weather.skyColor || '#121e33';
    let dirColorHex = '#fff3e0';
    let ambientHex = '#d4e4ff';

    if (crisis && crisis.id === 'heatwave') {
      skyHex = '#2a1205';
      dirColorHex = '#ff7043';
      ambientHex = '#ffab91';
      baseSunIntensity = 1.6;
    } else if (!isDay) {
      skyHex = '#070b12';
      dirColorHex = '#3949ab';
      ambientHex = '#1a237e';
      baseSunIntensity = 0.15;
    } else if (weather.id === 'rain') {
      skyHex = '#0f172a';
      dirColorHex = '#90caf9';
      ambientHex = '#546e7a';
    } else if (weather.id === 'storm_flood') {
      skyHex = '#080c14';
      dirColorHex = '#5c6bc0';
      ambientHex = '#37474f';
    } else if (weather.id === 'fresh_cloudy') {
      skyHex = '#1a2332';
      dirColorHex = '#b3e5fc';
      ambientHex = '#78909c';
    } else if (weather.id === 'humid_sun') {
      skyHex = '#212d40';
      dirColorHex = '#ffe082';
      ambientHex = '#90a4ae';
    } else if (weather.id === 'windy') {
      skyHex = '#261b14';
      dirColorHex = '#ffe082';
      ambientHex = '#bcaaa4';
    }

    this.scene.background.set(skyHex);
    if (this.scene.fog) {
      this.scene.fog.color.set(skyHex);
      let fogD = 0.015;
      if (weather.id === 'storm_flood') fogD = 0.025;
      else if (weather.id === 'windy' || weather.id === 'humid_sun') fogD = 0.02;
      else if (weather.id === 'fresh_cloudy') fogD = 0.017;
      this.scene.fog.density = fogD;
    }
    this.dirLight.color.set(dirColorHex);
    this.dirLight.intensity = baseSunIntensity;
    this.ambientLight.color.set(ambientHex);
  }

  onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
