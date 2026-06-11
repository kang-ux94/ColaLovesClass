/* ============================================
   可乐爱上课 - 核心应用逻辑
   ============================================ */

// --- 常量定义 ---
const STORAGE_KEY = 'cola_class_data';
const POINTS_PER_CHECKIN = 10;
const ROUND_MAX = 100;
const FIRST_ROUND_START = 90;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAYS_FULL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const COURSE_COLORS = [
  '#FF6B35', '#4ECDC4', '#A78BFA', '#F472B6', '#60A5FA',
  '#6BCB77', '#FFD93D', '#FF8C5A', '#C084FC', '#FB923C'
];

// 盲盒奖池
const BLIND_BOX_POOL = [
  { name: '奥特曼', emoji: '🦸', rarity: '普通', weight: 20, color: '#FF4444' },
  { name: '超级飞侠', emoji: '✈️', rarity: '普通', weight: 20, color: '#448AFF' },
  { name: '恐龙', emoji: '🦖', rarity: '普通', weight: 15, color: '#66BB6A' },
  { name: '磁吸积木', emoji: '🧲', rarity: '稀有', weight: 15, color: '#AB47BC' },
  { name: '变形金刚', emoji: '🤖', rarity: '稀有', weight: 15, color: '#FF7043' },
  { name: '零食大礼包', emoji: '🍬', rarity: '稀有', weight: 10, color: '#FFA726' },
  { name: '赵一鸣购物券', emoji: '🎫', rarity: '超级稀有', weight: 5, color: '#FFD700' },
];

// --- 状态管理 ---
let appState = loadState();
let editingCourseId = null;

