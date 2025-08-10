// Host interface JavaScript functionality
const socket = io();
let gameState = {};
let finalJudgments = {};
let sessionId = null;
let hostPassword = null;
let isConnected = false;

// Socket connection handlers
socket.on('connect', () => {
    console.log('Host connected to game server');
    isConnected = true;
    
    // If we have credentials, try to join automatically
    if (sessionId && hostPassword) {
        socket.emit('join-as-host', { sessionId, hostPassword });
    }
});

socket.on('disconnect', () => {
    console.log('Host disconnected from game server');
    isConnected = false;
    showAuthError('Connection lost. Attempting to reconnect...');
});

socket.on('connect_error', (error) => {
    console.error('Host connection error:', error);
    isConnected = false;
    showAuthError('Failed to connect to game server. Please refresh the page.');
});

// Authentication and initialization
document.addEventListener('DOMContentLoaded', () => {
    sessionId = sessionStorage.getItem('sessionId');
    hostPassword = sessionStorage.getItem('hostPassword');
    
    if (!sessionId || !hostPassword) {
        showAuthError('No session credentials found. Please return to the main page.');
        return;
    }
    
    // If already connected, join immediately, otherwise wait for connection
    if (socket.connected) {
        socket.emit('join-as-host', { sessionId, hostPassword });
    }
    // The join will be automatically attempted when 'connect' event fires
});

function showAuthError(message) {
    document.getElementById('auth-check').classList.add('hidden');
    document.getElementById('auth-error-message').textContent = message;
    document.getElementById('auth-error').classList.remove('hidden');
}

function showGameInterface() {
    document.getElementById('auth-check').classList.add('hidden');
    document.getElementById('auth-error').classList.add('hidden');
    document.getElementById('game-interface').classList.remove('hidden');
    document.getElementById('current-session-id').textContent = sessionId;
}

// Socket event handlers
socket.on('auth-error', (message) => {
    showAuthError(message);
});

socket.on('host-joined', (data) => {
    gameState = data.gameState;
    showGameInterface();
    updateContestantsList(data.contestants);
    updateBoard();
    updateGamePhase();
    
    // Handle AI feature availability
    const generateBtn = document.querySelector('button[onclick="generateNewQuestions()"]');
    if (generateBtn) {
        if (!data.aiEnabled) {
            generateBtn.disabled = true;
            generateBtn.title = 'OpenAI API key not configured';
            generateBtn.textContent = '🤖 AI Not Available';
            generateBtn.style.opacity = '0.5';
        } else {
            generateBtn.disabled = false;
            generateBtn.title = 'Generate new questions using AI';
        }
    }
});

socket.on('contestant-list-updated', (contestants) => {
    gameState.contestants = contestants;
    updateContestantsList(contestants);
});

socket.on('question-selected', (question) => {
    showCurrentQuestion(question);
});

socket.on('contestant-buzzed', (data) => {
    showBuzzerInfo(data);
});

socket.on('answer-judged', (data) => {
    hideBuzzerInfo();
    
    // Update the contestant's score in the local gameState
    if (gameState.contestants && gameState.contestants[data.contestant.id]) {
        gameState.contestants[data.contestant.id].score = data.contestant.score;
    }
    
    updateContestantsList(gameState.contestants);
    if (data.correct) {
        hideCurrentQuestion();
    }
    // Always update the board to reflect answered questions
    updateBoard();
});

socket.on('game-state-updated', (newGameState) => {
    gameState = newGameState;
    updateGamePhase();
    updateBoard(); // Ensure board updates when game state changes
});

socket.on('daily-double-wager-set', (data) => {
    hideDailyDoubleControls();
    showAnswerControls();
});

socket.on('final-jeopardy-started', (question) => {
    showFinalJeopardy(question);
});

socket.on('final-jeopardy-wager-received', (data) => {
    updateFinalWagers(data);
});

socket.on('game-reset', (newGameState) => {
    gameState = newGameState;
    updateContestantsList(gameState.contestants);
    updateBoard();
    hideCurrentQuestion();
    hideFinalJeopardy();
    updateGamePhase();
});

// New question generation handlers
socket.on('questions-generating', (data) => {
    showGenerationStatus(data.status, 'generating');
});

socket.on('questions-generated', (data) => {
    showGenerationStatus(data.status, 'success');
    gameState = data.gameState;
    updateContestantsList(gameState.contestants);
    updateBoard();
    hideCurrentQuestion();
    hideFinalJeopardy();
    updateGamePhase();
    
    // Hide status after 3 seconds
    setTimeout(() => {
        hideGenerationStatus();
    }, 3000);
});

