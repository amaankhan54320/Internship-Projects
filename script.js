// TaskFlow — script.js

const STORAGE_KEY = 'taskflow_tasks';
const SCRATCH_KEY = 'taskflow_scratch';
const SNOOZE_KEY = 'taskflow_snoozed';
const ALERTED_KEY = 'taskflow_alerted';
const THEME_KEY = 'taskflow_theme';

let selectedDate = todayKey();
let activeFilter = 'all';
let alertedTaskId = null;
let clockInterval = null;
let pollInterval = null;
let scratchSaveTimer = null;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLabel(key) {
  const d = parseDate(key);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDayNum(key) {
  return String(parseDate(key).getDate());
}

function formatWeekday(key) {
  return parseDate(key).toLocaleDateString('en-IN', { weekday: 'short' });
}

function generateId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

function saveTasks(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadScratch() {
  return localStorage.getItem(SCRATCH_KEY) || '';
}

function saveScratch(text) {
  localStorage.setItem(SCRATCH_KEY, text);
}

function loadSnoozed() {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY)) || {}; } catch { return {}; }
}

function saveSnoozed(data) {
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(data));
}

function loadAlerted() {
  try { return JSON.parse(localStorage.getItem(ALERTED_KEY)) || []; } catch { return []; }
}

function saveAlerted(arr) {
  localStorage.setItem(ALERTED_KEY, JSON.stringify(arr));
}

function pruneHistory() {
  const data = loadTasks();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 10);
  cutoff.setHours(0, 0, 0, 0);
  let changed = false;
  Object.keys(data).forEach(key => {
    const d = parseDate(key);
    if (d < cutoff) { delete data[key]; changed = true; }
  });
  if (changed) saveTasks(data);

  const snoozed = loadSnoozed();
  const now = Date.now();
  let sc = false;
  Object.keys(snoozed).forEach(k => { if (snoozed[k] < now - 86400000) { delete snoozed[k]; sc = true; } });
  if (sc) saveSnoozed(snoozed);
}

function getTasksForDate(key) {
  const data = loadTasks();
  return data[key] || [];
}

function setTasksForDate(key, tasks) {
  const data = loadTasks();
  data[key] = tasks;
  saveTasks(data);
}

function countActiveTodayTasks() {
  const tasks = getTasksForDate(todayKey());
  return tasks.filter(t => !t.done).length;
}

function updateWorkloadBar() {
  const count = countActiveTodayTasks();
  const bar = document.getElementById('workloadBar');
  const dot = document.getElementById('workloadDot');
  const label = document.getElementById('workloadLabel');
  const shell = document.querySelector('.app-shell');

  shell.classList.remove('state-low', 'state-medium', 'state-high');

  if (count === 0) {
    dot.style.background = 'var(--text-3)';
    label.style.color = 'var(--text-2)';
    label.textContent = 'No active tasks today';
    bar.style.background = '';
  } else if (count <= 3) {
    shell.classList.add('state-low');
    label.textContent = `Low workload — ${count} active task${count > 1 ? 's' : ''} today`;
  } else if (count <= 6) {
    shell.classList.add('state-medium');
    label.textContent = `Medium workload — ${count} active tasks today`;
  } else {
    shell.classList.add('state-high');
    label.textContent = `High workload — ${count} active tasks today`;
  }
}

function updateProgressRing() {
  const tasks = getTasksForDate(selectedDate);
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const circumference = 213.6;
  const offset = circumference - (pct / 100) * circumference;
  const ring = document.getElementById('progressRing');
  const pctEl = document.getElementById('progressPct');
  const sub = document.getElementById('statsSub');
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = pct === 100 && total > 0 ? 'var(--green)' : 'var(--accent)';
  pctEl.textContent = `${pct}%`;
  sub.textContent = `${done} of ${total} done`;
}

function buildDateCarousel() {
  const carousel = document.getElementById('dateCarousel');
  carousel.innerHTML = '';
  const data = loadTasks();
  for (let i = 0; i < 10; i++) {
    const key = dateKey(i);
    const tasks = data[key] || [];
    const hasTasks = tasks.length > 0;
    const btn = document.createElement('button');
    btn.className = `date-tab${key === selectedDate ? ' active' : ''}`;
    btn.role = 'tab';
    btn.setAttribute('aria-selected', key === selectedDate ? 'true' : 'false');
    btn.dataset.key = key;
    const dayNum = formatDayNum(key);
    const weekday = i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : formatWeekday(key));
    btn.innerHTML = `<span class="dt-day">${dayNum}</span><span class="dt-label">${weekday}</span>${hasTasks ? '<span class="task-pip"></span>' : ''}`;
    btn.addEventListener('click', () => {
      selectedDate = key;
      document.querySelectorAll('.date-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      updateDayHeader();
      renderTaskList();
      updateProgressRing();
      updateScratchpadVisibility();
    });
    carousel.appendChild(btn);
  }
}