function getDefaultState() {
  return {
    courses: [],
    checkins: [],
    points: { total: 0, courses: {} },
    blindBoxHistory: [],
    settings: { notifications: false, sound: true }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return getDefaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// --- 工具函数 ---
function today() {
  const d = new Date();
  return {
    dateStr: d.toISOString().split('T')[0],
    dayOfWeek: d.getDay(),
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}月${parseInt(d)}日`;
}

function getWeekDates() {
  const t = today();
  const current = new Date(t.year, t.month - 1, t.day);
  const dayOfWeek = current.getDay();
  const monday = new Date(current);
  monday.setDate(current.getDate() - dayOfWeek);
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push({
      dayOfWeek: i,
      dayName: WEEKDAYS[i],
      date: d.getDate(),
      month: d.getMonth() + 1,
      dateStr: d.toISOString().split('T')[0],
      isToday: d.toDateString() === current.toDateString(),
    });
  }
  return dates;
}

// --- 课程管理 ---
function getCoursePoints(courseId) {
  if (!appState.points.courses[courseId]) {
    // 初始化课程积分 - 第一轮从90开始
    appState.points.courses[courseId] = {
      total: FIRST_ROUND_START,
      roundPoints: FIRST_ROUND_START,
      completedRounds: 0,
      firstRoundActive: true,
    };
    saveState();
  }
  return appState.points.courses[courseId];
}

function isCheckedIn(courseId, dateStr) {
  return appState.checkins.some(c => c.courseId === courseId && c.date === dateStr);
}

function doCheckin(courseId) {
  const t = today();
  if (isCheckedIn(courseId, t.dateStr)) return false;
  
  // 记录打卡
  appState.checkins.push({
    id: 'chk_' + Date.now(),
    courseId,
    date: t.dateStr,
    time: new Date().toTimeString().slice(0, 5),
  });
  
  // 更新积分
  const cp = getCoursePoints(courseId);
  cp.roundPoints += POINTS_PER_CHECKIN;
  cp.total += POINTS_PER_CHECKIN;
  appState.points.total += POINTS_PER_CHECKIN;
  
  saveState();
  return cp.roundPoints >= ROUND_MAX;
}

function canDrawBlindBox(courseId) {
  const cp = getCoursePoints(courseId);
  return cp.roundPoints >= ROUND_MAX;
}

function drawBlindBox(courseId) {
  const cp = getCoursePoints(courseId);
  if (cp.roundPoints < ROUND_MAX) return null;
  
  // 消耗本轮积分
  cp.roundPoints = 0;
  cp.completedRounds++;
  cp.firstRoundActive = false;
  
  // 抽奖
  const prize = weightedRandom(BLIND_BOX_POOL);
  
  appState.blindBoxHistory.push({
    id: 'bb_' + Date.now(),
    courseId,
    date: today().dateStr,
    prize: prize.name,
    emoji: prize.emoji,
    rarity: prize.rarity,
    round: cp.completedRounds,
  });
  
  saveState();
  
  return {
    ...prize,
    round: cp.completedRounds,
    courseName: getCourse(courseId)?.name || '未知课程',
  };
}

function weightedRandom(pool) {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of pool) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return pool[pool.length - 1];
}

function getCourse(courseId) {
  return appState.courses.find(c => c.id === courseId);
}

// --- UI 渲染 ---

// 首页 - 今日课程
function renderTodayClasses() {
  const container = document.getElementById('todayClasses');
  const t = today();
  
  document.getElementById('todayDate').textContent = `${t.year}年${t.month}月${t.day}日`;
  document.getElementById('todayWeekday').textContent = WEEKDAYS_FULL[t.dayOfWeek];
  
  const todayCourses = appState.courses.filter(c => c.dayOfWeek === t.dayOfWeek);
  
  if (todayCourses.length === 0) {
    container.innerHTML = `
      <div class="no-class-today">
        <span class="emoji">🎉</span>
        今天没有课程安排<br>去「课表」页面添加课程吧！
      </div>`;
    return;
  }
  
  container.innerHTML = todayCourses.map(course => {
    const checked = isCheckedIn(course.id, t.dateStr);
    const isPast = isPastClass(course);
    
    let statusClass = 'pending';
    let btnClass = 'go';
    let btnText = '打卡 +10⭐';
    let btnHtml;
    
    if (checked) {
      statusClass = 'checked';
      btnHtml = `<button class="checkin-btn done">✅</button>`;
    } else if (isPast) {
      statusClass = 'missed';
      btnHtml = `<button class="checkin-btn missed-btn" onclick="quickCheckin('${course.id}')">补打卡</button>`;
    } else {
      btnHtml = `<button class="checkin-btn go" onclick="quickCheckin('${course.id}')">${btnText}</button>`;
    }
    
    return `
      <div class="today-class-card ${statusClass}">
        <div class="class-icon-circle" style="background:${course.color}22;color:${course.color}">
          ${course.icon}
        </div>
        <div class="class-info">
          <div class="class-name">${course.name}</div>
          <div class="class-time">⏰ ${course.time}</div>
        </div>
        ${btnHtml}
      </div>`;
  }).join('');
}

function isPastClass(course) {
  const now = new Date();
  const [h, m] = course.time.split(':').map(Number);
  // 如果当前时间超过课程时间2小时，认为是已过课程
  const classTime = new Date(now);
  classTime.setHours(h, m, 0, 0);
  return now > new Date(classTime.getTime() + 2 * 60 * 60 * 1000);
}

// 积分概览
function renderPointsBar() {
  const t = today();
  const todayCourses = appState.courses.filter(c => c.dayOfWeek === t.dayOfWeek);
  
  // 找到当天课程中积分最接近100的
  let activeRoundPoints = 0;
  let activeCourseName = '';
  
  if (todayCourses.length > 0) {
    for (const c of todayCourses) {
      const cp = getCoursePoints(c.id);
      if (cp.roundPoints > activeRoundPoints) {
        activeRoundPoints = cp.roundPoints;
        activeCourseName = c.name;
      }
    }
  }
  
  // 如果没有今天课程，找任意课程
  if (activeRoundPoints === 0 && appState.courses.length > 0) {
    for (const c of appState.courses) {
      const cp = getCoursePoints(c.id);
      if (cp.roundPoints > activeRoundPoints) {
        activeRoundPoints = cp.roundPoints;
        activeCourseName = c.name;
      }
    }
  }
  
  document.getElementById('totalPoints').innerHTML = `${appState.points.total}<span class="unit">分</span>`;
  
  const pct = Math.min(100, (activeRoundPoints / ROUND_MAX) * 100);
  document.getElementById('roundProgressFill').style.width = pct + '%';
  
  if (activeCourseName) {
    document.getElementById('roundLabel').innerHTML = 
      `🎯 <strong>${activeCourseName}</strong> 本轮: <strong>${activeRoundPoints}/${ROUND_MAX}</strong> 分`;
  } else {
    document.getElementById('roundLabel').textContent = '还没有添加课程哦～';
  }
  
  // 盲盒入口
  const entry = document.getElementById('blindboxEntry');
  const hasReady = appState.courses.some(c => canDrawBlindBox(c.id));
  if (hasReady) {
    entry.className = 'blindbox-entry ready';
    entry.innerHTML = '🎁✨ 可以抽盲盒啦！点击抽奖 ✨🎁';
  } else {
    entry.className = 'blindbox-entry locked';
    entry.innerHTML = '🎁 抽盲盒（满100分解锁）';
  }
}

// 课表 - 周历
function renderWeekCalendar() {
  const container = document.getElementById('weekCalendar');
  const week = getWeekDates();
  const t = today();
  
  container.innerHTML = week.map(d => {
    const hasClass = appState.courses.some(c => c.dayOfWeek === d.dayOfWeek);
    return `
      <div class="day-cell ${d.isToday ? 'today' : ''}" 
           onclick="selectDay(${d.dayOfWeek})" data-day="${d.dayOfWeek}">
        <div class="day-name">${d.dayName}</div>
        <div class="day-date">${d.date}</div>
        ${hasClass ? '<div class="day-dot"></div>' : ''}
      </div>`;
  }).join('');
  
  // 默认选中今天
  selectDay(t.dayOfWeek);
}

function selectDay(dayOfWeek) {
  // 更新选中状态
  document.querySelectorAll('.day-cell').forEach(el => {
    el.style.background = '';
    el.style.fontWeight = '';
  });
  const cell = document.querySelector(`.day-cell[data-day="${dayOfWeek}"]`);
  if (cell) {
    cell.style.background = 'linear-gradient(135deg, #FFF3E0, #FFE0B2)';
    cell.style.fontWeight = '700';
  }
  
  renderDaySchedule(dayOfWeek);
}

function renderDaySchedule(dayOfWeek) {
  const container = document.getElementById('daySchedule');
  const courses = appState.courses.filter(c => c.dayOfWeek === dayOfWeek);
  
  if (courses.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">
      ${WEEKDAYS_FULL[dayOfWeek]}没有课程，点击下方按钮添加
    </div>`;
    return;
  }
  
  container.innerHTML = courses.map(c => `
    <div class="schedule-course-item">
      <div class="course-color-dot" style="background:${c.color}"></div>
      <span style="font-size:22px;">${c.icon}</span>
      <div style="flex:1;">
        <div style="font-weight:700;">${c.name}</div>
        <div style="font-size:12px;color:var(--text-muted);">⏰ ${c.time}</div>
      </div>
      <button class="btn-danger" onclick="deleteCourse('${c.id}')">删除</button>
    </div>`).join('');
}

// 全部课程列表
function renderAllCourses() {
  const container = document.getElementById('allCoursesList');
  if (appState.courses.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = `
    <div class="card-title" style="margin-bottom:12px;">📚 全部课程</div>
    ${appState.courses.map(c => `
      <div class="schedule-course-item">
        <div class="course-color-dot" style="background:${c.color}"></div>
        <span style="font-size:22px;">${c.icon}</span>
        <div style="flex:1;">
          <div style="font-weight:700;">${c.name}</div>
          <div style="font-size:12px;color:var(--text-muted);">
            每周${WEEKDAYS_FULL[c.dayOfWeek]} ⏰ ${c.time}
          </div>
        </div>
        <button class="btn btn-ghost" style="font-size:12px;padding:6px 10px;flex:0;" 
                onclick="editCourse('${c.id}')">✏️</button>
      </div>`).join('')}`;
}

// 积分明细
function renderPointsBreakdown() {
  const container = document.getElementById('pointsBreakdown');
  
  if (appState.courses.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center;color:var(--text-muted);">
        还没有添加课程，去「课表」页面添加吧！
      </div>`;
    return;
  }
  
  container.innerHTML = appState.courses.map(c => {
    const cp = getCoursePoints(c.id);
    const pct = Math.min(100, (cp.roundPoints / ROUND_MAX) * 100);
    
    return `
      <div class="course-points-card">
        <div class="cp-header">
          <div class="cp-icon" style="background:${c.color}22;color:${c.color}">${c.icon}</div>
          <div>
            <div class="cp-name">${c.name}</div>
            <div class="cp-rounds">已完成 ${cp.completedRounds} 轮抽奖</div>
          </div>
        </div>
        <div class="round-progress" style="margin-bottom:10px;">
          <div class="round-progress-fill" style="width:${pct}%"></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-bottom:12px;">
          本轮 ${cp.roundPoints}/${ROUND_MAX} · 
          ${cp.roundPoints >= ROUND_MAX ? '🎁 可以抽盲盒了！' : `还差 ${ROUND_MAX - cp.roundPoints} 分`}
        </div>
        <div class="cp-stats">
          <div class="cp-stat">
            <div class="cp-stat-val">${cp.total}</div>
            <div class="cp-stat-label">总积分</div>
          </div>
          <div class="cp-stat">
            <div class="cp-stat-val">${cp.completedRounds}</div>
            <div class="cp-stat-label">抽奖次数</div>
          </div>
          <div class="cp-stat">
            <div class="cp-stat-val">${cp.roundPoints}</div>
            <div class="cp-stat-label">本轮积分</div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// 历史记录
function renderHistory() {
  const container = document.getElementById('historyList');
  
  // 合并打卡记录和盲盒记录
  const items = [];
  
  appState.checkins.forEach(c => {
    const course = getCourse(c.courseId);
    items.push({
      date: c.date,
      type: 'checkin',
      text: `${course?.icon || '📚'} ${course?.name || '未知'} 打卡`,
      points: POINTS_PER_CHECKIN,
      ts: new Date(c.date + 'T' + c.time).getTime(),
    });
  });
  
  appState.blindBoxHistory.forEach(b => {
    const course = getCourse(b.courseId);
    items.push({
      date: b.date,
      type: 'blindbox',
      text: `${b.emoji} ${course?.name || ''} 第${b.round}轮 · 抽中 ${b.prize}`,
      points: 0,
      ts: new Date(b.date).getTime(),
    });
  });
  
  items.sort((a, b) => b.ts - a.ts);
  const recent = items.slice(0, 20);
  
  if (recent.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">还没有打卡记录哦～</div>';
    return;
  }
  
  container.innerHTML = recent.map(item => `
    <div class="history-item">
      <span class="history-date">${formatDate(item.date)}</span>
      <span class="history-action">${item.text}</span>
      ${item.type === 'checkin' ? `<span class="history-points">+${item.points}⭐</span>` 
        : '<span class="history-prize">🎁</span>'}
    </div>`).join('');
}

// 盲盒状态
function renderBlindBox() {
  const statusEl = document.getElementById('bbStatus');
  const boxEl = document.getElementById('bbBox');
  const hintEl = document.getElementById('bbHint');
  
  const readyCourses = appState.courses.filter(c => canDrawBlindBox(c.id));
  
  if (readyCourses.length > 0) {
    statusEl.innerHTML = readyCourses.map(c => 
      `<span class="course-tag">${c.icon} ${c.name}</span>`
    ).join(' ') + ' 可以抽盲盒！';
    boxEl.className = 'bb-box ready';
    boxEl.textContent = '🎁';
    boxEl.onclick = () => openBlindBox(readyCourses[0].id);
    hintEl.className = 'bb-hint ready';
    hintEl.textContent = '👆 点击盲盒抽奖！';
  } else if (appState.courses.length === 0) {
    statusEl.textContent = '先添加课程开始打卡吧！';
    boxEl.className = 'bb-box locked';
    boxEl.textContent = '🔒';
    boxEl.onclick = null;
    hintEl.className = 'bb-hint';
    hintEl.textContent = '还没有课程哦';
  } else {
    statusEl.textContent = '继续打卡积攒积分吧！';
    boxEl.className = 'bb-box locked';
    boxEl.textContent = '🔒';
    boxEl.onclick = null;
    hintEl.className = 'bb-hint';
    
    // 找最接近的课程
    let closest = null;
    let maxPts = 0;
    appState.courses.forEach(c => {
      const cp = getCoursePoints(c.id);
      if (cp.roundPoints > maxPts && cp.roundPoints < ROUND_MAX) {
        maxPts = cp.roundPoints;
        closest = c;
      }
    });
    if (closest) {
      hintEl.textContent = `${closest.icon} ${closest.name} 还差 ${ROUND_MAX - maxPts} 分`;
    } else {
      hintEl.textContent = '满分才能抽盲盒哦';
    }
  }
  
  // 抽奖历史
  renderBlindBoxHistory();
}

function renderBlindBoxHistory() {
  const container = document.getElementById('bbHistory');
  const history = [...appState.blindBoxHistory].reverse();
  
  if (history.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">还没有抽过盲盒哦～</div>';
    return;
  }
  
  container.innerHTML = history.map(h => {
    const course = getCourse(h.courseId);
    return `
      <div class="history-item">
        <span class="history-date">${formatDate(h.date)}</span>
        <span style="font-size:24px;">${h.emoji}</span>
        <span class="history-action">
          ${course?.icon || ''} ${course?.name || ''} 第${h.round}轮
        </span>
        <span class="history-prize">${h.prize}</span>
      </div>`;
  }).join('');
}

// --- 盲盒抽奖动画 ---
function openBlindBox(courseId) {
  const boxEl = document.getElementById('bbBox');
  boxEl.className = 'bb-box opening';
  boxEl.textContent = '🎁';
  boxEl.onclick = null;
  
  // 播放音效
  if (appState.settings.sound) playBoxShakeSound();
  
  // 0.5秒震动后开奖
  setTimeout(() => {
    const result = drawBlindBox(courseId);
    if (result) {
      boxEl.textContent = '✨';
      showPrizeReveal(result);
      launchConfetti();
    } else {
      showToast('出了点问题，请重试');
    }
  }, 600);
}

function showPrizeReveal(prize) {
  document.getElementById('prizeEmoji').textContent = prize.emoji;
  document.getElementById('prizeName').textContent = prize.prize;
  document.getElementById('prizeRarity').textContent = 
    `${prize.rarity}奖品 · ${prize.courseName} 第${prize.round}轮`;
  document.getElementById('prizeReveal').style.display = 'flex';
  
  if (appState.settings.sound) playWinSound();
}

function closePrize() {
  document.getElementById('prizeReveal').style.display = 'none';
  stopConfetti();
  renderAll();
}

// --- 撒花特效 ---
let confettiAnimationId = null;
const confettiCanvas = document.getElementById('confetti-canvas');
const ctx = confettiCanvas.getContext('2d');
let confettiParticles = [];

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

function createConfettiParticle() {
  const colors = ['#FF6B35', '#4ECDC4', '#FFE66D', '#F472B6', '#A78BFA', 
                   '#60A5FA', '#6BCB77', '#FFD700', '#FF4444', '#00E5FF'];
  return {
    x: Math.random() * confettiCanvas.width,
    y: -20 - Math.random() * 100,
    w: 6 + Math.random() * 8,
    h: 4 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    opacity: 1,
  };
}

function launchConfetti() {
  resizeConfetti();
  confettiParticles = [];
  for (let i = 0; i < 120; i++) {
    confettiParticles.push(createConfettiParticle());
  }
  animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  
  let alive = false;
  confettiParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.rotationSpeed;
    p.vy += 0.05;
    p.opacity -= 0.002;
    
    if (p.opacity > 0 && p.y < confettiCanvas.height + 50) {
      alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  });
  
  if (alive) {
    confettiAnimationId = requestAnimationFrame(animateConfetti);
  } else {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

function stopConfetti() {
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
  confettiParticles = [];
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

// --- 音效（使用 Web Audio API）---
function playBoxShakeSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.4);
  } catch(e) { /* ignore */ }
}

function playWinSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + i * 0.15 + 0.3);
      osc.start(audioCtx.currentTime + i * 0.15);
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.3);
    });
  } catch(e) { /* ignore */ }
}

