// Log panel functionality
let logRefreshInterval = null;
let isLogPanelCollapsed = false;

function initLogPanel() {
    const logContent = document.getElementById('log-content');
    const logCountSpan = document.getElementById('log-count');
    const toggleBtn = document.getElementById('log-toggle-btn');
    const clearBtn = document.getElementById('log-clear-btn');
    const logPanel = document.getElementById('log-panel');
    
    // Load collapsed state from localStorage
    isLogPanelCollapsed = true;
    if (isLogPanelCollapsed) {
        logPanel.classList.add('collapsed');
        document.body.classList.add('log-collapsed');
        toggleBtn.textContent = 'Expand';
    }
    
    // Toggle collapse/expand
    toggleBtn.addEventListener('click', () => {
        isLogPanelCollapsed = !isLogPanelCollapsed;
        if (isLogPanelCollapsed) {
            logPanel.classList.add('collapsed');
            document.body.classList.add('log-collapsed');
            toggleBtn.textContent = 'Expand';
        } else {
            logPanel.classList.remove('collapsed');
            document.body.classList.remove('log-collapsed');
            toggleBtn.textContent = 'Collapse';
        }
        localStorage.setItem('logPanelCollapsed', isLogPanelCollapsed);
    });
    
    // Clear logs (only clears display, not server logs)
    clearBtn.addEventListener('click', () => {
        logContent.innerHTML = '<div class="log-entry">Logs cleared. New logs will appear...</div>';
    });
    
    // Fetch logs from server
    function fetchLogs() {
        fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        })
        .then(res => res.json())
        .then(data => {
            if (data.ok && data.logs) {
                renderLogs(data.logs);
                if (logCountSpan) {
                    logCountSpan.textContent = `(${data.logs.length})`;
                }
            }
        })
        .catch(err => {
            console.error('Failed to fetch logs:', err);
            if (logContent) {
                logContent.innerHTML = '<div class="log-entry error">Failed to connect to log server</div>';
            }
        });
    }
    
    function renderLogs(logs) {
        if (!logContent) return;
        
        if (!logs || logs.length === 0) {
            logContent.innerHTML = '<div class="log-entry">No logs available</div>';
            return;
        }
        
        logContent.innerHTML = '';
        logs.forEach(log => {
            let logClass = 'log-entry';
            if (log.includes('[INFO]')) logClass += ' info';
            else if (log.includes('[WARN]')) logClass += ' warn';
            else if (log.includes('[ERROR]')) logClass += ' error';
            
            const div = document.createElement('div');
            div.className = logClass;
            div.textContent = log;
            logContent.appendChild(div);
        });
        // Auto-scroll to bottom
        logContent.scrollTop = logContent.scrollHeight;
    }
    
    // Initial fetch
    fetchLogs();
    
    // Set up interval (every 3 seconds)
    logRefreshInterval = setInterval(fetchLogs, 3000);
}

// Clean up interval when page unloads
window.addEventListener('beforeunload', () => {
    if (logRefreshInterval) {
        clearInterval(logRefreshInterval);
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogPanel);
} else {
    initLogPanel();
}