// WealthWise Personal Finance Dashboard - Client Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // Per-user data isolation
    let currentUser = null;

    function userKey(key) {
        return currentUser ? `wealthwise_${currentUser}_${key}` : `wealthwise_${key}`;
    }

    // Authentication Logic
    const authOverlay = document.getElementById('auth-overlay');
    const mainAppContainer = document.getElementById('main-app-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const authMessage = document.getElementById('auth-message');
    const btnLogout = document.getElementById('btn-logout');

    function showAuthMessage(msg, isSuccess=false) {
        authMessage.textContent = msg;
        authMessage.style.color = isSuccess ? 'var(--accent)' : 'var(--accent-danger)';
        authMessage.style.display = 'block';
    }

    // Toggle forms
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        authMessage.style.display = 'none';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        authMessage.style.display = 'none';
    });

    // Check status on load
    fetch('/api/auth/status')
        .then(res => res.json())
        .then(data => {
            if (data.logged_in) {
                currentUser = data.username;
                authOverlay.style.display = 'none';
                mainAppContainer.style.display = 'block';
                loadUserData();
            } else {
                authOverlay.style.display = 'flex';
                mainAppContainer.style.display = 'none';
            }
        });

    // Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                currentUser = username;
                authOverlay.style.display = 'none';
                mainAppContainer.style.display = 'block';
                loadUserData();
            } else {
                showAuthMessage(data.error || 'Login failed.');
            }
        } catch (err) {
            showAuthMessage('Connection error.');
        }
    });

    // Handle Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                currentUser = username;
                authOverlay.style.display = 'none';
                mainAppContainer.style.display = 'block';
                loadUserData();
            } else {
                showAuthMessage(data.error || 'Registration failed.');
            }
        } catch (err) {
            showAuthMessage('Connection error.');
        }
    });

    // Handle Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
                currentUser = null;
                // Reset UI to login state
                authOverlay.style.display = 'flex';
                mainAppContainer.style.display = 'none';
                loginForm.reset();
                registerForm.reset();
                authMessage.style.display = 'none';
                // Switch back to login view if it was on register
                registerForm.style.display = 'none';
                loginForm.style.display = 'block';
            } catch (err) {
                console.error('Logout error:', err);
            }
        });
    }

    // Custom Step Logic — Exact +500 / -500 on ANY current value
    // Works for both keyboard arrow keys AND browser spinner button clicks
    const numInputPrevVals = new WeakMap();

    // Track value BEFORE spinner click so we can compute direction
    document.addEventListener('mousedown', (e) => {
        if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
            numInputPrevVals.set(e.target, parseFloat(e.target.value) || 0);
        }
    });

    // When spinner buttons change the value, detect direction and override to ±500
    document.addEventListener('input', (e) => {
        if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
            const prev = numInputPrevVals.has(e.target) ? numInputPrevVals.get(e.target) : null;
            if (prev !== null) {
                const curr = parseFloat(e.target.value);
                if (!isNaN(curr) && curr !== prev) {
                    // Only override if the delta looks like the native spinner step
                    // (i.e. not a manual typed change — check if diff is small)
                    const diff = curr - prev;
                    if (Math.abs(diff) < 500 && diff !== 0) {
                        const newVal = diff > 0 ? prev + 500 : Math.max(0, prev - 500);
                        e.target.value = newVal;
                    }
                    // Clear so it doesn't re-fire on manual input
                    numInputPrevVals.delete(e.target);
                }
            }
        }
    });

    // Keyboard ArrowUp / ArrowDown — exact ±500 on any value
    document.addEventListener('keydown', (e) => {
        if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const currentVal = parseFloat(e.target.value) || 0;
                if (e.key === 'ArrowUp') {
                    e.target.value = currentVal + 500;
                } else {
                    e.target.value = Math.max(0, currentVal - 500);
                }
                e.target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });

    // Mouse wheel scroll on number input — exact ±500
    document.addEventListener('wheel', (e) => {
        if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
            e.preventDefault();
            const currentVal = parseFloat(e.target.value) || 0;
            if (e.deltaY < 0) {
                e.target.value = currentVal + 500;
            } else {
                e.target.value = Math.max(0, currentVal - 500);
            }
            e.target.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, { passive: false });


    // State management
    const state = {
        currency: 'INR',
        currencySymbol: '₹'
    };

    // Currency Selector Setup
    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) {
        currencySelect.addEventListener('change', (e) => {
            const selectedOpt = currencySelect.options[currencySelect.selectedIndex];
            state.currency = selectedOpt.value;
            state.currencySymbol = selectedOpt.getAttribute('data-symbol') || selectedOpt.value;
            
            localStorage.setItem(userKey('currency'), state.currency);
            localStorage.setItem(userKey('symbol'), state.currencySymbol);
            
            updateCurrencyLabels();
        });
    }

    function updateCurrencyLabels() {
        document.querySelectorAll('.curr-symbol').forEach(el => {
            el.textContent = state.currencySymbol;
        });
    }
    updateCurrencyLabels();

    // Load all user-specific data from localStorage after login
    function loadUserData() {
        // Load currency preference
        state.currency = localStorage.getItem(userKey('currency')) || 'INR';
        state.currencySymbol = localStorage.getItem(userKey('symbol')) || '₹';
        if (currencySelect) currencySelect.value = state.currency;
        updateCurrencyLabels();

        // Pre-populate previously entered advisor details
        const savedIncome = localStorage.getItem(userKey('income'));
        const savedExpenses = localStorage.getItem(userKey('expenses'));
        document.getElementById('income_input').value = savedIncome || '';
        document.querySelectorAll('.expense-input').forEach(input => input.value = '');
        if (savedExpenses) {
            try {
                const expObj = JSON.parse(savedExpenses);
                document.querySelectorAll('.expense-input').forEach(input => {
                    const cat = input.getAttribute('data-category');
                    if (expObj[cat] !== undefined) {
                        input.value = expObj[cat];
                    }
                });
            } catch (e) {
                console.error("Failed to parse saved expenses from local storage", e);
            }
        }

        // Load goals
        try {
            goalsList = JSON.parse(localStorage.getItem(userKey('goals')));
        } catch(e) {
            goalsList = null;
        }
        goalsList = goalsList || [];

        // Load activities
        try {
            activitiesList = JSON.parse(localStorage.getItem(userKey('activities')));
        } catch(e) {
            activitiesList = null;
        }
        activitiesList = activitiesList || [];

        // Hide results section on fresh login
        if (resultsSection) resultsSection.style.display = 'none';
        if (feedbackZone) feedbackZone.style.display = 'none';
    }

    // UI Elements
    const advisorForm = document.getElementById('advisor-form');
    const btnSubmit = document.getElementById('btn-submit');
    const feedbackZone = document.getElementById('feedback-zone');
    const resultsSection = document.getElementById('results-section');

    const resIncome = document.getElementById('res-income');
    const resSpend = document.getElementById('res-spend');
    const resSavings = document.getElementById('res-savings');
    const resRate = document.getElementById('res-rate');

    const budgetCardsBox = document.getElementById('budget-cards-box');
    const analysisChipsBox = document.getElementById('analysis-chips-box');
    const suggestionsListBox = document.getElementById('suggestions-list-box');

    // Utility: Format currency amounts
    function formatAmount(num) {
        const val = parseFloat(num);
        if (isNaN(val)) return `${state.currencySymbol}0.00`;
        return `${state.currencySymbol}${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Utility: Map common expense categories to Font Awesome icons
    function getIconForCategory(category) {
        const cat = category.toLowerCase();
        if (cat.includes('rent') || cat.includes('housing')) return 'fa-solid fa-house';
        if (cat.includes('food') || cat.includes('groceries') || cat.includes('dining')) return 'fa-solid fa-utensils';
        if (cat.includes('transport') || cat.includes('commute') || cat.includes('car') || cat.includes('fuel')) return 'fa-solid fa-car';
        if (cat.includes('utility') || cat.includes('bill') || cat.includes('insurance')) return 'fa-solid fa-file-invoice-dollar';
        if (cat.includes('entertainment') || cat.includes('leisure') || cat.includes('game') || cat.includes('play')) return 'fa-solid fa-gamepad';
        return 'fa-solid fa-ellipsis';
    }

    // Dynamic results rendering helper function
    function renderResults(data) {
        // Hide feedback zone and show results section
        feedbackZone.style.display = 'none';
        resultsSection.style.display = 'grid';

        // 1. Populate Metrics Ribbon
        const budgetObj = data.budget || {};
        const incomeVal = parseFloat(document.getElementById('income_input').value) || 0;
        resIncome.textContent = formatAmount(budgetObj.total_income || incomeVal);
        resSpend.textContent = formatAmount(budgetObj.total_expenses || 0);
        resSavings.textContent = formatAmount(budgetObj.net_savings || 0);
        resRate.textContent = `${budgetObj.savings_rate_percent || 0}%`;

        // 2. Populate Budget Cards (Left Column)
        budgetCardsBox.innerHTML = '';
        const analysisObj = data.analysis || {};
        const breakdownList = analysisObj.breakdown || [];

        breakdownList.forEach(item => {
            // Determine fill colors based on status
            let fillClass = 'green';
            if (item.status === 'Warning') fillClass = 'yellow';
            else if (item.status === 'Overbudget') fillClass = 'red';

            const card = document.createElement('div');
            card.className = 'budget-card';
            card.innerHTML = `
                <div class="budget-card-header">
                    <div class="budget-card-title">
                        <i class="${getIconForCategory(item.category)}"></i>
                        <span>${item.category.charAt(0).toUpperCase() + item.category.slice(1)}</span>
                    </div>
                    <div class="budget-card-values">
                        <span class="amount">${formatAmount(item.amount)}</span>
                        <span class="pct">${item.percentage}% of income</span>
                    </div>
                </div>
                <div class="progress-container">
                    <div class="progress-track">
                        <div class="progress-fill ${fillClass}" style="width: ${Math.min(100, item.percentage)}%"></div>
                    </div>
                    <div class="progress-labels">
                        <span>Status: <strong>${item.status}</strong></span>
                        <span>Tip: ${item.tip || 'Optimize spending'}</span>
                    </div>
                </div>
            `;
            budgetCardsBox.appendChild(card);
        });

        // 3. Populate Spending Analysis Chips (Right Column)
        analysisChipsBox.innerHTML = '';
        breakdownList.forEach(item => {
            let statusClass = 'on-track';
            if (item.status === 'Warning') statusClass = 'warning';
            else if (item.status === 'Overbudget') statusClass = 'overspending';

            const chip = document.createElement('div');
            chip.className = `analysis-chip-card ${statusClass}`;
            chip.innerHTML = `
                <div class="analysis-chip-header">
                    <span>${item.category.charAt(0).toUpperCase() + item.category.slice(1)}</span>
                    <span class="analysis-status-badge ${statusClass}">${item.status}</span>
                </div>
                <div class="analysis-chip-value">${item.percentage}%</div>
                <div class="analysis-chip-tip">${item.tip || 'No breach flagged'}</div>
            `;
            analysisChipsBox.appendChild(chip);
        });

        // 4. Populate Future Plans List (Right Column) — max 7 short points
        suggestionsListBox.innerHTML = '';
        const suggestionsList = (data.suggestions || []).slice(0, 7);
        if (suggestionsList.length === 0) {
            suggestionsListBox.innerHTML = '<li style="color:var(--text-secondary);font-style:italic;">No future plans generated.</li>';
        } else {
            suggestionsList.forEach((plan, idx) => {
                const li = document.createElement('li');
                li.style.cssText = 'display:flex; align-items:flex-start; gap:0.6rem; padding:0.55rem 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.9rem; line-height:1.5;';
                li.innerHTML = `
                    <span style="min-width:22px; height:22px; background:linear-gradient(135deg,#0ea5e9,#6366f1); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; color:#fff; margin-top:2px;">${idx + 1}</span>
                    <span style="color:var(--text-primary);">${plan}</span>
                `;
                suggestionsListBox.appendChild(li);
            });
        }

        // 5. Populate Savings Tips
        const savingsTipsBox = document.createElement('div');
        const savingsTipsHeader = document.createElement('h4');
        savingsTipsHeader.textContent = 'Savings Tips';
        savingsTipsBox.appendChild(savingsTipsHeader);
        const savingsList = document.createElement('ul');
        (data.savings_tips || []).forEach((tip, idx) => {
            const li = document.createElement('li');
            li.textContent = tip;
            savingsList.appendChild(li);
        });
        savingsTipsBox.appendChild(savingsList);
        suggestionsListBox.parentNode.insertBefore(savingsTipsBox, suggestionsListBox.nextSibling);

        // 6. Populate Investment Tips
        const investmentTipsBox = document.createElement('div');
        const investmentTipsHeader = document.createElement('h4');
        investmentTipsHeader.textContent = 'Investment Tips';
        investmentTipsBox.appendChild(investmentTipsHeader);
        const investmentList = document.createElement('ul');
        (data.investment_tips || []).forEach((tip, idx) => {
            const li = document.createElement('li');
            li.textContent = tip;
            investmentList.appendChild(li);
        });
        investmentTipsBox.appendChild(investmentList);
        savingsTipsBox.parentNode.insertBefore(investmentTipsBox, savingsTipsBox.nextSibling);

        // Automatically smooth-scroll to results section
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Submit Advisor Form Handler
    if (advisorForm) {
        advisorForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const incomeVal = parseFloat(document.getElementById('income_input').value);
            const goalsVal = document.getElementById('goals_input').value.trim();

            // Client-side validation: Check income > 0
            if (isNaN(incomeVal) || incomeVal < 0) {
                feedbackZone.style.display = 'block';
                feedbackZone.innerHTML = `
                    <div class="error-message">
                        <i class="fa-solid fa-circle-exclamation"></i>
                        <span>Monthly income must be a valid number greater than or equal to 0.</span>
                    </div>
                `;
                return;
            }

            // Collect category expense inputs
            const expensesObj = {};
            document.querySelectorAll('.expense-input').forEach(input => {
                const category = input.getAttribute('data-category');
                const val = parseFloat(input.value);
                if (!isNaN(val) && val >= 0) {
                    expensesObj[category] = val;
                }
            });

            // Client-side validation: Check at least 1 expense entry
            if (Object.keys(expensesObj).length === 0) {
                feedbackZone.style.display = 'block';
                feedbackZone.innerHTML = `
                    <div class="error-message">
                        <i class="fa-solid fa-circle-exclamation"></i>
                        <span>Please enter at least one category expense greater than or equal to 0.</span>
                    </div>
                `;
                return;
            }

            // Store original button content and state, then disable & show spinner loader
            const originalBtnContent = btnSubmit.innerHTML;
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<div class="spinner" style="width: 20px; height: 20px; border-width: 2px; margin: 0 auto;"></div>`;

            // Show Loading state in feedback zone
            feedbackZone.style.display = 'block';
            resultsSection.style.display = 'none';
            feedbackZone.innerHTML = `
                <div class="glass-card loading-box">
                    <div class="spinner"></div>
                    <p style="color: var(--text-secondary); font-size: 0.95rem;">Invoking WealthWise AI Engine... Auditing your budget.</p>
                </div>
            `;

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
                    feedbackZone.innerHTML = `
                        <div class="error-message">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>${data.error || 'Failed to generate financial analysis.'}</span>
                        </div>
                    `;
                    return;
                }

                // Save details per user
                localStorage.setItem(userKey('has_details'), 'true');
                localStorage.setItem(userKey('income'), incomeVal.toString());
                localStorage.setItem(userKey('expenses'), JSON.stringify(expensesObj));

                // Render results dynamically and scroll to section
                renderResults(data);

            } catch (err) {
                console.error(err);
                feedbackZone.innerHTML = `
                    <div class="error-message">
                        <i class="fa-solid fa-circle-exclamation"></i>
                        <span>Connection error while communicating with advisor engine: ${err.message}</span>
                    </div>
                `;
            } finally {
                // Restore submit button state regardless of success or failure
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = originalBtnContent;
            }
        });
    }

    // -------------------------------------------------------------
    // Hamburger Navigation Menu & Modals Logic
    // -------------------------------------------------------------
    const menuToggle = document.getElementById('menu-toggle');
    const menuDropdown = document.getElementById('menu-dropdown');

    if (menuToggle && menuDropdown) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!menuDropdown.contains(e.target) && e.target !== menuToggle) {
                menuDropdown.classList.remove('active');
            }
        });
    }

    // Handle menu item clicks to launch modals
    document.querySelectorAll('.menu-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');

            // Auto-fill modules
            autoFillModules();

            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('active');
                menuDropdown.classList.remove('active');
                if (modalId === 'goals-modal') {
                    renderGoalsList();
                } else if (modalId === 'activity-modal') {
                    renderActivitiesList();
                } else if (modalId === 'graph-modal') {
                    renderYearlyGraph();
                }
            }
        });
    });

    // Helper: Collect current expenses from main dashboard
    function getEnteredExpenses() {
        const expensesObj = {};
        document.querySelectorAll('.expense-input').forEach(input => {
            const category = input.getAttribute('data-category');
            const val = parseFloat(input.value);
            if (!isNaN(val) && val >= 0) {
                expensesObj[category] = val;
            }
        });
        return expensesObj;
    }

    // Helper: Auto-fill fields across modules
    function autoFillModules() {
        const income = parseFloat(document.getElementById('income_input').value) || 0;
        const rent = parseFloat(document.getElementById('exp_rent').value) || 0;
        const food = parseFloat(document.getElementById('exp_food').value) || 0;
        const transport = parseFloat(document.getElementById('exp_transport').value) || 0;
        const bills = parseFloat(document.getElementById('exp_utilities').value) || 0;
        const entertainment = parseFloat(document.getElementById('exp_entertainment').value) || 0;
        const other = parseFloat(document.getElementById('exp_other').value) || 0;
        
        const totalExpenses = rent + food + transport + bills + entertainment + other;

        // Budget Generator Modal fields
        if (document.getElementById('bg_income')) document.getElementById('bg_income').value = income;
        if (document.getElementById('bg_rent')) document.getElementById('bg_rent').value = rent;
        if (document.getElementById('bg_bills')) document.getElementById('bg_bills').value = bills;
        if (document.getElementById('bg_food')) document.getElementById('bg_food').value = food;
        if (document.getElementById('bg_dining')) document.getElementById('bg_dining').value = entertainment;
        if (document.getElementById('bg_transport')) document.getElementById('bg_transport').value = transport;

        // Investments Modal fields
        if (document.getElementById('inv_income')) document.getElementById('inv_income').value = income;
        if (document.getElementById('inv_expenses')) document.getElementById('inv_expenses').value = totalExpenses;

        // Debt Modal fields
        if (document.getElementById('debt_user_income')) document.getElementById('debt_user_income').value = income;

        // Emergency Modal fields
        if (document.getElementById('ef_rent')) document.getElementById('ef_rent').value = rent;
        if (document.getElementById('ef_food')) document.getElementById('ef_food').value = food;
        if (document.getElementById('ef_transport')) document.getElementById('ef_transport').value = transport;
        if (document.getElementById('ef_bills')) document.getElementById('ef_bills').value = bills;
    }

    // Handle modal close buttons
    document.querySelectorAll('.modal-close, #btn-cancel-goal-modal, #btn-cancel-activity-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalOverlay = btn.closest('.modal-overlay');
            if (modalOverlay) {
                modalOverlay.classList.remove('active');
            }
        });
    });

    // Close when clicking modal backdrop
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });

    // -------------------------------------------------------------
    // Budget Generator Handler
    // -------------------------------------------------------------
    const budgetGenForm = document.getElementById('budget-gen-form');
    const budgetGenResult = document.getElementById('budget-gen-result');

    if (budgetGenForm) {
        budgetGenForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const income = parseFloat(document.getElementById('bg_income').value);
            const profile = document.getElementById('bg_profile').value;
            const rent = parseFloat(document.getElementById('bg_rent').value) || 0;
            const bills = parseFloat(document.getElementById('bg_bills').value) || 0;
            const food = parseFloat(document.getElementById('bg_food').value) || 0;
            const dining = parseFloat(document.getElementById('bg_dining').value) || 0;
            const transport = parseFloat(document.getElementById('bg_transport').value) || 0;
            const targetSavings = parseFloat(document.getElementById('bg_savings').value) || 0;

            const fixedTotal = rent + bills;
            const variableTotal = food + dining + transport;
            const netSavings = income - fixedTotal - variableTotal;

            budgetGenResult.style.display = 'block';
            budgetGenResult.innerHTML = `<p>⏳ <em>Generating personalized 50/30/20 salaried budget layout... Please wait.</em></p>`;

            try {
                const promptText = `Personalized Salaried Budget Generator Request:\nProfile: ${profile}\nMonthly Income: ${formatAmount(income)}\nFixed Expenses: ${formatAmount(fixedTotal)} (Rent ${formatAmount(rent)}, Bills ${formatAmount(bills)})\nVariable Expenses: ${formatAmount(variableTotal)} (Food ${formatAmount(food)}, Dining ${formatAmount(dining)}, Transport ${formatAmount(transport)})\nTarget Savings: ${formatAmount(targetSavings)}\nNet Savings: ${formatAmount(netSavings)}\n\nPlease provide a structured budget plan with:\n1. Fixed vs Variable breakdown evaluation\n2. Specific spending caps for dining and food\n3. Clear monthly savings targets to reach the target goal of ${formatAmount(targetSavings)}.`;
                
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: [{ role: 'user', content: promptText }] })
                });
                const data = await res.json();
                if (data.content) {
                    const formatted = data.content
                        .replace(/\n\n/g, '</p><p>')
                        .replace(/\n/g, '<br>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    budgetGenResult.innerHTML = `<h4>💡 AI Budget Strategy</h4><p>${formatted}</p>`;
                } else {
                    budgetGenResult.innerHTML = `<p style="color: var(--accent-danger);">⚠️ Unable to generate AI budget plan.</p>`;
                }
            } catch (err) {
                console.error(err);
                budgetGenResult.innerHTML = `<p style="color: var(--accent-danger);">⚠️ Connection error: ${err.message}</p>`;
            }
        });
    }

    // -------------------------------------------------------------
    // Investments Advisor Handler
    // -------------------------------------------------------------
    const investForm = document.getElementById('invest-form');
    const investResult = document.getElementById('invest-result');

    if (investForm) {
        investForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const income = parseFloat(document.getElementById('inv_income').value);
            const expenses = parseFloat(document.getElementById('inv_expenses').value) || 0;
            const existing = parseFloat(document.getElementById('inv_existing').value) || 0;
            const invAmount = parseFloat(document.getElementById('inv_amount').value);
            const goal = document.getElementById('inv_goal').value.trim();
            const period = parseFloat(document.getElementById('inv_period').value);
            const risk = document.getElementById('inv_risk').value;

            investResult.style.display = 'block';
            investResult.innerHTML = `<p>⏳ <em>Analyzing risk tolerance & generating target portfolio options... Please wait.</em></p>`;

            try {
                const promptText = `Investments Module Query:\nCurrency: ${state.currency} (${state.currencySymbol})\nMonthly Income: ${formatAmount(income)}\nMonthly Expenses: ${formatAmount(expenses)}\nExisting Savings: ${formatAmount(existing)}\nMonthly Investment Amount: ${formatAmount(invAmount)}\nGoal: ${goal}\nTime Period: ${period} Years\nRisk Level: ${risk}\n\nPlease analyze risk profile, suggest asset categories (mutual funds, FDs, PPF, index funds), list liquidity info, and provide diversification strategies. Include SEBI disclaimer.`;

                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: [{ role: 'user', content: promptText }] })
                });
                const data = await res.json();
                if (data.content) {
                    const formatted = data.content
                        .replace(/\n\n/g, '</p><p>')
                        .replace(/\n/g, '<br>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    investResult.innerHTML = `
                        <div class="metrics-ribbon" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                            <div class="metric-box">
                                <span>Investable / Month</span>
                                <strong>${formatAmount(invAmount)}</strong>
                            </div>
                            <div class="metric-box">
                                <span>Horizon</span>
                                <strong>${period} Years</strong>
                            </div>
                            <div class="metric-box">
                                <span>Risk Appetite</span>
                                <strong>${risk}</strong>
                            </div>
                        </div>
                        <div style="line-height: 1.6; color: var(--text-primary); margin-top: 1rem;">${formatted}</div>
                        <div class="sebi-disclaimer">
                            ⚠️ <strong>SEBI Disclaimer:</strong> This advice is for research and educational purposes only. Please consult a SEBI registered investment adviser before making market investments.
                        </div>
                    `;
                } else {
                    investResult.innerHTML = `<p style="color: var(--accent-danger);">⚠️ Unable to generate portfolio recommendations.</p>`;
                }
            } catch (err) {
                console.error(err);
                investResult.innerHTML = `<p style="color: var(--accent-danger);">⚠️ Connection error: ${err.message}</p>`;
            }
        });
    }

    // -------------------------------------------------------------
    // Debt & Loan Planner Handler
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
            const statusText = isAffordable ? 'Affordable EMI (<35% of income)' : 'High Debt Burden (>35% of income)';

            debtResult.style.display = 'block';
            debtResult.innerHTML = `
                <div class="metrics-ribbon" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                    <div class="metric-box">
                        <span>Calculated EMI</span>
                        <strong>${formatAmount(Math.round(emi))}</strong>
                    </div>
                    <div class="metric-box">
                        <span>Total Interest</span>
                        <strong>${formatAmount(Math.round(totalInterest))}</strong>
                    </div>
                    <div class="metric-box">
                        <span>Total Repay</span>
                        <strong>${formatAmount(Math.round(totalRepayment))}</strong>
                    </div>
                    <div class="metric-box">
                        <span>Affordability Ratio</span>
                        <strong>${emiIncomeRatio.toFixed(1)}%</strong>
                    </div>
                </div>
                <div class="sebi-disclaimer" style="background: ${isAffordable ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)'}; border-color: ${isAffordable ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.2)'}; color: ${isAffordable ? 'var(--accent)' : '#ec7063'};">
                    <strong>Status: ${statusText}</strong><br>
                    ${isAffordable ? '🎉 Your EMI payments are inside safe guidelines. Maintain healthy reserves.' : '⚠️ Warning: Debt burden exceeds recommended threshold (35%). Consider debt consolidation or snowball method.'}
                </div>
            `;
        });
    }

    // -------------------------------------------------------------
    // Emergency Fund Safety Net Planner
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
                <div class="metrics-ribbon" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                    <div class="metric-box">
                        <span>Monthly Essentials</span>
                        <strong>${formatAmount(monthlyEssentials)}</strong>
                    </div>
                    <div class="metric-box">
                        <span>Target Fund</span>
                        <strong>${formatAmount(targetEmergencyFund)}</strong>
                    </div>
                    <div class="metric-box">
                        <span>Current Saved</span>
                        <strong>${formatAmount(currentSavings)}</strong>
                    </div>
                    <div class="metric-box">
                        <span>Shortfall Target</span>
                        <strong>${formatAmount(shortfall)}</strong>
                    </div>
                </div>
                <div class="progress-container" style="margin-top: 1rem;">
                    <div class="progress-track">
                        <div class="progress-fill ${progressPct >= 100 ? 'green' : (progressPct >= 50 ? 'yellow' : 'red')}" style="width: ${progressPct}%"></div>
                    </div>
                    <div class="progress-labels">
                        <span>Fund Progress: ${progressPct}%</span>
                        <span>Target safety coverage: ${months} Months</span>
                    </div>
                </div>
                <div class="sebi-disclaimer" style="margin-top: 1rem;">
                    <strong>Safety Net Action Plan:</strong> ${shortfall === 0 ? '🎉 Your safety buffer is fully funded. Well done!' : `Maintain savings of approximately <strong>${formatAmount(Math.round(shortfall / 6))} / month</strong> for 6 months to reach your safety milestone.`}
                </div>
            `;
        });
    }

    // -------------------------------------------------------------
    // Savings Goals System
    // -------------------------------------------------------------
    let goalsList = [];

    const goalsGridBox = document.getElementById('goals-grid-box');
    const btnOpenAddGoal = document.getElementById('btn-open-add-goal');
    const addGoalModal = document.getElementById('add-goal-modal');
    const goalForm = document.getElementById('goal-form');

    if (btnOpenAddGoal) {
        btnOpenAddGoal.addEventListener('click', () => {
            addGoalModal.classList.add('active');
        });
    }

    function renderGoalsList() {
        if (!goalsGridBox) return;
        goalsGridBox.innerHTML = '';

        if (goalsList.length === 0) {
            goalsGridBox.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--text-secondary); padding: 2rem;">No financial goals created yet. Click "New Goal" above!</div>`;
            return;
        }

        goalsList.forEach(goal => {
            const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
            const card = document.createElement('div');
            card.className = 'goal-card';
            card.innerHTML = `
                <div class="goal-card-header">
                    <span class="goal-card-title">${goal.title}</span>
                    <button class="btn-del-goal" data-id="${goal.id}">&times;</button>
                </div>
                <div class="goal-card-values">
                    Saved <strong>${formatAmount(goal.current)}</strong> of <strong>${formatAmount(goal.target)}</strong> (${pct}%)
                </div>
                <div class="progress-container">
                    <div class="progress-track">
                        <div class="progress-fill ${pct >= 100 ? 'green' : (pct >= 50 ? 'yellow' : 'red')}" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
            goalsGridBox.appendChild(card);
        });

        // Add delete listeners
        goalsGridBox.querySelectorAll('.btn-del-goal').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.getAttribute('data-id'));
                goalsList = goalsList.filter(g => g.id !== id);
                localStorage.setItem(userKey('goals'), JSON.stringify(goalsList));
                renderGoalsList();
            });
        });
    }

    if (goalForm) {
        goalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('goal_title').value.trim();
            const target = parseFloat(document.getElementById('goal_target').value);
            const current = parseFloat(document.getElementById('goal_current').value) || 0;

            if (!title || isNaN(target) || target <= 0) return;

            goalsList.push({
                id: Date.now(),
                title, target, current
            });

            localStorage.setItem(userKey('goals'), JSON.stringify(goalsList));
            goalForm.reset();
            addGoalModal.classList.remove('active');
            renderGoalsList();
        });
    }

    // -------------------------------------------------------------
    // Activity / Transaction Tracker System
    // -------------------------------------------------------------
    let activitiesList = [];

    const activityRows = document.getElementById('activity-rows');
    const filterTypeDropdown = document.getElementById('activity-filter-type');
    const btnOpenAddActivity = document.getElementById('btn-open-add-activity');
    const addActivityModal = document.getElementById('add-activity-modal');
    const activityForm = document.getElementById('activity-form');

    if (btnOpenAddActivity && addActivityModal) {
        btnOpenAddActivity.addEventListener('click', () => {
            addActivityModal.classList.add('active');
        });
    }

    if (filterTypeDropdown) {
        filterTypeDropdown.addEventListener('change', renderActivitiesList);
    }

    function renderActivitiesList() {
        if (!activityRows) return;
        activityRows.innerHTML = '';

        const selectedType = filterTypeDropdown ? filterTypeDropdown.value : 'all';
        const filtered = activitiesList.filter(act => selectedType === 'all' || act.type === selectedType);

        if (filtered.length === 0) {
            activityRows.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">No transaction activities logged.</td></tr>`;
            return;
        }

        filtered.slice().reverse().forEach(act => {
            const isInc = act.type === 'income';
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.innerHTML = `
                <td style="padding: 0.75rem; color: #fff; font-weight: 600;">${act.desc}</td>
                <td style="padding: 0.75rem; color: var(--text-secondary);">${act.category}</td>
                <td style="padding: 0.75rem;"><span class="analysis-status-badge ${isInc ? 'on-track' : 'overspending'}" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; border-radius: 4px;">${isInc ? 'Income' : 'Expense'}</span></td>
                <td style="padding: 0.75rem; font-weight: 700; color: ${isInc ? 'var(--accent)' : 'var(--text-primary)'}">
                    ${isInc ? '+' : '-'}${formatAmount(act.amount)}
                </td>
                <td style="padding: 0.75rem;">
                    <button class="btn-del-activity" data-id="${act.id}" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-size: 1.1rem; line-height: 1;">
                        &times;
                    </button>
                </td>
            `;
            activityRows.appendChild(tr);
        });

        // Add delete handlers
        activityRows.querySelectorAll('.btn-del-activity').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.getAttribute('data-id'));
                activitiesList = activitiesList.filter(act => act.id !== id);
                localStorage.setItem(userKey('activities'), JSON.stringify(activitiesList));
                renderActivitiesList();
            });
        });
    }

    if (activityForm) {
        activityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const type = activityForm.querySelector('input[name="act_type"]:checked').value;
            const desc = document.getElementById('act_desc').value.trim();
            const amount = parseFloat(document.getElementById('act_amount').value);
            const category = document.getElementById('act_category').value;

            if (!desc || isNaN(amount) || amount < 0) return;

            activitiesList.push({
                id: Date.now(),
                type,
                desc,
                amount,
                category,
                date: new Date().toISOString().split('T')[0]
            });

            localStorage.setItem(userKey('activities'), JSON.stringify(activitiesList));
            activityForm.reset();
            addActivityModal.classList.remove('active');
            renderActivitiesList();
        });
    }

    // -------------------------------------------------------------
    // Yearly Graph Logic
    // -------------------------------------------------------------
    let yearlyChartInstance = null;

    function renderYearlyGraph() {
        const income = parseFloat(document.getElementById('income_input').value) || 0;
        const entertainment = parseFloat(document.getElementById('exp_entertainment').value) || 0;
        const allExpenses = getEnteredExpenses();
        const totalExpenses = Object.values(allExpenses).reduce((a, b) => a + b, 0);

        const yearlyIncome = income * 12;
        const yearlyExpenses = totalExpenses * 12;
        const yearlyEntertainment = entertainment * 12;

        const ctx = document.getElementById('yearlyChart');
        if (!ctx) return;

        if (yearlyChartInstance) {
            yearlyChartInstance.destroy();
        }

        yearlyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Yearly Income', 'Yearly Total Expenses', 'Yearly Entertainment'],
                datasets: [{
                    label: `Amount (${state.currencySymbol})`,
                    data: [yearlyIncome, yearlyExpenses, yearlyEntertainment],
                    backgroundColor: [
                        'rgba(14, 165, 233, 0.7)',
                        'rgba(244, 63, 94, 0.7)',
                        'rgba(168, 85, 247, 0.7)'
                    ],
                    borderColor: [
                        'rgba(14, 165, 233, 1)',
                        'rgba(244, 63, 94, 1)',
                        'rgba(168, 85, 247, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
});
