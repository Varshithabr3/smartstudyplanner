/* =============================================
   STUDYMIND AI — FULL APPLICATION SCRIPT
   ============================================= */

// ── Subject color palette
const SUBJECT_COLORS = [
  '#6c63ff','#22d3a2','#fb923c','#38bdf8','#c084fc',
  '#f5c542','#ff5f6d','#34d399','#818cf8','#f97316'
];

// ── App State
let appState = {
  subjects: [],
  studyHours: 4,
  examStart: '',
  attendance: 75,
  codingGoal: 5,
  schedule: [],           // [{day, date, tasks:[]}]
  codingLog: {},          // {"2024-01-15": 3}
  currentDayIndex: 0,
  streak: 0,
  lastStudyDate: null,
  theme: 'light',
};

// ── localStorage helpers
function saveState() {
  localStorage.setItem('studymind_state', JSON.stringify(appState));
}
function loadState() {
  const raw = localStorage.getItem('studymind_state');
  if (raw) {
    try {
      appState = { ...appState, ...JSON.parse(raw) };
      return true;
    } catch { return false; }
  }
  return false;
}

// ── DOM refs
const screens = {
  onboarding: document.getElementById('onboarding'),
  setup: document.getElementById('setup'),
  dashboard: document.getElementById('dashboard'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── Theme
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const icon = document.getElementById('themeIcon');
  const mobIcon = document.getElementById('mobThemeIcon');
  if (icon) icon.className = t === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  if (mobIcon) mobIcon.className = t === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  appState.theme = t;
}
function toggleTheme() {
  applyTheme(appState.theme === 'dark' ? 'light' : 'dark');
  saveState();
}

// ── Date helpers
function formatDate(d) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function isoDate(d) {
  return d.toISOString().split('T')[0];
}
function daysBetween(a, b) {
  return Math.ceil((b - a) / 86400000);
}
function todayISO() { return isoDate(new Date()); }

// ── Setup: Subject management
let tempSubjects = [];
function renderSubjectList() {
  const el = document.getElementById('subjectList');
  if (!tempSubjects.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-book"></i><p>Add your first subject below</p></div>`;
    return;
  }
  el.innerHTML = tempSubjects.map((s, i) => `
    <div class="subject-row">
      <input class="input-field" placeholder="Subject name" value="${s.name}"
        oninput="tempSubjects[${i}].name=this.value" />
      <input class="input-field" type="number" placeholder="Topics" value="${s.topics}"
        min="1" max="100" oninput="tempSubjects[${i}].topics=+this.value" />
      <button class="del-subject" onclick="removeSubject(${i})"><i class="fas fa-trash-alt"></i></button>
    </div>
  `).join('');
}
function addSubject() {
  tempSubjects.push({ name: '', topics: 8 });
  renderSubjectList();
}
function removeSubject(i) {
  tempSubjects.splice(i, 1);
  renderSubjectList();
}

// ── Setup Steps
let currentStep = 1;
function goToStep(n) {
  document.querySelectorAll('.setup-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step${n}`).classList.add('active');
  document.querySelectorAll('.step').forEach(s => {
    const sn = +s.dataset.step;
    s.classList.toggle('active', sn === n);
    s.classList.toggle('done', sn < n);
    s.innerHTML = sn < n ? '<i class="fas fa-check" style="font-size:12px"></i>' : sn;
  });
  currentStep = n;
}

// ── Build summary for step 3
function buildSummary() {
  const start = document.getElementById('examStart').value;
  const totalTopics = tempSubjects.reduce((a, s) => a + (+s.topics || 0), 0);
  const examDate = start ? new Date(start) : null;
  const daysLeft = examDate ? daysBetween(new Date(), examDate) : '—';
  document.getElementById('summaryCard').innerHTML = `
    <div class="summary-item">
      <span class="summary-key"><i class="fas fa-book"></i> Subjects</span>
      <span class="summary-val">${tempSubjects.filter(s=>s.name).map(s=>`${s.name} (${s.topics})`).join(', ') || 'None'}</span>
    </div>
    <div class="summary-item">
      <span class="summary-key"><i class="fas fa-layer-group"></i> Total Topics</span>
      <span class="summary-val">${totalTopics}</span>
    </div>
    <div class="summary-item">
      <span class="summary-key"><i class="fas fa-clock"></i> Daily Hours</span>
      <span class="summary-val">${appState.studyHours} hrs/day</span>
    </div>
    <div class="summary-item">
      <span class="summary-key"><i class="fas fa-calendar"></i> Exam Season</span>
      <span class="summary-val">${start ? formatDate(examDate) : 'Not set'} (${daysLeft} days)</span>
    </div>
    <div class="summary-item">
      <span class="summary-key"><i class="fas fa-user-graduate"></i> Attendance</span>
      <span class="summary-val" style="color:${appState.attendance < 75 ? 'var(--red)' : 'var(--green)'}">
        ${appState.attendance}%${appState.attendance < 75 ? ' ⚠️ LOW' : ' ✓'}
      </span>
    </div>
    <div class="summary-item">
      <span class="summary-key"><i class="fas fa-code"></i> Coding Goal</span>
      <span class="summary-val">${appState.codingGoal} problems/week</span>
    </div>
  `;
}

// ── AI Schedule Generation
const TOPIC_POOL = {
  'DSA': ['Arrays & Strings','Linked Lists','Stacks & Queues','Recursion & Backtracking','Trees & BST','Graphs & BFS/DFS','Dynamic Programming','Sorting Algorithms','Hashing','Tries & Heaps'],
  'OS': ['Process Management','Threads & Concurrency','CPU Scheduling','Memory Management','Paging & Segmentation','File Systems','Deadlocks','I/O Systems','Synchronization','Virtual Memory'],
  'DBMS': ['ER Diagrams','Relational Model','SQL Queries','Normalization','Transactions','ACID Properties','Indexing & Hashing','Query Optimization','Concurrency Control','NoSQL Overview'],
  'CN': ['OSI Model','TCP/IP Stack','Data Link Layer','Network Layer & IP','Transport Layer','DNS & HTTP','Routing Protocols','Network Security','Wireless Networks','Socket Programming'],
  'Maths': ['Propositional Logic','Set Theory','Relations & Functions','Graph Theory','Combinatorics','Probability','Linear Algebra','Calculus Basics','Number Theory','Recurrence Relations'],
  'Physics': ['Mechanics','Thermodynamics','Electromagnetism','Optics','Modern Physics','Waves','Fluid Dynamics','Nuclear Physics','Semiconductor Physics','Quantum Basics'],
  'Chemistry': ['Atomic Structure','Chemical Bonding','Thermochemistry','Electrochemistry','Organic Reactions','Periodic Table','Kinetics','Equilibrium','Coordination Chemistry','Polymers'],
};

function getTopicsForSubject(subjectName, count) {
  const key = Object.keys(TOPIC_POOL).find(k => subjectName.toLowerCase().includes(k.toLowerCase()));
  const pool = key ? TOPIC_POOL[key] : Array.from({length: 20}, (_, i) => `Topic ${i+1}`);
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[i % pool.length]);
  }
  return result;
}