// --- Toast 提示 ---
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 2200);
}

// --- Modal ---
function openModal(title, courseData = null) {
  const modal = document.getElementById('modalCourse');
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('inputCourseName').value = courseData?.name || '';
  document.getElementById('inputCourseTime').value = courseData?.time || '16:00';
  document.getElementById('inputCourseIcon').value = courseData?.icon || '📚';
  editingCourseId = courseData?.id || null;
  
  // 星期选择器
  const dayContainer = document.getElementById('daySelector');
  dayContainer.innerHTML = WEEKDAYS_FULL.map((name, idx) => `
    <button class="day-chip ${courseData?.dayOfWeek === idx ? 'selected' : ''}" 
            data-day="${idx}" onclick="selectDayChip(${idx})">${name[1]}</button>
  `).join('');
  
  // 颜色选择器
  const colorContainer = document.getElementById('colorPicker');
  colorContainer.innerHTML = COURSE_COLORS.map(color => `
    <div class="color-dot ${courseData?.color === color ? 'selected' : ''}" 
         style="background:${color}" data-color="${color}" 
         onclick="selectColor(this, '${color}')"></div>
  `).join('');
  
  // 预选颜色
  if (courseData?.color) {
    document.querySelector(`.color-dot[data-color="${courseData.color}"]`)?.classList.add('selected');
  }
  
  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('modalCourse').style.display = 'none';
  editingCourseId = null;
}

