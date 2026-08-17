// WealthWise Personal Finance Advisor - Client Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // State management stored in LocalStorage
    let state = {
        currency: localStorage.getItem('wealthwise_currency') || 'INR',
        currencySymbol: localStorage.getItem('wealthwise_symbol') || '₹',
        transactions: JSON.parse(localStorage.getItem('wealthwise_txs')) || [
            { id: 1, type: 'income', desc: 'Monthly Salary', amount: 52000.00, category: 'Salary', date: '2026-08-01' },
            { id: 2, type: 'expense', desc: 'Apartment Rent', amount: 16000.00, category: 'Housing', date: '2026-08-02' },
            { id: 3, type: 'expense', desc: 'Whole Foods Groceries', amount: 4500.00, category: 'Food & Dining', date: '2026-08-04' },
            { id: 4, type: 'expense', desc: 'Electric & Gas Bill', amount: 1400.00, category: 'Utilities', date: '2026-08-05' },
            { id: 5, type: 'expense', desc: 'Car Insurance & Gas', amount: 2200.00, category: 'Transportation', date: '2026-08-06' },
            { id: 6, type: 'expense', desc: 'Index Fund Investment', amount: 8000.00, category: 'Investments', date: '2026-08-07' }
        ],
        goals: JSON.parse(localStorage.getItem('wealthwise_goals')) || [
            { id: 1, title: '6-Month Emergency Fund', target: 150000, current: 85000 },
            { id: 2, title: 'House Down Payment', target: 400000, current: 120000 },
            { id: 3, title: 'Annual Vacation', target: 30000, current: 18000 }
        ],
        chatHistory: []
    };

    // Currency Selector Setup
    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) {
        currencySelect.value = state.currency;
        currencySelect.addEventListener('change', (e) => {
            const selectedOpt = currencySelect.options[currencySelect.selectedIndex];
            state.currency = selectedOpt.value;
            state.currencySymbol = selectedOpt.getAttribute('data-symbol') || selectedOpt.value;
            
            localStorage.setItem('wealthwise_currency', state.currency);
            localStorage.setItem('wealthwise_symbol', state.currencySymbol);
            
            updateCurrencyLabels();
            saveState();
        });
    }

    function updateCurrencyLabels() {
        document.querySelectorAll('.curr-symbol').forEach(el => {
            el.textContent = state.currencySymbol;
        });
    }
    updateCurrencyLabels();

    function formatAmount(num) {
        return `${state.currencySymbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

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
        'analyse-tab': { title: 'AI Financial Analysis', sub: 'Comprehensive AI budget audit, expense breakdown & personalized saving recommendations' },
        'invest-tab': { title: 'Investments Module', sub: 'Risk profile analysis, category research, lock-in info & returns projection' },
        'debt-tab': { title: 'Debt & Loan Planner', sub: 'EMI calculator, total interest analysis & debt reduction strategies' },
        'emergency-tab': { title: 'Emergency Fund Planner', sub: '3-to-6 month safety net calculation and shortfall tracker' },
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
        return `Selected Currency: ${state.currency} (${state.currencySymbol}), Monthly Income: ${formatAmount(income)}, Monthly Expenses: ${formatAmount(expense)}, Net Savings: ${formatAmount(savings)}.`;
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

        document.getElementById('val-income').textContent = formatAmount(income);
        document.getElementById('val-expense').textContent = formatAmount(expense);
        document.getElementById('val-savings').textContent = formatAmount(savings);
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
                <span>${cat}: <strong>${formatAmount(amt)}</strong> (${pct}%)</span>
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
                    ${isInc ? '+' : '-'}${formatAmount(tx.amount)}
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
                    ${formatAmount(goal.current)} / <strong>${formatAmount(goal.target)}</strong> (${pct}%)
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

    // -------------------------------------------------------------
    // Investments Advisor Module Handler
    // -------------------------------------------------------------
    const investForm = document.getElementById('invest-form');
    const investResult = document.getElementById('invest-result');

    if (investForm) {
        investForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const income = parseFloat(document.getElementById('inv_income').value);
            const expenses = parseFloat(document.getElementById('inv_expenses').value);
            const existing = parseFloat(document.getElementById('inv_existing').value);
            const invAmount = parseFloat(document.getElementById('inv_amount').value);
            const goal = document.getElementById('inv_goal').value.trim();
            const period = parseFloat(document.getElementById('inv_period').value);
            const risk = document.getElementById('inv_risk').value;

            if (isNaN(income) || isNaN(invAmount)) return;

            investResult.style.display = 'block';
            investResult.innerHTML = `
                <div class="result-metric-grid">
                    <div class="result-stat-box highlight">
                        <span>Monthly Investable</span>
                        <strong>${formatAmount(invAmount)}</strong>
                    </div>
                    <div class="result-stat-box">
                        <span>Risk Appetite</span>
                        <strong>${risk} Risk</strong>
                    </div>
                    <div class="result-stat-box success">
                        <span>Time Horizon</span>
                        <strong>${period} Years</strong>
                    </div>
                </div>
                <p>⏳ <em>Generating personalized AI investment research and asset allocation...</em></p>
            `;

            try {
                const prompt = `Investments Module Query:\nCurrency: ${state.currency} (${state.currencySymbol})\nMonthly Income: ${formatAmount(income)}\nMonthly Expenses: ${formatAmount(expenses)}\nExisting Savings: ${formatAmount(existing)}\nMonthly Investment Amount: ${formatAmount(invAmount)}\nGoal: ${goal}\nTime Period: ${period} Years\nRisk Level: ${risk}\n\nPlease provide:\n1. Suitable categories to research (e.g. PPF, Mutual Funds, Fixed Deposits, Index Funds, Equity)\n2. Expected return ranges when appropriate (without guarantees)\n3. Lock-in/liquidity details\n4. Important risks & diversification suggestions\n5. Warning against scams & unregistered products\n6. Suggestion to consult a registered Investment Adviser.`;
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
                });
                const data = await res.json();
                if (data.content) {
                    investResult.innerHTML = `
                        <div class="result-metric-grid">
                            <div class="result-stat-box highlight">
                                <span>Monthly Investment</span>
                                <strong>${formatAmount(invAmount)}</strong>
                            </div>
                            <div class="result-stat-box">
                                <span>Target Goal</span>
                                <strong>${goal}</strong>
                            </div>
                            <div class="result-stat-box success">
                                <span>Risk Level</span>
                                <strong>${risk} Risk</strong>
                            </div>
                        </div>
                        <div class="formatted-ai-response" style="margin-top: 1rem; line-height: 1.6;">${data.content.replace(/\n/g, '<br>')}</div>
                        <div class="sebi-disclaimer">
                            ⚠️ <strong>Mandatory Disclaimer:</strong> All information provided above is for educational and research purposes only. Please consult a registered Investment Adviser for personalized securities advice.
                        </div>
                    `;
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    // -------------------------------------------------------------
    // Debt / Loan Planner Handler
    // -------------------------------------------------------------
    const debtForm = document.getElementById('debt-form');
    const debtResult = document.getElementById('debt-result');

    if (debtForm) {
        debtForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const P = parseFloat(document.getElementById('debt_amount').value);
            const annualRate = parseFloat(document.getElementById('debt_rate').value);
            const years = parseFloat(document.getElementById('debt_duration').value);
            const userIncome = parseFloat(document.getElementById('debt_user_income').value);

            if (isNaN(P) || isNaN(annualRate) || isNaN(years) || P <= 0) return;

            const r = annualRate / 12 / 100;
            const n = years * 12;

            const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            const totalRepayment = emi * n;
            const totalInterest = totalRepayment - P;
            const emiIncomeRatio = userIncome > 0 ? (emi / userIncome) * 100 : 0;

            const isAffordable = emiIncomeRatio <= 35;
            const statusClass = isAffordable ? 'success' : 'warning';
            const statusText = isAffordable ? 'Affordable EMI (<35% of income)' : 'High Debt Burden (>35% of income)';

            debtResult.style.display = 'block';
            debtResult.innerHTML = `
                <div class="result-metric-grid">
                    <div class="result-stat-box highlight">
                        <span>Calculated Monthly EMI</span>
                        <strong>${formatAmount(Math.round(emi))}</strong>
                    </div>
                    <div class="result-stat-box warning">
                        <span>Total Interest Payable</span>
                        <strong>${formatAmount(Math.round(totalInterest))}</strong>
                    </div>
                    <div class="result-stat-box">
                        <span>Total Repayment Amount</span>
                        <strong>${formatAmount(Math.round(totalRepayment))}</strong>
                    </div>
                    <div class="result-stat-box ${statusClass}">
                        <span>EMI to Income Ratio</span>
                        <strong>${emiIncomeRatio.toFixed(1)}% (${statusText})</strong>
                    </div>
                </div>
                <div class="ai-insight-box">
                    <p>💡 <strong>Debt Strategy:</strong> Your EMI is approximately <strong>${formatAmount(Math.round(emi))}/month</strong> (${emiIncomeRatio.toFixed(1)}% of your income). ${isAffordable ? 'This is within a safe limit. Ensure essential living expenses and emergency savings are prioritized.' : 'Your EMI exceeds 35% of income! Consider debt avalanche (paying high-interest debts first) or refinancing.'}</p>
                </div>
            `;
        });
    }

    // -------------------------------------------------------------
    // Emergency Fund Planner Handler
    // -------------------------------------------------------------
    const emergencyForm = document.getElementById('emergency-form');
    const emergencyResult = document.getElementById('emergency-result');

    if (emergencyForm) {
        emergencyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const rent = parseFloat(document.getElementById('ef_rent').value) || 0;
            const food = parseFloat(document.getElementById('ef_food').value) || 0;
            const transport = parseFloat(document.getElementById('ef_transport').value) || 0;
            const bills = parseFloat(document.getElementById('ef_bills').value) || 0;
            const currentSavings = parseFloat(document.getElementById('ef_current').value) || 0;
            const months = parseInt(document.getElementById('ef_months').value) || 6;

            const monthlyEssentials = rent + food + transport + bills;
            const targetEmergencyFund = monthlyEssentials * months;
            const shortfall = Math.max(0, targetEmergencyFund - currentSavings);
            const progressPct = Math.min(100, Math.round((currentSavings / targetEmergencyFund) * 100));

            emergencyResult.style.display = 'block';
            emergencyResult.innerHTML = `
                <div class="result-metric-grid">
                    <div class="result-stat-box">
                        <span>Essential Expenses / Month</span>
                        <strong>${formatAmount(monthlyEssentials)}</strong>
                    </div>
                    <div class="result-stat-box highlight">
                        <span>🎯 Target Fund (${months} Months)</span>
                        <strong>${formatAmount(targetEmergencyFund)}</strong>
                    </div>
                    <div class="result-stat-box success">
                        <span>Current Emergency Savings</span>
                        <strong>${formatAmount(currentSavings)} (${progressPct}%)</strong>
                    </div>
                    <div class="result-stat-box ${shortfall > 0 ? 'warning' : 'success'}">
                        <span>Shortfall to Target</span>
                        <strong>${formatAmount(shortfall)}</strong>
                    </div>
                </div>
                <div class="progress-bar-bg" style="margin: 1rem 0; height: 12px;">
                    <div class="progress-bar-fill savings" style="width: ${progressPct}%"></div>
                </div>
                <div class="ai-insight-box">
                    <p>🎯 <strong>Emergency Fund Target:</strong> ${formatAmount(targetEmergencyFund)}<br>${shortfall === 0 ? '🎉 Your emergency fund is fully funded!' : `Shortfall: <strong>${formatAmount(shortfall)}</strong>. Save approximately ${formatAmount(Math.round(shortfall / 6))}/month for 6 months in a liquid fund to reach your safety goal.`}</p>
                </div>
            `;
        });
    }

    // -------------------------------------------------------------
    // AI Financial Analysis Form Handler
    // -------------------------------------------------------------
    const analysisForm = document.getElementById('analysis-form');
    const analysisResult = document.getElementById('analysis-result');

    if (analysisForm) {
        analysisForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const incomeVal = parseFloat(document.getElementById('ana_income').value);
            const goalsVal = document.getElementById('ana_goals').value.trim();

            // Client-side validation: Check income > 0
            if (isNaN(incomeVal) || incomeVal <= 0) {
                analysisResult.style.display = 'block';
                analysisResult.innerHTML = `<div class="error-message" style="color: var(--accent-danger); font-weight: 600;">⚠️ Please enter a valid monthly income greater than 0.</div>`;
                return;
            }

            // Collect expense categories
            const expensesObj = {};
            document.querySelectorAll('.ana-expense-input').forEach(input => {
                const category = input.getAttribute('data-category');
                const val = parseFloat(input.value);
                if (!isNaN(val) && val > 0) {
                    expensesObj[category] = val;
                }
            });

            // Client-side validation: Check at least 1 expense entry
            if (Object.keys(expensesObj).length === 0) {
                analysisResult.style.display = 'block';
                analysisResult.innerHTML = `<div class="error-message" style="color: var(--accent-danger); font-weight: 600;">⚠️ Please enter at least one expense category with an amount greater than 0.</div>`;
                return;
            }

            // Show loading state
            analysisResult.style.display = 'block';
            analysisResult.innerHTML = `<p>⏳ <em>Analyzing financial profile with Gemini AI... Please wait.</em></p>`;

            try {
                const response = await fetch('/analyse', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        income: incomeVal,
                        expenses: expensesObj,
                        goals: goalsVal,
                        currency: state.currency
                    })
                });

                const data = await response.json();

                if (!response.ok || data.error) {
                    analysisResult.innerHTML = `<div class="error-message" style="color: var(--accent-danger); font-weight: 600;">⚠️ ${data.error || 'Failed to generate financial analysis.'}</div>`;
                    return;
                }

                // Render JSON analysis results
                const totalIncome = data.total_income || incomeVal;
                const totalExpenses = data.total_expenses || Object.values(expensesObj).reduce((a, b) => a + b, 0);
                const netSavings = data.net_savings !== undefined ? data.net_savings : (totalIncome - totalExpenses);
                const savingsRate = data.savings_rate_percent !== undefined ? data.savings_rate_percent : Math.round((netSavings / totalIncome) * 100);

                let breakdownHtml = '';
                if (data.breakdown && data.breakdown.length > 0) {
                    breakdownHtml = `
                        <h4 style="margin-top: 1.2rem; color: var(--text-primary);">Category Expense Breakdown & Audit</h4>
                        <div class="table-responsive" style="margin-top: 0.5rem;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        <th>Amount</th>
                                        <th>Share (%)</th>
                                        <th>Status</th>
                                        <th>Recommendation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.breakdown.map(item => `
                                        <tr>
                                            <td><strong>${item.category}</strong></td>
                                            <td>${formatAmount(item.amount)}</td>
                                            <td>${item.percentage}%</td>
                                            <td><span class="badge ${item.status === 'Healthy' ? 'success' : (item.status === 'Warning' ? 'warning' : 'danger')}">${item.status}</span></td>
                                            <td>${item.recommendation || '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                let recsHtml = '';
                if (data.recommendations && data.recommendations.length > 0) {
                    recsHtml = `
                        <div class="ai-insight-box" style="margin-top: 1.2rem;">
                            <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">💡 Key Actionable Recommendations</h4>
                            <ul style="padding-left: 1.2rem; margin: 0; line-height: 1.6;">
                                ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }

                analysisResult.innerHTML = `
                    <div class="result-metric-grid">
                        <div class="result-stat-box">
                            <span>Monthly Income</span>
                            <strong>${formatAmount(totalIncome)}</strong>
                        </div>
                        <div class="result-stat-box warning">
                            <span>Total Expenses</span>
                            <strong>${formatAmount(totalExpenses)}</strong>
                        </div>
                        <div class="result-stat-box highlight">
                            <span>Net Monthly Savings</span>
                            <strong>${formatAmount(netSavings)}</strong>
                        </div>
                        <div class="result-stat-box ${savingsRate >= 20 ? 'success' : 'warning'}">
                            <span>Savings Rate</span>
                            <strong>${savingsRate}%</strong>
                        </div>
                    </div>
                    <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                        <p style="margin: 0; font-size: 0.95rem; line-height: 1.5; color: var(--text-primary);"><strong>Overview:</strong> ${data.summary || 'Financial profile analyzed successfully.'}</p>
                        ${data.savings_target ? `<p style="margin-top: 0.5rem; color: var(--accent-success); font-weight: 600;">🎯 Suggested Target Savings / Month: ${formatAmount(data.savings_target)}</p>` : ''}
                    </div>
                    ${breakdownHtml}
                    ${recsHtml}
                `;

            } catch (err) {
                console.error(err);
                analysisResult.innerHTML = `<div class="error-message" style="color: var(--accent-danger);">⚠️ Network error while running analysis: ${err.message}</div>`;
            }
        });
    }

    // Initial Render
    updateDashboard();
    renderTransactions();
    renderGoals();
});
