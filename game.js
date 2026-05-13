class GameManager {
    constructor() {
        this.economy = window.Economy;
        this.combatEngine = new window.CombatEngine('combat-canvas');
        
        this.selectedLabCreatures = [];
        this.currentView = 'lab';
        
        this.currentBetAmount = 0;
        this.currentBetSide = null;
        this.currentMatch = null;

        this.initBindings();
        this.updateLabView();
        
        window.addEventListener('showNotification', (e) => this.showNotification(e.detail.msg, e.detail.type));
    }

    initBindings() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });

        // Map
        document.querySelectorAll('.location-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.scavengeLocation(e.currentTarget.dataset.loc));
        });
        document.getElementById('close-scavenge-btn').addEventListener('click', () => {
            document.getElementById('scavenge-results').classList.add('hidden');
        });

        // Lab
        document.getElementById('breed-btn').addEventListener('click', () => this.breedSelected());
        document.getElementById('heal-btn').addEventListener('click', () => this.healSelected());

        // Arena
        document.getElementById('bet-left-btn').addEventListener('click', () => this.selectBetSide('left'));
        document.getElementById('bet-right-btn').addEventListener('click', () => this.selectBetSide('right'));
        document.getElementById('confirm-bet-btn').addEventListener('click', () => this.confirmBet());
        document.getElementById('next-match-btn').addEventListener('click', () => this.resetArena());
        document.getElementById('coach-ability-btn').addEventListener('click', () => this.useCoachAbility());

        // Initial matches
        this.generateMatches();
    }

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-' + viewId).classList.remove('hidden');
        
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.nav-btn[data-view="${viewId}"]`).classList.add('active');

        this.currentView = viewId;
        if (viewId === 'lab') this.updateLabView();
        if (viewId === 'arena' && !this.combatEngine.isRunning) this.generateMatches();
    }

    // --- MAP LOGIC ---
    scavengeLocation(loc) {
        const result = this.economy.scavenge(loc);
        if (!result.success) {
            this.showNotification(result.message, 'danger');
            return;
        }

        const list = document.getElementById('scavenge-loot-list');
        list.innerHTML = '';
        result.loot.forEach(item => {
            const li = document.createElement('li');
            li.innerText = item;
            list.appendChild(li);
        });
        document.getElementById('scavenge-results').classList.remove('hidden');
    }

    // --- LAB LOGIC ---
    updateLabView() {
        const list = document.getElementById('creature-list');
        list.innerHTML = '';
        
        this.economy.roster.forEach(creature => {
            const div = document.createElement('div');
            div.className = 'creature-card' + (this.selectedLabCreatures.includes(creature) ? ' selected' : '');
            
            div.innerHTML = `
                <div>
                    <strong>${creature.name}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted)">HP: ${Math.floor(creature.currentHp)}/${creature.maxHp} | Dmg: ${creature.damage}</div>
                </div>
                <div style="width: 15px; height: 15px; border-radius: 50%; background: ${creature.parts['Torso'].color}"></div>
            `;
            
            div.addEventListener('click', () => this.toggleLabSelection(creature));
            list.appendChild(div);
        });

        const breedBtn = document.getElementById('breed-btn');
        breedBtn.disabled = this.selectedLabCreatures.length !== 2;
        
        const healBtn = document.getElementById('heal-btn');
        healBtn.disabled = this.selectedLabCreatures.length !== 1;

        if (this.selectedLabCreatures.length > 0) {
            this.drawCreatureDetails(this.selectedLabCreatures[this.selectedLabCreatures.length - 1]);
        } else {
            this.clearCreatureDetails();
        }
    }

    toggleLabSelection(creature) {
        const index = this.selectedLabCreatures.indexOf(creature);
        if (index > -1) {
            this.selectedLabCreatures.splice(index, 1);
        } else {
            if (this.selectedLabCreatures.length >= 2) {
                this.selectedLabCreatures.shift(); // Keep max 2 selected
            }
            this.selectedLabCreatures.push(creature);
        }
        this.updateLabView();
    }

    drawCreatureDetails(creature) {
        const canvas = document.getElementById('creature-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        window.Genetics.GeneticsRenderer.drawCreature(ctx, creature, canvas.width/2, canvas.height/2 + 20, 2, true);

        const statsDiv = document.getElementById('creature-stats');
        statsDiv.innerHTML = `
            <div class="stat-row"><span>Health</span><span>${Math.floor(creature.currentHp)} / ${creature.maxHp}</span></div>
            <div class="stat-row"><span>Damage</span><span>${creature.damage}</span></div>
            <div class="stat-row"><span>Speed</span><span>${creature.effectiveSpeed}</span></div>
            <div class="stat-row"><span>Weight</span><span>${creature.weight}</span></div>
        `;

        const partsDiv = document.getElementById('creature-parts');
        partsDiv.innerHTML = '';
        window.Genetics.PART_TYPES.forEach(type => {
            const part = creature.parts[type];
            if (part) {
                const p = document.createElement('div');
                p.className = 'part-card';
                p.style.borderColor = part.color;
                p.innerHTML = `
                    <strong>${type}</strong><br>
                    Element: ${part.element}<br>
                    HP: ${Math.floor(part.hp)}/${part.maxHp}
                    ${part.isSevered ? '<br><span style="color:var(--danger)">SEVERED</span>' : ''}
                `;
                partsDiv.appendChild(p);
            }
        });
    }

    clearCreatureDetails() {
        const canvas = document.getElementById('creature-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.getElementById('creature-stats').innerHTML = '';
        document.getElementById('creature-parts').innerHTML = '';
    }

    breedSelected() {
        if (this.selectedLabCreatures.length !== 2) return;
        if (!this.economy.spendMoney(200)) {
            this.showNotification("Not enough money to breed ($200 needed)", "danger");
            return;
        }

        const child = window.Genetics.Creature.breed(this.selectedLabCreatures[0], this.selectedLabCreatures[1]);
        this.economy.addCreature(child);
        this.showNotification(`New creature spliced: ${child.name}!`, "success");
        this.selectedLabCreatures = [child];
        this.updateLabView();
    }

    healSelected() {
        if (this.selectedLabCreatures.length !== 1) return;
        if (!this.economy.spendMoney(50)) {
            this.showNotification("Not enough money to heal ($50 needed)", "danger");
            return;
        }

        this.selectedLabCreatures[0].heal();
        this.economy.saveGame();
        this.updateLabView();
        this.showNotification("Creature fully healed!", "success");
    }

    // --- ARENA LOGIC ---
    generateMatches() {
        const list = document.getElementById('match-list');
        list.innerHTML = '';
        
        // Generate AI vs AI matches
        for(let i=0; i<3; i++) {
            const elements = window.Genetics.ELEMENT_TYPES;
            const el1 = elements[Math.floor(Math.random()*elements.length)];
            const el2 = elements[Math.floor(Math.random()*elements.length)];
            
            const match = {
                id: i,
                f1: new window.Genetics.Creature(`Fighter ${Math.floor(Math.random()*100)}`, true, el1),
                f2: new window.Genetics.Creature(`Fighter ${Math.floor(Math.random()*100)}`, true, el2),
                odds1: (Math.random() * 1.5 + 1.1).toFixed(1),
                odds2: (Math.random() * 1.5 + 1.1).toFixed(1),
            };

            const div = document.createElement('div');
            div.className = 'match-card';
            div.innerHTML = `<strong>${match.f1.name}</strong> vs <strong>${match.f2.name}</strong>`;
            div.addEventListener('click', () => this.selectMatch(match, div));
            list.appendChild(div);
        }
    }

    selectMatch(match, element) {
        document.querySelectorAll('.match-card').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        this.currentMatch = match;
        
        const ui = document.getElementById('betting-interface');
        ui.classList.remove('hidden');
        
        document.getElementById('bet-left-btn').innerText = `${match.f1.name} (${match.odds1}x)`;
        document.getElementById('bet-right-btn').innerText = `${match.f2.name} (${match.odds2}x)`;
        
        this.currentBetSide = null;
        document.querySelectorAll('.bet-btn').forEach(btn => btn.classList.remove('selected'));
    }

    selectBetSide(side) {
        this.currentBetSide = side;
        document.querySelectorAll('.bet-btn').forEach(btn => btn.classList.remove('selected'));
        document.getElementById(`bet-${side}-btn`).classList.add('selected');
    }

    confirmBet() {
        if (!this.currentMatch || !this.currentBetSide) {
            this.showNotification("Select a match and a side to bet on.", "danger");
            return;
        }

        const amt = parseInt(document.getElementById('bet-amount').value);
        if (isNaN(amt) || amt <= 0) return;

        if (!this.economy.spendMoney(amt)) {
            this.showNotification("Not enough money!", "danger");
            return;
        }

        this.currentBetAmount = amt;
        
        // Hide betting interface, start match
        document.getElementById('betting-interface').classList.add('hidden');
        document.getElementById('match-list').classList.add('hidden');
        document.querySelector('.betting-panel h3').innerText = "Match in Progress...";

        this.combatEngine.startMatch(this.currentMatch.f1, this.currentMatch.f2, (winnerSide) => this.handleMatchEnd(winnerSide));
        
        document.getElementById('coach-ability-btn').disabled = false;
    }

    useCoachAbility() {
        // Boost selected fighter (simulated coach ability)
        if (this.currentBetSide && this.combatEngine.fighters.length === 2) {
            const target = this.currentBetSide === 'left' ? this.combatEngine.fighters[0] : this.combatEngine.fighters[1];
            target.creature.currentHp = Math.min(target.creature.maxHp, target.creature.currentHp + 20);
            target.cooldown = 0; // Reset cooldown for immediate attack
            this.showNotification("Adrenaline injected!", "success");
            
            document.getElementById('coach-ability-btn').disabled = true;
            
            // Visual effect
            const hud = document.querySelector(`.fighter-hud.${this.currentBetSide}`);
            hud.style.boxShadow = "0 0 20px var(--primary)";
            setTimeout(() => { hud.style.boxShadow = "none"; }, 1000);
        }
    }

    handleMatchEnd(winnerSide) {
        document.getElementById('coach-ability-btn').disabled = true;
        const resDiv = document.getElementById('combat-results');
        resDiv.classList.remove('hidden');

        const winnerName = winnerSide === 'left' ? this.currentMatch.f1.name : this.currentMatch.f2.name;
        document.getElementById('combat-winner-text').innerText = `${winnerName} Wins!`;

        if (winnerSide === this.currentBetSide) {
            const odds = winnerSide === 'left' ? this.currentMatch.odds1 : this.currentMatch.odds2;
            const winnings = Math.floor(this.currentBetAmount * parseFloat(odds));
            this.economy.addMoney(winnings);
            document.getElementById('bet-result-text').innerText = `You won $${winnings}!`;
            document.getElementById('bet-result-text').style.color = 'var(--success)';
        } else {
            document.getElementById('bet-result-text').innerText = `You lost $${this.currentBetAmount}.`;
            document.getElementById('bet-result-text').style.color = 'var(--danger)';
        }
    }

    resetArena() {
        document.getElementById('combat-results').classList.add('hidden');
        document.querySelector('.betting-panel h3').innerText = "Upcoming Matches";
        document.getElementById('match-list').classList.remove('hidden');
        
        const canvas = document.getElementById('combat-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        this.generateMatches();
    }

    showNotification(msg, type='info') {
        const container = document.getElementById('notification-container');
        const notif = document.createElement('div');
        notif.className = 'notification';
        if (type === 'danger') notif.style.borderLeftColor = 'var(--danger)';
        if (type === 'success') notif.style.borderLeftColor = 'var(--success)';
        
        notif.innerText = msg;
        container.appendChild(notif);
        
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }
}

// Init game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.Game = new GameManager();
});
