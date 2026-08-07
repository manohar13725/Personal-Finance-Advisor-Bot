// WealthWise Personal Finance Advisor - Client Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // State management stored in LocalStorage
    let state = {
        transactions: JSON.parse(localStorage.getItem('wealthwise_txs')) || [
            { id: 1, type: 'income', desc: 'Monthly Salary', amount: 5200.00, category: 'Salary', date: '2026-08-01' },
            { id: 2, type: 'expense', desc: 'Apartment Rent', amount: 1600.00, category: 'Housing', date: '2026-08-02' },
            { id: 3, type: 'expense', desc: 'Whole Foods Groceries', amount: 450.00, category: 'Food & Dining', date: '2026-08-04' },
            { id: 4, type: 'expense', desc: 'Electric & Gas Bill', amount: 140.00, category: 'Utilities', date: '2026-08-05' },
            { id: 5, type: 'expense', desc: 'Car Insurance & Gas', amount: 220.00, category: 'Transportation', date: '2026-08-06' },
            { id: 6, type: 'expense', desc: 'Index Fund Investment', amount: 800.00, category: 'Investments', date: '2026-08-07' }
        ],
        goals: JSON.parse(localStorage.getItem('wealthwise_goals')) || [
            { id: 1, title: '6-Month Emergency Fund', target: 15000, current: 8500 },
            { id: 2, title: 'House Down Payment', target: 40000, current: 12000 },
            { id: 3, title: 'Annual Vacation', target: 3000, current: 1800 }
        ],
        chatHistory: []
    };

    // UI Elements
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageHeading = document.getElementById('page-heading');
    const pageSubheading = document.getElementById('page-subheading');

    // Tab Navigation
    const tabTitles = {
        'chat-tab': { title: 'AI Finance Advisor', sub: 'Personalized wealth strategies, real-time budget coaching & debt planning' },
        'dashboard-tab': { title: 'Financial Dashboard', sub: 'Visual breakdown of monthly cash flow, budget health & savings analytics' },
        'tracker-tab': { title: 'Income & Expenses', sub: 'Log and organize your income sources and spending categories' },
        'goals-tab': { title: 'Savings Goals', sub: 'Track progress towards your target financial milestones' }
    };

    navItems.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            navItems.forEach(item => item.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            if (tabTitles[targetTab]) {
                pageHeading.textContent = tabTitles[targetTab].title;
                pageSubheading.textContent = tabTitles[targetTab].sub;
            }
        });
    });

    // Save State
    function saveState() {
        localStorage.setItem('wealthwise_txs', JSON.stringify(state.transactions));
        localStorage.setItem('wealthwise_goals', JSON.stringify(state.goals));
        updateDashboard();
        renderTransactions();
        renderGoals();
    }

    // Health Check
    async function checkHealth() {
        try {
            const res = await fetch('/api/health');
            if (res.ok) {
                const data = await res.json();
                document.getElementById('status-model').textContent = `${data.model} (${data.masked_key})`;
            }
        } catch (e) {
            console.log('Health check note: Standalone mode active');
        }
    }
    checkHealth();

    // AI Chat System
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    // Quick Prompts
    document.querySelectorAll('.prompt-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.getAttribute('data-prompt');
            chatForm.dispatchEvent(new Event('submit'));
        });
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        // User Message
        appendMessage('user', text);
        chatInput.value = '';

        // Add to history
        state.chatHistory.push({ role: 'user', content: text });

        // Add typing indicator
        const typingEl = appendTypingIndicator();

        try {
            // Include context summary of finances if available
            const financialContext = getFinancialContextSummary();
            const messagesWithContext = [
                { role: 'system', content: `Current user context:\n${financialContext}` },
                ...state.chatHistory
            ];

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messagesWithContext })
            });

            typingEl.remove();

            if (res.ok) {
                const data = await res.json();
                appendMessage('assistant', data.content);
                state.chatHistory.push({ role: 'assistant', content: data.content });
            } else {
                const errData = await res.json();
                appendMessage('assistant', `⚠️ **Advisor Connection Note**: ${errData.error || 'Unable to reach backend server.'}`);
            }
        } catch (err) {
            typingEl.remove();
            appendMessage('assistant', `⚠️ **Network Error**: Unable to reach backend server at /api/chat. Please ensure \`app.py\` is running.`);
        }
    });

    function appendMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;

        const iconSvg = role === 'user'
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;

        // Simple Markdown styling for bold/code/paragraphs
        let formattedText = content
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');

        msgDiv.innerHTML = `
            <div class="avatar">${iconSvg}</div>
            <div class="message-content"><p>${formattedText}</p></div>
        `;

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing';
        typingDiv.innerHTML = `
            <div class="avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="message-content">
                <p><em>WealthWise AI is thinking...</em></p>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return typingDiv;
    }

    function getFinancialContextSummary() {
        const income = state.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = state.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const savings = income - expense;
        return `Monthly Income: $${income.toFixed(2)}, Monthly Expenses: $${expense.toFixed(2)}, Net Savings: $${savings.toFixed(2)}.`;
    }

    // Dashboard Calculations & SVG Pie Chart
    const categoryColors = {
        'Housing': '#8B5CF6',
        'Food & Dining': '#06B6D4',
        'Utilities': '#3B82F6',
        'Transportation': '#F59E0B',
        'Entertainment': '#EC4899',
        'Investments': '#10B981',
        'Salary': '#10B981',
        'Other': '#6B7280'
    };

    function updateDashboard() {
        const income = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const savings = income - expense;
        const rate = income > 0 ? ((savings / income) * 100).toFixed(1) : 0;

        document.getElementById('val-income').textContent = `$${income.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('val-expense').textContent = `$${expense.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('val-savings').textContent = `$${savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('val-rate').textContent = `${rate}%`;

        // 50/30/20 Rule Analysis
        if (income > 0) {
            // Estimate Needs (Housing, Utilities, Food, Transportation) vs Wants (Entertainment, Other) vs Savings (Investments)
            const needs = state.transactions
                .filter(t => t.type === 'expense' && ['Housing', 'Utilities', 'Food & Dining', 'Transportation'].includes(t.category))
                .reduce((s, t) => s + t.amount, 0);
            
            const wants = state.transactions
                .filter(t => t.type === 'expense' && ['Entertainment', 'Other'].includes(t.category))
                .reduce((s, t) => s + t.amount, 0);
            
            const savingsVal = Math.max(0, savings);

            const pctNeeds = Math.min(100, Math.round((needs / income) * 100));
            const pctWants = Math.min(100, Math.round((wants / income) * 100));
            const pctSavings = Math.min(100, Math.round((savingsVal / income) * 100));

            document.getElementById('pct-needs').textContent = `${pctNeeds}%`;
            document.getElementById('pct-wants').textContent = `${pctWants}%`;
            document.getElementById('pct-savings').textContent = `${pctSavings}%`;

            document.getElementById('bar-needs').style.width = `${pctNeeds}%`;
            document.getElementById('bar-wants').style.width = `${pctWants}%`;
            document.getElementById('bar-savings').style.width = `${pctSavings}%`;

            let insightText = '';
            if (pctNeeds > 50) {
                insightText = `💡 <strong>Advisor Note</strong>: Your essential needs (${pctNeeds}%) exceed the recommended 50% threshold. Consider negotiating utilities or optimizing grocery spending.`;
            } else if (pctSavings >= 20) {
                insightText = `🎉 <strong>Great Job!</strong> You are hitting the 20%+ target savings rate (${pctSavings}%). You can allocate surplus into your high-priority savings goals or index funds!`;
            } else {
                insightText = `📊 <strong>Advisor Tip</strong>: Your current savings rate is ${pctSavings}%. Aim to bump this up to 20% by cutting back slightly on discretionary wants (${pctWants}%).`;
            }
            document.getElementById('ai-insight-box').innerHTML = `<p>${insightText}</p>`;
        }

        // SVG Pie Chart Calculation
        renderPieChart();
    }

    function renderPieChart() {
        const expenses = state.transactions.filter(t => t.type === 'expense');
        const catMap = {};
        expenses.forEach(t => {
            catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        });

        const totalExp = Object.values(catMap).reduce((a, b) => a + b, 0);
        const svg = document.getElementById('pie-chart-svg');
        const legend = document.getElementById('pie-chart-legend');

        svg.innerHTML = '';
        legend.innerHTML = '';

        if (totalExp === 0) {
            svg.innerHTML = `<circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="30"/>`;
            legend.innerHTML = `<div class="legend-item">No expense records yet</div>`;
            return;
        }

        let startAngle = 0;
        const cx = 100, cy = 100, r = 70;

        Object.entries(catMap).forEach(([cat, amt]) => {
            const sliceAngle = (amt / totalExp) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            const x1 = cx + r * Math.cos(startAngle);
            const y1 = cy + r * Math.sin(startAngle);
            const x2 = cx + r * Math.cos(endAngle);
            const y2 = cy + r * Math.sin(endAngle);

            const largeArc = sliceAngle > Math.PI ? 1 : 0;
            const color = categoryColors[cat] || '#8B5CF6';

            const pathData = [
                `M ${cx} ${cy}`,
                `L ${x1} ${y1}`,
                `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
                `Z`
            ].join(' ');

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('fill', color);
            path.setAttribute('opacity', '0.88');
            svg.appendChild(path);

            startAngle = endAngle;

            // Add to Legend
            const pct = Math.round((amt / totalExp) * 100);
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-dot" style="background-color: ${color}"></div>
                <span>${cat}: <strong>$${amt.toFixed(0)}</strong> (${pct}%)</span>
            `;
            legend.appendChild(item);
        });

        // Add inner circle for Donut effect
        const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerCircle.setAttribute('cx', cx);
        innerCircle.setAttribute('cy', cy);
        innerCircle.setAttribute('r', '45');
        innerCircle.setAttribute('fill', '#0B0F19');
        svg.appendChild(innerCircle);
    }

    // Transactions Table
    const filterType = document.getElementById('filter-type');
    filterType.addEventListener('change', renderTransactions);

    function renderTransactions() {
        const tbody = document.getElementById('transaction-rows');
        tbody.innerHTML = '';

        const typeFilter = filterType.value;
        const filtered = state.transactions.filter(t => typeFilter === 'all' || t.type === typeFilter);

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No transaction entries found.</td></tr>`;
            return;
        }

        filtered.slice().reverse().forEach(tx => {
            const tr = document.createElement('tr');
            const isInc = tx.type === 'income';
            tr.innerHTML = `
                <td><strong>${tx.desc}</strong></td>
                <td><span class="legend-item"><span class="legend-dot" style="background:${categoryColors[tx.category] || '#8B5CF6'}"></span>${tx.category}</span></td>
                <td><span class="${isInc ? 'tag-income' : 'tag-expense'}">${isInc ? 'Income' : 'Expense'}</span></td>
                <td style="font-weight: 700; color: ${isInc ? 'var(--accent-emerald)' : 'var(--text-primary)'}">
                    ${isInc ? '+' : '-'}$${tx.amount.toFixed(2)}
                </td>
                <td>
                    <button class="btn-del" data-id="${tx.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add Delete Handlers
        tbody.querySelectorAll('.btn-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.getAttribute('data-id'));
                state.transactions = state.transactions.filter(t => t.id !== id);
                saveState();
            });
        });
    }

    // Goals Grid
    function renderGoals() {
        const grid = document.getElementById('goals-grid');
        grid.innerHTML = '';

        if (state.goals.length === 0) {
            grid.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 2rem;">No financial goals created yet. Click "+ New Goal" above!</div>`;
            return;
        }

        state.goals.forEach(goal => {
            const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
            const card = document.createElement('div');
            card.className = 'goal-card';
            card.innerHTML = `
                <div class="goal-header">
                    <span class="goal-title">${goal.title}</span>
                    <button class="btn-del" data-goal-id="${goal.id}">&times;</button>
                </div>
                <div class="goal-amounts">
                    $${goal.current.toLocaleString()} / <strong>$${goal.target.toLocaleString()}</strong> (${pct}%)
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill savings" style="width: ${pct}%"></div>
                </div>
            `;
            grid.appendChild(card);
        });

        grid.querySelectorAll('.btn-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.getAttribute('data-goal-id'));
                state.goals = state.goals.filter(g => g.id !== id);
                saveState();
            });
        });
    }

    // Modals
    const btnQuickAdd = document.getElementById('btn-quick-add-transaction');
    const txModal = document.getElementById('tx-modal');
    const closeTxModal = document.getElementById('close-tx-modal');
    const cancelTxModal = document.getElementById('cancel-tx-modal');
    const txForm = document.getElementById('tx-form');

    btnQuickAdd.addEventListener('click', () => txModal.classList.add('open'));
    [closeTxModal, cancelTxModal].forEach(b => b.addEventListener('click', () => txModal.classList.remove('open')));

    txForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = txForm.querySelector('input[name="tx_type"]:checked').value;
        const desc = document.getElementById('tx_desc').value.trim();
        const amount = parseFloat(document.getElementById('tx_amount').value);
        const category = document.getElementById('tx_category').value;

        if (!desc || isNaN(amount) || amount <= 0) return;

        state.transactions.push({
            id: Date.now(),
            type, desc, amount, category,
            date: new Date().toISOString().split('T')[0]
        });

        saveState();
        txForm.reset();
        txModal.classList.remove('open');
    });

    // Goal Modal
    const btnAddGoal = document.getElementById('btn-add-goal');
    const goalModal = document.getElementById('goal-modal');
    const closeGoalModal = document.getElementById('close-goal-modal');
    const cancelGoalModal = document.getElementById('cancel-goal-modal');
    const goalForm = document.getElementById('goal-form');

    btnAddGoal.addEventListener('click', () => goalModal.classList.add('open'));
    [closeGoalModal, cancelGoalModal].forEach(b => b.addEventListener('click', () => goalModal.classList.remove('open')));

    goalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('goal_title').value.trim();
        const target = parseFloat(document.getElementById('goal_target').value);
        const current = parseFloat(document.getElementById('goal_current').value) || 0;

        if (!title || isNaN(target) || target <= 0) return;

        state.goals.push({
            id: Date.now(),
            title, target, current
        });

        saveState();
        goalForm.reset();
        goalModal.classList.remove('open');
    });

    // Initial Render
    updateDashboard();
    renderTransactions();
    renderGoals();
});