function updateDayHeader() {
  const title = document.getElementById('dayTitle');
  const sub = document.getElementById('daySubtitle');
  const today = todayKey();
  const tomorrow = dateKey(1);
  if (selectedDate === today) { title.textContent = 'Today'; }
  else if (selectedDate === tomorrow) { title.textContent = 'Tomorrow'; }
  else { title.textContent = formatWeekday(selectedDate); }
  sub.textContent = formatDateLabel(selectedDate);
}

function updateScratchpadVisibility() {
  const panel = document.getElementById('scratchpadPanel');
  if (selectedDate === todayKey()) {
    panel.style.display = 'flex';
  } else {
    panel.style.display = 'none';
  }
}

function renderTaskList() {
  const list = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');
  let tasks = getTasksForDate(selectedDate);

  if (activeFilter === 'active') tasks = tasks.filter(t => !t.done);
  else if (activeFilter === 'done') tasks = tasks.filter(t => t.done);

  const existing = list.querySelectorAll('.task-card');
  existing.forEach(el => el.remove());
  if (emptyState) emptyState.remove();

  if (tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.id = 'emptyState';
    const msg = activeFilter === 'done' ? 'No completed tasks yet.' : activeFilter === 'active' ? 'All tasks done!' : 'No tasks scheduled for this day yet.';
    empty.innerHTML = `<div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div><p class="empty-title">All clear</p><p class="empty-sub">${msg}</p>`;
    list.appendChild(empty);
    return;
  }

  const now = new Date();
  tasks.forEach(task => {
    const card = buildTaskCard(task, now);
    list.appendChild(card);
  });
}

function buildTaskCard(task, now) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.id = task.id;
  if (task.done) card.classList.add('done');

  let isOverdue = false;
  if (task.time && !task.done && selectedDate === todayKey()) {
    const [h, m] = task.time.split(':').map(Number);
    const deadline = new Date(now);
    deadline.setHours(h, m, 0, 0);
    if (now > deadline) { isOverdue = true; card.classList.add('overdue'); }
  }

  const timeHtml = task.time ? `<span class="task-time${isOverdue ? ' overdue-time' : ''}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>${task.time}${isOverdue ? ' — overdue' : ''}</span>` : '';
  const descHtml = task.desc ? `<button class="task-desc-toggle">+ notes</button>` : '';

  card.innerHTML = `
    <button class="task-checkbox" data-id="${task.id}" aria-label="Toggle done">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <div class="task-body">
      <p class="task-name">${escapeHtml(task.title)}</p>
      <div class="task-meta">${timeHtml}${descHtml}</div>
      ${task.desc ? `<div class="task-description">${escapeHtml(task.desc)}</div>` : ''}
    </div>
    <div class="task-actions">
      <button class="task-action-btn" data-action="edit" data-id="${task.id}" aria-label="Edit task">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="task-action-btn delete" data-action="delete" data-id="${task.id}" aria-label="Delete task">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `;

  card.querySelector('.task-checkbox').addEventListener('click', e => { e.stopPropagation(); toggleTaskDone(task.id); });
  const descToggle = card.querySelector('.task-desc-toggle');
  if (descToggle) descToggle.addEventListener('click', () => { card.querySelector('.task-description').classList.toggle('open'); descToggle.textContent = card.querySelector('.task-description').classList.contains('open') ? '− notes' : '+ notes'; });
  card.querySelector('[data-action="edit"]').addEventListener('click', e => { e.stopPropagation(); openEditModal(task.id); });
  card.querySelector('[data-action="delete"]').addEventListener('click', e => { e.stopPropagation(); deleteTask(task.id); });

  return card;
}

function toggleTaskDone(id) {
  const tasks = getTasksForDate(selectedDate);
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  tasks[idx].done = !tasks[idx].done;
  if (tasks[idx].done) tasks[idx].completedAt = Date.now();
  else delete tasks[idx].completedAt;
  setTasksForDate(selectedDate, tasks);
  renderTaskList();
  updateWorkloadBar();
  updateProgressRing();
  buildDateCarousel();

  const alerted = loadAlerted().filter(a => a !== id);
  saveAlerted(alerted);
}

function deleteTask(id) {
  const tasks = getTasksForDate(selectedDate).filter(t => t.id !== id);
  setTasksForDate(selectedDate, tasks);
  renderTaskList();
  updateWorkloadBar();
  updateProgressRing();
  buildDateCarousel();
}

let editingTaskId = null;