function selectDayChip(day) {
  document.querySelectorAll('#daySelector .day-chip').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.day) === day);
  });
}

function selectColor(el, color) {
  document.querySelectorAll('#colorPicker .color-dot').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
}

function getSelectedDay() {
  const selected = document.querySelector('#daySelector .day-chip.selected');
  return selected ? parseInt(selected.dataset.day) : 1;
}

function getSelectedColor() {
  const selected = document.querySelector('#colorPicker .color-dot.selected');
  return selected ? selected.dataset.color : COURSE_COLORS[0];
}

function saveCourse() {
  const name = document.getElementById('inputCourseName').value.trim();
  if (!name) { showToast('请输入课程名称'); return; }
  
  const dayOfWeek = getSelectedDay();
  const time = document.getElementById('inputCourseTime').value || '16:00';
  const icon = document.getElementById('inputCourseIcon').value || '📚';
  const color = getSelectedColor();
  
  if (editingCourseId) {
    // 编辑
    const idx = appState.courses.findIndex(c => c.id === editingCourseId);
    if (idx >= 0) {
      appState.courses[idx] = { ...appState.courses[idx], name, dayOfWeek, time, icon, color };
    }
  } else {
    // 新增
    const newCourse = {
      id: 'c_' + Date.now(),
      name, dayOfWeek, time, icon, color,
    };
    appState.courses.push(newCourse);
    
    // 初始化第一轮积分为90
    appState.points.courses[newCourse.id] = {
      total: FIRST_ROUND_START,
      roundPoints: FIRST_ROUND_START,
      completedRounds: 0,
      firstRoundActive: true,
    };
    appState.points.total += FIRST_ROUND_START;
  }
  
  saveState();
  closeModal();
  renderAll();
  showToast(editingCourseId ? '课程已更新 ✅' : '课程已添加！初始赠送90分 🎉');
}

