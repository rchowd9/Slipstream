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
    }

    draw() 
    {
        if (this.state === 'SLIPSTREAM') {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = 'white';
        } else if (this.state === 'RECOVERY') {
            ctx.fillStyle = 'gray';
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
        ctx.globalAlpha = 1.0;
    }

    update() 
    {
        this.draw();
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

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
        if (this.state !== 'NEUTRAL') 
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
        secondsRemain--;
        timerElement.innerText = secondsRemain; 

        if (secondsRemain <= 0)
        {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000);
}

function startingGame()
{
    overlay.classList.add('hidden');
    startTimer();
    animate();
}

function endGame()
{
    document.getElementById('status-message').innerText = 'TIMES UP';
    overlay.classList.remove('hidden');
    player1.state = 'RECOVERY';
    player2.state = 'RECOVERY';
}

window.addEventListener('keydown', ({ key}) => {
    switch(key) {
        case 'd':
            player1.dash(1);
            break;
        case 'a':
            player1.dash(-1);
            break;

        case 'ArrowRight':
            player2.dash(1);
            break;

        case 'ArrowLeft':
            player2.dash(-1);
            break;
    }
});

function animate()
{
    window.requestAnimationFrame(animate);

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    player1.update();
    player2.update();

    if (
        rectangleCollision({ rectangle1: player1, rectangle2: player2 }) &&
        player1.state === 'SLIPSTREAM' && !player2.isIntangible
    ) {
        console.log('Player 1 Hit!');
        document.getElementById('player2-health').style.width = '0%';
    }

    if (
        rectangleCollision({ rectangle1: player2, rectangle2: player1 }) &&
        player2.state === 'SLIPSTREAM' && !player1.isIntangible
    ) {
        console.log('Player 2 Hit!');
        document.getElementById('player1-health').style.width = '0%';
    }
}

setTimeout(startingGame, 1500);
