// Index page JavaScript functionality
// Check if Socket.IO is loaded and initialize safely
let socket = null;
if (typeof io === 'undefined') {
    console.error('Socket.IO library not loaded!');
    // Ensure the UI doesn't stay stuck on the loading overlay
    document.addEventListener('DOMContentLoaded', () => {
        hideLoading();
        showError('Failed to load real-time library. Please refresh the page.');
        const landingSection = document.getElementById('landing');
        if (landingSection) landingSection.classList.remove('hidden');
    });
} else {
    try {
        // Prefer websocket, but allow polling fallback
        socket = io({ transports: ['websocket', 'polling'] });
        console.log('Socket.IO library loaded successfully');
    } catch (e) {
        console.error('Failed to initialize Socket.IO:', e);
        document.addEventListener('DOMContentLoaded', () => {
            hideLoading();
            showError('Failed to start real-time connection. Please refresh the page.');
            const landingSection = document.getElementById('landing');
            if (landingSection) landingSection.classList.remove('hidden');
        });
    }
}
let currentSessionId = null;
let currentHostPassword = null;
let isConnected = false;

// Socket connection event handlers (only if socket initialized)
if (socket) {
    socket.on('connect', () => {
        console.log('Connected to game server');
        isConnected = true;
        hideLoading();
        hideError();
        
        // Force hide loading overlay with style override
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
            loadingElement.style.visibility = 'hidden';
            console.log('Loading overlay force hidden');
        }
        
        // Show landing page once connected
        const landingSection = document.getElementById('landing');
        if (landingSection) {
            landingSection.classList.remove('hidden');
            console.log('Landing section shown after connection');
            console.log('Landing section classes:', landingSection.className);
            console.log('Landing section display style:', window.getComputedStyle(landingSection).display);
            console.log('Landing section visibility:', window.getComputedStyle(landingSection).visibility);
            console.log('Landing section opacity:', window.getComputedStyle(landingSection).opacity);
        } else {
            console.error('Landing section not found!');
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from game server');
        isConnected = false;
        showLoading();
        // Hide landing section when disconnected
        const landingSection = document.getElementById('landing');
        if (landingSection) landingSection.classList.add('hidden');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        isConnected = false;
        hideLoading();
        showError('Failed to connect to game server. Please check if the server is running and refresh the page.');
        // Still show the landing page even with connection errors
        const landingSection = document.getElementById('landing');
        if (landingSection) landingSection.classList.remove('hidden');
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to game server after', attemptNumber, 'attempts');
        isConnected = true;
        hideLoading();
        hideError();
        const landingSection = document.getElementById('landing');
        if (landingSection) landingSection.classList.remove('hidden');
    });
}

// Socket event handlers
if (socket) {
    socket.on('session-created', (data) => {
        hideLoading();
        currentSessionId = data.sessionId;
        document.getElementById('created-session-id').textContent = data.sessionId;
        showSection('session-info');
    });

    socket.on('auth-error', (message) => {
        hideLoading();
        showError(message);
    });
}

// Error handling
function showError(message) {
    document.getElementById('error-text').textContent = message;
    document.getElementById('error-message').classList.remove('hidden');
}

function hideError() {
    document.getElementById('error-message').classList.add('hidden');
}

// Navigation functions
function showHostOptions() {
    showSection('host-options');
}

function showContestantJoin() {
    showSection('contestant-join');
}

// Session management
function createSession() {
    const password = document.getElementById('host-password').value.trim();
    if (!password) {
        showError('Please enter the host password');
        return;
    }
    
    showLoading();
    currentHostPassword = password;
    if (socket) {
        socket.emit('create-session', { hostPassword: password });
    } else {
        hideLoading();
        showError('Real-time connection not available. Please refresh the page.');
    }
}

function joinAsHost() {
    const sessionId = document.getElementById('host-session-id').value.trim().toUpperCase();
    const password = document.getElementById('host-password').value.trim();
    
    if (!sessionId || !password) {
        showError('Please enter both session ID and password');
        return;
    }
    
    showLoading();
    // Store credentials and redirect
    sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('hostPassword', password);
    window.location.href = '/host';
}

function proceedToHost() {
    if (currentSessionId && currentHostPassword) {
        showLoading();
        sessionStorage.setItem('sessionId', currentSessionId);
        sessionStorage.setItem('hostPassword', currentHostPassword);
        window.location.href = '/host';
    }
}

function joinAsContestant() {
    const sessionId = document.getElementById('contestant-session-id').value.trim().toUpperCase();
    const contestantName = document.getElementById('contestant-name').value.trim();
    
    if (!sessionId) {
        showError('Please enter the session ID');
        return;
    }
    
    if (!contestantName) {
        showError('Please enter your name');
        return;
    }
    
    if (contestantName.length > 20) {
        showError('Name must be 20 characters or less');
        return;
    }
    
    showLoading();
    // Store session ID and name, then redirect
    sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('contestantName', contestantName);
    window.location.href = '/contestant';
}