function editCourse(courseId) {
  const course = getCourse(courseId);
  if (course) openModal('编辑课程', course);
}

function deleteCourse(courseId) {
  const course = getCourse(courseId);
  if (!course) return;
  if (!confirm(`确定要删除「${course.name}」吗？该课程的所有积分和记录将被清除。`)) return;
  
  appState.courses = appState.courses.filter(c => c.id !== courseId);
  appState.checkins = appState.checkins.filter(c => c.courseId !== courseId);
  appState.blindBoxHistory = appState.blindBoxHistory.filter(b => b.courseId !== courseId);
  
  // 回收积分
  if (appState.points.courses[courseId]) {
    appState.points.total -= appState.points.courses[courseId].total;
    delete appState.points.courses[courseId];
  }
  
  saveState();
  renderAll();
  showToast(`「${course.name}」已删除`);
}

// --- 快捷打卡 ---
function quickCheckin(courseId) {
  const course = getCourse(courseId);
  if (!course) return;
  
  const reached100 = doCheckin(courseId);
  
  if (reached100) {
    showToast(`🎉 ${course.icon} 满分！快去抽盲盒吧！`);
    // 自动跳转到盲盒页面
    setTimeout(() => {
      switchTab('blindbox');
      openBlindBox(courseId);
    }, 500);
  } else {
    showToast(`✅ ${course.icon} 打卡成功！+${POINTS_PER_CHECKIN}⭐`);
  }
  
  renderAll();
}

