/**
 * Baccarat Simulator
 * Rules:
 * - Player/Banker pay 1:1
 * - Banker winning with 6 pays 1:2 (0.5:1)
 * - Tie pays 8:1
 */

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class BaccaratGame {
    constructor() {
        this.deck = [];
        this.bankroll = 50000000;
        this.initialBankroll = 50000000;
        this.currentBet = 0;
        this.selectedBetType = null; // 'player', 'banker', 'tie'
        this.isAutoMode = false;
        this.autoInterval = null;
        this.isProcessing = false;
        this.gameSpeed = 200; // ms delay

        // New Stats & History
        this.history = []; // Array of 'P', 'B', 'T'
        this.simStats = {
            playerWins: 0,
            bankerWins: 0,
            ties: 0,
            totalHands: 0
        };

        this.ui = {
            playerCards: document.getElementById('player-cards'),
            bankerCards: document.getElementById('banker-cards'),
            playerScore: document.getElementById('player-score'),
            bankerScore: document.getElementById('banker-score'),
            feedbackText: document.getElementById('feedback-text'),
            bankroll: document.getElementById('bankroll'),
            profitLoss: document.getElementById('profit-loss'),
            betInput: document.getElementById('bet-amount'),
            btnDeal: document.getElementById('btn-deal'),
            btnAuto: document.getElementById('btn-auto'),
            btnSim100: document.getElementById('btn-sim-100'),
            btnSim1000: document.getElementById('btn-sim-1000'),
            btnReset: document.getElementById('btn-reset'),
            roadmap: document.getElementById('roadmap'),
            bigRoad: document.getElementById('big-road'),
            simStatsDisplay: document.getElementById('sim-stats-display'),
            btnClearBet: document.getElementById('btn-clear-bet'),
            shoeCount: document.getElementById('shoe-count'),
            shoeTotal: document.getElementById('shoe-total'),
            shoeBar: document.getElementById('shoe-bar'),
            betBoxes: {
                player: document.getElementById('bet-player'),
                banker: document.getElementById('bet-banker'),
                tie: document.getElementById('bet-tie')
            }
        };

        this.loadState();
        this.bindEvents();

        if (this.deck.length === 0) this.createDeck();
        else this.updateShoeIndicator();

        this.selectBet('player'); // Default selection
        this.updateStats();
        this.renderRoadmap();
        this.renderBigRoad();
    }

    bindEvents() {
        // Bet Selection
        Object.entries(this.ui.betBoxes).forEach(([type, el]) => {
            el.addEventListener('click', () => this.selectBet(type));
        });

        // Chip Buttons
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const val = parseInt(e.target.dataset.value);
                this.addChip(val);
            });
        });

        // Speed Controls
        document.querySelectorAll('.btn-speed').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.gameSpeed = parseInt(e.target.dataset.speed);
            });
        });

        this.ui.btnClearBet.addEventListener('click', () => {
            this.ui.betInput.value = 0;
        });

        document.getElementById('btn-edit-bankroll').addEventListener('click', () => {
            const bankrollEl = document.getElementById('bankroll');
            const currentVal = this.bankroll;

            // If already editing, do nothing
            if (bankrollEl.querySelector('input')) return;

            // Replace text with input
            bankrollEl.innerHTML = `
                <input type="number" id="bankroll-input" value="${currentVal}" style="width: 120px; padding: 2px; border-radius: 4px; border: 1px solid #ccc; color: black;">
                <button id="btn-save-bankroll" style="cursor: pointer; background: var(--accent-success); border: none; border-radius: 4px; padding: 2px 6px; color: white; margin-left: 4px;">OK</button>
            `;

            const input = document.getElementById('bankroll-input');
            const saveBtn = document.getElementById('btn-save-bankroll');

            input.focus();

            const save = () => {
                const val = parseFloat(input.value);
                if (!isNaN(val) && val > 0) {
                    this.bankroll = val;
                    this.initialBankroll = val;
                    this.updateStats(); // Will restore the span text
                    this.saveState();
                    // Reset Profit/Loss for new session
                    this.ui.profitLoss.textContent = '$0';
                    this.ui.profitLoss.style.color = 'var(--text-main)';
                } else {
                    alert("Montant invalide");
                    this.updateStats(); // Restore old value
                }
            };

            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling
                save();
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') save();
            });
        });

        this.ui.btnDeal.addEventListener('click', () => this.playRound(true));

        this.ui.btnAuto.addEventListener('click', () => this.toggleAutoMode());

        this.ui.btnSim100.addEventListener('click', () => this.runSimulation(100));
        this.ui.btnSim1000.addEventListener('click', () => this.runSimulation(1000));

        this.ui.btnReset.addEventListener('click', () => {
            this.bankroll = 50000000;
            this.initialBankroll = 50000000;
            this.history = [];
            this.simStats = { playerWins: 0, bankerWins: 0, ties: 0, totalHands: 0 };
            this.createDeck();
            this.updateStats();
            this.renderRoadmap();
            this.renderBigRoad();
            this.ui.simStatsDisplay.innerHTML = '';
            this.ui.feedbackText.textContent = 'Réinitialisé';
            this.selectBet('player');
            this.saveState();
        });
    }

    saveState() {
        const state = {
            bankroll: this.bankroll,
            history: this.history,
            simStats: this.simStats,
            // Don't save deck to keep it simple, just reset deck on reload if needed or keep simple
        };
        localStorage.setItem('baccarat_state', JSON.stringify(state));
    }

    loadState() {
        const saved = localStorage.getItem('baccarat_state');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.bankroll = state.bankroll || 50000000;
                this.history = state.history || [];
                this.simStats = state.simStats || { playerWins: 0, bankerWins: 0, ties: 0, totalHands: 0 };
            } catch (e) {
                console.error("Error loading state", e);
            }
        }
    }

    addChip(value) {
        let current = parseInt(this.ui.betInput.value) || 0;
        this.ui.betInput.value = current + value;
    }

    selectBet(type) {
        if (this.isProcessing && !this.isAutoMode) return;

        this.selectedBetType = type;

        // Update UI
        Object.values(this.ui.betBoxes).forEach(el => el.classList.remove('selected'));
        this.ui.betBoxes[type].classList.add('selected');

        this.ui.btnDeal.disabled = false;
    }

    createDeck() {
        this.deck = [];
        // 8 decks is standard for Baccarat
        for (let i = 0; i < 8; i++) {
            for (const suit of SUITS) {
                for (const rank of RANKS) {
                    this.deck.push({
                        suit,
                        rank,
                        value: this.getCardValue(rank),
                        id: `${i}-${suit}-${rank}-${Math.random().toString(36).substr(2, 9)}`
                    });
                }
            }
        }
        this.shuffle();
        // Burn card simulation
        this.deck.pop();
        this.updateShoeIndicator();
    }

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    updateShoeIndicator() {
        const total = 8 * 52;
        const current = this.deck.length;
        this.ui.shoeCount.textContent = current;
        this.ui.shoeTotal.textContent = total;
        const pct = (current / total) * 100;
        this.ui.shoeBar.style.width = `${pct}%`;

        if (pct < 10) this.ui.shoeBar.style.background = 'var(--accent-danger)';
        else this.ui.shoeBar.style.background = 'var(--accent-warning)';
    }

    getCardValue(rank) {
        if (['10', 'J', 'Q', 'K'].includes(rank)) return 0;
        if (rank === 'A') return 1;
        return parseInt(rank);
    }

    calculateScore(cards) {
        const sum = cards.reduce((acc, card) => acc + card.value, 0);
        return sum % 10;
    }

    async playRound(animate = true) {
        if (this.isProcessing && animate) return;

        const betAmount = parseInt(this.ui.betInput.value);
        if (isNaN(betAmount) || betAmount <= 0) {
            alert('Mise invalide');
            return;
        }
        if (betAmount > this.bankroll) {
            if (animate) alert('Fonds insuffisants');
            this.stopAutoMode();
            return;
        }

        if (!this.selectedBetType) {
            if (animate) alert('Sélectionnez un pari');
            return;
        }

        this.isProcessing = true;
        if (animate) this.ui.btnDeal.disabled = true;

        // Deduct bet
        this.bankroll -= betAmount;
        this.updateStats();

        if (this.deck.length < 20) this.createDeck();

        const playerHand = [];
        const bankerHand = [];

        // Initial Deal
        playerHand.push(this.deck.pop());
        bankerHand.push(this.deck.pop());
        playerHand.push(this.deck.pop());
        bankerHand.push(this.deck.pop());

        this.updateShoeIndicator();

        if (animate) {
            this.ui.playerCards.innerHTML = '';
            this.ui.bankerCards.innerHTML = '';
            this.ui.playerScore.textContent = '';
            this.ui.bankerScore.textContent = '';

            await this.renderCard(playerHand[0], this.ui.playerCards);
            await this.renderCard(bankerHand[0], this.ui.bankerCards);
            await this.renderCard(playerHand[1], this.ui.playerCards);
            await this.renderCard(bankerHand[1], this.ui.bankerCards);
        }

        let playerScore = this.calculateScore(playerHand);
        let bankerScore = this.calculateScore(bankerHand);

        if (animate) {
            this.ui.playerScore.textContent = playerScore;
            this.ui.bankerScore.textContent = bankerScore;
        }

        let playerThirdCard = null;
        let isNatural = false;

        // Natural Win Check (8 or 9)
        if (playerScore >= 8 || bankerScore >= 8) {
            isNatural = true;
            if (animate) {
                // Show Natural Badge
                if (playerScore >= 8) this.ui.playerScore.innerHTML += ' <span class="natural-badge">Natural</span>';
                if (bankerScore >= 8) this.ui.bankerScore.innerHTML += ' <span class="natural-badge">Natural</span>';
            }
        } else {
            // Player Draw Rules
            if (playerScore <= 5) {
                if (animate) await this.sleep(this.gameSpeed * 3);
                const card = this.deck.pop();
                playerHand.push(card);
                playerThirdCard = card.value;
                this.updateShoeIndicator();
                if (animate) {
                    await this.renderCard(card, this.ui.playerCards);
                    playerScore = this.calculateScore(playerHand);
                    this.ui.playerScore.textContent = playerScore;
                }
            }

            // Banker Draw Rules
            let bankerDraws = false;
            if (playerHand.length === 2) {
                // Player stood
                if (bankerScore <= 5) bankerDraws = true;
            } else {
                // Player drew
                if (bankerScore <= 2) bankerDraws = true;
                else if (bankerScore === 3 && playerThirdCard !== 8) bankerDraws = true;
                else if (bankerScore === 4 && [2, 3, 4, 5, 6, 7].includes(playerThirdCard)) bankerDraws = true;
                else if (bankerScore === 5 && [4, 5, 6, 7].includes(playerThirdCard)) bankerDraws = true;
                else if (bankerScore === 6 && [6, 7].includes(playerThirdCard)) bankerDraws = true;
            }

            if (bankerDraws) {
                if (animate) await this.sleep(this.gameSpeed * 3);
                const card = this.deck.pop();
                bankerHand.push(card);
                this.updateShoeIndicator();
                if (animate) {
                    await this.renderCard(card, this.ui.bankerCards);
                    bankerScore = this.calculateScore(bankerHand);
                    this.ui.bankerScore.textContent = bankerScore;
                }
            }
        }

        // Recalculate final scores (if not animated, we need them here)
        if (!animate) {
            playerScore = this.calculateScore(playerHand);
            bankerScore = this.calculateScore(bankerHand);
        }

        // Determine Winner
        let result = 'tie';
        let payout = 0;

        if (playerScore > bankerScore) result = 'player';
        else if (bankerScore > playerScore) result = 'banker';

        // Update History & Stats
        this.history.push(result === 'player' ? 'P' : (result === 'banker' ? 'B' : 'T'));
        if (result === 'player') this.simStats.playerWins++;
        else if (result === 'banker') this.simStats.bankerWins++;
        else this.simStats.ties++;
        this.simStats.totalHands++;

        this.saveState();

        if (animate) {
            this.renderRoadmap();
            this.renderBigRoad();
        }

        // Payout Logic
        if (result === this.selectedBetType) {
            if (result === 'player') {
                payout = betAmount * 2; // 1:1 + stake
            } else if (result === 'banker') {
                if (bankerScore === 6) {
                    payout = betAmount + (betAmount * 0.5); // 1:2 odds (0.5:1)
                } else {
                    payout = betAmount * 2; // 1:1 + stake
                }
            } else if (result === 'tie') {
                payout = betAmount + (betAmount * 8); // 8:1 + stake
            }
        } else if (result === 'tie' && this.selectedBetType !== 'tie') {
            // Push on tie for Player/Banker bets
            payout = betAmount;
        }

        this.bankroll += payout;
        const profit = payout - betAmount;

        if (animate) {
            this.updateStats();

            let msg = '';
            if (result === 'tie') msg = 'EGALITÉ (Tie)';
            else msg = `${result.toUpperCase()} Gagne!`;

            if (profit > 0) msg += ` +$${profit}`;
            else if (profit === 0) msg += ` (Push)`;
            else msg += ` -$${betAmount}`;

            this.ui.feedbackText.textContent = msg;
            this.ui.feedbackText.className = profit > 0 ? 'feedback-message feedback-win' : (profit < 0 ? 'feedback-message feedback-loss' : 'feedback-message feedback-tie');

            this.ui.btnDeal.disabled = false;
            this.isProcessing = false;
        }

        return profit;
    }

    renderRoadmap() {
        this.ui.roadmap.innerHTML = '';
        // Show last 60 hands max to fit
        const recentHistory = this.history.slice(-60);

        recentHistory.forEach(res => {
            const bead = document.createElement('div');
            bead.className = `bead ${res === 'P' ? 'player' : (res === 'B' ? 'banker' : 'tie')}`;
            bead.textContent = res;
            this.ui.roadmap.appendChild(bead);
        });

        // Scroll to end
        this.ui.roadmap.scrollLeft = this.ui.roadmap.scrollWidth;
    }

    renderBigRoad() {
        this.ui.bigRoad.innerHTML = '';
        const matrix = this.calculateBigRoadMatrix();

        matrix.forEach(col => {
            const colEl = document.createElement('div');
            colEl.className = 'big-road-column';

            col.forEach(cell => {
                const cellEl = document.createElement('div');
                cellEl.className = 'big-road-cell';

                if (cell.type) {
                    const circle = document.createElement('div');
                    circle.className = `big-road-circle ${cell.type === 'P' ? 'player' : 'banker'}`;
                    cellEl.appendChild(circle);

                    if (cell.ties > 0) {
                        const line = document.createElement('div');
                        line.className = 'big-road-tie-line';
                        cellEl.appendChild(line);
                    }
                }
                colEl.appendChild(cellEl);
            });

            this.ui.bigRoad.appendChild(colEl);
        });

        // Scroll to end
        this.ui.bigRoad.parentElement.scrollLeft = this.ui.bigRoad.parentElement.scrollWidth;
    }

    calculateBigRoadMatrix() {
        // Simplified Big Road Logic
        // Columns of same winner. Ties don't break column but add a mark.
        // If Tie is first, it's tricky. We'll skip initial ties for column start logic to keep it simple.

        const columns = [];
        let currentCol = [];
        let lastWinner = null;

        // Max rows usually 6
        const MAX_ROWS = 6;

        this.history.forEach(res => {
            if (res === 'T') {
                // Add tie to last item if exists
                if (currentCol.length > 0) {
                    currentCol[currentCol.length - 1].ties++;
                } else if (columns.length > 0) {
                    // Add to last column's last item
                    const lastCol = columns[columns.length - 1];
                    if (lastCol.length > 0) lastCol[lastCol.length - 1].ties++;
                }
                return; // Don't add new cell for tie
            }

            if (res !== lastWinner) {
                // New Column
                if (currentCol.length > 0) columns.push(this.padColumn(currentCol, MAX_ROWS));
                currentCol = [{ type: res, ties: 0 }];
                lastWinner = res;
            } else {
                // Same Winner, add to column
                if (currentCol.length < MAX_ROWS) {
                    currentCol.push({ type: res, ties: 0 });
                } else {
                    // Dragon tail (go right) - simplified: just start new col for this sim
                    columns.push(this.padColumn(currentCol, MAX_ROWS));
                    currentCol = [{ type: res, ties: 0 }];
                }
            }
        });

        if (currentCol.length > 0) columns.push(this.padColumn(currentCol, MAX_ROWS));

        return columns;
    }

    padColumn(col, maxRows) {
        const padded = [...col];
        while (padded.length < maxRows) {
            padded.push({});
        }
        return padded;
    }

    async renderCard(card, container) {
        const el = document.createElement('div');
        el.className = `card ${['♥', '♦'].includes(card.suit) ? 'red' : 'black'} dealt`;
        el.innerHTML = `
            <div class="suit-top">${card.suit}</div>
            <div class="rank-center">${card.rank}</div>
            <div class="suit-bottom">${card.suit}</div>
        `;
        container.appendChild(el);
        await this.sleep(this.gameSpeed);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatMoney(amount) {
        // Format with ' as thousand separator
        // Keep 1 decimal if it's not a whole number, otherwise 0
        const formatted = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(1);
        return '$' + formatted.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    }

    updateStats() {
        this.ui.bankroll.textContent = this.formatMoney(this.bankroll);
        const totalPL = this.bankroll - this.initialBankroll;
        this.ui.profitLoss.textContent = (totalPL >= 0 ? '+' : '') + this.formatMoney(totalPL);
        this.ui.profitLoss.style.color = totalPL >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';
    }

    toggleAutoMode() {
        this.isAutoMode = !this.isAutoMode;
        if (this.isAutoMode) {
            this.ui.btnAuto.classList.add('auto-mode-active');
            this.ui.btnAuto.textContent = 'Stop Auto';
            if (!this.selectedBetType) this.selectBet('player'); // Default
            this.autoLoop();
        } else {
            this.stopAutoMode();
        }
    }

    stopAutoMode() {
        this.isAutoMode = false;
        this.ui.btnAuto.classList.remove('auto-mode-active');
        this.ui.btnAuto.textContent = 'Mode Auto';
        clearTimeout(this.autoInterval);
    }

    async autoLoop() {
        if (!this.isAutoMode) return;
        await this.playRound(true);
        if (this.isAutoMode) {
            this.autoInterval = setTimeout(() => this.autoLoop(), this.gameSpeed * 2); // Adjust delay based on speed
        }
    }

    async runSimulation(count) {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.ui.feedbackText.textContent = `Simulating ${count} hands...`;

        // Default to Player if nothing selected
        if (!this.selectedBetType) this.selectedBetType = 'player';

        // Use a small timeout to let UI update
        await this.sleep(50);

        let startBankroll = this.bankroll;

        try {
            for (let i = 0; i < count; i++) {
                // Force logic without animation
                await this.playRound(false);
                // Yield to UI occasionally
                if (i % 50 === 0) await this.sleep(0);
            }
        } catch (error) {
            console.error("Simulation error:", error);
            this.ui.feedbackText.textContent = "Erreur simulation";
        } finally {
            this.isProcessing = false;
            this.updateStats();
            this.renderRoadmap();
            this.renderBigRoad();

            const diff = this.bankroll - startBankroll;
            this.ui.feedbackText.textContent = `Simulé ${count} mains. P/L: ${diff >= 0 ? '+' : ''}${this.formatMoney(diff)}`;

            // Update Sim Stats Display
            const total = this.simStats.totalHands;
            const pPct = ((this.simStats.playerWins / total) * 100).toFixed(1);
            const bPct = ((this.simStats.bankerWins / total) * 100).toFixed(1);
            const tPct = ((this.simStats.ties / total) * 100).toFixed(1);

            this.ui.simStatsDisplay.innerHTML = `
                <strong>Statistiques (${total} mains):</strong><br>
                Player: ${this.simStats.playerWins} (${pPct}%) | 
                Banker: ${this.simStats.bankerWins} (${bPct}%) | 
                Tie: ${this.simStats.ties} (${tPct}%)
            `;

            this.saveState();
        }
    }
}

window.game = new BaccaratGame();