function generateSchedule() {
  const subjects = appState.subjects.filter(s => s.name.trim());
  const examDate = appState.examStart ? new Date(appState.examStart) : addDays(new Date(), 30);
  const today = new Date();
  const daysAvailable = Math.max(1, daysBetween(today, examDate));
  const hoursPerDay = appState.studyHours;

  // Build a pool of all tasks with priority
  let allTasks = [];
  subjects.forEach((subj, si) => {
    const topics = getTopicsForSubject(subj.name, subj.topics);
    topics.forEach((topic, ti) => {
      const priority = ti < Math.ceil(subj.topics * 0.3) ? 'high'
                     : ti < Math.ceil(subj.topics * 0.6) ? 'medium' : 'low';
      const est = priority === 'high' ? 1.5 : priority === 'medium' ? 1 : 0.75;
      allTasks.push({
        id: `${si}-${ti}`,
        subjectIndex: si,
        subjectName: subj.name,
        topic,
        priority,
        estimatedHours: est,
        completed: false,
        color: subj.color,
      });
    });
  });

  // Distribute tasks across days
  const schedule = [];
  let taskIdx = 0;
  for (let d = 0; d < daysAvailable && taskIdx < allTasks.length; d++) {
    const date = addDays(today, d);
    const dayTasks = [];
    let hoursLeft = hoursPerDay;
    while (taskIdx < allTasks.length && hoursLeft > 0) {
      const task = { ...allTasks[taskIdx] };
      // Preserve existing completion status
      const existing = findExistingTask(task.id);
      if (existing) task.completed = existing.completed;
      dayTasks.push(task);
      hoursLeft -= task.estimatedHours;
      taskIdx++;
    }
    schedule.push({
      day: d + 1,
      date: isoDate(date),
      tasks: dayTasks,
    });
  }

  // Add remaining tasks to last day
  if (taskIdx < allTasks.length && schedule.length > 0) {
    while (taskIdx < allTasks.length) {
      const task = { ...allTasks[taskIdx] };
      const existing = findExistingTask(task.id);
      if (existing) task.completed = existing.completed;
      schedule[schedule.length - 1].tasks.push(task);
      taskIdx++;
    }
  }

  appState.schedule = schedule;
}