socket.on('questions-generation-error', (data) => {
    showGenerationStatus(`Error: ${data.error}`, 'error');
    
    // Hide status after 5 seconds
    setTimeout(() => {
        hideGenerationStatus();
    }, 5000);
});

// UI update functions
function updateContestantsList(contestants) {
    const list = document.getElementById('contestants-list');
    if (Object.keys(contestants).length === 0) {
        list.innerHTML = '<p>No contestants connected yet...</p>';
        return;
    }
    
    list.innerHTML = '';
    Object.values(contestants).forEach(contestant => {
        const div = document.createElement('div');
        div.className = 'contestant-item';
        div.innerHTML = `
            <div class="contestant-info">
                <div class="contestant-name">${contestant.name}</div>
                <div class="contestant-ip">IP: ${contestant.ipAddress}</div>
            </div>
            <div class="contestant-score">$${contestant.score}</div>
        `;
        list.appendChild(div);
    });
}

function updateBoard() {
    const board = document.getElementById('jeopardy-board');
    board.innerHTML = '';
    
    // Add category headers
    gameState.categories.forEach(category => {
        const header = document.createElement('div');
        header.className = 'category-header';
        header.textContent = category;
        board.appendChild(header);
    });
    
    // Add question cells
    gameState.board.forEach((row, rowIndex) => {
        row.questions.forEach((question, colIndex) => {
            const cell = document.createElement('div');
            cell.className = `question-cell ${question.answered ? 'answered' : ''}`;
            if (question.isDailyDouble && !question.answered) {
                cell.classList.add('daily-double');
            }
            cell.textContent = question.answered ? '' : `$${row.price}`;
            if (!question.answered) {
                cell.onclick = () => selectQuestion(rowIndex, colIndex);
            }
            board.appendChild(cell);
        });
    });
}

function selectQuestion(row, col) {
    socket.emit('select-question', { row, col });
}

// Question display functions
function showCurrentQuestion(question) {
    const questionDiv = document.getElementById('current-question');
    const questionText = document.getElementById('question-text');
    const questionMeta = document.getElementById('question-meta');
    const answerText = document.getElementById('answer-text');
    const answerSection = document.getElementById('answer-section');
    const answerDisplay = document.getElementById('answer-display');
    
    questionText.textContent = question.text;
    answerText.textContent = question.answer || 'No answer provided';
    
    questionMeta.innerHTML = `
        <strong>Category:</strong> ${question.category} | 
        <strong>Value:</strong> $${question.value}
        ${question.isDailyDouble ? ' | <span style="color: gold;">⭐ DAILY DOUBLE ⭐</span>' : ''}
    `;
    
    questionDiv.classList.remove('hidden');
    answerSection.classList.remove('hidden');
    answerDisplay.classList.add('hidden'); // Hide answer initially
    
    // Reset show answer button
    const showAnswerBtn = document.querySelector('.show-answer-btn');
    showAnswerBtn.textContent = '📖 Show Answer';
    showAnswerBtn.onclick = showAnswer;
    
    if (question.isDailyDouble) {
        showDailyDoubleControls();
    } else {
        showAnswerControls();
    }
}

function hideCurrentQuestion() {
    document.getElementById('current-question').classList.add('hidden');
    document.getElementById('answer-section').classList.add('hidden');
    document.getElementById('answer-display').classList.add('hidden');
    hideAnswerControls();
    hideDailyDoubleControls();
}

function showAnswer() {
    const answerDisplay = document.getElementById('answer-display');
    const showAnswerBtn = document.querySelector('.show-answer-btn');
    
    if (answerDisplay.classList.contains('hidden')) {
        answerDisplay.classList.remove('hidden');
        showAnswerBtn.textContent = '📖 Hide Answer';
        showAnswerBtn.onclick = hideAnswer;
    }
}

function hideAnswer() {
    const answerDisplay = document.getElementById('answer-display');
    const showAnswerBtn = document.querySelector('.show-answer-btn');
    
    answerDisplay.classList.add('hidden');
    showAnswerBtn.textContent = '📖 Show Answer';
    showAnswerBtn.onclick = showAnswer;
}

// Buzzer and control functions
function showBuzzerInfo(data) {
    const buzzerInfo = document.getElementById('buzzer-info');
    const buzzerContestant = document.getElementById('buzzer-contestant');
    buzzerContestant.textContent = data.contestantName;
    buzzerInfo.classList.remove('hidden');
    showAnswerControls();
}

