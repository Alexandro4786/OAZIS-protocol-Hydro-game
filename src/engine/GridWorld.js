import { GRID_SIZE, IRRIGATION_TECH, CROP_TYPES, BUILDINGS } from '../config.js';

export class GridWorld {
  constructor(gameState) {
    this.gameState = gameState;
    this.size = GRID_SIZE;
    this.tiles = [];
    this.initGrid();
  }

  initGrid() {
    this.tiles = [];
    for (let x = 0; x < this.size; x++) {
      this.tiles[x] = [];
      for (let y = 0; y < this.size; y++) {
        // Daryo/kanal tabiiy oqimi: x = 0 ustunida yoki yuqori burchakda daryo bo'ladi
        const isRiver = (x === 0 && y >= 3 && y <= 12) || (x === 1 && y >= 6 && y <= 9);
        
        this.tiles[x][y] = {
          x,
          y,
          id: `${x}_${y}`,
          type: isRiver ? 'river' : 'desert', // river, desert, cultivated, oasis
          moisture: isRiver ? 100 : (12 + Math.random() * 8), // % VWC
          salinity: 5 + Math.random() * 5, // %
          temperature: 28,
          elevation: Math.sin(x * 0.4) * Math.cos(y * 0.4) * 0.3,
          
          // Ekin ma'lumotlari
          crop: null, // { type: 'cotton', stage: 0..4, progress: 0..100, health: 100, daysAlive: 0 }
          
          // Sug'orish tizimi
          irrigation: null, // 'furrow', 'sprinkler', 'drip_surface', 'sdi', 'scada_ai'
          irrigationActive: true,
          
          // Infratuzilma
          building: isRiver && (x === 0 && y === 7) ? 'canal_intake' : null,
          hasPipe: false,
          hasSensor: false,
          
          // SCADA / PID parametrlari
          targetMoisture: 60, // Optimal %
          currentFlow: 0,     // m3/h
          pidIntegral: 0,
          pidLastError: 0,
          waterLossRate: 0,   // bug'lanish va sizilish m3/s
          
          // Qoplama va signal
          isCoveredByIot: false,
          isConnectedToWater: isRiver && (x === 0 && y === 7),
          
          // Dinamik ko'kalamzorlik darajasi
          greenery: isRiver ? 0.8 : 0.0
        };
      }
    }
  }

