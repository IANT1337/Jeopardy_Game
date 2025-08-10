const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    // Socket.IO configuration for better reliability
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static('public'));

// Serve specific routes
app.get('/host', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/contestant', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contestant.html'));
});

// Game state
let gameState = {
    contestants: {},
    contestantsByName: {}, // Maps contestant names to their data for reconnection
    hostId: null,
    currentQuestion: null,
    answering: false,
    answeringContestant: null,
    board: [],
    categories: [],
    gamePhase: 'waiting', // waiting, playing, daily-double, final-jeopardy
    finalJeopardyQuestion: null,
    finalJeopardyWagers: {}
};

// Game sessions and authentication
const gameSessions = new Map(); // sessionId -> { hostPassword, active, createdAt }
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'jeopardy2025'; // Default password
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// Generate random session ID
function generateSessionId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Clean up expired sessions
function cleanupSessions() {
    const now = Date.now();
    for (const [sessionId, session] of gameSessions.entries()) {
        if (now - session.createdAt > SESSION_TIMEOUT) {
            gameSessions.delete(sessionId);
        }
    }
}

// Run cleanup every hour
setInterval(cleanupSessions, 60 * 60 * 1000);

// Load questions from CSV file
function loadQuestions() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync('jeopardy_questions.csv')) {
            console.error('jeopardy_questions.csv file not found!');
            console.error('Please create a jeopardy_questions.csv file with your questions.');
            console.error('Format: price,CATEGORY1,CATEGORY2,CATEGORY3,CATEGORY4,CATEGORY5,CATEGORY6');
            gameState.categories = [];
            gameState.board = [];
            reject(new Error('Questions file not found'));
            return;
        }
        
        loadQuestionsFromCSV()
            .then(resolve)
            .catch(reject);
    });
}

function loadQuestionsFromCSV() {
    return new Promise((resolve, reject) => {
        const questions = [];
        let headers = [];
        let isFirstRow = true;
        
        fs.createReadStream('jeopardy_questions.csv')
            .pipe(csv())
            .on('data', (row) => {
                if (isFirstRow) {
                    // Get headers (categories) - skip the first column which should be 'prices'
                    headers = Object.keys(row);
                    const priceColumn = headers[0].toLowerCase();
                    if (priceColumn === 'prices' || priceColumn === 'price' || priceColumn === 'value') {
                        gameState.categories = headers.slice(1);
                    } else {
                        gameState.categories = headers;
                    }
                    isFirstRow = false;
                }
                
                questions.push(row);
            })
            .on('end', () => {
                try {
                    gameState.board = [];
                    
                    questions.forEach(row => {
                        const rowValues = Object.values(row);
                        const price = parseInt(rowValues[0]) || 200; // Default to 200 if parsing fails
                        const questionTexts = rowValues.slice(1);
                        
                        gameState.board.push({
                            price: price,
                            questions: questionTexts.map((q, index) => {
                                // Split question and answer by semicolon
                                const parts = (q || '').split(';');
                                const question = parts[0] || '';
                                const answer = parts[1] || '';
                                
                                return {
                                    text: question,
                                    answer: answer,
                                    category: gameState.categories[index] || 'CATEGORY',
                                    answered: false,
                                    isDailyDouble: false // Will be set when game starts
                                };
                            })
                        });
                    });
                    
                    console.log('Questions loaded successfully from CSV');
                    console.log(`Loaded ${gameState.board.length} price levels with ${gameState.categories.length} categories`);
                    resolve();
                } catch (error) {
                    console.error('Error processing CSV data:', error);
                    reject(error);
                }
            })
            .on('error', (error) => {
                console.error('Error reading CSV file:', error);
                reject(error);
            });
    });
}

// Initialize questions
loadQuestions();

