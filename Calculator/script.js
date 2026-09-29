const expressionLine   = document.getElementById('expressionLine');
const resultLine        = document.getElementById('resultLine');
const historyList       = document.getElementById('historyList');
const historyEmpty      = document.getElementById('historyEmpty');
const historyPanel      = document.getElementById('historyPanel');
const historyToggleBtn  = document.getElementById('historyToggleBtn');
const clearHistoryBtn   = document.getElementById('clearHistoryBtn');

const MAX_HISTORY = 10;

let currentInput    = '';
let expression      = '';
let justEvaluated   = false;
let historyVisible  = false;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('calc_history') || '[]');
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem('calc_history', JSON.stringify(history));
}

function renderHistory() {
  const history = loadHistory();
  historyList.innerHTML = '';

  if (history.length === 0) {
    historyList.appendChild(historyEmpty);
    historyEmpty.style.display = 'block';
    return;
  }

  historyEmpty.style.display = 'none';

  history.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML = `
      <div class="hist-formula">${item.formula}</div>
      <div class="hist-result">= ${item.result}</div>
    `;
    el.addEventListener('click', () => {
      currentInput = String(item.result);
      expression   = '';
      justEvaluated = true;
      updateDisplay();
    });
    historyList.appendChild(el);
  });
}

function addToHistory(formula, result) {
  const history = loadHistory();
  history.unshift({ formula, result });
  if (history.length > MAX_HISTORY) history.pop();
  saveHistory(history);
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem('calc_history');
  renderHistory();
}

function updateDisplay() {
  expressionLine.textContent = expression || '\u00a0';

  const display = currentInput !== '' ? currentInput : '0';
  resultLine.textContent = display;
  resultLine.classList.remove('error');

  const len = display.length;
  if (len > 14)      resultLine.style.fontSize = '24px';
  else if (len > 10) resultLine.style.fontSize = '32px';
  else if (len > 7)  resultLine.style.fontSize = '40px';
  else               resultLine.style.fontSize = '48px';
}

function showError(msg) {
  resultLine.textContent = msg;
  resultLine.classList.add('error');
  resultLine.style.fontSize = '22px';
  expressionLine.textContent = '\u00a0';
  currentInput = '';
  expression   = '';
  justEvaluated = false;
}

function handleNumber(value) {
  if (justEvaluated) {
    currentInput  = value;
    expression     = '';
    justEvaluated  = false;
  } else {
    if (currentInput === '0' && value !== '.') {
      currentInput = value;
    } else {
      currentInput += value;
    }
  }
  updateDisplay();
}

function handleDecimal() {
  if (justEvaluated) {
    currentInput  = '0.';
    expression     = '';
    justEvaluated  = false;
    updateDisplay();
    return;
  }
  if (currentInput.includes('.')) return;
  if (currentInput === '') currentInput = '0';
  currentInput += '.';
  updateDisplay();
}

function handleOperator(op) {
  justEvaluated = false;

  if (currentInput === '' && expression !== '') {
    expression = expression.slice(0, -2) + ' ' + op + ' ';
    updateDisplay();
    return;
  }

  if (currentInput !== '') {
    expression   += currentInput + ' ' + op + ' ';
    currentInput  = '';
  }
  updateDisplay();
}

function handleAC() {
  currentInput  = '';
  expression     = '';
  justEvaluated  = false;
  updateDisplay();
}

function handleBackspace() {
  if (justEvaluated) {
    currentInput  = '';
    justEvaluated  = false;
    updateDisplay();
    return;
  }
  if (currentInput.length > 0) {
    currentInput = currentInput.slice(0, -1);
    updateDisplay();
  }
}

function handleSquare() {
  if (currentInput === '') return;
  const num = parseFloat(currentInput);
  if (isNaN(num)) return;
  const result = num * num;
  const formula = `(${num})²`;
  expression    = formula + ' =';
  addToHistory(`${formula}`, formatNumber(result));
  currentInput  = formatNumber(result);
  justEvaluated  = true;
  updateDisplay();
}

function handleCube() {
  if (currentInput === '') return;
  const num = parseFloat(currentInput);
  if (isNaN(num)) return;
  const result = num * num * num;
  const formula = `(${num})³`;
  expression    = formula + ' =';
  addToHistory(`${formula}`, formatNumber(result));
  currentInput  = formatNumber(result);
  justEvaluated  = true;
  updateDisplay();
}

function handleSqrt() {
  if (currentInput === '') return;
  const num = parseFloat(currentInput);
  if (isNaN(num)) return;
  if (num < 0) {
    showError('Not a real number');
    return;
  }
  const result = Math.sqrt(num);
  const formula = `√(${num})`;
  expression    = formula + ' =';
  addToHistory(`${formula}`, formatNumber(result));
  currentInput  = formatNumber(result);
  justEvaluated  = true;
  updateDisplay();
}

function formatNumber(num) {
  if (!isFinite(num)) return 'Error';
  const str = parseFloat(num.toPrecision(12)).toString();
  return str;
}

function handleEquals() {
  if (expression === '' && currentInput === '') return;

  const fullExpr = expression + currentInput;
  if (!currentInput && !expression) return;

  const displayFormula = expression + (currentInput || '0');

  const evalStr = fullExpr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .trim();

  if (evalStr === '' || /[+\-*/]\s*$/.test(evalStr)) return;

  try {
    if (/÷\s*0(\s|$)/.test(fullExpr) || /\/\s*0(\s|$)/.test(evalStr)) {
      showError('Cannot divide by zero');
      return;
    }

    const result = Function('"use strict"; return (' + evalStr + ')')();

    if (!isFinite(result)) {
      showError('Cannot divide by zero');
      return;
    }

    const formatted = formatNumber(result);
    addToHistory(displayFormula.trim(), formatted);

    expression    = displayFormula.trim() + ' =';
    currentInput  = formatted;
    justEvaluated  = true;
    updateDisplay();
  } catch {
    showError('Error');
  }
}

function toggleHistory() {
  historyVisible = !historyVisible;
  historyPanel.classList.toggle('open', historyVisible);
  historyToggleBtn.classList.toggle('active', historyVisible);
}

document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    const value  = btn.dataset.value;

    switch (action) {
      case 'number':    handleNumber(value);   break;
      case 'decimal':   handleDecimal();        break;
      case 'operator':  handleOperator(value);  break;
      case 'ac':        handleAC();             break;
      case 'backspace': handleBackspace();      break;
      case 'square':    handleSquare();         break;
      case 'cube':      handleCube();           break;
      case 'sqrt':      handleSqrt();           break;
      case 'equals':    handleEquals();         break;
    }
  });
});

historyToggleBtn.addEventListener('click', toggleHistory);
clearHistoryBtn.addEventListener('click', clearHistory);

document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9')  handleNumber(e.key);
  else if (e.key === '.')             handleDecimal();
  else if (e.key === '+')             handleOperator('+');
  else if (e.key === '-')             handleOperator('-');
  else if (e.key === '*')             handleOperator('×');
  else if (e.key === '/')             { e.preventDefault(); handleOperator('÷'); }
  else if (e.key === 'Enter' || e.key === '=') handleEquals();
  else if (e.key === 'Backspace')     handleBackspace();
  else if (e.key === 'Escape')        handleAC();
});

renderHistory();
updateDisplay();