function findExistingTask(id) {
  for (const day of appState.schedule) {
    const t = day.tasks.find(t => t.id === id);
    if (t) return t;
  }
  return null;
}

// ── Missed Day: redistribute today's tasks
function handleMissedDay() {
  const todayISO_ = todayISO();
  const dayIdx = appState.schedule.findIndex(d => d.date === todayISO_);
  if (dayIdx === -1) { showAlert("Couldn't find today's schedule to adjust."); return; }

  const missed = appState.schedule[dayIdx].tasks.filter(t => !t.completed);
  if (!missed.length) { showAlert("All today's tasks are already completed!"); return; }

  // Redistribute across next 3 days
  const nextDays = appState.schedule.slice(dayIdx + 1, dayIdx + 4);
  if (!nextDays.length) { showAlert("No upcoming days to redistribute tasks to."); return; }

  let idx = 0;
  missed.forEach(task => {
    nextDays[idx % nextDays.length].tasks.unshift({ ...task });
    idx++;
  });

  // Clear today's incomplete tasks
  appState.schedule[dayIdx].tasks = appState.schedule[dayIdx].tasks.filter(t => t.completed);

  appState.streak = Math.max(0, appState.streak - 1);
  saveState();
  renderDashboard();
  showAlert("Plan adjusted! Today's missed tasks have been spread across the next 3 days.", 'warning');
}

