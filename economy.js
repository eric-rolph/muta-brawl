class EconomyManager {
    constructor() {
        this.money = 1000;
        this.roster = [];
        this.loadGame();
    }

    addMoney(amount) {
        this.money += amount;
        this.updateUI();
        this.saveGame();
    }

    spendMoney(amount) {
        if (this.money >= amount) {
            this.money -= amount;
            this.updateUI();
            this.saveGame();
            return true;
        }
        return false;
    }

    addCreature(creature) {
        this.roster.push(creature);
        this.saveGame();
    }

    removeCreature(id) {
        this.roster = this.roster.filter(c => c.id !== id);
        this.saveGame();
    }

    saveGame() {
        const state = {
            money: this.money,
            roster: this.roster // Assuming JSON.stringify works fine with our class structure.
                                // We'll need to re-instantiate them on load.
        };
        localStorage.setItem('mutabrawl_save', JSON.stringify(state));
    }

    loadGame() {
        const saved = localStorage.getItem('mutabrawl_save');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.money = state.money || 1000;
                
                if (state.roster && state.roster.length > 0) {
                    this.roster = state.roster.map(cData => {
                        const c = new window.Genetics.Creature(cData.name);
                        c.id = cData.id;
                        c.parts = cData.parts; // Copy over parsed parts
                        c.recalculateStats();
                        return c;
                    });
                } else {
                    this.giveStarterCreature();
                }
            } catch (e) {
                console.error("Failed to load save", e);
                this.giveStarterCreature();
            }
        } else {
            this.giveStarterCreature();
        }
        this.updateUI();
    }

    giveStarterCreature() {
        const starter = new window.Genetics.Creature("Starter Scrapper", false, 'Normal');
        this.roster.push(starter);
        this.saveGame();
    }

    updateUI() {
        const moneyEl = document.getElementById('player-money');
        if (moneyEl) {
            moneyEl.innerText = this.money;
        }
    }

    scavenge(locationType) {
        // Costs some money to travel
        if (!this.spendMoney(50)) {
            return { success: false, message: "Not enough money to travel ($50 needed)." };
        }

        const chance = Math.random();
        let loot = [];
        
        if (chance > 0.3) {
            // Found a feral creature
            let element = 'Normal';
            if (locationType === 'toxic-swamp') element = 'Toxic';
            if (locationType === 'volcanic-crater') element = 'Volcanic';
            if (locationType === 'abandoned-facility') element = 'Cybernetic';

            const feral = new window.Genetics.Creature("Feral " + element, true, element);
            this.addCreature(feral);
            loot.push(`Found Feral Creature: ${feral.name}`);
        } else {
            // Found scrap/money
            const foundMoney = Math.floor(Math.random() * 200) + 50;
            this.addMoney(foundMoney);
            loot.push(`Found ${foundMoney} scrap/money!`);
        }

        return { success: true, loot: loot };
    }
}

window.Economy = new EconomyManager();
