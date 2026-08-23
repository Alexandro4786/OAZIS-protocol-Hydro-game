import { CROP_TYPES, IRRIGATION_TECH, BUILDINGS } from '../config.js';
import confetti from 'canvas-confetti';

export class UIManager {
  constructor(gameState, gridWorld, audioManager, crisisManager) {
    this.gameState = gameState;
    this.gridWorld = gridWorld;
    this.audioManager = audioManager;
    this.crisisManager = crisisManager;

    this.currentTab = 'survey'; // survey, crops, irrigation, infra, demolish
    this.initDOM();
    this.initEvents();
    this.renderTools();
  }

  initDOM() {
    this.statBudget = document.getElementById('stat-budget');
    this.statSurface = document.getElementById('stat-surface-water');
    this.statAquifer = document.getElementById('stat-aquifer');
    this.statMoisture = document.getElementById('stat-moisture');
    this.statEcoScore = document.getElementById('stat-eco-score');
    this.ecoProgressFill = document.getElementById('eco-progress-fill');
    this.statSeasonDay = document.getElementById('stat-season-day');
    this.statTempEt0 = document.getElementById('stat-temp-et0');
    
    this.toolsContainer = document.getElementById('tools-container');
    this.inspectorPanel = document.getElementById('inspector-panel');
    this.crisisBanner = document.getElementById('crisis-banner');
    this.notificationsContainer = document.getElementById('notifications-container');
  }