function openAddModal() {
  editingTaskId = null;
  document.getElementById('modalTitle').textContent = 'New Task';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskTime').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('descCount').textContent = '0';
  const wrapper = document.getElementById('descWrapper');
  wrapper.classList.add('collapsed');
  document.getElementById('descToggle').setAttribute('aria-expanded', 'false');
  const displayKey = selectedDate === todayKey() ? 'Today' : (selectedDate === dateKey(1) ? 'Tomorrow' : formatDateLabel(selectedDate));
  document.getElementById('scheduleDateDisplay').textContent = displayKey;
  openModal('taskModal');
  setTimeout(() => document.getElementById('taskTitle').focus(), 120);
}

function openEditModal(id) {
  const tasks = getTasksForDate(selectedDate);
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingTaskId = id;
  document.getElementById('modalTitle').textContent = 'Edit Task';
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskTime').value = task.time || '';
  document.getElementById('taskDesc').value = task.desc || '';
  document.getElementById('descCount').textContent = (task.desc || '').length;
  const wrapper = document.getElementById('descWrapper');
  if (task.desc) { wrapper.classList.remove('collapsed'); document.getElementById('descToggle').setAttribute('aria-expanded', 'true'); }
  else { wrapper.classList.add('collapsed'); document.getElementById('descToggle').setAttribute('aria-expanded', 'false'); }
  const displayKey = selectedDate === todayKey() ? 'Today' : (selectedDate === dateKey(1) ? 'Tomorrow' : formatDateLabel(selectedDate));
  document.getElementById('scheduleDateDisplay').textContent = displayKey;
  openModal('taskModal');
  setTimeout(() => document.getElementById('taskTitle').focus(), 120);
}

function saveTaskFromModal() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { document.getElementById('taskTitle').focus(); document.getElementById('taskTitle').style.borderColor = 'var(--red)'; setTimeout(() => document.getElementById('taskTitle').style.borderColor = '', 1500); return; }
  const time = document.getElementById('taskTime').value;
  const desc = document.getElementById('taskDesc').value.trim();
  const tasks = getTasksForDate(selectedDate);

  if (editingTaskId) {
    const idx = tasks.findIndex(t => t.id === editingTaskId);
    if (idx !== -1) { tasks[idx].title = title; tasks[idx].time = time; tasks[idx].desc = desc; }
  } else {
    tasks.push({ id: generateId(), title, time, desc, done: false, createdAt: Date.now() });
  }

  setTasksForDate(selectedDate, tasks);
  closeModal('taskModal');
  renderTaskList();
  updateWorkloadBar();
  updateProgressRing();
  buildDateCarousel();
  editingTaskId = null;
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function startClock() {
  const el = document.getElementById('liveClock');
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  tick();
  clockInterval = setInterval(tick, 1000);
}

function pollDeadlines() {
  if (document.getElementById('alertModal').classList.contains('open')) return;
  const now = new Date();
  const tasks = getTasksForDate(todayKey());
  const snoozed = loadSnoozed();
  const alerted = loadAlerted();

  for (const task of tasks) {
    if (task.done || !task.time) continue;
    if (alerted.includes(task.id)) continue;
    const snoozeUntil = snoozed[task.id];
    if (snoozeUntil && now.getTime() < snoozeUntil) continue;

    const [h, m] = task.time.split(':').map(Number);
    const deadline = new Date(now);
    deadline.setHours(h, m, 0, 0);

    if (now >= deadline) {
      alertedTaskId = task.id;
      document.getElementById('alertMessage').textContent = `"${task.title}" was due at ${task.time}. Take action now — complete it or snooze.`;
      openModal('alertModal');
      break;
    }
  }
}

function initDeadlinePoll() {
  pollDeadlines();
  pollInterval = setInterval(pollDeadlines, 30000);
}

