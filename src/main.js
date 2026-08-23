import * as THREE from 'three';
import { GameState } from './engine/GameState.js';
import { GridWorld } from './engine/GridWorld.js';
import { AudioManager } from './engine/AudioManager.js';
import { ScadaPID } from './engine/ScadaPID.js';
import { CrisisManager } from './engine/CrisisManager.js';
import { SceneManager } from './render/SceneManager.js';
import { TileRenderer } from './render/TileRenderer.js';
import { BuildingRenderer } from './render/BuildingRenderer.js';
import { ParticleSystem } from './render/ParticleSystem.js';
import { Terraformer } from './render/Terraformer.js';
import { TechTreeModal } from './ui/TechTreeModal.js';
import { ScadaModal } from './ui/ScadaModal.js';
import { UIManager } from './ui/UIManager.js';
import { TutorialGuide } from './ui/TutorialGuide.js';
import { CROP_TYPES, IRRIGATION_TECH, BUILDINGS, WEATHER_PRESETS, SEASONS } from './config.js';

class OasisGame {
  constructor() {
    this.canvasContainer = document.getElementById('canvas-container');
    
    // 1. Dvigatel va holatlar
    this.gameState = new GameState();
    this.gridWorld = new GridWorld(this.gameState);
    this.audioManager = new AudioManager();
    this.scadaEngine = new ScadaPID(this.gridWorld, this.gameState);
    this.crisisManager = new CrisisManager(this.gameState, this.gridWorld);

    // 2. 3D Render Tizimlari
    this.sceneManager = new SceneManager(this.canvasContainer);
    this.tileRenderer = new TileRenderer(this.sceneManager.scene, this.gridWorld);
    this.buildingRenderer = new BuildingRenderer(this.sceneManager.scene, this.gridWorld);
    this.particleSystem = new ParticleSystem(this.sceneManager.scene, this.gridWorld);
    this.terraformer = new Terraformer(this.sceneManager.scene);

    // 3. UI Modullari
    this.techTreeModal = new TechTreeModal(this.gameState, this.audioManager);
    this.scadaModal = new ScadaModal(this.scadaEngine, this.gameState, this.audioManager);
    this.uiManager = new UIManager(this.gameState, this.gridWorld, this.audioManager, this.crisisManager);
    this.tutorialGuide = new TutorialGuide(this.audioManager, this.gameState);

    // 4. Meteorologik Ob-havo
    this.weatherPreset = WEATHER_PRESETS.sunny;
    this.weatherTimer = 45;
    this.weather = {
      id: this.weatherPreset.id,
      name: this.weatherPreset.name,
      icon: this.weatherPreset.icon,
      temperature: 28,
      et0: 4.5,
      windSpeed: 3,
      rainRate: 0,
      cloudCover: 0.1,
      moistureGainRate: 0
    };

    this.lastTime = performance.now();
    this.initInteraction();
    this.syncInitialWorld();

    // Qayta boshlash hodisasi
    this.gameState.on('restartGame', () => this.restart());
    this.gameState.on('tileSelected', (tile) => {
      this.sceneManager.setSelectedTile(tile ? { x: tile.x, y: tile.y } : null);
    });

    // Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  restart() {
    this.gameState.reset();
    this.gridWorld.initGrid();
    this.tileRenderer.syncTileReferences();
    this.buildingRenderer.clearAll();
    
    // Telemetriya va inqiroz boshqaruvini yangilash
    this.scadaEngine = new ScadaPID(this.gridWorld, this.gameState);
    this.scadaModal.scadaEngine = this.scadaEngine;
    this.crisisManager = new CrisisManager(this.gameState, this.gridWorld);
    this.uiManager.crisisManager = this.crisisManager;
    
    // Tanlovlarni bekor qilish
    this.sceneManager.setSelectedTile(null);
    this.sceneManager.setHoveredTile(null);
    
    // Ob-havo
    this.weather.temperature = 28;
    this.weather.et0 = 4.5;
    
    // Terraformer va bino vizualini qayta tiklash
    this.terraformer.update(this.gameState.resources.ecoScore);
    this.syncInitialWorld();
    this.uiManager.renderTools();
    this.uiManager.update(this.weather, null);

    // Ochiq modallarni yopish
    document.getElementById('endgame-modal').style.display = 'none';
    document.getElementById('restart-modal').style.display = 'none';

    this.audioManager.playHarvest();
    
    this.gameState.emit('notify', {
      type: 'success',
      message: "O'yin yangitdan boshlandi! Barcha resurslar va maydon tiklandi."
    });
  }

