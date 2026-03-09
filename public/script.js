document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');
    const welcomeScreen = document.getElementById('welcome-screen');
    const statusBadge = document.getElementById('status-badge');
    const activePersona = document.getElementById('active-persona');
    const personaIcon = document.getElementById('persona-icon');
    const personaLabel = document.getElementById('persona-label');
    const personaConfidence = document.getElementById('persona-confidence');

    const viewLogsBtn = document.getElementById('view-logs-btn');
    const logsModal = document.getElementById('logs-modal');
    const closeLogs = document.getElementById('close-logs');
    const logsContainer = document.getElementById('logs-container');

    const INTENT_DATA = {
        code: { icon: '🧑‍💻', color: 'var(--intent-code)' },
        data: { icon: '📊', color: 'var(--intent-data)' },
        writing: { icon: '✍️', color: 'var(--intent-writing)' },
        career: { icon: '💼', color: 'var(--intent-career)' },
        unclear: { icon: '🤔', color: 'var(--intent-unclear)' }
    };

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
        sendBtn.disabled = userInput.value.trim() === '';
    });

    // Send on Enter (but Shift+Enter for newline)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // UI Reset
        userInput.value = '';
        userInput.style.height = 'auto';
        sendBtn.disabled = true;
        welcomeScreen.classList.add('hidden');
        chatHistory.classList.remove('hidden');

        // Add User Message to UI
        appendMessage('user', message);

        // Show Typing indicator
        const typingId = appendMessage('bot', '...', true);

        try {
            statusBadge.textContent = 'Classifying...';
            statusBadge.style.background = 'rgba(59, 130, 246, 0.2)';
            statusBadge.style.color = 'var(--accent-color)';

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            if (!response.ok) throw new Error('Failed to reach server');

            const data = await response.json();

            // Update Persona Status
            updatePersonaStatus(data.intent, data.confidence, data.manualOverride);

            // Remove typing indicator and add real response
            removeMessage(typingId);
            appendMessage('bot', data.response, false, data.intent);

            statusBadge.textContent = 'System Ready';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBadge.style.color = '#10b981';

        } catch (error) {
            removeMessage(typingId);
            appendMessage('bot', 'Sorry, I encountered an error. Please check your connection and API key.');
            console.error(error);
            statusBadge.textContent = 'Error';
            statusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
            statusBadge.style.color = 'var(--intent-unclear)';
        }
    }

    function appendMessage(role, text, isTyping = false, intent = null) {
        const id = 'msg-' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.id = id;
        msgDiv.className = `message ${role}`;

        if (intent && INTENT_DATA[intent]) {
            const tag = document.createElement('span');
            tag.className = 'intent-tag';
            tag.textContent = intent;
            tag.style.background = INTENT_DATA[intent].color;
            tag.style.color = '#000';
            msgDiv.appendChild(tag);
            msgDiv.style.borderColor = INTENT_DATA[intent].color;
        }

        const content = document.createElement('div');
        content.className = 'content';

        // Basic Markdown-ish formatting for code blocks
        if (role === 'bot' && !isTyping) {
            content.innerHTML = formatResponse(text);
        } else {
            content.textContent = text;
        }

        msgDiv.appendChild(content);
        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return id;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function updatePersonaStatus(intent, confidence, isManual) {
        const meta = INTENT_DATA[intent] || INTENT_DATA.unclear;

        activePersona.classList.remove('hidden');
        personaIcon.textContent = meta.icon;
        personaLabel.textContent = intent.toUpperCase();
        personaLabel.style.color = meta.color;

        const confText = isManual ? '[MANUAL OVERRIDE]' : `(${(confidence * 100).toFixed(1)}% confidence)`;
        personaConfidence.textContent = confText;
    }

    function formatResponse(text) {
        // Simple regex for code blocks
        return text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
        }).replace(/\n/g, '<br>');
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Modal Logic
    viewLogsBtn.addEventListener('click', async () => {
        logsModal.classList.remove('hidden');
        logsContainer.innerHTML = '<p>Loading logs...</p>';

        try {
            const res = await fetch('/api/logs?limit=20');
            const data = await res.json();

            if (data.logs.length === 0) {
                logsContainer.innerHTML = '<p>No interaction logs found yet.</p>';
                return;
            }

            logsContainer.innerHTML = data.logs.reverse().map(log => `
                <div class="log-item">
                    <header>
                        <span>${new Date(log.timestamp).toLocaleString()}</span>
                        <span style="color: ${INTENT_DATA[log.intent]?.color || '#fff'}">${log.intent.toUpperCase()}</span>
                    </header>
                    <p><strong>Message:</strong> ${escapeHtml(log.userMessage)}</p>
                    <p style="font-size: 0.8rem; margin-top: 0.5rem; color: var(--text-secondary)">
                        ${log.manualOverride ? 'Manual Override' : `Confidence: ${(log.confidence * 100).toFixed(1)}%`}
                    </p>
                </div>
            `).join('');
        } catch (err) {
            logsContainer.innerHTML = '<p>Error loading logs.</p>';
        }
    });

    closeLogs.addEventListener('click', () => logsModal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
        if (e.target === logsModal) logsModal.classList.add('hidden');
    });
});