function hideBuzzerInfo() {
    document.getElementById('buzzer-info').classList.add('hidden');
}

function showAnswerControls() {
    document.getElementById('answer-controls').classList.remove('hidden');
}

function hideAnswerControls() {
    document.getElementById('answer-controls').classList.add('hidden');
}

function showDailyDoubleControls() {
    document.getElementById('daily-double-controls').classList.remove('hidden');
}

function hideDailyDoubleControls() {
    document.getElementById('daily-double-controls').classList.add('hidden');
}

function judgeAnswer(correct) {
    socket.emit('judge-answer', { correct });
    hideAnswerControls();
}

function updateGamePhase() {
    const phaseElement = document.getElementById('game-phase');
    const phases = {
        'waiting': 'Waiting for contestants',
        'playing': 'Playing',
        'daily-double': 'Daily Double',
        'final-jeopardy': 'Final Jeopardy'
    };
    phaseElement.textContent = phases[gameState.gamePhase] || gameState.gamePhase;
}

// Final Jeopardy functions
function startFinalJeopardy() {
    socket.emit('start-final-jeopardy');
}

function showFinalJeopardy(question) {
    const finalDiv = document.getElementById('final-jeopardy');
    const questionText = document.getElementById('final-question-text');
    questionText.innerHTML = `
        <strong>Category:</strong> ${question.category}<br>
        <strong>Question:</strong> ${question.text}
    `;
    finalDiv.classList.remove('hidden');
    document.getElementById('jeopardy-board').style.display = 'none';
}

function hideFinalJeopardy() {
    document.getElementById('final-jeopardy').classList.add('hidden');
    document.getElementById('jeopardy-board').style.display = 'grid';
}

function updateFinalWagers(data) {
    const wagersDiv = document.getElementById('final-wagers');
    const existingWager = document.getElementById(`wager-${data.contestant}`);
    
    if (!existingWager) {
        const wagerDiv = document.createElement('div');
        wagerDiv.id = `wager-${data.contestant}`;
        wagerDiv.innerHTML = `<strong>${data.contestant}:</strong> Wager submitted ($${data.wager})`;
        wagersDiv.appendChild(wagerDiv);
    }
    
    // Check if all contestants have wagered
    const totalContestants = Object.keys(gameState.contestants).length;
    const totalWagers = wagersDiv.children.length;
    
    if (totalWagers >= totalContestants) {
        showFinalJudging();
    }
}

function showFinalJudging() {
    const judgingDiv = document.getElementById('final-judging');
    const answersDiv = document.getElementById('final-answers');
    
    answersDiv.innerHTML = '';
    Object.values(gameState.contestants).forEach(contestant => {
        const answerDiv = document.createElement('div');
        answerDiv.innerHTML = `
            <div style="margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                <strong>${contestant.name}:</strong>
                <label>
                    <input type="radio" name="final-${contestant.id}" value="correct"> Correct
                </label>
                <label>
                    <input type="radio" name="final-${contestant.id}" value="incorrect"> Incorrect
                </label>
            </div>
        `;
        answersDiv.appendChild(answerDiv);
    });
    
    judgingDiv.classList.remove('hidden');
}

function submitFinalJudgment() {
    const answers = [];
    Object.keys(gameState.contestants).forEach(contestantId => {
        const radio = document.querySelector(`input[name="final-${contestantId}"]:checked`);
        if (radio) {
            answers.push({
                contestantId: contestantId,
                correct: radio.value === 'correct'
            });
        }
    });
    
    socket.emit('judge-final-jeopardy', { answers });
}

// Game management
function resetGame() {
    if (confirm('Are you sure you want to reset the game? This will clear all scores and reset the board.')) {
        socket.emit('reset-game');
    }
}

// New question generation
function generateNewQuestions() {
    if (confirm('Are you sure you want to generate new questions? This will replace all current questions and reset the game.')) {
        socket.emit('generate-new-questions');
    }
}

function showGenerationStatus(message, type) {
    const statusDiv = document.getElementById('generation-status');
    const messageSpan = document.getElementById('generation-message');
    
    messageSpan.textContent = message;
    statusDiv.classList.remove('hidden', 'success', 'error', 'generating');
    statusDiv.classList.add(type);
}

function hideGenerationStatus() {
    const statusDiv = document.getElementById('generation-status');
    statusDiv.classList.add('hidden');
}
