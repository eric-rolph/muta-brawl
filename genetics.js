// Genetics and Creature Data Structures
const PART_TYPES = ['Head', 'Torso', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg', 'Tail'];

const ELEMENT_TYPES = ['Normal', 'Toxic', 'Volcanic', 'Cybernetic'];

const BASE_COLORS = {
    'Normal': '#cda37f',
    'Toxic': '#4caf50',
    'Volcanic': '#ff5722',
    'Cybernetic': '#9e9e9e'
};

class BodyPart {
    constructor(type, element = 'Normal') {
        this.type = type;
        this.element = element;
        this.generateStats();
    }

    generateStats() {
        const baseMult = Math.random() * 0.5 + 0.8; // 0.8 - 1.3
        
        this.hp = Math.floor(20 * baseMult);
        this.weight = Math.floor(10 * baseMult);
        this.damage = Math.floor(5 * baseMult);
        this.speed = Math.floor(5 * baseMult);
        
        // Element modifiers
        if (this.element === 'Toxic') { this.damage += 2; this.hp -= 2; }
        if (this.element === 'Volcanic') { this.hp += 5; this.weight += 3; }
        if (this.element === 'Cybernetic') { this.damage += 3; this.speed += 2; }

        // Part specific modifiers
        if (this.type === 'Torso') { this.hp *= 3; this.weight *= 2; this.damage = 0; }
        if (this.type === 'Head') { this.hp *= 1.5; this.damage = 1; }
        if (this.type.includes('Arm')) { this.damage *= 2.5; this.hp *= 0.8; }
        if (this.type.includes('Leg')) { this.speed *= 3; this.weight *= 1.5; this.damage *= 0.5; }
        
        this.hp = Math.max(1, Math.floor(this.hp));
        this.maxHp = this.hp;
        this.isSevered = false;
        
        this.color = this.tweakColor(BASE_COLORS[this.element]);
    }

    tweakColor(hex) {
        // Simple random color variation
        let r = parseInt(hex.slice(1,3), 16);
        let g = parseInt(hex.slice(3,5), 16);
        let b = parseInt(hex.slice(5,7), 16);
        
        r = Math.min(255, Math.max(0, r + Math.floor((Math.random() - 0.5) * 40)));
        g = Math.min(255, Math.max(0, g + Math.floor((Math.random() - 0.5) * 40)));
        b = Math.min(255, Math.max(0, b + Math.floor((Math.random() - 0.5) * 40)));
        
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }
}

class Creature {
    constructor(name, isFeral = false, dominantElement = 'Normal') {
        this.id = 'c_' + Math.random().toString(36).substr(2, 9);
        this.name = name || 'Mutt-' + Math.floor(Math.random() * 999);
        this.parts = {};
        
        PART_TYPES.forEach(type => {
            // Feral creatures might have mixed elements, but mostly dominant
            const el = Math.random() > 0.7 && isFeral ? 
                ELEMENT_TYPES[Math.floor(Math.random() * ELEMENT_TYPES.length)] : dominantElement;
            this.parts[type] = new BodyPart(type, el);
        });
        
        this.recalculateStats();
    }

    recalculateStats() {
        this.maxHp = 0;
        this.currentHp = 0;
        this.weight = 0;
        this.damage = 0;
        this.speed = 0;

        Object.values(this.parts).forEach(part => {
            if (!part.isSevered) {
                this.maxHp += part.maxHp;
                this.currentHp += part.hp;
                this.weight += part.weight;
                this.damage += part.damage;
                this.speed += part.speed;
            } else {
                this.weight += part.weight * 0.5; // Dead weight
            }
        });

        // Modifiers based on holistic build
        // E.g., Heavy weight reduces effective speed
        this.effectiveSpeed = Math.max(1, this.speed - (this.weight * 0.1));
    }

    heal() {
        Object.values(this.parts).forEach(part => {
            part.hp = part.maxHp;
            part.isSevered = false;
        });
        this.recalculateStats();
    }

    static breed(parent1, parent2) {
        const child = new Creature("Splice-" + Math.floor(Math.random() * 9999));
        
        // CRISPR Splicing Mechanic
        PART_TYPES.forEach(type => {
            const source = Math.random() > 0.5 ? parent1 : parent2;
            // Deep copy the part to avoid reference issues
            child.parts[type] = JSON.parse(JSON.stringify(source.parts[type]));
            
            // Mutation chance (Good or Bad)
            if (Math.random() < 0.15) {
                const mutationFactor = Math.random() * 1.0 + 0.5; // 0.5x to 1.5x stats
                child.parts[type].maxHp = Math.floor(child.parts[type].maxHp * mutationFactor);
                child.parts[type].hp = child.parts[type].maxHp;
                child.parts[type].damage = Math.floor(child.parts[type].damage * mutationFactor);
                child.parts[type].speed = Math.floor(child.parts[type].speed * mutationFactor);
                
                // Color mutation
                child.parts[type].color = '#'+Math.floor(Math.random()*16777215).toString(16);
            }
        });
        
        child.recalculateStats();
        return child;
    }
}

// Rendering Logic for Canvas
const GeneticsRenderer = {
    drawCreature: (ctx, creature, x, y, scale = 1, facingRight = true) => {
        ctx.save();
        ctx.translate(x, y);
        if (!facingRight) {
            ctx.scale(-1, 1);
        }
        ctx.scale(scale, scale);

        // Drawing order: Back Arm/Leg, Tail, Torso, Head, Front Arm/Leg
        
        const drawPart = (type, drawFn) => {
            const part = creature.parts[type];
            if (!part || part.isSevered) return;
            ctx.fillStyle = part.color;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            drawFn();
            ctx.fill();
            ctx.stroke();
        };

        // Tail
        drawPart('Tail', () => {
            ctx.beginPath();
            ctx.moveTo(-20, 10);
            ctx.quadraticCurveTo(-50, 40, -40, 60);
            ctx.quadraticCurveTo(-30, 30, -15, 20);
            ctx.closePath();
        });

        // Left Arm (Back)
        drawPart('LeftArm', () => {
            ctx.beginPath();
            ctx.roundRect(-15, -10, 15, 45, 8);
        });

        // Left Leg (Back)
        drawPart('LeftLeg', () => {
            ctx.beginPath();
            ctx.roundRect(-10, 20, 20, 40, 10);
        });

        // Torso
        drawPart('Torso', () => {
            ctx.beginPath();
            ctx.ellipse(0, 5, 25, 35, 0, 0, Math.PI * 2);
        });

        // Head
        drawPart('Head', () => {
            ctx.beginPath();
            ctx.arc(5, -35, 20, 0, Math.PI * 2);
            // Eye
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.fillStyle = 'red';
            ctx.arc(12, -38, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // Right Leg (Front)
        drawPart('RightLeg', () => {
            ctx.beginPath();
            ctx.roundRect(-5, 25, 22, 45, 10);
        });

        // Right Arm (Front)
        drawPart('RightArm', () => {
            ctx.beginPath();
            ctx.roundRect(-5, -5, 18, 50, 8);
            
            // Claw/Fist
            ctx.moveTo(5, 45);
            ctx.arc(4, 50, 10, 0, Math.PI * 2);
        });

        ctx.restore();
    }
};

window.Genetics = { Creature, BodyPart, GeneticsRenderer, PART_TYPES };