  syncInitialWorld() {
    this.buildingRenderer.sync();
    // Boshlang'ich bildirishnoma
    this.gameState.emit('notify', {
      type: 'info',
      message: "Oasis Protocol ga xush kelibsiz! Boshlash uchun kanalga quvur ulang va ekin eking."
    });
  }

  initInteraction() {
    const domElement = this.sceneManager.renderer.domElement;

    // Birinchi klikda ovozni yoqish
    window.addEventListener('click', () => {
      this.audioManager.init();
    }, { once: true });

    domElement.addEventListener('click', (e) => {
      if (e.button !== 0) return; // Faqat chap klik

      // Agar xarita surilgan bo'lsa (Google Maps drag), klik hisoblanmasin
      if (this.sceneManager.hasMovedMap) {
        return;
      }

      // Raycast orqali bosilgan katakni aniqlash
      this.sceneManager.raycaster.setFromCamera(this.sceneManager.mouse, this.sceneManager.camera);
      const intersects = this.sceneManager.raycaster.intersectObjects(this.tileRenderer.interactiveMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const { gridX, gridY } = hit.userData;
        this.handleTileClick(gridX, gridY);
      }
    });

    // Hover orqali katakni ajratib ko'rsatish
    domElement.addEventListener('mousemove', () => {
      this.sceneManager.raycaster.setFromCamera(this.sceneManager.mouse, this.sceneManager.camera);
      const intersects = this.sceneManager.raycaster.intersectObjects(this.tileRenderer.interactiveMeshes);
      if (intersects.length > 0) {
        const { gridX, gridY } = intersects[0].object.userData;
        this.sceneManager.setHoveredTile({ x: gridX, y: gridY });
      } else {
        this.sceneManager.setHoveredTile(null);
      }
    });
  }

