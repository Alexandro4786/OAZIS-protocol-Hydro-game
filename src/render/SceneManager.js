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

  updateCameraPosition() {
    const x = this.cameraTarget.x + this.cameraDistance * Math.sin(this.cameraAngle) * Math.cos(this.cameraPitch);
    const y = this.cameraTarget.y + this.cameraDistance * Math.sin(this.cameraPitch);
    const z = this.cameraTarget.z + this.cameraDistance * Math.cos(this.cameraAngle) * Math.cos(this.cameraPitch);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  setupControls() {
    let isDragging = false;
    let isPanning = false;
    let prevMouse = { x: 0, y: 0 };

    this.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 2 || e.button === 1) { // Right or Middle click to rotate
        isDragging = true;
        prevMouse = { x: e.clientX, y: e.clientY };
      } else if (e.button === 0 && e.shiftKey) { // Shift+Left to pan
        isPanning = true;
        prevMouse = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        this.cameraAngle -= dx * 0.008;
        this.cameraPitch = Math.max(0.2, Math.min(Math.PI / 2.1, this.cameraPitch + dy * 0.008));
        this.updateCameraPosition();
        prevMouse = { x: e.clientX, y: e.clientY };
      } else if (isPanning) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        const panSpeed = 0.04;
        const forward = new THREE.Vector3().subVectors(this.cameraTarget, this.camera.position).setY(0).normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        
        this.cameraTarget.addScaledVector(right, -dx * panSpeed);
        this.cameraTarget.addScaledVector(forward, dy * panSpeed);
        this.updateCameraPosition();
        prevMouse = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      isPanning = false;
    });

    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance = Math.max(12, Math.min(75, this.cameraDistance + e.deltaY * 0.04));
      this.updateCameraPosition();
    }, { passive: false });

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

  updateLighting(timeOfDay, crisis) {
    // Kun vaqti (0..24 soat)
    const hour = timeOfDay % 24;
    const sunAngle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    
    const sunX = Math.cos(sunAngle) * 45 + (GRID_SIZE * TILE_SIZE) / 2;
    const sunY = Math.max(2, Math.sin(sunAngle) * 50);
    const sunZ = Math.sin(sunAngle) * 35 + (GRID_SIZE * TILE_SIZE) / 2;
    
    this.dirLight.position.set(sunX, sunY, sunZ);
    
    // Kechqurun yoki kunduzgi ranglar
    if (crisis && crisis.id === 'heatwave') {
      this.scene.background.set('#2a1205');
      this.dirLight.color.set('#ff7043');
      this.ambientLight.color.set('#ffab91');
    } else if (hour >= 6 && hour <= 19) { // Kunduzi
      this.scene.background.set('#121e33');
      this.dirLight.color.set('#fff3e0');
      this.ambientLight.color.set('#d4e4ff');
    } else { // Kechasi
      this.scene.background.set('#070b12');
      this.dirLight.color.set('#3949ab');
      this.ambientLight.color.set('#1a237e');
    }
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
