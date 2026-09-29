/**
 * Connect Four — script.js
 * ─────────────────────────────────────────────────────────
 * Architecture:
 *   • GameState   — pure 2D-array state machine
 *   • WinEngine   — multi-vector win checker
 *   • StorageAPI  — localStorage wrapper
 *   • UI          — DOM rendering & animation layer
 *   • Controller  — event wiring, coordinates all modules
 * ─────────────────────────────────────────────────────────
 */

'use strict';

/* ══════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════ */
const ROWS    = 6;
const COLS    = 7;
const EMPTY   = 0;
const P1      = 1;  // Red
const P2      = 2;  // Yellow
const WIN_LEN = 4;

const STORAGE_KEY_P1 = 'c4_score_p1';
const STORAGE_KEY_P2 = 'c4_score_p2';

/* ══════════════════════════════════════════════════════════
   STORAGE API
   Wraps localStorage safely so the app still works if
   storage is unavailable (private mode, etc.)
══════════════════════════════════════════════════════════ */
const StorageAPI = {
  _get(key, fallback = 0) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? parseInt(raw, 10) : fallback;
    } catch { return fallback; }
  },
  _set(key, value) {
    try { localStorage.setItem(key, String(value)); } catch { /* silent */ }
  },
  _remove(key) {
    try { localStorage.removeItem(key); } catch { /* silent */ }
  },

  getScores() {
    return {
      p1: this._get(STORAGE_KEY_P1, 0),
      p2: this._get(STORAGE_KEY_P2, 0),
    };
  },
  incrementScore(player) {
    const key = player === P1 ? STORAGE_KEY_P1 : STORAGE_KEY_P2;
    const current = this._get(key, 0);
    this._set(key, current + 1);
    return current + 1;
  },
  resetScores() {
    this._remove(STORAGE_KEY_P1);
    this._remove(STORAGE_KEY_P2);
  },
};

/* ══════════════════════════════════════════════════════════
   GAME STATE
   Pure data model — no DOM access.
══════════════════════════════════════════════════════════ */
const GameState = {
  board: [],          // [row][col] → EMPTY | P1 | P2
  currentPlayer: P1,
  gameOver: false,
  moveCount: 0,

  /** Create/reset a fresh 6×7 board filled with EMPTY. */
  init() {
    this.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
    this.currentPlayer = P1;
    this.gameOver = false;
    this.moveCount = 0;
  },

  /**
   * Attempt to drop a token into column `col`.
   * Returns the row index where the token landed, or -1 if the column is full.
   */
  dropToken(col) {
    if (this.gameOver) return -1;
    // Gravity: find the lowest empty row in this column
    for (let row = ROWS - 1; row >= 0; row--) {
      if (this.board[row][col] === EMPTY) {
        this.board[row][col] = this.currentPlayer;
        this.moveCount++;
        return row;
      }
    }
    return -1; // column full
  },

  /** Returns true when all 42 cells are filled (draw). */
  isBoardFull() {
    return this.moveCount >= ROWS * COLS;
  },

  /** Switch to the other player. */
  switchPlayer() {
    this.currentPlayer = this.currentPlayer === P1 ? P2 : P1;
  },

  /** Mark game as finished. */
  endGame() {
    this.gameOver = true;
  },

  /** Check if column `col` still has an empty slot. */
  isColumnPlayable(col) {
    return this.board[0][col] === EMPTY;
  },
};