  handleTileClick(x, y) {
    const tile = this.gridWorld.getTile(x, y);
    if (!tile) return;

    this.gameState.selectTile(tile);
    this.sceneManager.setSelectedTile({ x, y });

    const tool = this.gameState.activeTool;

    // 0. Hosil Yetilgan Ekinni 1 Bosishda To'g'ridan-to'g'ri Terib Olish (1-Click Direct Harvest)
    if (tile.crop && tile.crop.stage >= 4 && !tile.crop.isWithered) {
      const cropConfig = CROP_TYPES[tile.crop.type];
      const revenue = this.gridWorld.harvestCrop(x, y);
      if (revenue > 0) {
        this.audioManager.playHarvest();
        this.buildingRenderer.sync();
        this.uiManager.spawnFloatingScore(
          window.innerWidth / 2,
          window.innerHeight / 2,
          `+$${revenue} 💰 +${cropConfig ? cropConfig.ecoValue : 5} Eko ✨`,
          'money'
        );
        this.gameState.emit('notify', {
          type: 'success',
          message: `🌾 ${cropConfig ? cropConfig.name : 'Ekin'} hosili yig'ib olindi! (+$${revenue})`
        });
        return;
      }
    }

    // Qurigan ekinni 1 bosishda tozalash
    if (tile.crop && tile.crop.isWithered && tool === 'survey') {
      this.gridWorld.harvestCrop(x, y);
      this.buildingRenderer.sync();
      this.audioManager.playDemolish();
      this.gameState.emit('notify', { type: 'info', message: "🧹 Qurigan ekin tozalandi" });
      return;
    }

    // Daryo katagiga narsa qurib bo'lmaydi (kanal intake dan tashqari)
    if (tile.type === 'river' && tool !== 'survey' && tool !== 'bld_canal_intake') {
      this.gameState.emit('notify', { type: 'warning', message: "Daryo oqimiga ekin yoki quvur ekib bo'lmaydi!" });
      return;
    }

    // 1. Tahlil
    if (tool === 'survey') {
      this.audioManager.playClick();
      return;
    }

    // 2. Ekin ekish
    if (tool.startsWith('crop_')) {
      const cropKey = tool.replace('crop_', '');
      const cropConfig = CROP_TYPES[cropKey];
      if (cropConfig) {
        if (tile.crop) {
          this.gameState.emit('notify', { type: 'warning', message: "Bu yerda allaqachon ekin mavjud!" });
          return;
        }
        if (this.gameState.spendBudget(cropConfig.seedCost)) {
          tile.crop = {
            type: cropKey,
            stage: 0,
            progress: 0,
            health: 100,
            daysAlive: 0,
            isWithered: false
          };
          if (tile.isConnectedToWater) {
            tile.moisture = Math.max(tile.moisture, 55); // Boshlang'ich urug' sug'orishi
            if (!tile.irrigation) tile.irrigation = 'furrow';
            tile.irrigationActive = true;
          }
          this.gridWorld.updateNetworkConnectivity();
          this.audioManager.playBuild();
          this.buildingRenderer.sync();
          if (tile.isConnectedToWater) {
            this.gameState.emit('notify', {
              type: 'success',
              message: `${cropConfig.name} ekildi va quvur orqali suv berilmoqda! 💧 (-$${cropConfig.seedCost})`
            });
          } else {
            this.gameState.emit('notify', {
              type: 'warning',
              message: `${cropConfig.name} ekildi (-$${cropConfig.seedCost}). ⚠️ Suv ulanmagan! Daryo nasosidan quvur torting.`
            });
          }
        }
      }
      return;
    }

    // 3. Sug'orish tizimi o'rnatish
    if (tool.startsWith('irr_')) {
      const irrKey = tool.replace('irr_', '');
      const techConfig = IRRIGATION_TECH[irrKey];
      if (techConfig) {
        if (!this.gameState.isTechUnlocked(irrKey)) {
          this.gameState.emit('notify', { type: 'warning', message: "Ushbu texnologiya hali ochilmagan! Tech Tree dan oching." });
          return;
        }
        if (this.gameState.spendBudget(techConfig.cost)) {
          tile.irrigation = irrKey;
          tile.irrigationActive = true;
          this.gridWorld.updateNetworkConnectivity();
          this.audioManager.playBuild();
          this.buildingRenderer.sync();
          this.gameState.emit('notify', { type: 'success', message: `${techConfig.shortName} o'rnatildi (-$${techConfig.cost})` });
        }
      }
      return;
    }

    // 4. Infratuzilma qurish
    if (tool.startsWith('bld_')) {
      const bldKey = tool.replace('bld_', '');
      if (bldKey === 'pipe') {
        const cost = BUILDINGS.pipe.cost;
        if (this.gameState.spendBudget(cost)) {
          tile.hasPipe = true;
          this.gridWorld.updateNetworkConnectivity();
          this.audioManager.playBuild();
          this.buildingRenderer.sync();
          this.gameState.emit('notify', { type: 'success', message: "Gidravlik quvur yotqizildi (-$15)" });
        }
      } else {
        const bldConfig = BUILDINGS[bldKey];
        if (bldConfig) {
          if (tile.building) {
            this.gameState.emit('notify', { type: 'warning', message: "Bu katakda boshqa inshoot bor!" });
            return;
          }
          if (bldKey === 'canal_intake') {
            const isRiverOrBank = tile.type === 'river' || this.gridWorld.getNeighbors(tile.x, tile.y).some(n => n.type === 'river');
            if (!isRiverOrBank) {
              this.gameState.emit('notify', { type: 'warning', message: "⚠️ Kanal nasosi faqat daryo ustiga yoki daryo qirg'og'iga o'rnatiladi!" });
              return;
            }
          }
          if ((bldKey === 'well' || bldKey === 'windmill_pump' || bldKey === 'deep_well') && tile.type === 'river') {
            this.gameState.emit('notify', { type: 'warning', message: "Quduq va nasoslar daryo ichiga emas, quruqlik/cho'lga o'rnatiladi!" });
            return;
          }
          if (this.gameState.spendBudget(bldConfig.cost)) {
            tile.building = bldKey;
            tile.hasPipe = true; // Inshootlar avtomatik quvur vazifasini ham o'taydi
            this.gridWorld.updateNetworkConnectivity();
            this.audioManager.playBuild();
            this.buildingRenderer.sync();
            this.gameState.emit('notify', { type: 'success', message: `${bldConfig.name} qurildi (-$${bldConfig.cost})! 🕳️💧` });
          }
        }
      }
      return;
    }

    // 5. Ko'chirish (Green Farm 3 Move Mode)
    if (tool === 'move_mode') {
      const src = this.gameState.moveSourceTile;
      if (!src) {
        this.gameState.setTool('survey');
        return;
      }
      const res = this.gridWorld.moveTileContent(src.x, src.y, x, y);
      if (res.success) {
        this.audioManager.playBuild();
        this.buildingRenderer.sync();
        this.gameState.emit('notify', { type: 'success', message: res.message });
        this.gameState.moveSourceTile = null;
        this.gameState.setTool('survey');
      } else {
        this.gameState.emit('notify', { type: 'warning', message: res.message });
      }
      return;
    }

    // 6. Buzish / Sotish (60% Refund)
    if (tool === 'demolish') {
      const refund = this.gridWorld.demolishTile(x, y);
      if (refund > 0) {
        this.audioManager.playBuild();
        this.buildingRenderer.sync();
        this.gameState.emit('notify', { type: 'success', message: `Buzildi: +$${refund} qaytarildi (60% kompensatsiya)!` });
        this.uiManager.spawnFloatingScore(window.innerWidth / 2, window.innerHeight / 2, `+$${refund} 💰`, 'refund');
      } else {
        this.audioManager.playClick();
      }
    }
  }