// ── Progress helpers
function getTotalStats() {
  let total = 0, done = 0;
  appState.schedule.forEach(d => d.tasks.forEach(t => { total++; if (t.completed) done++; }));
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

function getUpcomingExams() {
  const today = new Date();
  return appState.subjects
    .filter(s => s.examDate)
    .map(s => {
      const d = new Date(s.examDate);
      return { ...s, daysLeft: daysBetween(today, d), examDateObj: d };
    })
    .filter(s => s.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

function updateStreak() {
  const today = todayISO();
  const todayDay = appState.schedule.find(d => d.date === today);
  if (!todayDay) return;
  const todayDone = todayDay.tasks.some(t => t.completed);
  if (todayDone && appState.lastStudyDate !== today) {
    appState.lastStudyDate = today;
    appState.streak = (appState.streak || 0) + 1;
  }
}

// ── Alert banner
function showAlert(msg, type = 'warning') {
  const banner = document.getElementById('alertBanner');
  document.getElementById('alertText').textContent = msg;
  banner.classList.remove('hidden');
  banner.style.background = type === 'danger'
    ? 'var(--red-bg)' : type === 'success'
    ? 'var(--green-bg)' : 'var(--yellow-bg)';
  banner.style.color = type === 'danger' ? 'var(--red)' : type === 'success' ? 'var(--green)' : 'var(--yellow)';
}

// ── Render: Stats row
function renderStats() {
  const { total, done, pct } = getTotalStats();
  const pending = total - done;
  const streak = appState.streak || 0;
  const daysLeft = appState.examStart
    ? Math.max(0, daysBetween(new Date(), new Date(appState.examStart))) : '—';

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--accent-glow);color:var(--accent2)">
        <i class="fas fa-check-double"></i>
      </div>
      <div class="stat-val color-accent">${done}</div>
      <div class="stat-label">Tasks Done</div>
      <div class="mini-progress">
        <div class="mini-progress-track">
          <div class="mini-progress-fill" style="width:${pct}%"></div>
        </div>
        <span class="stat-delta color-accent">${pct}%</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--green-bg);color:var(--green)">
        <i class="fas fa-hourglass-half"></i>
      </div>
      <div class="stat-val color-green">${pending}</div>
      <div class="stat-label">Tasks Pending</div>
      <div class="stat-delta" style="color:var(--text3)">${total} total</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--orange-bg);color:var(--orange)">
        <i class="fas fa-fire"></i>
      </div>
      <div class="stat-val color-orange">${streak}</div>
      <div class="stat-label">Day Streak</div>
      <div class="stat-delta" style="color:var(--orange)">${streak > 0 ? '🔥 Keep going!' : 'Start today!'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--red-bg);color:var(--red)">
        <i class="fas fa-calendar-xmark"></i>
      </div>
      <div class="stat-val" style="color:${typeof daysLeft === 'number' && daysLeft < 7 ? 'var(--red)' : 'var(--yellow)'}">${daysLeft}</div>
      <div class="stat-label">Days to Exams</div>
      <div class="stat-delta" style="color:var(--text3)">${appState.examStart ? formatDate(new Date(appState.examStart)) : 'Not set'}</div>
    </div>
  `;

  document.getElementById('sidebarStreak').textContent = streak;
}

// ── Render: Task list (day view)
function renderTaskList() {
  const todayList = document.getElementById('taskList');
  const dayLabel = document.getElementById('dayLabel');
  const dayDate = document.getElementById('dayDate');

  const idx = appState.currentDayIndex;
  if (!appState.schedule.length) {
    todayList.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-plus"></i><p>No schedule generated yet</p></div>`;
    return;
  }

  const safeIdx = Math.max(0, Math.min(idx, appState.schedule.length - 1));
  appState.currentDayIndex = safeIdx;
  const day = appState.schedule[safeIdx];
  const dateObj = new Date(day.date + 'T00:00:00');
  const todayStr = todayISO();

  const label = day.date === todayStr ? 'Today'
    : day.date === isoDate(addDays(new Date(), -1)) ? 'Yesterday'
    : day.date === isoDate(addDays(new Date(), 1)) ? 'Tomorrow'
    : `Day ${day.day}`;

  dayLabel.textContent = label;
  dayDate.textContent = formatDate(dateObj);

  if (!day.tasks.length) {
    todayList.innerHTML = `<div class="empty-state"><i class="fas fa-sun"></i><p>Rest day! No tasks scheduled.</p></div>`;
    return;
  }

  const hourTotal = day.tasks.reduce((a, t) => a + t.estimatedHours, 0);
  todayList.innerHTML = day.tasks.map(task => `
    <div class="task-item ${task.completed ? 'completed' : ''}" onclick="toggleTask('${day.date}','${task.id}')">
      <div class="task-bar" style="background:${task.color}"></div>
      <div class="task-check ${task.completed ? 'checked' : ''}">
        ${task.completed ? '<i class="fas fa-check"></i>' : ''}
      </div>
      <div class="task-content">
        <div class="task-subject" style="color:${task.color}">${task.subjectName}</div>
        <div class="task-title">${task.topic}</div>
        <div class="task-meta">
          <span><i class="fas fa-clock"></i> ${task.estimatedHours}h</span>
          <span><i class="fas fa-book-open"></i> Study + Notes</span>
        </div>
      </div>
      <div class="priority-badge priority-${task.priority}">${task.priority}</div>
    </div>
  `).join('') + `
    <div style="text-align:right;font-size:12px;color:var(--text3);margin-top:8px;font-family:var(--font-mono)">
      Total: ${hourTotal.toFixed(1)} hrs for ${day.tasks.length} task${day.tasks.length>1?'s':''}
    </div>
  `;
}

function toggleTask(dateStr, taskId) {
  const day = appState.schedule.find(d => d.date === dateStr);
  if (!day) return;
  const task = day.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  updateStreak();
  saveState();
  renderDashboard();
}

