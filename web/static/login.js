// DOM elements
const userCard = document.getElementById('user-card');
const adminCard = document.getElementById('admin-card');
const loginCard = document.getElementById('login-card');
const userBtn = document.getElementById('user-btn');
const adminBtn = document.getElementById('admin-btn');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginBackBtn = document.getElementById('login-back-btn');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginStatus = document.getElementById('login-status');

// Helper: set status message
function setStatus(element, message, type) {
    element.textContent = message || '';
    element.className = 'status';
    if (type) {
        element.classList.add(type);
    }
}

// Helper: clear status
function clearStatus() {
    setStatus(loginStatus, '', '');
}

// Switch to user page
function goToUserPage() {
    window.location.href = '/user.html';
}

// Show login form
function showLoginForm() {
    userCard.style.display = 'none';
    adminCard.style.display = 'none';
    loginCard.style.display = 'block';
    clearStatus();
    loginUsername.value = '';
    loginPassword.value = '';
}

// Hide login form, show selection cards
function hideLoginForm() {
    userCard.style.display = 'block';
    adminCard.style.display = 'block';
    loginCard.style.display = 'none';
    clearStatus();
}

// Verify admin credentials with server
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

// Handle login submission
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
    // Store admin session info
        sessionStorage.setItem('adminUsername', username);
        sessionStorage.setItem('adminPassword', password);  // Add this line
        sessionStorage.setItem('isAdminLoggedIn', 'true');
        window.location.href = '/admin.html';
    }else {
        setStatus(loginStatus, 'Invalid username or password', 'error');
    }
}

// Event listeners
userBtn.addEventListener('click', goToUserPage);
adminBtn.addEventListener('click', showLoginForm);
loginSubmitBtn.addEventListener('click', handleLogin);
loginBackBtn.addEventListener('click', hideLoginForm);

// Allow Enter key to submit login
loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
});
loginUsername.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
});