  updateSimulation(dt) {
    if (this.gameState.isPaused) return;

    const gameDt = dt * this.gameState.speed;
    const res = this.gameState.resources;

    // Kun, fasl va yil hisobi (4 Fasl Tsikli: Bahor, Yoz, Kuz, Qish)
    res.timeOfDay = (res.timeOfDay + gameDt * 0.4) % 24;
    res.day += gameDt * 0.016;

    const dayInYear = ((Math.floor(res.day) - 1) % 48) + 1;
    const year = Math.floor((res.day - 1) / 48) + 1;
    const currentSeason = SEASONS.find(s => dayInYear >= s.dayRange[0] && dayInYear <= s.dayRange[1]) || SEASONS[0];

    if (res.seasonId !== currentSeason.id) {
      res.season = currentSeason.name;
      res.seasonId = currentSeason.id;
      res.year = year;
      this.gameState.emit('seasonChanged', currentSeason);
      this.gameState.emit('notify', {
        type: 'success',
        message: `${currentSeason.icon} Yangi Fasl Boshlandi: ${currentSeason.name} mavsumi! (${year}-Yil) ${currentSeason.desc}`
      });
      this.audioManager.playLevelUp();
    }

    // 1. Dinamik Tabiiy Meteorologik Tsikl (Realistic Meteorological Markov Chain)
    this.weatherTimer -= gameDt;
    if (this.weatherTimer <= 0) {
      const curPreset = this.weatherPreset || WEATHER_PRESETS.sunny;
      const transitions = curPreset.nextTransitions || [
        { id: 'cloudy', weight: 60 },
        { id: 'humid_sun', weight: 25 },
        { id: 'sunny', weight: 15 }
      ];

      // Ehtimollik (vazn) bo'yicha tabiiy keyingi holatni tanlash
      const totalWeight = transitions.reduce((sum, t) => sum + t.weight, 0);
      let rand = Math.random() * totalWeight;
      let nextId = transitions[0].id;
      for (const t of transitions) {
        if (rand < t.weight) {
          nextId = t.id;
          break;
        }
        rand -= t.weight;
      }

      this.weatherPreset = WEATHER_PRESETS[nextId] || WEATHER_PRESETS.sunny;
      this.weatherTimer = 45 + Math.random() * 40; // 45-85 soniya

      this.gameState.emit('weatherChanged', this.weatherPreset);
      this.gameState.emit('notify', {
        type: 'info',
        message: `${this.weatherPreset.icon} Ob-havo: ${this.weatherPreset.name}! ${this.weatherPreset.description}`
      });

      if (this.weatherPreset.id === 'windy') {
        this.audioManager.playWindGust();
      } else if (this.weatherPreset.id === 'storm_flood') {
        this.audioManager.playThunder();
      }
    }

    // 2. Fasl va Ob-havo ko'rsatkichlarini hisoblash
    const hour = res.timeOfDay;
    const seasonTemp = currentSeason.baseTemp || 22;
    let diurnalVariation = Math.sin(((hour - 6) / 12) * Math.PI) * 7;
    if (hour < 6 || hour > 20) diurnalVariation = -5;

    let baseTemp = seasonTemp + diurnalVariation + this.weatherPreset.tempMod;
    let baseEt0 = (currentSeason.baseEt0 || 4.0) * (Math.max(5, baseTemp) / Math.max(10, seasonTemp)) * this.weatherPreset.et0Mod;

    // Inqiroz ta'siri
    if (this.crisisManager.activeCrisis) {
      if (this.crisisManager.activeCrisis.id === 'heatwave') {
        baseTemp += 14;
        baseEt0 *= 2.2;
      }
    }

    // Yomg'ir va Sel paytida daryo va akvifer zaxirasi to'lib boradi
    if (this.weatherPreset.id === 'rain') {
      res.surfaceWater = Math.min(10000, res.surfaceWater + 25 * gameDt);
      res.aquiferWater = Math.min(20000, res.aquiferWater + 15 * gameDt);
    } else if (this.weatherPreset.id === 'storm_flood') {
      res.surfaceWater = Math.min(12000, res.surfaceWater + 90 * gameDt);
      res.aquiferWater = Math.min(20000, res.aquiferWater + 45 * gameDt);
    }

    this.weather.id = this.weatherPreset.id;
    this.weather.name = this.weatherPreset.name;
    this.weather.icon = this.weatherPreset.icon;
    this.weather.windSpeed = this.weatherPreset.windSpeed;
    this.weather.rainRate = this.weatherPreset.rainRate;
    this.weather.cloudCover = this.weatherPreset.cloudCover;
    this.weather.moistureGainRate = this.weatherPreset.moistureGainRate;
    this.weather.temperature = baseTemp;
    this.weather.et0 = baseEt0;
    res.temperature = baseTemp;
    res.et0 = baseEt0;

    // Dvigatellarni yangilash
    this.gridWorld.update(gameDt, this.weather);
    this.crisisManager.update(gameDt, this.weather);
    this.scadaEngine.update(gameDt, this.weather);

    // Eko-Ball barqarorligi
    let aliveCrops = 0;
    let healthyCount = 0;
    for (let x = 0; x < this.gridWorld.size; x++) {
      for (let y = 0; y < this.gridWorld.size; y++) {
        const t = this.gridWorld.tiles[x][y];
        if (t.crop) {
          aliveCrops++;
          if (t.crop.health > 70) healthyCount++;
        }
      }
    }
    if (aliveCrops > 0) {
      const targetEco = (healthyCount / (this.gridWorld.size * this.gridWorld.size)) * 120;
      res.ecoScore += (targetEco - res.ecoScore) * 0.01 * gameDt;
    }

    // 3D Visual sinxronizatsiyasi
    this.buildingRenderer.sync();
  }

  loop(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // 1. Simulyatsiya
    this.updateSimulation(dt);

    // 2. 3D Render
    this.sceneManager.updateLighting(
      this.gameState.resources.timeOfDay,
      this.crisisManager.activeCrisis,
      this.weatherPreset,
      dt,
      this.audioManager
    );
    this.tileRenderer.update(currentTime * 0.001, this.gameState.activeHeatmap);
    this.buildingRenderer.update(currentTime * 0.001, dt, this.weatherPreset);
    this.particleSystem.update(
      currentTime * 0.001,
      dt,
      this.gameState.resources.ecoScore,
      this.crisisManager.activeCrisis,
      this.weatherPreset,
      this.gameState.resources.timeOfDay
    );
    this.terraformer.update(this.gameState.resources.ecoScore);
    this.sceneManager.render();

    // 3. UI
    this.uiManager.update(this.weather, this.crisisManager.activeCrisis);
    this.scadaModal.update();

    requestAnimationFrame((t) => this.loop(t));
  }
}

// O'yinni ishga tushirish
window.addEventListener('DOMContentLoaded', () => {
  new OasisGame();
});
