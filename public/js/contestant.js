// Contestant interface JavaScript functionality
const socket = io();
let contestantId = null;
let gameState = {};
let canBuzz = false;
let sessionId = null;
let isConnected = false;

// Socket connection handlers
socket.on('connect', () => {
    console.log('Contestant connected to game server');
    isConnected = true;
    
    // If we have credentials, try to join automatically
    const contestantName = sessionStorage.getItem('contestantName');
    if (sessionId && contestantName) {
        socket.emit('join-as-contestant', { sessionId, contestantName });
    }
});

socket.on('disconnect', () => {
    console.log('Contestant disconnected from game server');
    isConnected = false;
    showStatus('Connection lost. Attempting to reconnect...', 'warning');
});

socket.on('connect_error', (error) => {
    console.error('Contestant connection error:', error);
    isConnected = false;
    showAuthError('Failed to connect to game server. Please refresh the page.');
});

// Authentication and initialization
document.addEventListener('DOMContentLoaded', () => {
    sessionId = sessionStorage.getItem('sessionId');
    const contestantName = sessionStorage.getItem('contestantName');
    
    if (!sessionId) {
        showAuthError('No session ID found. Please return to the main page and enter a valid session ID.');
        return;
    }
    
    if (!contestantName) {
        showAuthError('No name found. Please return to the main page and enter your name.');
        return;
    }
    
    // If already connected, join immediately, otherwise wait for connection
    if (socket.connected) {
        socket.emit('join-as-contestant', { sessionId, contestantName });
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

socket.on('disconnect', () => {
    showStatus('Connection lost. Attempting to reconnect...', 'warning');
});

socket.on('connect', () => {
    // If we were previously connected and have session data, try to reconnect
    if (contestantId && sessionId) {
        const contestantName = sessionStorage.getItem('contestantName');
        if (contestantName) {
            socket.emit('join-as-contestant', { sessionId, contestantName });
        }
    }
});

socket.on('contestant-joined', (data) => {
    contestantId = data.id;
    gameState = data.gameState;
    showGameInterface();
    updateBoard();
    updateContestantsList();
    updateContestantInfo();
    
    // Show reconnection message if applicable
    if (data.isReconnecting) {
        showStatus('Reconnected successfully! Your progress has been restored.', 'success');
        setTimeout(() => {
            hideStatus();
        }, 3000);
    }
});

socket.on('contestant-list-updated', (contestants) => {
    gameState.contestants = contestants;
    updateContestantsList();
    updateContestantInfo();
});

socket.on('question-selected', (question) => {
    showCurrentQuestion(question);
    if (question.isDailyDouble) {
        // Only the contestant who selected gets to wager
        // For now, allow any contestant to buzz first for daily double
        enableBuzzer();
    } else {
        enableBuzzer();
    }
});

socket.on('contestant-buzzed', (data) => {
    if (data.contestantId === contestantId) {
        showStatus('You buzzed in! Waiting for host judgment...', 'info');
        if (gameState.currentQuestion && gameState.currentQuestion.isDailyDouble) {
            showDailyDoubleWager();
        }
    } else {
        showStatus(`${data.contestantName} buzzed in first!`, 'warning');
    }
    disableBuzzer();
});

socket.on('answer-judged', (data) => {
    hideStatus();
    
    // Update the contestant's score in the local gameState
    if (gameState.contestants && gameState.contestants[data.contestant.id]) {
        gameState.contestants[data.contestant.id].score = data.contestant.score;
    }
    
    if (data.correct) {
        showStatus('Answer was correct!', 'success');
        hideCurrentQuestion();
        // Update the board to show the question as answered
        updateBoard();
    } else {
        if (data.contestant.id !== contestantId) {
            enableBuzzer(); // Re-enable for other contestants
            showStatus('Answer was incorrect. You can buzz in again!', 'info');
        } else {
            showStatus('Your answer was incorrect.', 'error');
        }
    }
    
    // Update displays with new scores
    updateContestantsList();
    updateContestantInfo();
});

socket.on('game-state-updated', (newGameState) => {
    gameState = newGameState;
    updateBuzzerStatus();
    updateBoard(); // Ensure board reflects current state
});

socket.on('daily-double-wager-set', (data) => {
    hideDailyDoubleWager();
    showStatus(`${data.contestant} wagered $${data.wager} on the Daily Double!`, 'info');
});

socket.on('final-jeopardy-started', (question) => {
    showFinalJeopardy(question);
});

socket.on('final-jeopardy-results', (data) => {
    gameState.contestants = data.contestants;
    updateContestantsList();
    showStatus('Final Jeopardy complete! Check the final scores.', 'success');
});

socket.on('game-reset', (newGameState) => {
    gameState = newGameState;
    updateBoard();
    updateContestantsList();
    updateContestantInfo();
    hideCurrentQuestion();
    hideFinalJeopardy();
    hideStatus();
    enableBuzzer();
});

// UI update functions
function updateBoard() {
    const board = document.getElementById('jeopardy-board');
    board.innerHTML = '';
    
    if (!gameState.categories || !gameState.board) return;
    
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
            // Removed daily double visual indicator for contestants
            cell.textContent = question.answered ? '' : `$${row.price}`;
            board.appendChild(cell);
        });
    });
}