// ── Render: Exam timeline
function renderExamTimeline() {
  const el = document.getElementById('examTimeline');
  const exams = getUpcomingExams();
  if (!exams.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-calendar"></i><p>No exam dates set. Add them in Settings.</p></div>`;
    return;
  }
  el.innerHTML = exams.map(s => {
    const cls = s.daysLeft <= 5 ? 'days-urgent' : s.daysLeft <= 14 ? 'days-soon' : 'days-ok';
    const month = s.examDateObj.toLocaleString('en-IN', { month: 'short' });
    return `
      <div class="exam-item">
        <div class="exam-date-badge" style="color:${s.color}">
          <div class="day">${s.examDateObj.getDate()}</div>
          <div class="month">${month}</div>
        </div>
        <div class="exam-info">
          <div class="exam-name">${s.name}</div>
          <div class="exam-topics">${s.topics} topics · ${s.daysLeft <= 0 ? 'Exam day!' : `${s.daysLeft} day${s.daysLeft>1?'s':''} to prepare`}</div>
        </div>
        <div class="days-left ${cls}">${s.daysLeft <= 0 ? '🎯 Today' : `${s.daysLeft}d left`}</div>
      </div>
    `;
  }).join('');
}

// ── Render: Charts
let completionChartInstance = null;
let weeklyChartInstance = null;

function renderCharts() {
  const { total, done } = getTotalStats();
  const pending = total - done;

  // Chart.js theme colors
  const isDark = appState.theme === 'dark';
  const textColor = isDark ? '#9da8cc' : '#4a5280';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  // Completion donut
  const ctx1 = document.getElementById('completionChart').getContext('2d');
  if (completionChartInstance) completionChartInstance.destroy();
  completionChartInstance = new Chart(ctx1, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Pending'],
      datasets: [{
        data: [done || 0, pending || 1],
        backgroundColor: ['#22d3a2', '#212645'],
        borderColor: isDark ? '#1e2340' : '#fff',
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, font: { family: 'DM Sans', size: 12 }, padding: 16 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} task${ctx.raw!==1?'s':''}` } }
      },
      cutout: '68%',
    }
  });

  // Weekly bar chart (simulated hours per day, last 7 days)
  const ctx2 = document.getElementById('weeklyChart').getContext('2d');
  const days = [], hours = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    days.push(d.toLocaleString('en-IN', { weekday: 'short' }));
    const iso = isoDate(d);
    const day = appState.schedule.find(sd => sd.date === iso);
    const doneTasks = day ? day.tasks.filter(t => t.completed) : [];
    hours.push(+(doneTasks.reduce((a, t) => a + t.estimatedHours, 0)).toFixed(1));
  }

  if (weeklyChartInstance) weeklyChartInstance.destroy();
  weeklyChartInstance = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Study Hours',
        data: hours,
        backgroundColor: hours.map((_, i) => i === 6 ? '#6c63ff' : 'rgba(108,99,255,0.35)'),
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 11 } },
        },
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'DM Sans', size: 12 } },
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw}h studied` } }
      }
    }
  });
}

// ── Render: All tasks list (progress tab)
function renderAllTasks() {
  const el = document.getElementById('allTasksList');
  const allTasks = [];
  appState.schedule.forEach(d => d.tasks.forEach(t => allTasks.push({ ...t, date: d.date, dayN: d.day })));
  if (!allTasks.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-list-check"></i><p>No tasks yet</p></div>`;
    return;
  }
  const sorted = allTasks.sort((a, b) => {
    if (a.priority === b.priority) return 0;
    return ['high','medium','low'].indexOf(a.priority) - ['high','medium','low'].indexOf(b.priority);
  });
  el.innerHTML = sorted.slice(0, 20).map(task => `
    <div class="task-item ${task.completed ? 'completed' : ''}" onclick="toggleTask('${task.date}','${task.id}')">
      <div class="task-bar" style="background:${task.color}"></div>
      <div class="task-check ${task.completed ? 'checked' : ''}">
        ${task.completed ? '<i class="fas fa-check"></i>' : ''}
      </div>
      <div class="task-content">
        <div class="task-subject" style="color:${task.color}">${task.subjectName} · Day ${task.dayN}</div>
        <div class="task-title">${task.topic}</div>
        <div class="task-meta">
          <span><i class="fas fa-clock"></i> ${task.estimatedHours}h</span>
          <span><i class="fas fa-calendar"></i> ${formatDate(new Date(task.date + 'T00:00:00'))}</span>
        </div>
      </div>
      <div class="priority-badge priority-${task.priority}">${task.priority}</div>
    </div>
  `).join('') + (sorted.length > 20 ? `<div style="text-align:center;color:var(--text3);font-size:13px;padding:12px">+${sorted.length-20} more tasks</div>` : '');
}