/* ══════════════════════════════════════════════════════════
   WIN ENGINE
   Scans all four vectors after each placement.
   Returns winning cells as [{row, col}, …] or null.
══════════════════════════════════════════════════════════ */
const WinEngine = {
  /**
   * Main entry point.
   * @param {number[][]} board  The current 2D board.
   * @param {number}     row    Row of the most-recently placed token.
   * @param {number}     col    Column of the most-recently placed token.
   * @param {number}     player P1 or P2.
   * @returns {Array<{row:number, col:number}>|null}  Winning cells or null.
   */
  check(board, row, col, player) {
    // Directions: [dRow, dCol]
    const directions = [
      [0, 1],   // Horizontal →
      [1, 0],   // Vertical ↓
      [1, 1],   // Diagonal ↘
      [1, -1],  // Diagonal ↙
    ];

    for (const [dr, dc] of directions) {
      const cells = this._scanLine(board, row, col, player, dr, dc);
      if (cells !== null) return cells;
    }
    return null;
  },

  /**
   * Scan in both halves of a direction and collect consecutive matches.
   * Returns the winning 4+ cells or null.
   */
  _scanLine(board, row, col, player, dr, dc) {
    // Walk in positive direction
    const cells = [{ row, col }];

    for (let step = 1; step < WIN_LEN; step++) {
      const r = row + dr * step;
      const c = col + dc * step;
      if (!this._inBounds(r, c) || board[r][c] !== player) break;
      cells.push({ row: r, col: c });
    }

    // Walk in negative direction
    for (let step = 1; step < WIN_LEN; step++) {
      const r = row - dr * step;
      const c = col - dc * step;
      if (!this._inBounds(r, c) || board[r][c] !== player) break;
      cells.unshift({ row: r, col: c });
    }

    return cells.length >= WIN_LEN ? cells.slice(0, WIN_LEN) : null;
  },

  _inBounds(row, col) {
    return row >= 0 && row < ROWS && col >= 0 && col < COLS;
  },
};