// UI utility functions
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.auth-section, .info-sections').forEach(section => {
        section.classList.add('hidden');
    });
    hideError();
    
    // Show the requested section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        
        // Auto-focus first input for auth sections only
        if (sectionId !== 'landing') {
            setTimeout(() => {
                const firstInput = targetSection.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    }
}

// Copy session ID to clipboard
function copySessionId() {
    const sessionId = document.getElementById('created-session-id').textContent;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(sessionId).then(() => {
            showSuccessMessage('Session ID copied to clipboard!');
        }).catch(() => {
            fallbackCopyTextToClipboard(sessionId);
        });
    } else {
        fallbackCopyTextToClipboard(sessionId);
    }
}

// Fallback for older browsers
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showSuccessMessage('Session ID copied to clipboard!');
    } catch (err) {
        showError('Failed to copy session ID. Please copy manually: ' + text);
    }
    
    document.body.removeChild(textArea);
}

// Show success message
function showSuccessMessage(message) {
    // Create temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-toast';
    successDiv.innerHTML = `
        <div class="success-content">
            <span class="success-icon">✅</span>
            <span>${message}</span>
        </div>
    `;
    
    // Add styles
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(76,175,80,0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(76,175,80,0.3);
    `;
    
    document.body.appendChild(successDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
        successDiv.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (document.body.contains(successDiv)) {
                document.body.removeChild(successDiv);
            }
        }, 300);
    }, 3000);
}

// Loading state management
function showLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.classList.remove('hidden');
        console.log('Loading shown, classes:', loadingElement.className);
    }
}

function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.classList.add('hidden');
        // Force hide with inline styles to override any CSS conflicts
        loadingElement.style.display = 'none';
        loadingElement.style.visibility = 'hidden';
        loadingElement.style.opacity = '0';
        console.log('Loading hidden, classes:', loadingElement.className);
        console.log('Loading display style:', window.getComputedStyle(loadingElement).display);
    } else {
        console.error('Loading element not found when trying to hide!');
    }
}

// Enhanced navigation functions
function showHostOptions() {
    showSection('host-options');
}

function showContestantJoin() {
    showSection('contestant-join');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    
    // Debug: Check what elements are present
    const landingSection = document.getElementById('landing');
    const loadingElement = document.getElementById('loading');
    const mainActions = document.querySelector('.main-actions');
    const roleSelection = document.querySelector('.role-selection');
    
    console.log('Elements found:');
    console.log('- Landing section:', landingSection ? 'YES' : 'NO');
    console.log('- Loading element:', loadingElement ? 'YES' : 'NO');  
    console.log('- Main actions:', mainActions ? 'YES' : 'NO');
    console.log('- Role selection:', roleSelection ? 'YES' : 'NO');
    
    if (landingSection) {
        console.log('Landing section initial classes:', landingSection.className);
    }
    
    // Show loading initially while connecting to server
    showLoading();
    
    // Hide all auth sections initially
    document.querySelectorAll('.auth-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Ensure landing section is hidden initially (will show after connection)
    if (landingSection) {
        landingSection.classList.add('hidden');
        console.log('Landing section hidden, classes now:', landingSection.className);
    }
    
    // Check if socket is already connected (in case connection happened very quickly)
    if (socket && socket.connected) {
        console.log('Socket already connected on DOM load');
        isConnected = true;
        hideLoading();
        if (landingSection) {
            landingSection.classList.remove('hidden');
        }
        return;
    }
    
    // Fallback: If not connected after 5 seconds, show the page anyway with a warning
    setTimeout(() => {
        if (!isConnected) {
            console.warn('Socket.IO connection timeout after 5 seconds, showing page anyway');
            if (socket) {
                console.log('Socket state:', socket.connected);
                console.log('Socket ID:', socket.id);
                if (socket.io && socket.io.engine) {
                    console.log('Socket transport:', socket.io.engine.transport.name);
                    console.log('Socket ready state:', socket.io.engine.readyState);
                }
            }
            hideLoading();
            if (landingSection) {
                landingSection.classList.remove('hidden');
            }
            // Show a warning that the connection might be slow
            showError('Connection is slow but page is available. Some features may be limited.');
        }
    }, 5000);
    
    // Check multiple times if socket is already connected (in case connection happened before page load)
    let checkCount = 0;
    const checkConnectionInterval = setInterval(() => {
        checkCount++;
        if (socket && socket.connected && !isConnected) {
            console.log('Socket was already connected, updating state (check #' + checkCount + ')');
            isConnected = true;
            hideLoading();
            hideError();
            if (landingSection) {
                landingSection.classList.remove('hidden');
            }
            clearInterval(checkConnectionInterval);
        }
        
        // Clear the interval after 50 checks (5 seconds)
        if (checkCount >= 50) {
            clearInterval(checkConnectionInterval);
        }
    }, 100);
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const activeSection = document.querySelector('.auth-section:not(.hidden)');
        if (activeSection) {
            const button = activeSection.querySelector('.btn-primary');
            if (button) button.click();
        }
    }
    
    // ESC key to go back to landing
    if (event.key === 'Escape') {
        const activeAuthSection = document.querySelector('.auth-section:not(.hidden)');
        if (activeAuthSection && activeAuthSection.id !== 'session-info') {
            showSection('landing');
        }
    }
});