function updateContestantsList() {
    const table = document.getElementById('contestants-list');
    if (!gameState.contestants) return;
    
    // Create tbody if it doesn't exist
    let tbody = table.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
    } else {
        tbody.innerHTML = '';
    }
    
    Object.values(gameState.contestants).forEach(contestant => {
        const row = document.createElement('tr');
        if (contestant.id === contestantId) {
            row.className = 'current-contestant';
        }
        
        row.innerHTML = `
            <td>${contestant.name}</td>
            <td>$${contestant.score}</td>
        `;
        
        tbody.appendChild(row);
    });
}

function updateContestantInfo() {
    if (!gameState.contestants || !gameState.contestants[contestantId]) return;
    
    const contestant = gameState.contestants[contestantId];
    document.getElementById('contestant-name').textContent = contestant.name;
    document.getElementById('contestant-score').textContent = `$${contestant.score}`;
}

// Buzzer functionality
function updateBuzzerStatus() {
    const button = document.getElementById('buzz-button');
    
    if (!gameState.contestants || !gameState.contestants[contestantId]) return;
    
    canBuzz = gameState.contestants[contestantId].canBuzz && gameState.currentQuestion && !gameState.answering;
    
    if (canBuzz) {
        button.disabled = false;
    } else {
        button.disabled = true;
    }
}

function enableBuzzer() {
    canBuzz = true;
    updateBuzzerStatus();
}

function disableBuzzer() {
    canBuzz = false;
    updateBuzzerStatus();
}

function buzzIn() {
    if (canBuzz) {
        socket.emit('buzz-in');
        disableBuzzer();
    }
}

// Question display functions
function showCurrentQuestion(question) {
    const questionDiv = document.getElementById('current-question');
    const questionText = document.getElementById('question-text');
    const questionMeta = document.getElementById('question-meta');
    
    questionText.textContent = question.text;
    questionMeta.innerHTML = `
        <strong>Category:</strong> ${question.category} | 
        <strong>Value:</strong> $${question.value}
    `;
    
    questionDiv.classList.remove('hidden');
}

function hideCurrentQuestion() {
    document.getElementById('current-question').classList.add('hidden');
}

// Status message functions
function showStatus(message, type) {
    const statusDiv = document.getElementById('status-message');
    const statusText = document.getElementById('status-text');
    const answerStatus = document.getElementById('answer-status');
    
    statusText.textContent = message;
    statusDiv.classList.remove('hidden');
    
    // Add type-specific styling if needed
    statusDiv.style.borderColor = type === 'success' ? '#4CAF50' : 
                               type === 'error' ? '#f44336' : 
                               type === 'warning' ? '#ff9800' : '#ffc107';
    
    // Update the answer status outline
    if (type === 'success') {
        answerStatus.classList.add('correct');
        answerStatus.classList.remove('incorrect');
    } else if (type === 'error') {
        answerStatus.classList.add('incorrect');
        answerStatus.classList.remove('correct');
    }
}

function hideStatus() {
    document.getElementById('status-message').classList.add('hidden');
    const answerStatus = document.getElementById('answer-status');
    answerStatus.classList.remove('correct', 'incorrect');
}

// Daily Double functions
function showDailyDoubleWager() {
    const contestant = gameState.contestants[contestantId];
    const maxWager = Math.max(contestant.score, 1000);
    
    document.getElementById('max-wager').textContent = maxWager;
    document.getElementById('wager-input').max = maxWager;
    document.getElementById('wager-input').value = '';
    document.getElementById('daily-double-wager').classList.remove('hidden');
}

function hideDailyDoubleWager() {
    document.getElementById('daily-double-wager').classList.add('hidden');
}

function submitWager() {
    const wager = parseInt(document.getElementById('wager-input').value);
    if (isNaN(wager) || wager < 0) {
        alert('Please enter a valid wager amount.');
        return;
    }
    
    socket.emit('daily-double-wager', { wager });
    hideDailyDoubleWager();
}

// Final Jeopardy functions
function showFinalJeopardy(question) {
    const finalDiv = document.getElementById('final-jeopardy');
    const questionText = document.getElementById('final-question-text');
    const contestant = gameState.contestants[contestantId];
    const maxWager = contestant.score > 0 ? contestant.score : 1000;
    
    questionText.innerHTML = `
        <strong>Category:</strong> ${question.category}<br>
        <strong>Question:</strong> ${question.text}
    `;
    
    document.getElementById('final-max-wager').textContent = maxWager;
    document.getElementById('final-wager-input').max = maxWager;
    document.getElementById('final-wager-input').value = '';
    
    finalDiv.classList.remove('hidden');
    document.getElementById('jeopardy-board').style.display = 'none';
}

function hideFinalJeopardy() {
    document.getElementById('final-jeopardy').classList.add('hidden');
    document.getElementById('jeopardy-board').style.display = 'grid';
}

function submitFinalWager() {
    const wager = parseInt(document.getElementById('final-wager-input').value);
    if (isNaN(wager) || wager < 0) {
        alert('Please enter a valid wager amount.');
        return;
    }
    
    socket.emit('final-jeopardy-wager', { wager });
    document.getElementById('final-wager-controls').innerHTML = '<p>Wager submitted! Waiting for other contestants...</p>';
}

// Event listeners
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && canBuzz) {
        event.preventDefault();
        buzzIn();
    }
});