// ── Render: Insights
function renderInsights() {
  const el = document.getElementById('insightsGrid');
  const { total, done, pct } = getTotalStats();
  const att = appState.attendance;
  const streak = appState.streak || 0;

  const codingThisWeek = Object.entries(appState.codingLog || {})
    .filter(([d]) => daysBetween(new Date(d + 'T00:00:00'), new Date()) <= 7)
    .reduce((a, [, v]) => a + v, 0);
  const codingPct = Math.min(100, Math.round((codingThisWeek / (appState.codingGoal || 5)) * 100));

  const insights = [
    {
      icon: 'fa-graduation-cap',
      iconBg: 'var(--accent-glow)', iconColor: 'var(--accent2)',
      title: 'Overall Progress',
      body: `${done} of ${total} tasks completed. ${pct >= 80 ? 'Excellent pace!' : pct >= 50 ? 'Good progress, keep going!' : 'You need to pick up the pace.'}`,
      pct,
      barColor: pct >= 70 ? '#22d3a2' : pct >= 40 ? '#f5c542' : '#ff5f6d',
    },
    {
      icon: 'fa-user-check',
      iconBg: att < 75 ? 'var(--red-bg)' : 'var(--green-bg)',
      iconColor: att < 75 ? 'var(--red)' : 'var(--green)',
      title: 'Attendance Status',
      body: att < 75
        ? `⚠️ Your attendance is ${att}% — below the 75% requirement. Prioritize classes!`
        : `✅ Attendance at ${att}% — you're in good standing. Maintain it!`,
      pct: att,
      barColor: att < 75 ? '#ff5f6d' : '#22d3a2',
    },
    {
      icon: 'fa-fire',
      iconBg: 'var(--orange-bg)', iconColor: 'var(--orange)',
      title: 'Study Streak',
      body: streak === 0
        ? 'No active streak. Complete at least one task today to start!'
        : `${streak} day streak! ${streak >= 7 ? '🔥 On fire!' : 'Keep the momentum going!'}`,
      pct: Math.min(100, streak * 14),
      barColor: '#fb923c',
    },
    {
      icon: 'fa-code',
      iconBg: 'var(--blue-bg)', iconColor: 'var(--blue)',
      title: 'Coding Practice',
      body: `${codingThisWeek}/${appState.codingGoal} problems this week. ${codingPct >= 100 ? '🎯 Goal met!' : `${appState.codingGoal - codingThisWeek} more to hit your weekly target.`}`,
      pct: codingPct,
      barColor: '#38bdf8',
    },
  ];

  el.innerHTML = insights.map(ins => `
    <div class="insight-card">
      <div class="insight-icon" style="background:${ins.iconBg};color:${ins.iconColor}">
        <i class="fas ${ins.icon}"></i>
      </div>
      <div class="insight-title">${ins.title}</div>
      <div class="insight-body">${ins.body}</div>
      <div class="insight-progress">
        <div class="insight-progress-bar" style="width:${ins.pct}%;background:${ins.barColor}"></div>
      </div>
      <div style="font-size:12px;color:var(--text3);font-family:var(--font-mono);text-align:right">${ins.pct}%</div>
    </div>
  `).join('');
}

// ── Render: Coding tracker
function renderCodingTracker() {
  const el = document.getElementById('codingTracker');
  const goal = appState.codingGoal || 5;
  const log = appState.codingLog || {};
  const weekDays = [];
  for (let i = 6; i >= 0; i--) weekDays.push(addDays(new Date(), -i));

  const totalThisWeek = weekDays.reduce((a, d) => a + (log[isoDate(d)] || 0), 0);
  const pct = Math.min(100, Math.round((totalThisWeek / goal) * 100));

  el.innerHTML = `
    <div class="coding-tracker-header">
      <div>
        <span style="font-weight:600;font-size:15px">${totalThisWeek}/${goal} problems this week</span>
        <div style="font-size:12px;color:var(--text3);margin-top:4px">
          <span style="font-family:var(--font-mono)">${pct}%</span> of weekly goal
        </div>
      </div>
      <div style="text-align:right">
        <div class="mini-progress" style="width:160px">
          <div class="mini-progress-track" style="flex:1;height:8px">
            <div class="mini-progress-fill" style="width:${pct}%;background:${pct>=100?'var(--green)':'var(--accent)'}"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="coding-week-grid">
      ${weekDays.map(d => {
        const iso = isoDate(d);
        const count = log[iso] || 0;
        const cls = count >= Math.ceil(goal / 7) ? 'goal-met' : count > 0 ? 'solved' : '';
        const isToday = iso === todayISO();
        return `
          <div class="coding-day">
            <div class="coding-day-name">${d.toLocaleString('en-IN',{weekday:'short'})}</div>
            <div class="coding-day-bubble ${cls}" title="Click to log a problem${isToday?' (today)':''}" onclick="logCodingProblem('${iso}')">
              ${count || (isToday ? '+' : '0')}
            </div>
            <div class="coding-day-count">${count ? `${count}p` : ''}</div>
          </div>
        `;
      }).join('')}
    </div>
    <div style="margin-top:14px;font-size:12px;color:var(--text3);text-align:center">
      Click a day bubble to log a solved problem · 
      <span style="color:var(--green)">●</span> Solved · 
      <span style="color:var(--accent)">●</span> Goal met
    </div>
  `;
}

