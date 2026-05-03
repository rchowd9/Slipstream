const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1024;
canvas.height = 576;

const GRAVITY = 0.7;
const DASH_DURATION = 200;
const RECOVERY_TIME = 300;

const timerElement = document.getElementById('timer');
let secondsRemain = 60;
let timerInterval;
let gameRunning = true;

class Player 
{
    constructor({ position, color, offset, isPlayer2 = false })
    {
        this.position = position;
        this.velocity = { x: 0, y: 0};
        this.width = 50;
        this.height = 150;
        this.color = color;
        this.isPlayer2 = isPlayer2;

        this.state = 'NEUTRAL';
        this.isIntangible = false;
        this.health = 100;
    }

    takeDamage(amount)
    {
        this.health -= amount;
        if (this.health < 0) this.health = 0;

        const id = this.isPlayer2 ? 'player2-health' : 'player1-health';
        const healthBar = document.getElementById(id);
        if (healthBar) healthBar.style.width = this.health + '%';
    }

    draw() 
    {
        if (this.state === 'SLIPSTREAM') 
        {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = 'white';
        } 
        else if (this.state === 'RECOVERY') 
        {
            ctx.fillStyle = 'gray';
        } 
        else 
        {
            ctx.fillStyle = this.color;
        }

        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
        ctx.globalAlpha = 1.0;
    }

    update() 
    {
        this.draw();

        if (gameRunning) 
        {
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
        }

        if (this.position.x < 0) 
        {
            this.position.x = 0;
        }

        if (this.position.x + this.width > canvas.width) 
        {
            this.position.x = canvas.width - this.width;
        }

        if (this.position.y + this.height + this.velocity.y >= canvas.height - 60) 
        {
            this.velocity.y = 0;
            this.position.y = canvas.height - 60 - this.height;
        } 
        
        else 
        {
            this.velocity.y += GRAVITY;
        }
    }

    dash(direction) 
    {
        if (this.state !== 'NEUTRAL' || !gameRunning) 
        {
            return;
        }

        this.state = 'SLIPSTREAM';
        this.isIntangible = true;
        this.velocity.x = direction * 20;

        setTimeout(() => {
            this.velocity.x = 0;
            this.isIntangible = false;
            this.state = 'RECOVERY';

            setTimeout(() => {
                this.state = 'NEUTRAL';
            }, RECOVERY_TIME);
        }, DASH_DURATION);
    }
}

const player1 = new Player ({
    position: { x: 100, y: 0},
    color: '#3498db'

});

const player2 = new Player ({
    position: {x: 800, y: 0},
    color: '#e74c3c',
    isPlayer2: true
});

const overlay = document.getElementById('message-overlay');

function startTimer()
{
    timerInterval = setInterval(() => {
        if (gameRunning) {
            secondsRemain--;
            timerElement.innerText = secondsRemain;

            if (secondsRemain <= 0)
            {
                clearInterval(timerInterval);
                endGame("TIME'S UP!");
            }
        }
    }, 1000);
}

function startingGame()
{
    overlay.classList.add('hidden');
    startTimer();
    animate();
}

function resetGame()
{
    gameRunning = true;
    secondsRemain = 60;
    timerElement.innerText = secondsRemain;

    player1.position = { x: 100, y: 0 };
    player1.velocity = { x: 0, y: 0 };
    player1.state = 'NEUTRAL';
    player1.health = 100;

    player2.position = { x: 800, y: 0 };
    player2.velocity = { x: 0, y: 0 };
    player2.state = 'NEUTRAL';
    player2.health = 100;

    document.getElementById('player1-health').style.width = '100%';
    document.getElementById('player2-health').style.width = '100%';

    overlay.classList.add('hidden');
    startTimer();
}


function endGame(message = 'GAME OVER')
{
    gameRunning = false;
    document.getElementById('status-message').innerText = message + "\nPress 'R' to Play Again";
    overlay.classList.remove('hidden');
    clearInterval(timerInterval);
}

window.addEventListener('keydown', ({ key }) => {
    if (!gameRunning && key === 'r') {
        resetGame();
        return;
    }

    if (!gameRunning) return;

    switch(key) {
        case 'd':
            player1.dash(1);
            break;
        case 'a':
            player1.dash(-1);
            break;
    }
});

function rectangleCollision({rectangle1, rectangle2})
{
    return (
        rectangle1.position.x + rectangle1.width >= rectangle2.position.x &&
        rectangle1.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.position.y + rectangle1.height >= rectangle2.position.y &&
        rectangle1.position.y <= rectangle2.position.y + rectangle2.height
    );
}

function updatingAI() {
    if (player2.state !== 'NEUTRAL') return;

    const distance = player2.position.x - player1.position.x;
    const absDistance = Math.abs(distance);
    
   
    const detectionRange = 600; 
    if (absDistance > detectionRange) {
        player2.velocity.x = 0;
        return;
    }

    
    if (absDistance <= 300 && absDistance >= 150) {
        if (Math.random() < 0.02) {
            const direction = distance > 0 ? -1 : 1;
            player2.dash(direction);
        } else {
            player2.velocity.x = 0;
        }
    }

    
    else if (absDistance < 150) {
        const direction = distance > 0 ? 1 : -1;
        player2.dash(direction);
    }
    
    else if (absDistance > 300) {
        player2.velocity.x = distance > 0 ? -2 : 2;
    }
}

function animate()
{
    window.requestAnimationFrame(animate);

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#333';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

    
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, canvas.height - 60, canvas.width, 1);

    player1.update();
    player2.update();

    if (gameRunning) {
        updatingAI();

        if (rectangleCollision({ rectangle1: player1, rectangle2: player2 }) &&
            player1.state === 'SLIPSTREAM' && !player2.isIntangible) {
            player2.takeDamage(100);
            endGame("PLAYER 1 WINS");
        }

        if (rectangleCollision({ rectangle1: player2, rectangle2: player1 }) &&
            player2.state === 'SLIPSTREAM' && !player1.isIntangible) {
            player1.takeDamage(100);
            endGame("AI WINS");
        }
    }

}

setTimeout(startingGame, 1500);
