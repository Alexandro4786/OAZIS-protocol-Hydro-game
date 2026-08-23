// SCADA & Fuzzy-PID Telemetry Engine

export class ScadaPID {
  constructor(gridWorld, gameState) {
    this.gridWorld = gridWorld;
    this.gameState = gameState;
    
    // Telemetriya tarixi (oxirgi 40 ta nuqta grafik uchun)
    this.history = {
      timestamps: [],
      moistureAvg: [],
      moistureTarget: [],
      waterFlowRate: [],
      et0Values: [],
      efficiency: []
    };
    
    this.isAiAutoPilot = true; // SCADA AI rejimini yoqish
    this.globalSetpoint = 60; // 60% VWC
    this.sampleTimer = 0;
  }

  update(dt, weather) {
    this.sampleTimer += dt;
    if (this.sampleTimer >= 1.0) { // Har 1 soniyada telemetriya yozish
      this.sampleTimer = 0;
      this.recordTelemetry(weather);
    }
  }

  recordTelemetry(weather) {
    let totalMoisture = 0;
    let totalFlow = 0;
    let count = 0;

    for (let x = 0; x < this.gridWorld.size; x++) {
      for (let y = 0; y < this.gridWorld.size; y++) {
        const tile = this.gridWorld.tiles[x][y];
        if (tile.crop || tile.irrigation) {
          totalMoisture += tile.moisture;
          totalFlow += tile.currentFlow || 0;
          count++;
        }
      }
    }

    const avgMoisture = count > 0 ? (totalMoisture / count) : 30;
    const nowLabel = new Date().toLocaleTimeString('uz-UZ', { hour12: false, minute: '2-digit', second: '2-digit' });

    this.history.timestamps.push(nowLabel);
    this.history.moistureAvg.push(Math.round(avgMoisture * 10) / 10);
    this.history.moistureTarget.push(this.globalSetpoint);
    this.history.waterFlowRate.push(Math.round(totalFlow * 10) / 10);
    this.history.et0Values.push(Math.round(weather.et0 * 10) / 10);

    // 40 nuqtadan oshsa eskilarini o'chirish
    const MAX_POINTS = 30;
    if (this.history.timestamps.length > MAX_POINTS) {
      this.history.timestamps.shift();
      this.history.moistureAvg.shift();
      this.history.moistureTarget.shift();
      this.history.waterFlowRate.shift();
      this.history.et0Values.shift();
    }
  }

  setGlobalSetpoint(target) {
    this.globalSetpoint = Math.max(30, Math.min(85, target));
    for (let x = 0; x < this.gridWorld.size; x++) {
      for (let y = 0; y < this.gridWorld.size; y++) {
        const tile = this.gridWorld.tiles[x][y];
        tile.targetMoisture = this.globalSetpoint;
      }
    }
  }

  toggleAiAutoPilot(enabled) {
    this.isAiAutoPilot = enabled;
  }
}