function logCodingProblem(dateStr) {
  if (!appState.codingLog) appState.codingLog = {};
  appState.codingLog[dateStr] = (appState.codingLog[dateStr] || 0) + 1;
  saveState();
  renderCodingTracker();
  renderInsights();
}

// ── Full dashboard render
function renderDashboard() {
  updateStreak();
  renderStats();
  renderTaskList();
  renderExamTimeline();
  renderCharts();
  renderAllTasks();
  renderInsights();
  renderCodingTracker();

  document.getElementById('codingGoalDisplay').textContent = appState.codingGoal;

  // Attendance warning
  if (appState.attendance < 75) {
    showAlert(`Your attendance is ${appState.attendance}%! You need 75%+ to qualify for exams.`, 'warning');
  }
}

// ── Tab switching
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');

  const titles = { schedule: ['My Schedule', "Here's your AI-generated study plan"], progress: ['Progress', 'Track your completed tasks'], insights: ['Insights', 'Smart analytics for your study session'] };
  document.getElementById('pageTitle').textContent = titles[name][0];
  document.getElementById('pageSub').textContent = titles[name][1];

  if (name === 'progress') { renderCharts(); renderAllTasks(); }
  if (name === 'insights') { renderInsights(); renderCodingTracker(); }
}

// ── Default subjects for demo
function getDefaultSubjects() {
  return [
    { name: 'DSA', topics: 10, color: SUBJECT_COLORS[0], examDate: isoDate(addDays(new Date(), 28)) },
    { name: 'OS', topics: 8, color: SUBJECT_COLORS[1], examDate: isoDate(addDays(new Date(), 35)) },
    { name: 'DBMS', topics: 9, color: SUBJECT_COLORS[2], examDate: isoDate(addDays(new Date(), 42)) },
    { name: 'CN', topics: 7, color: SUBJECT_COLORS[3], examDate: isoDate(addDays(new Date(), 35)) },
  ];
}

// ── INIT
function init() {
  const hasData = loadState();
  applyTheme(appState.theme || 'dark');

  // Set default exam start if blank
  if (!appState.examStart) {
    appState.examStart = isoDate(addDays(new Date(), 30));
  }

  // Route to correct screen
  if (hasData && appState.schedule && appState.schedule.length) {
    // Set current day to today
    const todayIdx = appState.schedule.findIndex(d => d.date === todayISO());
    appState.currentDayIndex = todayIdx >= 0 ? todayIdx : 0;
    showScreen('dashboard');
    renderDashboard();
  } else {
    // Populate with demo data
    tempSubjects = getDefaultSubjects().map(s => ({ name: s.name, topics: s.topics }));
    showScreen('onboarding');
  }

  bindEvents();
}

