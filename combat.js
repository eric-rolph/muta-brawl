class CombatEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.isRunning = false;
        
        this.fighters = [];
        this.onMatchEnd = null;
    }

    startMatch(fighter1, fighter2, onMatchEndCallback) {
        // Clone fighters for the arena so we don't permadeath roster unless intended
        // Wait, the prompt says "Destructible anatomy: In a fight, body parts can be damaged...".
        // Let's use the actual objects so damage persists, requiring healing!
        
        this.fighters = [
            {
                creature: fighter1,
                x: 100,
                y: this.height - 100, // Ground level roughly
                vx: 0,
                vy: 0,
                facingRight: true,
                state: 'idle', // idle, attack, hit, dead
                cooldown: 0,
                side: 'left'
            },
            {
                creature: fighter2,
                x: this.width - 100,
                y: this.height - 100,
                vx: 0,
                vy: 0,
                facingRight: false,
                state: 'idle',
                cooldown: 0,
                side: 'right'
            }
        ];

        fighter1.recalculateStats();
        fighter2.recalculateStats();

        this.updateHUD();
        this.onMatchEnd = onMatchEndCallback;
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    stopMatch() {
        this.isRunning = false;
    }

    loop(currentTime) {
        if (!this.isRunning) return;
        
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        this.update(dt);
        this.draw();

        if (this.isRunning) {
            requestAnimationFrame((t) => this.loop(t));
        }
    }

    update(dt) {
        const f1 = this.fighters[0];
        const f2 = this.fighters[1];

        // Check Win Conditions
        if (this.checkWinCondition()) return;

        // Gravity and Physics
        this.fighters.forEach(f => {
            f.vy += 900 * dt; // Gravity
            f.y += f.vy * dt;
            f.x += f.vx * dt;

            // Ground collision
            if (f.y > this.height - 50) {
                f.y = this.height - 50;
                f.vy = 0;
                // Friction
                f.vx *= 0.8;
            }

            // Cooldown reduction
            if (f.cooldown > 0) f.cooldown -= dt;
        });

        // AI Logic
        this.processAI(f1, f2, dt);
        this.processAI(f2, f1, dt);

        // Update HUD
        this.updateHUD();
    }

    processAI(attacker, defender, dt) {
        if (attacker.creature.currentHp <= 0 || attacker.state === 'dead') return;
        
        const dist = Math.abs(attacker.x - defender.x);
        const attackRange = 80;

        // Face opponent
        attacker.facingRight = attacker.x < defender.x;

        if (dist > attackRange) {
            // Move towards
            const speedMod = attacker.creature.effectiveSpeed;
            const moveSpeed = 100 + (speedMod * 5);
            attacker.vx = attacker.facingRight ? moveSpeed : -moveSpeed;
            attacker.state = 'move';
        } else {
            attacker.vx = 0;
            if (attacker.cooldown <= 0) {
                this.executeAttack(attacker, defender);
            } else {
                attacker.state = 'idle';
            }
        }
    }

    executeAttack(attacker, defender) {
        attacker.state = 'attack';
        attacker.cooldown = 1.0 + (Math.random() * 0.5); // 1-1.5s cooldown
        
        // Attack animation jump
        attacker.vy = -150;
        attacker.vx = attacker.facingRight ? 100 : -100;

        // Calculate damage
        const dmg = attacker.creature.damage * (Math.random() * 0.5 + 0.8);
        
        // Find random non-severed part to hit
        const parts = Object.values(defender.creature.parts).filter(p => !p.isSevered);
        if (parts.length === 0) return;

        const targetPart = parts[Math.floor(Math.random() * parts.length)];
        
        targetPart.hp -= dmg;
        defender.creature.currentHp -= dmg;
        defender.state = 'hit';
        
        // Knockback
        defender.vx = attacker.facingRight ? 300 : -300;
        defender.vy = -200;

        // Part severing logic
        if (targetPart.hp <= 0 && targetPart.type !== 'Torso' && targetPart.type !== 'Head') {
            targetPart.hp = 0;
            targetPart.isSevered = true;
            this.showNotification(`${defender.creature.name}'s ${targetPart.type} was severed!`, 'danger');
        }

        defender.creature.recalculateStats();

        // Create hit effect (simple screen shake or particles ideally, keeping it simple for now)
    }

    checkWinCondition() {
        const f1 = this.fighters[0];
        const f2 = this.fighters[1];

        let winner = null;

        // 1. Knockout (Torso/Head or overall HP)
        if (f1.creature.currentHp <= 0 || f1.creature.parts['Torso'].hp <= 0 || f1.creature.parts['Head'].hp <= 0) {
            f1.state = 'dead';
            winner = f2;
        } else if (f2.creature.currentHp <= 0 || f2.creature.parts['Torso'].hp <= 0 || f2.creature.parts['Head'].hp <= 0) {
            f2.state = 'dead';
            winner = f1;
        }

        // 2. Ring out
        if (f1.x < -50 || f1.x > this.width + 50) {
            f1.state = 'dead';
            winner = f2;
        } else if (f2.x < -50 || f2.x > this.width + 50) {
            f2.state = 'dead';
            winner = f1;
        }

        if (winner) {
            this.isRunning = false;
            setTimeout(() => {
                if (this.onMatchEnd) this.onMatchEnd(winner.side);
            }, 1000);
            return true;
        }
        return false;
    }

    draw() {
        // Clear background
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw Arena Grid/Floor
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height - 50);
        this.ctx.lineTo(this.width, this.height - 50);
        this.ctx.stroke();

        // Draw Fighters
        this.fighters.forEach(f => {
            if (f.state === 'dead') return;
            
            // Simple bounce animation based on state
            let yOffset = 0;
            if (f.state === 'move') {
                yOffset = Math.sin(performance.now() / 100) * 10;
            }

            window.Genetics.GeneticsRenderer.drawCreature(
                this.ctx, 
                f.creature, 
                f.x, 
                f.y + yOffset, 
                1.5, 
                f.facingRight
            );
        });
    }

    updateHUD() {
        const f1 = this.fighters[0].creature;
        const f2 = this.fighters[1].creature;

        document.getElementById('fighter-1-name').innerText = f1.name;
        document.getElementById('fighter-2-name').innerText = f2.name;

        const pct1 = Math.max(0, (f1.currentHp / f1.maxHp) * 100);
        const pct2 = Math.max(0, (f2.currentHp / f2.maxHp) * 100);

        document.getElementById('fighter-1-hp').style.width = pct1 + '%';
        document.getElementById('fighter-2-hp').style.width = pct2 + '%';
        
        if (pct1 < 30) document.getElementById('fighter-1-hp').style.backgroundColor = 'var(--danger)';
        else document.getElementById('fighter-1-hp').style.backgroundColor = 'var(--success)';
        
        if (pct2 < 30) document.getElementById('fighter-2-hp').style.backgroundColor = 'var(--danger)';
        else document.getElementById('fighter-2-hp').style.backgroundColor = 'var(--success)';
    }

    showNotification(msg, type='info') {
        // Dispatch custom event to be handled by game.js
        window.dispatchEvent(new CustomEvent('showNotification', { detail: { msg, type } }));
    }
}

window.CombatEngine = CombatEngine;