  initEvents() {
    // 1. Asboblar toifasi (Tabs)
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.audioManager.playClick();
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.dataset.tab;
        this.renderTools();
      });
    });

    // 1.1. Pastki Menyuni Ochish / Yashirish Tugmasi (Green Farm 3 / SimCity FAB)
    const bottomDock = document.getElementById('bottom-dock');
    const toggleBtn = document.getElementById('btn-toggle-dock');
    const toggleLabel = document.getElementById('dock-toggle-label');
    const toggleArrow = document.getElementById('dock-toggle-arrow');
    let isDockOpen = false;

    toggleBtn?.addEventListener('click', () => {
      this.audioManager.playClick();
      isDockOpen = !isDockOpen;
      if (isDockOpen) {
        bottomDock.classList.remove('collapsed');
        bottomDock.style.display = 'flex';
        toggleBtn.classList.add('active');
        if (toggleLabel) toggleLabel.innerText = "Menyuni Yashirish";
        if (toggleArrow) toggleArrow.innerText = "▼";
      } else {
        bottomDock.classList.add('collapsed');
        bottomDock.style.display = 'none';
        toggleBtn.classList.remove('active');
        if (toggleLabel) toggleLabel.innerText = "Asboblar & Ekinlar Menyusi";
        if (toggleArrow) toggleArrow.innerText = "▲";
      }
    });

    // 2. Heatmap menyusini ochish / yopish
    const heatmapDock = document.getElementById('heatmap-dock');
    const heatmapToggleBtn = document.getElementById('btn-toggle-heatmap');
    const heatmapToggleArrow = document.getElementById('heatmap-toggle-arrow');
    let isHeatmapOpen = false;

    heatmapToggleBtn?.addEventListener('click', () => {
      this.audioManager.playClick();
      isHeatmapOpen = !isHeatmapOpen;
      if (isHeatmapOpen) {
        heatmapDock.classList.remove('collapsed');
        heatmapDock.style.display = 'flex';
        heatmapToggleBtn.classList.add('active');
        if (heatmapToggleArrow) heatmapToggleArrow.innerText = "▼";
      } else {
        heatmapDock.classList.add('collapsed');
        heatmapDock.style.display = 'none';
        heatmapToggleBtn.classList.remove('active');
        if (heatmapToggleArrow) heatmapToggleArrow.innerText = "▲";
      }
    });

    // 2.1. Heatmap almashtirish
    document.querySelectorAll('.heatmap-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.audioManager.playClick();
        document.querySelectorAll('.heatmap-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.gameState.setHeatmap(btn.dataset.heatmap);
      });
    });

    // 3. Tezlik tugmalari
    const speedButtons = {
      'btn-speed-pause': 0,
      'btn-speed-1x': 1,
      'btn-speed-2x': 2,
      'btn-speed-5x': 5
    };
    Object.entries(speedButtons).forEach(([id, spd]) => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        this.audioManager.playClick();
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        e.target.closest('.speed-btn')?.classList.add('active');
        this.gameState.setSpeed(spd);
      });
    });

    // 4. Ovoz tugmasi
    document.getElementById('btn-audio-toggle')?.addEventListener('click', (e) => {
      this.audioManager.init();
      const muted = this.audioManager.toggleMute();
      e.target.innerText = muted ? '🔇' : '🔊';
    });

    // 5. Yordam / Qo'llanma
    document.getElementById('btn-help-modal')?.addEventListener('click', () => {
      this.audioManager.playClick();
      document.getElementById('help-modal').style.display = 'flex';
    });
    document.querySelectorAll('[data-close="help-modal"]').forEach(b => {
      b.addEventListener('click', () => {
        this.audioManager.playClick();
        document.getElementById('help-modal').style.display = 'none';
      });
    });

    // 6. Inqirozni ta'mirlash tugmasi
    document.getElementById('btn-crisis-fix')?.addEventListener('click', () => {
      this.crisisManager.repairPipeBurst();
    });

    // 7. Inspector tugmalari
    document.getElementById('insp-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audioManager.playClick();
      this.gameState.selectTile(null);
      this.inspectorPanel.style.display = 'none';
    });
    document.getElementById('btn-insp-harvest')?.addEventListener('click', () => {
      if (this.gameState.selectedTile) {
        this.gridWorld.harvestCrop(this.gameState.selectedTile.x, this.gameState.selectedTile.y);
        this.updateInspector(this.gameState.selectedTile);
      }
    });
    document.getElementById('btn-insp-toggle-irrigation')?.addEventListener('click', (e) => {
      if (this.gameState.selectedTile) {
        this.gameState.selectedTile.irrigationActive = !this.gameState.selectedTile.irrigationActive;
        this.audioManager.playClick();
        this.updateInspector(this.gameState.selectedTile);
      }
    });
    
    // Green Farm 3 Style: Ko'chirish (Move)
    document.getElementById('btn-insp-move')?.addEventListener('click', () => {
      if (this.gameState.selectedTile) {
        this.audioManager.playClick();
        this.gameState.moveSourceTile = this.gameState.selectedTile;
        this.gameState.setTool('move_mode');
        this.gameState.emit('notify', {
          type: 'info',
          message: "Ko'chirish rejimi: Obyektni o'tkazmoqchi bo'lgan yangi bo'sh katak ustiga bosing."
        });
      }
    });

    // Green Farm 3 Style: Sotish / Buzish (60% Refund)
    document.getElementById('btn-insp-demolish')?.addEventListener('click', () => {
      if (this.gameState.selectedTile) {
        const t = this.gameState.selectedTile;
        const refund = this.gridWorld.demolishTile(t.x, t.y);
        this.audioManager.playBuild();
        this.updateInspector(t);
        this.gameState.emit('tileDemolished', t);
        if (refund > 0) {
          this.gameState.emit('notify', {
            type: 'success',
            message: `Buzildi: +$${refund} qaytarildi (60% kompensatsiya)!`
          });
          this.spawnFloatingScore(window.innerWidth / 2, window.innerHeight / 2, `+$${refund} 💰`, 'refund');
        } else {
          this.gameState.emit('notify', { type: 'info', message: "Katak tozalandi." });
        }
      }
    });

    // Bekor qilish tugmasi (Floating Action Bar & Esc)
    document.getElementById('btn-cancel-action')?.addEventListener('click', () => {
      this.cancelActiveAction();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancelActiveAction();
      }
    });

    // Qayta boshlash tugmalari
    const restartModal = document.getElementById('restart-modal');
    document.getElementById('btn-restart-game')?.addEventListener('click', () => {
      this.audioManager.playClick();
      if (restartModal) restartModal.style.display = 'flex';
    });

    document.getElementById('btn-cancel-restart')?.addEventListener('click', () => {
      this.audioManager.playClick();
      if (restartModal) restartModal.style.display = 'none';
    });

    document.getElementById('btn-confirm-restart')?.addEventListener('click', () => {
      this.audioManager.playClick();
      if (restartModal) restartModal.style.display = 'none';
      this.gameState.emit('restartGame');
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      document.getElementById('endgame-modal').style.display = 'none';
      this.gameState.emit('restartGame');
    });

    // Hodisalarni tinglash
    this.gameState.on('notify', (data) => this.showToast(data));
    this.gameState.on('tileSelected', (tile) => this.updateInspector(tile));
    this.gameState.on('techUnlocked', () => this.renderTools());
    this.gameState.on('toolChanged', (toolId) => this.updateFloatingActionBar(toolId));
    this.gameState.on('harvestSuccess', (data) => {
      this.spawnFloatingScore(window.innerWidth / 2, window.innerHeight / 2 - 30, `+$${data.earnings} 💰`, 'money');
    });
  }

  cancelActiveAction() {
    this.audioManager.playClick();
    this.gameState.moveSourceTile = null;
    this.gameState.setTool('survey');
    document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
    this.updateFloatingActionBar('survey');
    this.gameState.emit('notify', { type: 'info', message: "Amal bekor qilindi (Tahlil rejimi)." });
  }

  updateFloatingActionBar(toolId) {
    const bar = document.getElementById('floating-action-bar');
    const title = document.getElementById('floating-action-title');
    const icon = document.getElementById('floating-action-icon');
    const desc = document.getElementById('floating-action-desc');
    if (!bar) return;

    if (!toolId || toolId === 'survey') {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';

    if (toolId === 'move_mode') {
      icon.innerText = '📦';
      title.innerText = "Ko'chirish Rejimi";
      desc.innerText = "Obyektni o'tkazmoqchi bo'lgan yangi katakni tanlang yoki Esc bosing";
    } else if (toolId.startsWith('crop_')) {
      const c = CROP_TYPES[toolId.replace('crop_', '')];
      icon.innerText = c ? c.icon : '🌱';
      title.innerText = `${c ? c.name : 'Ekin'} Ekish Rejimi ($${c ? c.seedCost : 0})`;
      desc.innerText = "Katak ustiga bosib eking yoki Bekor qiling (Esc)";
    } else if (toolId.startsWith('irr_')) {
      const tech = IRRIGATION_TECH[toolId.replace('irr_', '')];
      icon.innerText = tech ? tech.icon : '💧';
      title.innerText = `${tech ? tech.shortName : 'Sug\'orish'} O'rnatish ($${tech ? tech.cost : 0})`;
      desc.innerText = "Katak ustiga bosib o'rnating yoki Bekor qiling (Esc)";
    } else if (toolId.startsWith('bld_')) {
      const bldKey = toolId.replace('bld_', '');
      const bld = BUILDINGS[bldKey];
      icon.innerText = bld ? bld.icon : '🏗️';
      title.innerText = `${bld ? bld.name : 'Inshoot'} Qurish ($${bld ? bld.cost : 0})`;
      desc.innerText = "Katak ustiga bosib quring yoki Bekor qiling (Esc)";
    } else if (toolId === 'demolish') {
      icon.innerText = '🧹';
      title.innerText = "Buzish / Sotish Rejimi (60% Qaytarish)";
      desc.innerText = "O'chirmoqchi bo'lgan obyektingizni bosing";
    }
  }

  spawnFloatingScore(x, y, text, type = 'money') {
    const container = document.getElementById('floating-scores-container') || document.body;
    const el = document.createElement('div');
    el.className = `floating-score ${type}`;
    el.innerText = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    container.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 1400);
  }

  renderTools() {
    this.toolsContainer.innerHTML = '';
    let tools = [];

    if (this.currentTab === 'survey') {
      tools = [
        { id: 'survey', name: 'Tahlil / Ko\'rish', icon: '🔍', cost: 0, desc: 'Katak tuproq va namlik ma\'lumotlarini o\'rganish' }
      ];
    } else if (this.currentTab === 'crops') {
      tools = Object.values(CROP_TYPES).map(c => ({
        id: `crop_${c.id}`,
        name: c.name,
        icon: c.icon,
        cost: c.seedCost,
        desc: `${c.category} • Suv talabi: ${c.waterNeed} mm • Hosil: $${c.revenue}`,
        unlocked: true
      }));
    } else if (this.currentTab === 'irrigation') {
      tools = Object.values(IRRIGATION_TECH).map(tech => ({
        id: `irr_${tech.id}`,
        name: tech.shortName,
        icon: tech.icon,
        cost: tech.cost,
        desc: `${tech.name} • Samaradorlik: ${Math.round(tech.efficiency * 100)}%`,
        unlocked: this.gameState.isTechUnlocked(tech.id)
      }));
    } else if (this.currentTab === 'infra') {
      tools = Object.values(BUILDINGS).map(b => ({
        id: `bld_${b.id}`,
        name: b.name,
        icon: b.icon,
        cost: b.cost,
        desc: b.description,
        unlocked: b.id === 'pipe' || b.id === 'canal_intake' || this.gameState.isTechUnlocked(`tech_${b.id}`)
      }));
    } else if (this.currentTab === 'demolish') {
      tools = [
        { id: 'demolish', name: 'Buzish / Tozalash', icon: '🧹', cost: 0, desc: 'Ekin, quvur yoki inshootni xaritadan o\'chirish' }
      ];
    }

    tools.forEach(t => {
      const isUnlocked = t.unlocked !== undefined ? t.unlocked : true;
      const card = document.createElement('div');
      card.className = `tool-card ${!isUnlocked ? 'locked' : ''} ${this.gameState.activeTool === t.id ? 'active' : ''}`;
      card.title = t.desc;

      card.innerHTML = `
        <span class="tool-icon">${t.icon}</span>
        <span class="tool-name">${t.name}</span>
        <span class="tool-cost">${t.cost > 0 ? `$${t.cost}` : 'BEPUL'}</span>
      `;

      if (isUnlocked) {
        card.addEventListener('click', () => {
          this.audioManager.playClick();
          document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          this.gameState.setTool(t.id);
        });
      }

      this.toolsContainer.appendChild(card);
    });
  }

  update(weather, crisis) {
    const res = this.gameState.resources;

    // Resurslar qiymatlari
    this.statBudget.innerText = `$${Math.round(res.budget).toLocaleString()}`;
    this.statSurface.innerText = `${Math.round(res.surfaceWater).toLocaleString()} m³`;
    this.statAquifer.innerText = `${Math.round(res.aquiferWater).toLocaleString()} m³`;
    
    // O'rtacha namlik
    let totalMoist = 0;
    let count = 0;
    for (let x = 0; x < this.gridWorld.size; x++) {
      for (let y = 0; y < this.gridWorld.size; y++) {
        if (this.gridWorld.tiles[x][y].type !== 'river') {
          totalMoist += this.gridWorld.tiles[x][y].moisture;
          count++;
        }
      }
    }
    const avgM = Math.round(totalMoist / count);
    this.statMoisture.innerText = `${avgM}% VWC`;

    // Eko-Ball
    this.statEcoScore.innerText = `${Math.round(res.ecoScore)}%`;
    this.ecoProgressFill.style.width = `${Math.min(100, res.ecoScore)}%`;

    // Ob-havo ko'rsatkichi
    const weatherIcon = weather.icon || '☀️';
    const weatherName = weather.name || 'Quyoshli';
    const wIconEl = document.getElementById('weather-icon');
    const wNameEl = document.getElementById('stat-weather-name');
    if (wIconEl) wIconEl.innerText = weatherIcon;
    if (wNameEl) wNameEl.innerText = `${weatherName} • ${Math.floor(res.day)}-kun`;
    
    let extraMeteo = `💨 ${weather.windSpeed || 3}m/s`;
    if (weather.rainRate && weather.rainRate > 0) {
      extraMeteo += ` • 🌧️ +${weather.rainRate}mm`;
    }
    if (this.statTempEt0) {
      this.statTempEt0.innerHTML = `${Math.round(weather.temperature)}°C <span class="et0-sub">(ET₀: ${weather.et0.toFixed(1)} • ${extraMeteo})</span>`;
    }

    // Inqiroz Bannerini yangilash
    if (crisis) {
      this.crisisBanner.style.display = 'flex';
      document.getElementById('crisis-icon').innerText = crisis.icon;
      document.getElementById('crisis-title').innerText = crisis.name;
      document.getElementById('crisis-desc').innerText = crisis.description;
      
      const secLeft = Math.max(0, Math.ceil(this.crisisManager.crisisDurationLeft));
      document.getElementById('crisis-timer').innerText = `00:${secLeft < 10 ? '0' : ''}${secLeft}`;

      const fixBtn = document.getElementById('btn-crisis-fix');
      if (crisis.id === 'pipe_burst') {
        fixBtn.style.display = 'block';
      } else {
        fixBtn.style.display = 'none';
      }
    } else {
      this.crisisBanner.style.display = 'none';
    }

    // Tanlangan katak ma'lumotlarini yangilab turish
    if (this.gameState.selectedTile) {
      this.updateInspector(this.gameState.selectedTile);
    } else {
      this.inspectorPanel.style.display = 'none';
    }

    // O'yin yakunini tekshirish
    const endState = this.gameState.checkEndGameConditions();
    if (endState.ended) {
      this.showEndGame(endState);
    }
  }

  updateInspector(tile) {
    if (!tile) {
      this.inspectorPanel.style.display = 'none';
      return;
    }

    this.inspectorPanel.style.display = 'flex';
    document.getElementById('insp-coord').innerText = `Katak [${tile.x}, ${tile.y}]`;

    const typeNames = { river: 'Daryo / Kanal Suvi', desert: 'Quruq Cho\'l Tuprog\'i' };
    document.getElementById('insp-type').innerText = typeNames[tile.type] || 'Sug\'oriladigan Yer';

    // Namlik holati
    const m = Math.round(tile.moisture);
    let mStatus = 'Quruq';
    if (m >= 45 && m <= 75) mStatus = 'Optimal 🌱';
    else if (m > 75) mStatus = 'Ko\'llagan 🌊';
    document.getElementById('insp-moisture').innerText = `${m}% VWC (${mStatus})`;

    document.getElementById('insp-salinity').innerText = `${Math.round(tile.salinity)}%`;

    // Infratuzilma
    const bldNames = {
      canal_intake: 'Kanal Nasosi 🏞️',
      deep_well: 'Arteziyan Quduq 🏗️',
      iot_tower: 'SCADA Minorasi 📡',
      solar_array: 'Quyosh Paneli ☀️'
    };
    document.getElementById('insp-building').innerText = bldNames[tile.building] || (tile.hasPipe ? 'Quvur 🚰' : 'Yo\'q');

    // Sug'orish
    const irrTech = IRRIGATION_TECH[tile.irrigation];
    document.getElementById('insp-irrigation').innerText = irrTech ? `${irrTech.shortName} (${tile.irrigationActive ? 'Ochiq' : 'Yopiq'})` : 'O\'rnatilmagan';

    // Ekin
    if (tile.crop) {
      const crp = CROP_TYPES[tile.crop.type];
      const stageNames = ['Nihol', 'Vegetatsiya', 'Gullash', 'Pishish', 'Hosil Yetildi!'];
      const statusText = tile.crop.isWithered ? 'Qurigan 💀' : `${stageNames[tile.crop.stage]} (${Math.round(tile.crop.health)}% sog'lom)`;
      document.getElementById('insp-crop').innerText = `${crp.name} - ${statusText}`;
    } else {
      document.getElementById('insp-crop').innerText = 'Ekilmagan';
    }

    document.getElementById('insp-flow').innerText = `${(tile.currentFlow || 0).toFixed(1)} m³/soat`;
    
    // Suv tarmog'i ulanish tavsifi
    let netStatus = '❌ Quvur yetib bormagan (Daryo nasosiga ulang)';
    if (tile.building === 'canal_intake') {
      netStatus = '🌊 Asosiy Daryo Nasosi (Boshlang\'ich Suv Manbasi)';
    } else if (tile.building === 'deep_well') {
      netStatus = '🏗️ Arteziyan Quduq (Yer osti suvi manbasi)';
    } else if (tile.isConnectedToWater) {
      netStatus = '✅ Suv manbasiga ulangan (Oqim faol 💧)';
    }
    document.getElementById('insp-network').innerText = netStatus;

    // Tugmalar holati
    const harvestBtn = document.getElementById('btn-insp-harvest');
    if (tile.crop && (tile.crop.stage >= 4 || tile.crop.isWithered)) {
      harvestBtn.style.display = 'block';
    } else {
      harvestBtn.style.display = 'none';
    }

    const toggleIrrBtn = document.getElementById('btn-insp-toggle-irrigation');
    if (tile.irrigation) {
      toggleIrrBtn.style.display = 'block';
      toggleIrrBtn.innerText = tile.irrigationActive ? '💧 Klapanni yopish' : '💧 Klapanni ochish';
    } else {
      toggleIrrBtn.style.display = 'none';
    }
  }

  showToast({ type, message }) {
    const toast = document.createElement('div');
    toast.className = `toast ${type || 'info'}`;
    toast.innerText = message;
    this.notificationsContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  showEndGame({ win, reason }) {
    const modal = document.getElementById('endgame-modal');
    modal.style.display = 'flex';
    document.getElementById('endgame-icon').innerText = win ? '🏆' : '💀';
    document.getElementById('endgame-title').innerText = win ? "G'ALABA! OASIS PROTOCOL YAKUNLANDI" : "MAG'LUBIYAT";
    document.getElementById('endgame-title').style.color = win ? 'var(--green-accent)' : 'var(--red-accent)';
    document.getElementById('endgame-reason').innerText = reason;

    if (win) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
  }
}