// ── Event binding
function bindEvents() {
  // Theme
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('mobThemeToggle')?.addEventListener('click', toggleTheme);

  // Onboarding
  document.getElementById('startSetup').addEventListener('click', () => {
    tempSubjects = getDefaultSubjects().map(s => ({ name: s.name, topics: s.topics }));
    renderSubjectList();
    goToStep(1);
    showScreen('setup');
  });

  // Back to onboarding
  document.getElementById('backToOnboard').addEventListener('click', () => showScreen('onboarding'));

  // Add subject
  document.getElementById('addSubject').addEventListener('click', addSubject);

  // Range inputs
  const hoursInput = document.getElementById('studyHours');
  const hoursVal = document.getElementById('studyHoursVal');
  hoursInput.addEventListener('input', () => {
    appState.studyHours = +hoursInput.value;
    hoursVal.textContent = `${hoursInput.value} hrs`;
  });
  const attInput = document.getElementById('attendance');
  const attVal = document.getElementById('attendanceVal');
  attInput.addEventListener('input', () => {
    appState.attendance = +attInput.value;
    attVal.textContent = `${attInput.value}%`;
  });

  // Steps
  document.getElementById('toStep2').addEventListener('click', () => {
    const valid = tempSubjects.filter(s => s.name.trim());
    if (!valid.length) { alert('Please add at least one subject!'); return; }
    goToStep(2);
  });
  document.getElementById('backToStep1').addEventListener('click', () => goToStep(1));
  document.getElementById('toStep3').addEventListener('click', () => {
    appState.studyHours = +document.getElementById('studyHours').value;
    appState.examStart = document.getElementById('examStart').value || isoDate(addDays(new Date(), 30));
    appState.attendance = +document.getElementById('attendance').value;
    appState.codingGoal = +document.getElementById('codingGoal').value || 5;
    buildSummary();
    goToStep(3);
  });
  document.getElementById('backToStep2').addEventListener('click', () => goToStep(2));

  // Generate plan
  document.getElementById('generatePlan').addEventListener('click', () => {
    const validSubjs = tempSubjects.filter(s => s.name.trim());
    appState.subjects = validSubjs.map((s, i) => ({
      ...s,
      color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
      examDate: isoDate(addDays(new Date(appState.examStart), i * 7)),
    }));
    appState.schedule = [];
    appState.streak = 0;
    appState.codingLog = {};
    generateSchedule();
    const todayIdx = appState.schedule.findIndex(d => d.date === todayISO());
    appState.currentDayIndex = todayIdx >= 0 ? todayIdx : 0;
    saveState();
    showScreen('dashboard');
    renderDashboard();
  });

  // Day navigation
  document.getElementById('prevDay').addEventListener('click', () => {
    if (appState.currentDayIndex > 0) {
      appState.currentDayIndex--;
      renderTaskList();
    }
  });
  document.getElementById('nextDay').addEventListener('click', () => {
    if (appState.currentDayIndex < appState.schedule.length - 1) {
      appState.currentDayIndex++;
      renderTaskList();
    }
  });

  // Missed day
  document.getElementById('missedDayBtn').addEventListener('click', () => {
    document.getElementById('missedModal').classList.remove('hidden');
  });
  document.getElementById('cancelMissed').addEventListener('click', () => {
    document.getElementById('missedModal').classList.add('hidden');
  });
  document.getElementById('confirmMissed').addEventListener('click', () => {
    document.getElementById('missedModal').classList.add('hidden');
    handleMissedDay();
  });

  // Regenerate
  document.getElementById('regenerateBtn').addEventListener('click', () => {
    if (confirm('Regenerate the entire plan? Your current progress will be preserved.')) {
      const existingCompletions = {};
      appState.schedule.forEach(d => d.tasks.forEach(t => {
        if (t.completed) existingCompletions[t.id] = true;
      }));
      generateSchedule();
      // Restore completions
      appState.schedule.forEach(d => d.tasks.forEach(t => {
        if (existingCompletions[t.id]) t.completed = true;
      }));
      saveState();
      renderDashboard();
      showAlert('Plan regenerated successfully!', 'success');
    }
  });

  // Reset
  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('resetModal').classList.remove('hidden');
  });
  document.getElementById('sidebarReset').addEventListener('click', () => {
    document.getElementById('resetModal').classList.remove('hidden');
  });
  document.getElementById('cancelReset').addEventListener('click', () => {
    document.getElementById('resetModal').classList.add('hidden');
  });
  document.getElementById('confirmReset').addEventListener('click', () => {
    localStorage.removeItem('studymind_state');
    location.reload();
  });

  // Alert close
  document.getElementById('closeAlert').addEventListener('click', () => {
    document.getElementById('alertBanner').classList.add('hidden');
  });

  // Tab navigation
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Exam start default
  const examInput = document.getElementById('examStart');
  if (!examInput.value) {
    examInput.value = isoDate(addDays(new Date(), 30));
  }
}

// ── Kick off
document.addEventListener('DOMContentLoaded', init);