// --- Tab 切换 ---
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  const tabEl = document.getElementById('tab-' + tabName);
  const btnEl = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  
  if (tabEl) tabEl.classList.add('active');
  if (btnEl) btnEl.classList.add('active');
  
  // 切换时刷新对应内容
  if (tabName === 'blindbox') renderBlindBox();
  if (tabName === 'points') { renderPointsBreakdown(); renderHistory(); }
  if (tabName === 'schedule') renderWeekCalendar();
  
  updatePendingBadge();
}

// --- 防遗忘机制 ---
function updatePendingBadge() {
  const t = today();
  const todayCourses = appState.courses.filter(c => c.dayOfWeek === t.dayOfWeek);
  const pendingCount = todayCourses.filter(c => !isCheckedIn(c.id, t.dateStr) && !isPastClass(c)).length;
  
  const badge = document.getElementById('badgePending');
  if (pendingCount > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = pendingCount;
  } else {
    badge.style.display = 'none';
  }
  
  // 底部提醒栏
  const forgetMsg = document.getElementById('forgetMsg');
  const bottomBar = document.getElementById('bottomBar');
  
  if (todayCourses.length === 0) {
    forgetMsg.textContent = '今天没有课程，好好休息吧～ 😊';
    bottomBar.style.background = '#F5F5F5';
  } else if (pendingCount > 0) {
    forgetMsg.textContent = `还有 ${pendingCount} 节课没打卡，别忘了赚积分哦！`;
    bottomBar.style.background = '#FFF3E0';
  } else {
    const allChecked = todayCourses.every(c => isCheckedIn(c.id, t.dateStr));
    if (allChecked) {
      forgetMsg.textContent = '今天全部打卡完成，太棒了！🌟';
      bottomBar.style.background = '#E8F5E9';
    }
  }
}