function renderHistoryView() {
  const container = document.getElementById('historyList');
  container.innerHTML = '';
  const data = loadTasks();
  const today = todayKey();
  const historyKeys = Object.keys(data)
    .filter(k => k < today)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 10);

  if (historyKeys.length === 0) {
    container.innerHTML = '<div class="history-empty">No historical task data yet. Completed days will appear here.</div>';
    return;
  }

  historyKeys.forEach(key => {
    const tasks = data[key];
    if (!tasks || tasks.length === 0) return;
    const done = tasks.filter(t => t.done).length;
    const miss = tasks.length - done;
    const block = document.createElement('div');
    block.className = 'history-day-block';
    block.innerHTML = `
      <div class="history-day-header">
        <span class="history-day-label">${formatDateLabel(key)}</span>
        <div class="history-day-stats">
          ${done > 0 ? `<span class="hstat hstat-done">${done} done</span>` : ''}
          ${miss > 0 ? `<span class="hstat hstat-miss">${miss} missed</span>` : ''}
        </div>
      </div>
      <div class="history-task-list">
        ${tasks.map(t => `
          <div class="history-task-item ${t.done ? 'hti-done' : 'hti-miss'}">
            <span class="hti-status"></span>
            <span class="hti-name">${escapeHtml(t.title)}</span>
            ${t.time ? `<span class="hti-time">${t.time}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(block);
  });
}

function initScratchpad() {
  const area = document.getElementById('scratchpadArea');
  const chars = document.getElementById('scratchpadChars');
  const saved = document.getElementById('scratchpadSaved');
  area.value = loadScratch();
  chars.textContent = `${area.value.length} characters`;

  area.addEventListener('input', () => {
    chars.textContent = `${area.value.length} characters`;
    clearTimeout(scratchSaveTimer);
    scratchSaveTimer = setTimeout(() => {
      saveScratch(area.value);
      saved.textContent = 'Saved';
      saved.classList.add('show');
      setTimeout(() => saved.classList.remove('show'), 2000);
    }, 500);
  });

  document.getElementById('clearScratchpad').addEventListener('click', () => {
    if (area.value && !confirm('Clear the scratchpad? This cannot be undone.')) return;
    area.value = '';
    saveScratch('');
    chars.textContent = '0 characters';
  });
}

function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  if (view === 'history') { pruneHistory(); renderHistoryView(); }
}

function initFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderTaskList();
    });
  });
}

function initDescToggle() {
  const toggle = document.getElementById('descToggle');
  const wrapper = document.getElementById('descWrapper');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    wrapper.classList.toggle('collapsed', expanded);
    if (!expanded) setTimeout(() => document.getElementById('taskDesc').focus(), 150);
  });

  document.getElementById('taskDesc').addEventListener('input', function() {
    document.getElementById('descCount').textContent = this.value.length;
  });
}

function initModalEvents() {
  document.getElementById('openAddTask').addEventListener('click', openAddModal);
  document.getElementById('modalClose').addEventListener('click', () => { closeModal('taskModal'); editingTaskId = null; });
  document.getElementById('cancelTask').addEventListener('click', () => { closeModal('taskModal'); editingTaskId = null; });
  document.getElementById('saveTask').addEventListener('click', saveTaskFromModal);

  document.getElementById('taskTitle').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTaskFromModal(); } });

  document.getElementById('taskModal').addEventListener('click', e => { if (e.target === document.getElementById('taskModal')) { closeModal('taskModal'); editingTaskId = null; } });

  document.getElementById('alertDone').addEventListener('click', () => {
    if (alertedTaskId) {
      toggleTaskDone(alertedTaskId);
      const alerted = loadAlerted();
      alerted.push(alertedTaskId);
      saveAlerted(alerted);
      alertedTaskId = null;
    }
    closeModal('alertModal');
  });

  document.getElementById('alertSnooze').addEventListener('click', () => {
    if (alertedTaskId) {
      const snoozed = loadSnoozed();
      snoozed[alertedTaskId] = Date.now() + 15 * 60 * 1000;
      saveSnoozed(snoozed);
      alertedTaskId = null;
    }
    closeModal('alertModal');
  });

  document.getElementById('alertDismiss').addEventListener('click', () => {
    if (alertedTaskId) {
      const alerted = loadAlerted();
      alerted.push(alertedTaskId);
      saveAlerted(alerted);
      alertedTaskId = null;
    }
    closeModal('alertModal');
  });

  document.getElementById('alertModal').addEventListener('click', e => { if (e.target === document.getElementById('alertModal')) closeModal('alertModal'); });
}

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function initSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.getElementById('mainContent').addEventListener('click', () => {
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
  });
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isLight = saved === 'light' || (saved === null && !prefersDark);
  if (isLight) document.body.classList.add('light');

  document.getElementById('themeToggle').addEventListener('click', () => {
    const nowLight = document.body.classList.toggle('light');
    localStorage.setItem(THEME_KEY, nowLight ? 'light' : 'dark');
  });
}

function init() {
  pruneHistory();
  initTheme();
  buildDateCarousel();
  updateDayHeader();
  renderTaskList();
  updateWorkloadBar();
  updateProgressRing();
  updateScratchpadVisibility();
  initScratchpad();
  initModalEvents();
  initNavigation();
  initSidebarToggle();
  initFilters();
  initDescToggle();
  startClock();
  initDeadlinePoll();

  // update workload bar every minute for today's count accuracy
  setInterval(() => {
    updateWorkloadBar();
    buildDateCarousel();
  }, 60000);
}

document.addEventListener('DOMContentLoaded', init);