  getTile(x, y) {
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      return this.tiles[x][y];
    }
    return null;
  }

  getNeighbors(x, y) {
    const neighbors = [];
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    dirs.forEach(([dx, dy]) => {
      const tile = this.getTile(x + dx, y + dy);
      if (tile) neighbors.push(tile);
    });
    return neighbors;
  }

  update(dt, weather) {
    // 1. Infratuzilma va sensor qamrovini tahlil qilish
    this.updateNetworkConnectivity();

    // 2. Har bir katak simulyatsiyasi
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.tiles[x][y];
        if (tile.type === 'river') {
          tile.moisture = 100;
          continue;
        }

        // a) Bug'lanish (ET0 va haroratga bog'liq)
        let et0Factor = weather.et0 * (weather.temperature / 25) * 0.05 * dt;
        
        // Agar o'rmon/daraxt bo'lsa, mikroiqlim hisobiga ET0 kamayadi
        if (tile.crop && tile.crop.type === 'oasis_tree') {
          et0Factor *= 0.6;
        }

        // Sug'orish turi bo'yicha bug'lanishni kamaytirish
        let evaporationLoss = et0Factor;
        if (tile.irrigation === 'sdi') {
          evaporationLoss *= 0.05; // SDI da deyarli bug'lanmaydi
        } else if (tile.irrigation === 'drip_surface') {
          evaporationLoss *= 0.4;
        } else if (tile.irrigation === 'sprinkler') {
          evaporationLoss *= 0.75;
        } else if (tile.irrigation === 'furrow') {
          evaporationLoss *= 1.3; // Egatda quyoshda suv ko'l bo'lib tez bug'lanadi
        }

        // b) Namlikning tabiiy pasayishi
        tile.moisture = Math.max(5, tile.moisture - evaporationLoss);

        // c) Sug'orish oqimi (Quvur yoki nasos ulangan bo'lsa avtomatik sug'oradi)
        tile.waterLossRate = 0;
        if (tile.isConnectedToWater) {
          // Agar ekin yoki quvur bo'lsa-yu sug'orish turi tanlanmagan bo'lsa,
          // avtomatik ravishda bazaviy sug'orish (Egat/Quvur) ishga tushadi
          if (!tile.irrigation && (tile.crop || tile.hasPipe)) {
            tile.irrigation = 'furrow';
            tile.irrigationActive = true;
          }
          if (tile.irrigation && tile.irrigationActive) {
            this.applyIrrigation(tile, dt, weather);
          }
        }

        // d) O'simlik suv iste'moli va o'sishi
        if (tile.crop) {
          this.updateCrop(tile, dt);
        }

        // e) Drenaj va tuproq sho'rlanishi dinamikasi
        if (tile.moisture > 85) {
          // Ortiqcha suv pastga sizilib drenaj yo'qotishi yuz beradi
          const overWater = (tile.moisture - 85) * 0.1 * dt;
          tile.moisture -= overWater;
          tile.waterLossRate += overWater * 0.5;
          // Egatlab sug'orishda ortiqcha suv sho'rni yer yuziga ko'taradi
          if (tile.irrigation === 'furrow') {
            tile.salinity = Math.min(100, tile.salinity + 0.15 * dt);
          }
        }

        // Agar tuproq quruq bo'lsa va akvifer sho'rlangan bo'lsa
        if (this.gameState.resources.salinityRisk > 0.4 && tile.irrigation) {
          tile.salinity = Math.min(100, tile.salinity + this.gameState.resources.salinityRisk * 0.1 * dt);
        }

        // f) Ko'kalamzorlik indeksi (Terraforming)
        if (tile.crop && tile.crop.health > 50) {
          tile.greenery = Math.min(1.0, tile.greenery + 0.05 * dt);
        } else if (tile.moisture > 40) {
          tile.greenery = Math.min(0.6, tile.greenery + 0.02 * dt);
        } else {
          tile.greenery = Math.max(0.0, tile.greenery - 0.03 * dt);
        }
      }
    }
  }

  applyIrrigation(tile, dt, weather) {
    const tech = IRRIGATION_TECH[tile.irrigation] || IRRIGATION_TECH['furrow'];
    if (!tech) return;

    // AI SCADA / Fuzzy-PID boshqaruvi
    let flowRate = tech.waterPerHour;
    if (tile.irrigation === 'scada_ai' && tile.isCoveredByIot) {
      // Fuzzy-PID: ekin namlik ehtiyojini ushlab turadi
      const error = tile.targetMoisture - tile.moisture;
      tile.pidIntegral = Math.max(-20, Math.min(20, tile.pidIntegral + error * dt));
      const derivative = (error - tile.pidLastError) / Math.max(0.01, dt);
      tile.pidLastError = error;

      const Kp = 0.8;
      const Ki = 0.05;
      const Kd = 0.2;
      let pidOutput = (Kp * error + Ki * tile.pidIntegral + Kd * derivative);
      
      // Ob-havo prognozi bo'yicha profilaktik korreksiya
      if (weather.et0 > 6.0) pidOutput += 1.5; // Issiqda oldindan ko'proq berish

      flowRate = Math.max(0, Math.min(tech.waterPerHour * 1.5, pidOutput));
    } else {
      // Oddiy mexanik oqim: agar namlik 80% dan oshsa isrof
      if (tile.moisture >= 85) {
        flowRate *= 0.5;
      }
    }

    if (flowRate <= 0.01) {
      tile.currentFlow = 0;
      return;
    }

    const waterVolume = (flowRate * dt) * 0.1; // m3
    const actualProvided = this.gameState.consumeWater(waterVolume, tile.sourceType || 'surface');
    
    if (actualProvided > 0) {
      tile.currentFlow = flowRate;
      
      // Samaradorlik bo'yicha namlikka aylanishi
      const effectiveWater = actualProvided * tech.efficiency;
      const wastedWater = actualProvided * (1 - tech.efficiency);
      
      tile.moisture = Math.min(100, tile.moisture + effectiveWater * 12);
      tile.waterLossRate += wastedWater;
      this.gameState.stats.waterWasted += wastedWater;
      this.gameState.stats.waterSaved += actualProvided * (tech.efficiency - 0.45); // Egatga nisbatan tejash
    }
  }

  updateCrop(tile, dt) {
    const cropConfig = CROP_TYPES[tile.crop.type];
    if (!cropConfig) return;

    tile.crop.daysAlive += dt * 0.1;

    // Namlik tekshiruvi
    const isOptimal = tile.moisture >= cropConfig.optimalMoistureMin && tile.moisture <= cropConfig.optimalMoistureMax;
    const isDry = tile.moisture < cropConfig.optimalMoistureMin * 0.6;
    const isFlooded = tile.moisture > cropConfig.optimalMoistureMax * 1.25;
    const isSalineToxic = (tile.salinity / 100) > cropConfig.salinityTolerance;

    if (isOptimal && !isSalineToxic) {
      tile.crop.health = Math.min(100, tile.crop.health + 3.0 * dt);
      tile.crop.progress += (100 / cropConfig.growDays) * 0.12 * dt;
    } else if (isDry || isFlooded || isSalineToxic) {
      tile.crop.health = Math.max(0, tile.crop.health - 1.2 * dt);
    }

    // O'simlik suv ichishi
    const waterIntake = cropConfig.waterNeed * 0.04 * dt;
    tile.moisture = Math.max(0, tile.moisture - waterIntake);

    // O'sish bosqichlari (0: Ekish, 1: Nihol, 2: Gullash, 3: Pishish, 4: Hosil yetildi)
    tile.crop.stage = Math.min(4, Math.floor((tile.crop.progress / 100) * 4));

    // Salomatlik nolga tushsa ekin quriydi
    if (tile.crop.health <= 0) {
      tile.crop.isWithered = true;
    }
  }

  updateNetworkConnectivity() {
    // 1. Barcha nasos/manbalarni topish
    const sources = [];
    const iotTowers = [];

    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.tiles[x][y];
        tile.isConnectedToWater = false;
        tile.isCoveredByIot = false;
        
        if (tile.type === 'river') {
          tile.isConnectedToWater = true;
        }
        if (tile.building === 'canal_intake' || tile.building === 'deep_well') {
          sources.push(tile);
          tile.isConnectedToWater = true;
        }
        if (tile.building === 'iot_tower') {
          iotTowers.push(tile);
        }
      }
    }

    // 2. Suv oqimi yo'lini (Flood-fill or BFS) aniqlash
    const queue = [...sources];
    const visited = new Set(sources.map(s => s.id));

    while (queue.length > 0) {
      const current = queue.shift();
      const neighbors = this.getNeighbors(current.x, current.y);
      for (const n of neighbors) {
        if (!visited.has(n.id)) {
          // Agar quvur yoki sug'orish o'rnatilgan bo'lsa ulanadi
          if (n.hasPipe || n.irrigation || n.building) {
            n.isConnectedToWater = true;
            n.sourceType = current.sourceType || (current.building === 'deep_well' ? 'aquifer' : 'surface');
            visited.add(n.id);
            queue.push(n);
          }
        }
      }
    }

    // 3. IoT qamrovi (Radius = 4)
    for (const tower of iotTowers) {
      const radius = BUILDINGS.iot_tower.radius;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            const t = this.getTile(tower.x + dx, tower.y + dy);
            if (t) t.isCoveredByIot = true;
          }
        }
      }
    }
  }

  harvestCrop(x, y) {
    const tile = this.getTile(x, y);
    if (!tile || !tile.crop) return null;

    const cropConfig = CROP_TYPES[tile.crop.type];
    if (!cropConfig) return null;

    if (tile.crop.isWithered) {
      tile.crop = null;
      this.gameState.stats.cropsLost++;
      this.gameState.emit('notify', { type: 'error', message: "Qurib qolgan ekin tozalandi (hosil yo'q)." });
      return null;
    }

    if (tile.crop.stage >= 4 || tile.crop.progress >= 95) {
      const healthFactor = tile.crop.health / 100;
      const earnings = Math.round(cropConfig.revenue * healthFactor);
      
      this.gameState.addBudget(earnings);
      this.gameState.updateEcoScore(cropConfig.ecoValue);
      this.gameState.stats.totalHarvestRevenue += earnings;
      this.gameState.stats.cropsHarvested++;
      
      this.gameState.emit('notify', {
        type: 'success',
        message: `Hosil yig'ildi! +$${earnings} daromad, +${cropConfig.ecoValue} Eko-Ball!`
      });
      this.gameState.emit('harvestSuccess', { x, y, earnings, cropType: tile.crop.type });

      // Ko'p yillik daraxt bo'lsa qoladi, bir yillik bo'lsa tozalanadi
      if (tile.crop.type === 'oasis_tree' || tile.crop.type === 'orchard') {
        tile.crop.progress = 50; // Qayta pishish sikliga o'tadi
        tile.crop.stage = 2;
      } else {
        tile.crop = null;
      }

      return earnings;
    } else {
      this.gameState.emit('notify', { type: 'warning', message: "Ekin hali to'liq yetilmadi!" });
      return null;
    }
  }

  moveTileContent(fromX, fromY, toX, toY) {
    const src = this.getTile(fromX, fromY);
    const dest = this.getTile(toX, toY);

    if (!src || !dest) return { success: false, message: "Katak topilmadi!" };
    if (fromX === toX && fromY === toY) return { success: false, message: "Ayni shu katak tanlandi." };

    const hasContent = src.crop || src.irrigation || src.hasPipe || src.building;
    if (!hasContent) return { success: false, message: "Ko'chirish uchun obyekt mavjud emas!" };

    // Daryo katagiga ko'chirish qoidalari
    if (dest.type === 'river' && src.building !== 'canal_intake') {
      return { success: false, message: "Daryo oqimiga ko'chirib bo'lmaydi!" };
    }

    // Agar maqsadda allaqachon bino yoki ekin bo'lsa
    if (dest.building && src.building) {
      return { success: false, message: "Maqsad katagida allaqachon inshoot mavjud!" };
    }
    if (dest.crop && src.crop) {
      return { success: false, message: "Maqsad katagida allaqachon boshqa ekin mavjud!" };
    }

    // Obyektlarni ko'chirish
    if (src.building) {
      dest.building = src.building;
      src.building = null;
    }
    if (src.hasPipe) {
      dest.hasPipe = true;
      src.hasPipe = false;
    }
    if (src.irrigation) {
      dest.irrigation = src.irrigation;
      dest.irrigationActive = src.irrigationActive;
      src.irrigation = null;
    }
    if (src.crop) {
      dest.crop = { ...src.crop };
      src.crop = null;
    }

    this.updateNetworkConnectivity();
    return { success: true, message: `Obyekt [${fromX}, ${fromY}] dan [${toX}, ${toY}] ga ko'chirildi!` };
  }

  demolishTile(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return 0;

    let refund = 0;
    if (tile.building && tile.building !== 'canal_intake' && BUILDINGS[tile.building]) {
      refund += Math.round(BUILDINGS[tile.building].cost * 0.6);
      tile.building = null;
    }
    if (tile.hasPipe) {
      refund += Math.round(BUILDINGS.pipe.cost * 0.6);
      tile.hasPipe = false;
    }
    if (tile.irrigation && IRRIGATION_TECH[tile.irrigation]) {
      refund += Math.round(IRRIGATION_TECH[tile.irrigation].cost * 0.6);
      tile.irrigation = null;
    }
    if (tile.crop && CROP_TYPES[tile.crop.type]) {
      refund += Math.round(CROP_TYPES[tile.crop.type].seedCost * 0.3);
      tile.crop = null;
    }

    if (refund > 0) {
      this.gameState.addBudget(refund);
    }

    this.updateNetworkConnectivity();
    return refund;
  }
}
