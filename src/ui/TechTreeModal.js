import { TECH_NODES } from '../config.js';

export class TechTreeModal {
  constructor(gameState, audioManager) {
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.modalEl = document.getElementById('tech-modal');
    this.containerEl = document.getElementById('tech-tree-container');

    this.initEvents();
  }

  initEvents() {
    document.getElementById('btn-tech-modal').addEventListener('click', () => {
      this.open();
    });

    document.querySelectorAll('[data-close="tech-modal"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
  }

  open() {
    this.audioManager.playClick();
    this.render();
    this.modalEl.style.display = 'flex';
  }

  close() {
    this.audioManager.playClick();
    this.modalEl.style.display = 'none';
  }

  render() {
    this.containerEl.innerHTML = '';

    TECH_NODES.forEach(tech => {
      const isUnlocked = this.gameState.isTechUnlocked(tech.id);
      
      // Prerequisites tekshirish
      const prereqsMet = tech.prerequisites.every(p => this.gameState.isTechUnlocked(p));
      const hasEco = this.gameState.resources.ecoScore >= tech.ecoRequirement;
      const hasBudget = this.gameState.resources.budget >= tech.cost;
      const isAvailable = !isUnlocked && prereqsMet && hasEco;

      const card = document.createElement('div');
      card.className = `tech-card ${isUnlocked ? 'unlocked' : (isAvailable ? 'available' : '')}`;

      card.innerHTML = `
        <div class="tech-title">
          <span>${tech.name}</span>
          <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1);">
            ${tech.tier}-bosqich
          </span>
        </div>
        <div class="tech-desc">${tech.description}</div>
        
        <div style="font-size: 10px; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px;">
          <div>Mablag': <strong style="color: var(--yellow-accent);">$${tech.cost}</strong></div>
          <div>Kerakli Eko-Ball: <strong style="color: ${hasEco ? 'var(--green-accent)' : 'var(--red-accent)'};">${tech.ecoRequirement}%</strong></div>
        </div>

        <div class="tech-footer">
          ${isUnlocked 
            ? `<span style="color: var(--green-accent); font-weight: 700; font-size: 11px;">✅ Ochiq</span>`
            : `<button class="action-btn btn-unlock-tech" data-id="${tech.id}" ${!isAvailable ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                Ochish ($${tech.cost})
               </button>`
          }
        </div>
      `;

      this.containerEl.appendChild(card);
    });

    // Tugmalarga hodisalar ulash
    this.containerEl.querySelectorAll('.btn-unlock-tech').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const node = TECH_NODES.find(t => t.id === id);
        if (node) {
          const success = this.gameState.unlockTech(node.id, node.cost, node.ecoRequirement);
          if (success) {
            this.audioManager.playHarvest();
            this.render();
          }
        }
      });
    });
  }
}