// Function to assign exactly one daily double randomly
function assignDailyDouble() {
    if (!gameState.board || gameState.board.length === 0) return;
    
    // First, clear any existing daily doubles
    gameState.board.forEach(row => {
        row.questions.forEach(question => {
            question.isDailyDouble = false;
        });
    });
    
    // Get all unanswered questions
    const unansweredQuestions = [];
    gameState.board.forEach((row, rowIndex) => {
        row.questions.forEach((question, colIndex) => {
            if (!question.answered) {
                unansweredQuestions.push({ row: rowIndex, col: colIndex });
            }
        });
    });
    
    // Randomly select one question to be the daily double
    if (unansweredQuestions.length > 0) {
        const randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
        const selectedQuestion = unansweredQuestions[randomIndex];
        gameState.board[selectedQuestion.row].questions[selectedQuestion.col].isDailyDouble = true;
        
        console.log(`Daily Double assigned to row ${selectedQuestion.row + 1}, column ${selectedQuestion.col + 1}`);
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id} from ${socket.handshake.address}`);
    
    socket.on('create-session', (data) => {
        if (data.hostPassword !== HOST_PASSWORD) {
            socket.emit('auth-error', 'Invalid host password');
            return;
        }
        
        const sessionId = generateSessionId();
        gameSessions.set(sessionId, {
            hostPassword: data.hostPassword,
            active: true,
            createdAt: Date.now()
        });
        
        socket.emit('session-created', { sessionId });
        console.log(`Session created: ${sessionId}`);
    });
    
    socket.on('join-as-host', (data) => {
        if (!data.sessionId || !data.hostPassword) {
            socket.emit('auth-error', 'Session ID and password required');
            return;
        }
        
        const session = gameSessions.get(data.sessionId);
        if (!session || data.hostPassword !== HOST_PASSWORD) {
            socket.emit('auth-error', 'Invalid session ID or password');
            return;
        }
        
        // Check if this is a reconnection (gameState already exists for this session)
        const isReconnection = gameState.sessionId === data.sessionId && gameState.board.length > 0;
        let preservedBoardState = null;
        
        if (isReconnection) {
            // Save the current board state before loading questions
            preservedBoardState = JSON.parse(JSON.stringify(gameState.board));
        }
        
        if (!isReconnection) {
            // Reset game state for new session
            gameState = {
                contestants: {},
                contestantsByName: {},
                hostId: socket.id,
                currentQuestion: null,
                answering: false,
                answeringContestant: null,
                board: [],
                categories: [],
                gamePhase: 'waiting',
                finalJeopardyQuestion: null,
                finalJeopardyWagers: {},
                sessionId: data.sessionId
            };
        } else {
            // Just update the host ID for reconnection
            gameState.hostId = socket.id;
        }
        
        loadQuestions().then(() => {
            // Only assign daily double for new sessions, not reconnections
            if (!isReconnection) {
                assignDailyDouble();
            } else {
                // For reconnections, restore the preserved board state
                if (preservedBoardState) {
                    gameState.board = preservedBoardState;
                    console.log('Host reconnected - restored existing game state including daily double');
                }
            }
            
            socket.join('host');
            socket.join(`session-${data.sessionId}`);
            socket.emit('host-joined', {
                contestants: gameState.contestants,
                gameState: gameState,
                sessionId: data.sessionId
            });
            console.log(`Host ${isReconnection ? 'reconnected to' : 'joined'} session ${data.sessionId}: ${socket.id}`);
        }).catch(error => {
            console.error('Error loading questions:', error);
            socket.emit('auth-error', 'Error loading game questions');
        });
    });
    
    socket.on('join-as-contestant', (data) => {
        if (!data.sessionId) {
            socket.emit('auth-error', 'Session ID required');
            return;
        }
        
        if (!data.contestantName || data.contestantName.trim().length === 0) {
            socket.emit('auth-error', 'Contestant name required');
            return;
        }
        
        if (data.contestantName.length > 20) {
            socket.emit('auth-error', 'Name must be 20 characters or less');
            return;
        }
        
        const session = gameSessions.get(data.sessionId);
        if (!session) {
            socket.emit('auth-error', 'Invalid session ID');
            return;
        }
        
        if (!gameState.sessionId || gameState.sessionId !== data.sessionId) {
            socket.emit('auth-error', 'Game session not active');
            return;
        }
        
        const contestantName = data.contestantName.trim();
        let contestant = null;
        let isReconnecting = false;
        
        // Check if this contestant is reconnecting
        if (gameState.contestantsByName[contestantName.toLowerCase()]) {
            contestant = gameState.contestantsByName[contestantName.toLowerCase()];
            isReconnecting = true;
            
            // Remove from old socket ID if they were connected
            if (contestant.id && gameState.contestants[contestant.id]) {
                delete gameState.contestants[contestant.id];
            }
            
            // Update socket ID for reconnection
            contestant.id = socket.id;
            contestant.ipAddress = socket.handshake.address;
            contestant.canBuzz = contestant.canBuzz !== undefined ? contestant.canBuzz : true;
        } else {
            // Check if name is already taken by someone else
            const existingContestant = Object.values(gameState.contestants).find(
                c => c.name.toLowerCase() === contestantName.toLowerCase()
            );
            
            if (existingContestant) {
                socket.emit('auth-error', 'Name already taken. Please choose a different name.');
                return;
            }
            
            // Create new contestant
            contestant = {
                id: socket.id,
                name: contestantName,
                score: 0,
                ipAddress: socket.handshake.address,
                canBuzz: true
            };
            
            // Store in persistent storage
            gameState.contestantsByName[contestantName.toLowerCase()] = contestant;
        }
        
        // Add/update contestant in active contestants
        gameState.contestants[socket.id] = contestant;
        
        socket.join('contestants');
        socket.join(`session-${data.sessionId}`);
        socket.emit('contestant-joined', {
            id: socket.id,
            gameState: gameState,
            isReconnecting: isReconnecting
        });
        
        // Notify host of contestant list update
        io.to('host').emit('contestant-list-updated', gameState.contestants);
        
        console.log(`Contestant ${isReconnecting ? 'reconnected' : 'joined'} session ${data.sessionId}: ${socket.id} (${contestantName}) - Score: $${contestant.score}`);
    });
    
    socket.on('select-question', (data) => {
        if (socket.id !== gameState.hostId) return;
        
        const question = gameState.board[data.row].questions[data.col];
        if (question.answered) return;
        
        gameState.currentQuestion = {
            ...question,
            row: data.row,
            col: data.col,
            value: gameState.board[data.row].price
        };
        
        gameState.answering = false;
        gameState.answeringContestant = null;
        
        // Enable buzzing for all contestants
        Object.keys(gameState.contestants).forEach(id => {
            gameState.contestants[id].canBuzz = true;
        });
        
        if (question.isDailyDouble) {
            gameState.gamePhase = 'daily-double';
        } else {
            gameState.gamePhase = 'playing';
        }
        
        io.emit('question-selected', gameState.currentQuestion);
        io.emit('game-state-updated', gameState);
    });
    
    socket.on('buzz-in', () => {
        if (!gameState.contestants[socket.id] || !gameState.contestants[socket.id].canBuzz || gameState.answering) {
            return;
        }
        
        gameState.answering = true;
        gameState.answeringContestant = socket.id;
        
        // Disable buzzing for all contestants
        Object.keys(gameState.contestants).forEach(id => {
            gameState.contestants[id].canBuzz = false;
        });
        
        io.emit('contestant-buzzed', {
            contestantId: socket.id,
            contestantName: gameState.contestants[socket.id].name
        });
        io.emit('game-state-updated', gameState);
    });
    
    socket.on('judge-answer', (data) => {
        if (socket.id !== gameState.hostId || !gameState.answeringContestant) return;
        
        const contestant = gameState.contestants[gameState.answeringContestant];
        // Use wager amount for daily doubles, otherwise use the question value
        const value = gameState.currentQuestion.wager || gameState.currentQuestion.value;
        
        if (data.correct) {
            contestant.score += value;
            // Mark question as answered
            gameState.board[gameState.currentQuestion.row].questions[gameState.currentQuestion.col].answered = true;
            gameState.currentQuestion = null;
        } else {
            contestant.score -= value;
            // Re-enable buzzing for remaining contestants
            Object.keys(gameState.contestants).forEach(id => {
                if (id !== gameState.answeringContestant) {
                    gameState.contestants[id].canBuzz = true;
                }
            });
        }
        
        // Update persistent storage
        const contestantName = contestant.name.toLowerCase();
        if (gameState.contestantsByName[contestantName]) {
            gameState.contestantsByName[contestantName].score = contestant.score;
        }
        
        gameState.answering = false;
        gameState.answeringContestant = null;
        gameState.gamePhase = 'playing';
        
        io.emit('answer-judged', {
            correct: data.correct,
            contestant: contestant,
            newScore: contestant.score
        });
        
        // Send updated contestants list to all clients immediately
        io.emit('contestant-list-updated', gameState.contestants);
        // Send updated game state to ensure board updates
        io.emit('game-state-updated', gameState);
    });
    
    socket.on('daily-double-wager', (data) => {
        if (socket.id !== gameState.answeringContestant) return;
        
        const contestant = gameState.contestants[socket.id];
        const maxWager = Math.max(contestant.score, 1000);
        
        if (data.wager > maxWager || data.wager < 0) {
            socket.emit('invalid-wager', { maxWager });
            return;
        }
        
        gameState.currentQuestion.wager = data.wager;
        gameState.gamePhase = 'playing';
        
        io.emit('daily-double-wager-set', {
            contestant: contestant.name,
            wager: data.wager
        });
    });
    
    socket.on('start-final-jeopardy', () => {
        if (socket.id !== gameState.hostId) return;
        
        gameState.gamePhase = 'final-jeopardy';
        gameState.finalJeopardyQuestion = {
            text: "Final Jeopardy Question: This programming language was created by Brendan Eich in 1995.",
            category: "TECHNOLOGY"
        };
        
        io.emit('final-jeopardy-started', gameState.finalJeopardyQuestion);
    });
    
    socket.on('final-jeopardy-wager', (data) => {
        if (!gameState.contestants[socket.id]) return;
        
        const contestant = gameState.contestants[socket.id];
        const maxWager = contestant.score > 0 ? contestant.score : 1000;
        
        if (data.wager > maxWager || data.wager < 0) {
            socket.emit('invalid-wager', { maxWager });
            return;
        }
        
        gameState.finalJeopardyWagers[socket.id] = data.wager;
        
        io.to('host').emit('final-jeopardy-wager-received', {
            contestant: contestant.name,
            wager: data.wager
        });
    });
    
    socket.on('judge-final-jeopardy', (data) => {
        if (socket.id !== gameState.hostId) return;
        
        data.answers.forEach(answer => {
            const contestant = gameState.contestants[answer.contestantId];
            const wager = gameState.finalJeopardyWagers[answer.contestantId] || 0;
            
            if (answer.correct) {
                contestant.score += wager;
            } else {
                contestant.score -= wager;
            }
            
            // Update persistent storage
            const contestantName = contestant.name.toLowerCase();
            if (gameState.contestantsByName[contestantName]) {
                gameState.contestantsByName[contestantName].score = contestant.score;
            }
        });
        
        io.emit('final-jeopardy-results', {
            contestants: gameState.contestants
        });
    });
    
    socket.on('reset-game', () => {
        if (socket.id !== gameState.hostId) return;
        
        // Reset scores but keep contestants
        Object.keys(gameState.contestants).forEach(id => {
            gameState.contestants[id].score = 0;
            gameState.contestants[id].canBuzz = true;
        });
        
        // Also reset scores in persistent storage
        Object.keys(gameState.contestantsByName).forEach(name => {
            gameState.contestantsByName[name].score = 0;
            gameState.contestantsByName[name].canBuzz = true;
        });
        
        // Reset board
        gameState.board.forEach(row => {
            row.questions.forEach(question => {
                question.answered = false;
            });
        });
        
        // Assign a new daily double for this game
        assignDailyDouble();
        
        gameState.currentQuestion = null;
        gameState.answering = false;
        gameState.answeringContestant = null;
        gameState.gamePhase = 'playing';
        gameState.finalJeopardyWagers = {};
        
        io.emit('game-reset', gameState);
    });
    
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        if (socket.id === gameState.hostId) {
            gameState.hostId = null;
            io.emit('host-disconnected');
        }
        
        if (gameState.contestants[socket.id]) {
            const contestant = gameState.contestants[socket.id];
            console.log(`Contestant ${contestant.name} disconnected but data preserved for reconnection`);
            
            // Remove from active contestants but keep in contestantsByName for reconnection
            delete gameState.contestants[socket.id];
            
            // Update contestant list for remaining clients
            io.emit('contestant-list-updated', gameState.contestants);
        }
    });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

server.listen(PORT, HOST, () => {
    console.log(`Jeopardy server running on ${HOST}:${PORT}`);
    console.log(`Host password: ${HOST_PASSWORD}`);
    console.log(`Landing page: http://localhost:${PORT}`);
    console.log(`Host interface: http://localhost:${PORT}/host`);
    console.log(`Contestant interface: http://localhost:${PORT}/contestant`);
    console.log('');
    console.log('To allow external connections:');
    console.log('1. Configure your router to port forward port 3000 to this computer');
    console.log('2. Your external IP can be found at: https://whatismyipaddress.com/');
    console.log('3. External users can connect to: http://[YOUR-EXTERNAL-IP]:3000');
    console.log('4. Make sure Windows Firewall allows connections on port 3000');
});