// 浏览器通知
function requestNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    appState.settings.notifications = true;
    saveState();
    updateSettingsUI();
    scheduleNotifications();
    showToast('🔔 上课提醒已开启');
    return;
  }
  Notification.requestPermission().then(perm => {
    if (perm === 'granted') {
      appState.settings.notifications = true;
      saveState();
      updateSettingsUI();
      scheduleNotifications();
      showToast('🔔 上课提醒已开启');
    }
  });
}

function scheduleNotifications() {
  if (!appState.settings.notifications) return;
  
  const t = today();
  const todayCourses = appState.courses.filter(c => c.dayOfWeek === t.dayOfWeek);
  
  todayCourses.forEach(course => {
    const [h, m] = course.time.split(':').map(Number);
    const classTime = new Date(t.year, t.month - 1, t.day, h, m);
    const remindTime = new Date(classTime.getTime() - 15 * 60 * 1000); // 提前15分钟
    const now = new Date();
    
    if (remindTime > now) {
      const delay = remindTime.getTime() - now.getTime();
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('⏰ 可乐爱上课', {
            body: `${course.icon} ${course.name} 还有15分钟就要开始啦！记得打卡哦~`,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">🎒</text></svg>',
          });
        }
      }, delay);
    }
  });
}

function updateSettingsUI() {
  const soundBtn = document.getElementById('btnSound');
  soundBtn.textContent = appState.settings.sound ? '🔊' : '🔇';
  soundBtn.classList.toggle('active', appState.settings.sound);
}

// --- 全局渲染 ---
function renderAll() {
  renderTodayClasses();
  renderPointsBar();
  renderPointsBreakdown();
  renderHistory();
  renderBlindBox();
  renderAllCourses();
  updatePendingBadge();
  
  // 如果当前在课表tab，刷新课表
  const scheduleTab = document.getElementById('tab-schedule');
  if (scheduleTab.classList.contains('active')) {
    renderWeekCalendar();
  }
}

// --- 事件绑定 ---
document.addEventListener('DOMContentLoaded', () => {
  // Tab 切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // 添加课程按钮
  document.getElementById('btnAddCourse').addEventListener('click', () => openModal('添加课程'));
  
  // 保存课程
  document.getElementById('btnSaveCourse').addEventListener('click', saveCourse);
  
  // 点击遮罩关闭弹窗
  document.getElementById('modalCourse').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  
  // 设置按钮
  document.getElementById('btnSettings').addEventListener('click', openSettings);
  
  // 设置弹窗关闭
  document.getElementById('modalSettings').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  
  // 通知按钮 → 改为跳转到设置（手机场景更实用）
  document.getElementById('btnNotify').addEventListener('click', () => {
    openSettings();
  });
  
  // 音效按钮
  document.getElementById('btnSound').addEventListener('click', () => {
    appState.settings.sound = !appState.settings.sound;
    saveState();
    updateSettingsUI();
    showToast(appState.settings.sound ? '🔊 音效已开启' : '🔇 音效已关闭');
  });
  
  // 窗口大小变化
  window.addEventListener('resize', resizeConfetti);
  
  // 初始化
  updateSettingsUI();
  renderAll();
  
  // 如果开启了通知，安排提醒
  if (appState.settings.notifications) {
    scheduleNotifications();
  }
  
  // 默认选中今天（如果当前在课表tab）
  renderWeekCalendar();
  
  console.log('🎒 可乐爱上课 已就绪！');
  console.log('💡 提示：添加课程后第一轮自动赠送90分，打卡一次就能抽盲盒！');
  
  // 注册 PWA Service Worker
  registerSW();
  
  // 监听 PWA 安装事件
  listenPWAInstall();
});

// =============================================
//  PWA 注册
// =============================================
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('[PWA] Service Worker 已注册', reg.scope))
      .catch(err => console.warn('[PWA] SW 注册失败（可能需HTTPS）:', err));
  }
}

// =============================================
//  PWA 安装提示
// =============================================
let deferredPrompt = null;

function listenPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // 显示安装横幅
    document.getElementById('installBanner').style.display = 'block';
    document.getElementById('btnInstallPWA').style.display = 'block';
  });
  
  // 如果已安装为PWA，隐藏提示
  if (window.matchMedia('(display-mode: standalone)').matches) {
    document.getElementById('installBanner').style.display = 'none';
    document.getElementById('btnInstallPWA').style.display = 'none';
  }
}

