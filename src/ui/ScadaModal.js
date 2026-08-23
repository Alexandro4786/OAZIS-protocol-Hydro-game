export class ScadaModal {
  constructor(scadaEngine, gameState, audioManager) {
    this.scadaEngine = scadaEngine;
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.modalEl = document.getElementById('scada-modal');
    this.canvas = document.getElementById('scada-chart-moisture');
    this.ctx = this.canvas?.getContext('2d');
    
    this.isOpen = false;
    this.initEvents();
  }

  initEvents() {
    document.getElementById('btn-scada-modal')?.addEventListener('click', () => {
      this.open();
    });

    document.querySelectorAll('[data-close="scada-modal"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    const spSlider = document.getElementById('scada-sp-slider');
    const spVal = document.getElementById('scada-sp-val');
    spSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (spVal) spVal.innerText = `${val}%`;
      this.scadaEngine.setGlobalSetpoint(val);
    });

    const aiToggle = document.getElementById('scada-ai-toggle');
    aiToggle?.addEventListener('change', (e) => {
      this.scadaEngine.toggleAiAutoPilot(e.target.checked);
      this.gameState.emit('notify', {
        type: 'success',
        message: e.target.checked ? "AI Avto-Dozalash faollashtirildi!" : "AI Avto-Dozalash o'chirildi (Qo'lda boshqaruv)."
      });
    });
  }

  open() {
    this.audioManager.playClick();
    this.isOpen = true;
    this.modalEl.style.display = 'flex';
  }

  close() {
    this.audioManager.playClick();
    this.isOpen = false;
    this.modalEl.style.display = 'none';
  }

  update() {
    if (!this.isOpen || !this.ctx) return;
    this.drawChart();
  }

  drawChart() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    const data = this.scadaEngine.history;

    // Orqa fonni tozalash
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, 0, w, h);

    // To'r chiziqlari (Grid lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= 100; y += 25) {
      const py = h - (y / 100) * (h - 30) - 20;
      ctx.beginPath();
      ctx.moveTo(40, py);
      ctx.lineTo(w - 10, py);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${y}%`, 10, py + 3);
    }

    if (data.moistureAvg.length < 2) return;

    const count = data.moistureAvg.length;
    const stepX = (w - 60) / Math.max(1, count - 1);

    // 1. Setpoint chizig'i (Dashed Yellow)
    ctx.strokeStyle = '#ffea00';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const px = 45 + i * stepX;
      const py = h - (data.moistureTarget[i] / 100) * (h - 30) - 20;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // 2. Real Moisture chizig'i (Solid Green Glow)
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const px = 45 + i * stepX;
      const py = h - (data.moistureAvg[i] / 100) * (h - 30) - 20;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Oxirgi nuqtani belgilash
    const lastX = 45 + (count - 1) * stepX;
    const lastY = h - (data.moistureAvg[count - 1] / 100) * (h - 30) - 20;
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Legend
    ctx.fillStyle = '#00e676';
    ctx.fillText(`● Haqiqiy VWC: ${data.moistureAvg[count - 1]}%`, 50, 18);
    ctx.fillStyle = '#ffea00';
    ctx.fillText(`- - Setpoint: ${data.moistureTarget[count - 1]}%`, 220, 18);
  }
}