/* ══════════════════════════════════════════════════════════
   UI MODULE
   All DOM reads and writes live here.
══════════════════════════════════════════════════════════ */
const UI = {
  /* Element references */
  elBoardGrid:    null,
  elColTargets:   null,
  elColPreviews:  null,
  elBoardFrame:   null,
  elTurnBanner:   null,
  elTurnPip:      null,
  elTurnText:     null,
  elScoreP1:      null,
  elScoreP2:      null,
  elScoreCardP1:  null,
  elScoreCardP2:  null,
  elModalBackdrop:null,
  elModalTrophy:  null,
  elModalTitle:   null,
  elModalSubtitle:null,
  elBtnResetBoard:null,
  elBtnResetAll:  null,
  elBtnPlayAgain: null,
  elBtnModalResetAll: null,

  /** Grab all DOM references (called once on init). */
  cacheElements() {
    this.elBoardGrid     = document.getElementById('board-grid');
    this.elColTargets    = document.getElementById('col-targets');
    this.elColPreviews   = document.getElementById('col-previews');
    this.elBoardFrame    = document.querySelector('.board-frame');
    this.elTurnBanner    = document.getElementById('turn-banner');
    this.elTurnPip       = document.getElementById('turn-pip');
    this.elTurnText      = document.getElementById('turn-text');
    this.elScoreP1       = document.getElementById('score-p1');
    this.elScoreP2       = document.getElementById('score-p2');
    this.elScoreCardP1   = document.getElementById('score-card-p1');
    this.elScoreCardP2   = document.getElementById('score-card-p2');
    this.elModalBackdrop = document.getElementById('modal-backdrop');
    this.elModalTrophy   = document.getElementById('modal-trophy');
    this.elModalTitle    = document.getElementById('modal-title');
    this.elModalSubtitle = document.getElementById('modal-subtitle');
    this.elBtnResetBoard    = document.getElementById('btn-reset-board');
    this.elBtnResetAll      = document.getElementById('btn-reset-all');
    this.elBtnPlayAgain     = document.getElementById('modal-play-again');
    this.elBtnModalResetAll = document.getElementById('modal-reset-all');
  },

  /**
   * Build the 6×7 cell grid and 7 column targets + preview slots.
   * This only needs to run once on startup; cells are cleared per-game
   * via clearBoard().
   */
  buildBoard() {
    // ── Cells
    this.elBoardGrid.innerHTML = '';
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Row ${row + 1} Column ${col + 1}`);
        this.elBoardGrid.appendChild(cell);
      }
    }

    // ── Column click targets
    this.elColTargets.innerHTML = '';
    for (let col = 0; col < COLS; col++) {
      const target = document.createElement('button');
      target.classList.add('col-target');
      target.dataset.col = col;
      target.setAttribute('aria-label', `Drop token in column ${col + 1}`);
      target.setAttribute('type', 'button');
      this.elColTargets.appendChild(target);
    }

    // ── Column preview slots (hover indicators)
    this.elColPreviews.innerHTML = '';
    for (let col = 0; col < COLS; col++) {
      const preview = document.createElement('div');
      preview.classList.add('col-preview');
      preview.dataset.col = col;
      const pip = document.createElement('div');
      pip.classList.add('preview-token');
      preview.appendChild(pip);
      this.elColPreviews.appendChild(preview);
    }
  },

  /**
   * Clear all token elements from cells without rebuilding the DOM.
   */
  clearBoard() {
    const cells = this.elBoardGrid.querySelectorAll('.cell');
    cells.forEach(cell => {
      cell.innerHTML = '';
    });
    // Unblock all column targets
    const targets = this.elColTargets.querySelectorAll('.col-target');
    targets.forEach(t => {
      t.classList.remove('blocked');
      t.removeAttribute('disabled');
    });
    // Remove board frame hover class
    this.elBoardFrame.classList.remove('col-hover-p1', 'col-hover-p2');
  },

  /**
   * Animate dropping a token into the specified cell.
   * @param {number} landRow   Row index where token lands (0 = top).
   * @param {number} col       Column index.
   * @param {number} player    P1 or P2.
   * @param {Function} onDone  Called when animation finishes.
   */
  animateDrop(landRow, col, player, onDone) {
    const cellIndex = landRow * COLS + col;
    const cell = this.elBoardGrid.children[cellIndex];

    const token = document.createElement('div');
    token.classList.add('token', player === P1 ? 'p1' : 'p2');

    // Calculate how far the token needs to fall (in %).
    // The cell is position: relative, token is absolute inset:0.
    // We offset by the number of rows above × (cell-size + gap)
    // expressed as a percentage of the cell height.
    // Simpler approach: use a large negative translateY then animate to 0.
    // Compute the visual distance: each row = 100% of cell height + gap.
    const cellSize   = cell.offsetHeight || 64;
    const gapPx      = parseFloat(getComputedStyle(this.elBoardGrid).rowGap) || 8;
    const totalPx    = (landRow * (cellSize + gapPx)) + cellSize;
    // Express as % of the token's own height (same as cell)
    const dropPct    = ((totalPx / cellSize) * 100).toFixed(1);

    token.style.setProperty('--drop-start', `-${dropPct}%`);
    token.classList.add('drop');

    cell.appendChild(token);

    // Remove animation class after it completes to keep token in place
    token.addEventListener('animationend', () => {
      token.classList.remove('drop');
      token.style.removeProperty('--drop-start');
      token.style.transform = 'translateY(0)';
      if (typeof onDone === 'function') onDone();
    }, { once: true });
  },

  /**
   * Apply the winner pulse/glow class to the four winning cells.
   * @param {Array<{row:number, col:number}>} winCells
   */
  highlightWinners(winCells) {
    winCells.forEach(({ row, col }) => {
      const cellIndex = row * COLS + col;
      const cell = this.elBoardGrid.children[cellIndex];
      const token = cell.querySelector('.token');
      if (token) token.classList.add('winner');
    });
  },

  /**
   * Mark a column as full (blocked) so the cursor changes.
   */
  blockColumn(col) {
    const target = this.elColTargets.children[col];
    if (target) {
      target.classList.add('blocked');
      target.setAttribute('disabled', 'true');
    }
  },

  /**
   * Block all column targets (game over state).
   */
  blockAllColumns() {
    Array.from(this.elColTargets.children).forEach(t => {
      t.classList.add('blocked');
      t.setAttribute('disabled', 'true');
    });
  },

  /** Update the turn indicator banner. */
  setTurnBanner(player, isGameOver = false) {
    const label = player === P1 ? 'Player 1' : 'Player 2';
    this.elTurnBanner.className = `turn-banner ${player === P1 ? 'p1' : 'p2'}${isGameOver ? ' game-over' : ''}`;
    this.elTurnPip.className = 'turn-banner__pip';
    this.elTurnText.textContent = isGameOver ? 'Game Over' : `${label}'s Turn`;
  },

  /** Show the column hover preview pip and board frame glow. */
  showColHover(col, player) {
    // Clear all previews
    Array.from(this.elColPreviews.children).forEach(p => {
      p.classList.remove('hovered', 'p1', 'p2');
    });
    if (col < 0) {
      this.elBoardFrame.classList.remove('col-hover-p1', 'col-hover-p2');
      return;
    }
    const preview = this.elColPreviews.children[col];
    if (preview) {
      preview.classList.add('hovered', player === P1 ? 'p1' : 'p2');
    }
    this.elBoardFrame.classList.toggle('col-hover-p1', player === P1);
    this.elBoardFrame.classList.toggle('col-hover-p2', player === P2);
  },

  /** Highlight the active player's score card. */
  setActiveScoreCard(player) {
    this.elScoreCardP1.classList.toggle('active', player === P1);
    this.elScoreCardP2.classList.toggle('active', player === P2);
  },

  /** Update score display with a bump animation. */
  setScore(player, value) {
    const el = player === P1 ? this.elScoreP1 : this.elScoreP2;
    el.textContent = value;
    el.classList.remove('bump');
    // Force reflow to restart the animation
    void el.offsetWidth;
    el.classList.add('bump');
    el.addEventListener('animationend', () => el.classList.remove('bump'), { once: true });
  },

  /** Load and display scores from storage (no animation). */
  displayScores(scores) {
    this.elScoreP1.textContent = scores.p1;
    this.elScoreP2.textContent = scores.p2;
  },

  /** Open the win/draw modal. */
  showModal({ player, isDraw }) {
    if (isDraw) {
      this.elModalTrophy.textContent = '🤝';
      this.elModalTitle.textContent = 'It\'s a Draw!';
      this.elModalTitle.className = 'modal__title';
      this.elModalSubtitle.textContent = 'All 42 slots filled — nobody wins this round.';
    } else {
      const label = player === P1 ? 'Player 1' : 'Player 2';
      const cls   = player === P1 ? 'p1' : 'p2';
      this.elModalTrophy.textContent = '🏆';
      this.elModalTitle.textContent = `${label} Wins!`;
      this.elModalTitle.className = `modal__title ${cls}`;
      this.elModalSubtitle.textContent = 'Four in a row — spectacular!';
    }
    this.elModalBackdrop.hidden = false;
    // Focus the play-again button for accessibility
    this.elBtnPlayAgain.focus();
  },

  /** Close the modal. */
  hideModal() {
    this.elModalBackdrop.hidden = true;
  },
};