async function installPWA() {
  if (!deferredPrompt) {
    showToast('📲 请用浏览器菜单「添加到主屏幕」');
    return;
  }
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  if (result.outcome === 'accepted') {
    showToast('✅ 已添加到主屏幕！');
  }
  deferredPrompt = null;
  document.getElementById('installBanner').style.display = 'none';
}

function dismissInstall() {
  document.getElementById('installBanner').style.display = 'none';
}

// =============================================
//  日历导出 - 生成ICS文件导入手机日历
// =============================================
function exportCalendar() {
  if (appState.courses.length === 0) {
    showToast('请先添加课程');
    return;
  }
  
  // 生成ICS内容
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//可乐爱上课//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:可乐爱上课 - 课程提醒',
  ];
  
  // 为每门课生成未来8周的重复事件
  appState.courses.forEach(course => {
    const [h, m] = course.time.split(':').map(Number);
    const now = new Date();
    const startDate = new Date(now);
    
    // 找到下一个匹配的星期几
    while (startDate.getDay() !== course.dayOfWeek) {
      startDate.setDate(startDate.getDate() + 1);
    }
    
    // 格式化为ICS日期
    const formatICSDate = (d, hour, min) => {
      return d.getFullYear() +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0') + 'T' +
        String(hour).padStart(2, '0') +
        String(min).padStart(2, '0') + '00';
    };
    
    const dtStart = formatICSDate(startDate, h, m);
    const endH = h;
    const endM = m + 60; // 默认1小时课程
    const dtEnd = formatICSDate(startDate, endH, endM);
    
    // 生成唯一ID
    const uid = `cola-${course.id}-${Date.now()}@colalovesclass`;
    
    // 提醒：提前15分钟
    ics.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${course.icon} ${course.name}`,
      `DESCRIPTION:🎒 可乐爱上课提醒\\n课程：${course.name}\\n记得打卡赚积分哦！`,
      'RRULE:FREQ=WEEKLY;COUNT=52',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:⏰ ${course.name} 还有15分钟开始！记得打开可乐爱上课打卡~`,
      'END:VALARM',
      'END:VEVENT'
    );
  });
  
  ics.push('END:VCALENDAR');
  
  // 下载文件
  const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '可乐爱上课_课程日历.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('📅 日历文件已下载！\n打开文件导入手机日历即可自动提醒');
  
  // 给用户使用提示
  setTimeout(() => {
    showToast('💡 iPhone: 用「文件」打开 → 添加全部\n安卓: 用日历APP导入');
  }, 2500);
}

// =============================================
//  数据导出
// =============================================
function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: appState,
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `可乐爱上课_备份_${today().dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('💾 数据已导出备份！');
}

// =============================================
//  数据导入
// =============================================
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      
      if (!imported.data || !imported.data.courses) {
        throw new Error('数据格式不对');
      }
      
      // 确认导入
      const courseNames = imported.data.courses.map(c => c.icon + ' ' + c.name).join('、');
      const msg = `将导入以下数据：\n📚 课程: ${courseNames || '无'}\n⭐ 总积分: ${imported.data.points?.total || 0}\n🎁 抽奖记录: ${imported.data.blindBoxHistory?.length || 0}条\n\n⚠️ 当前数据将被覆盖，确认导入？`;
      
      if (confirm(msg)) {
        appState = imported.data;
        saveState();
        renderAll();
        showToast('✅ 数据导入成功！');
      }
    } catch (err) {
      showToast('❌ 文件格式不正确');
    }
  };
  reader.readAsText(file);
  
  // 重置input以便重复选择同一文件
  event.target.value = '';
}

// =============================================
//  清除数据
// =============================================
function resetAllData() {
  if (confirm('⚠️ 确定要清除所有数据吗？\n\n包括：课程、打卡记录、积分、抽奖历史\n\n此操作不可恢复！')) {
    if (confirm('再次确认：真的要清除全部数据？')) {
      appState = getDefaultState();
      saveState();
      renderAll();
      closeSettings();
      showToast('🗑️ 所有数据已清除');
    }
  }
}

// =============================================
//  设置面板
// =============================================
function openSettings() {
  document.getElementById('modalSettings').style.display = 'flex';
  // iOS Safari PWA安装提示
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone) {
    document.getElementById('btnInstallPWA').style.display = 'block';
    document.getElementById('btnInstallPWA').textContent = '📲 添加到主屏幕（点击后看底部提示）';
    document.getElementById('btnInstallPWA').onclick = () => {
      showToast('💡 点击浏览器底部「分享」→「添加到主屏幕」');
    };
  }
}

function closeSettings() {
  document.getElementById('modalSettings').style.display = 'none';
}
