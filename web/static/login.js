// DOM elements
const userBtn = document.getElementById('user-btn');
const adminBtn = document.getElementById('admin-btn');
const loginCard = document.getElementById('login-card');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginBackBtn = document.getElementById('login-back-btn');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginStatus = document.getElementById('login-status');

// Get the mode card containers - use more specific selectors
const userModeCard = userBtn ? userBtn.parentElement : null;
const adminModeCard = adminBtn ? adminBtn.parentElement : null;

function setStatus(element, message, type) {
    if (!element) return;
    element.textContent = message || '';
    element.className = 'status';
    if (type) {
        element.classList.add(type);
    }
    if (!message) {
        element.style.display = 'none';
    } else {
        element.style.display = 'block';
    }
}

function clearStatus() {
    setStatus(loginStatus, '', '');
}

function goToUserPage() {
    window.location.href = '/user.html';
}

function showLoginForm() {
    // Hide the two mode buttons containers using direct parent access
    if (userModeCard) {
        userModeCard.style.display = 'none';
    }
    if (adminModeCard) {
        adminModeCard.style.display = 'none';
    }
    
    // Hide header to clean up view
    const header = document.querySelector('header');
    if (header) {
        header.style.display = 'none';
    }
    
    // Show login card
    if (loginCard) {
        loginCard.style.display = 'block';
    }
    clearStatus();
    if (loginUsername) loginUsername.value = '';
    if (loginPassword) loginPassword.value = '';
}

function hideLoginForm() {
    // Show the two mode buttons containers
    if (userModeCard) {
        userModeCard.style.display = 'block';
    }
    if (adminModeCard) {
        adminModeCard.style.display = 'block';
    }
    
    // Show header again
    const header = document.querySelector('header');
    if (header) {
        header.style.display = 'block';
    }
    
    // Hide login card
    if (loginCard) {
        loginCard.style.display = 'none';
    }
    clearStatus();
}

async function verifyAdmin(username, password) {
    try {
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        return data.ok === true;
    } catch (error) {
        console.error('Verification failed:', error);
        return false;
    }
}

async function handleLogin() {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();

    if (!username || !password) {
        setStatus(loginStatus, 'Please enter both username and password', 'error');
        return;
    }

    setStatus(loginStatus, 'Verifying...', '');

    const isValid = await verifyAdmin(username, password);

    if (isValid) {
        sessionStorage.setItem('adminUsername', username);
        sessionStorage.setItem('adminPassword', password);
        sessionStorage.setItem('isAdminLoggedIn', 'true');
        window.location.href = '/admin.html';
    } else {
        setStatus(loginStatus, 'Invalid username or password', 'error');
    }
}

// Event listeners
if (userBtn) {
    userBtn.addEventListener('click', goToUserPage);
}

if (adminBtn) {
    adminBtn.addEventListener('click', showLoginForm);
}

if (loginSubmitBtn) {
    loginSubmitBtn.addEventListener('click', handleLogin);
}

if (loginBackBtn) {
    loginBackBtn.addEventListener('click', hideLoginForm);
}

if (loginPassword) {
    loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLogin();
        }
    });
}

if (loginUsername) {
    loginUsername.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLogin();
        }
    });
}

// Initialize: hide status bar on page load
if (loginStatus) {
    loginStatus.style.display = 'none';
}

console.log('login.js loaded successfully');
console.log('userModeCard found:', !!userModeCard);
console.log('adminModeCard found:', !!adminModeCard);