/* ══════════════════════════════════════════════════════════
   CONTROLLER
   Coordinates GameState, WinEngine, StorageAPI, and UI.
══════════════════════════════════════════════════════════ */
const Controller = {
  /** Tracks whether a drop animation is currently in progress. */
  _dropping: false,

  /** Bootstrap everything. */
  init() {
    UI.cacheElements();
    UI.buildBoard();

    const scores = StorageAPI.getScores();
    UI.displayScores(scores);

    this._startNewGame();
    this._bindEvents();
  },

  /** Reset the board state and UI for a fresh game round. */
  _startNewGame() {
    GameState.init();
    UI.clearBoard();
    UI.hideModal();
    UI.setTurnBanner(P1);
    UI.setActiveScoreCard(P1);
    UI.showColHover(-1, P1); // clear hover
    this._dropping = false;
  },

  /** Wire all user-interaction events. */
  _bindEvents() {
    // ── Column click targets: drop token
    UI.elColTargets.addEventListener('click', (e) => {
      const target = e.target.closest('.col-target');
      if (!target) return;
      const col = parseInt(target.dataset.col, 10);
      this._handleColumnClick(col);
    });

    // ── Column hover: show preview pip
    UI.elColTargets.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.col-target');
      if (!target || GameState.gameOver) return;
      const col = parseInt(target.dataset.col, 10);
      if (GameState.isColumnPlayable(col)) {
        UI.showColHover(col, GameState.currentPlayer);
      }
    });

    UI.elColTargets.addEventListener('mouseleave', () => {
      UI.showColHover(-1, GameState.currentPlayer);
    });

    // ── Touch: show preview on touchstart
    UI.elColTargets.addEventListener('touchstart', (e) => {
      const target = e.target.closest('.col-target');
      if (!target || GameState.gameOver) return;
      const col = parseInt(target.dataset.col, 10);
      if (GameState.isColumnPlayable(col)) {
        UI.showColHover(col, GameState.currentPlayer);
      }
    }, { passive: true });

    // ── Keyboard: allow arrow keys + Enter/Space on column targets
    UI.elColTargets.addEventListener('keydown', (e) => {
      const target = e.target.closest('.col-target');
      if (!target) return;
      const col = parseInt(target.dataset.col, 10);

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._handleColumnClick(col);
      } else if (e.key === 'ArrowLeft' && col > 0) {
        e.preventDefault();
        UI.elColTargets.children[col - 1].focus();
      } else if (e.key === 'ArrowRight' && col < COLS - 1) {
        e.preventDefault();
        UI.elColTargets.children[col + 1].focus();
      }
    });

    // ── Reset Board button
    UI.elBtnResetBoard.addEventListener('click', () => {
      this._startNewGame();
    });

    // ── Reset All (scores + board)
    UI.elBtnResetAll.addEventListener('click', () => {
      StorageAPI.resetScores();
      UI.displayScores({ p1: 0, p2: 0 });
      this._startNewGame();
    });

    // ── Modal: Play Again
    UI.elBtnPlayAgain.addEventListener('click', () => {
      this._startNewGame();
    });

    // ── Modal: Reset Scores
    UI.elBtnModalResetAll.addEventListener('click', () => {
      StorageAPI.resetScores();
      UI.displayScores({ p1: 0, p2: 0 });
      this._startNewGame();
    });

    // ── Close modal on backdrop click (outside modal box)
    UI.elModalBackdrop.addEventListener('click', (e) => {
      if (e.target === UI.elModalBackdrop) {
        UI.hideModal();
      }
    });

    // ── Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !UI.elModalBackdrop.hidden) {
        UI.hideModal();
      }
    });
  },

  /**
   * Core move handler: validates, commits to state, animates,
   * checks win/draw, updates scores.
   */
  _handleColumnClick(col) {
    // Guard rails
    if (GameState.gameOver || this._dropping) return;
    if (!GameState.isColumnPlayable(col)) return;

    const player = GameState.currentPlayer;

    // Commit move to the 2D array and get the landing row
    const landRow = GameState.dropToken(col);
    if (landRow === -1) return; // safety net — column was full

    // Check if the column is now full and block its target
    if (!GameState.isColumnPlayable(col)) {
      UI.blockColumn(col);
    }

    // Clear hover preview while animating
    UI.showColHover(-1, player);

    // Lock input during animation
    this._dropping = true;

    // Animate the drop, then resolve game state
    UI.animateDrop(landRow, col, player, () => {
      this._dropping = false;

      // ── Win check
      const winCells = WinEngine.check(GameState.board, landRow, col, player);
      if (winCells !== null) {
        GameState.endGame();
        UI.highlightWinners(winCells);
        UI.blockAllColumns();
        UI.setTurnBanner(player, true);
        UI.setActiveScoreCard(player);

        // Increment and display score
        const newScore = StorageAPI.incrementScore(player);
        UI.setScore(player, newScore);

        // Show modal after a short delay to let the glow render
        setTimeout(() => {
          UI.showModal({ player, isDraw: false });
        }, 800);
        return;
      }

      // ── Draw check
      if (GameState.isBoardFull()) {
        GameState.endGame();
        UI.blockAllColumns();
        UI.setTurnBanner(player, true);
        setTimeout(() => {
          UI.showModal({ player: null, isDraw: true });
        }, 400);
        return;
      }

      // ── Continue: switch player, update UI
      GameState.switchPlayer();
      const next = GameState.currentPlayer;
      UI.setTurnBanner(next);
      UI.setActiveScoreCard(next);
    });
  },
};

/* ══════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  Controller.init();
});
