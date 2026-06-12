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

// 默认盲盒奖池（首次使用或重置时）
const DEFAULT_PRIZE_POOL = [
  { name: '奥特曼', emoji: '🦸', weight: 20, enabled: true },
  { name: '超级飞侠', emoji: '✈️', weight: 20, enabled: true },
  { name: '恐龙', emoji: '🦖', weight: 15, enabled: true },
  { name: '磁吸积木', emoji: '🧲', weight: 15, enabled: true },
  { name: '变形金刚', emoji: '🤖', weight: 15, enabled: true },
  { name: '零食大礼包', emoji: '🍬', weight: 10, enabled: true },
  { name: '赵一鸣购物券', emoji: '🎫', weight: 5, enabled: true },
];

function getPrizePool() {
  if (!appState.prizePool || appState.prizePool.length === 0) {
    appState.prizePool = JSON.parse(JSON.stringify(DEFAULT_PRIZE_POOL));
    saveState();
  }
  return appState.prizePool.filter(p => p.enabled !== false);
}

// --- 状态管理 ---
function loadState() {
  // 尝试从 profile 专属 key 加载
  const key = localStorage.getItem('cola_active_key');
  if (key) {
    const data = loadProfileData(key);
    if (data && data.courses) return data;
  }
  // 降级：从通用 key 加载
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      if (state.courses) {
        state.courses = state.courses.map(c => {
          if (!c.schedules) {
            return { ...c, schedules: [{ dayOfWeek: c.dayOfWeek ?? 1, time: c.time ?? '16:00' }] };
          }
          return c;
        });
      }
      return state;
    }
  } catch (e) { /* ignore */ }
  return getDefaultState();
}

function saveState() {
  appState._updatedAt = Date.now();
  // 保存到 profile 专属 key
  const k = localStorage.getItem('cola_active_key');
  if (k) localStorage.setItem('cola_data_' + k, JSON.stringify(appState));
  // 也存到通用 key 作为兜底
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  if (typeof scheduleCloudSave === 'function' && document.readyState === 'complete') {
    scheduleCloudSave();
  }
}

let appState = loadState();
let editingCourseId = null;

// 通行证通过后回调（localData: 本地或迁移的旧数据）
function onGatePassed(localData) {
  // 如果有数据则加载，否则用空状态
  if (localData && localData.courses) {
    appState = localData;
  } else {
    appState = getDefaultState();
  }
  saveState();
  renderAll();
  
  initCloud();
  loadFromCloud().then(cloudData => {
    if (cloudData && isValidCloudData(cloudData)) {
      const localTime = appState._updatedAt || 0;
      const cloudTime = cloudData._updatedAt || 0;
      if (cloudTime > localTime) {
        delete cloudData._updatedAt;
        const s = appState.settings;
        appState = cloudData;
        appState.settings = { ...appState.settings, ...s };
        saveState();
        renderAll();
      } else if (localTime > cloudTime) {
        scheduleCloudSave();
      }
    } else if (appState.courses.length > 0 || appState.checkins.length > 0) {
      scheduleCloudSave();
    }
    updateProfileUI();
  }).catch(() => {});
}

function getDefaultState() {
  return {
    courses: [],
    checkins: [],
    points: { total: 0, courses: {} },
    blindBoxHistory: [],
    prizePool: JSON.parse(JSON.stringify(DEFAULT_PRIZE_POOL)),
    settings: { notifications: false, sound: true }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      // 迁移旧数据格式: course.dayOfWeek + course.time → course.schedules
      if (state.courses) {
        state.courses = state.courses.map(c => {
          if (!c.schedules) {
            return {
              ...c,
              schedules: [{ dayOfWeek: c.dayOfWeek ?? 1, time: c.time ?? '16:00' }],
            };
          }
          return c;
        });
      }
      return state;
    }
  } catch (e) { /* ignore */ }
  return getDefaultState();
}

function saveState() {
  appState._updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  // 延迟云同步（等 DOM 就绪后再启动）
  if (typeof scheduleCloudSave === 'function' && document.readyState === 'complete') {
    scheduleCloudSave();
  }
}

// --- 工具函数 ---
function today() {
  const d = new Date();
  return {
    dateStr: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
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
      dateStr: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
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

function doCheckin(courseId, customDate = null, note = null) {
  const t = customDate ? { dateStr: customDate, dayOfWeek: new Date(customDate).getDay() } : today();
  const dateStr = t.dateStr;
  
  // 检查是否已经打卡
  const existingIdx = appState.checkins.findIndex(c => c.courseId === courseId && c.date === dateStr);
  
  if (existingIdx >= 0) {
    // 已打卡，更新备注
    if (note !== null) {
      appState.checkins[existingIdx].note = note;
      saveState();
    }
    return false;
  }
  
  // 记录打卡
  appState.checkins.push({
    id: 'chk_' + Date.now(),
    courseId,
    date: dateStr,
    time: new Date().toTimeString().slice(0, 5),
    note: note || null,
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
  const pool = getPrizePool();
  const prize = weightedRandom(pool);
  
  appState.blindBoxHistory.push({
    id: 'bb_' + Date.now(),
    courseId,
    date: today().dateStr,
    prize: prize.name,
    emoji: prize.emoji,
    rarity: prize.weight <= 5 ? '超级稀有' : prize.weight <= 10 ? '稀有' : '普通',
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
  
  const todayCourses = appState.courses.filter(c => 
    c.schedules.some(s => s.dayOfWeek === t.dayOfWeek)
  );
  
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
    const schedules = getSchedulesForDay(course, t.dayOfWeek, t.dateStr);
    const timeStr = schedules.map(s => s.time).join(' / ');
    
    let statusClass = 'pending';
    let btnHtml;
    
    if (checked) {
      statusClass = 'checked';
      btnHtml = `<button class="checkin-btn done">✅</button>`;
    } else if (isPast) {
      statusClass = 'missed';
      btnHtml = `<button class="checkin-btn missed-btn" onclick="quickCheckin('${course.id}')">补打卡</button>`;
    } else {
      btnHtml = `<button class="checkin-btn go" onclick="quickCheckin('${course.id}')">打卡 +10⭐</button>`;
    }
    
    return `
      <div class="today-class-card ${statusClass}">
        <div class="class-icon-circle" style="background:${course.color}22;color:${course.color}">
          ${course.icon}
        </div>
        <div class="class-info">
          <div class="class-name">${course.name}</div>
          <div class="class-time">⏰ ${timeStr}</div>
        </div>
        ${btnHtml}
      </div>`;
  }).join('');
}

// 获取课程在指定日期的上课时间（每周固定 + 按日期）
function getSchedulesForDay(course, dayOfWeek, dateStr = null) {
  const weeklySchedules = course.schedules.filter(s => s.dayOfWeek === dayOfWeek);
  let dateSchedules = [];
  if (dateStr && course.dateSchedules) {
    dateSchedules = course.dateSchedules.filter(ds => ds.date === dateStr);
  }
  return [...weeklySchedules, ...dateSchedules].sort((a, b) => {
    const ta = a.time || '';
    const tb = b.time || '';
    return ta.localeCompare(tb);
  });
}

function isPastClass(course) {
  const t = today();
  const schedules = getSchedulesForDay(course, t.dayOfWeek);
  if (schedules.length === 0) return false;
  const now = new Date();
  // 如果当前时间超过最后一个时间段 2 小时，认为已过
  const lastSchedule = schedules[schedules.length - 1];
  const [h, m] = lastSchedule.time.split(':').map(Number);
  const lastTime = new Date(now);
  lastTime.setHours(h, m, 0, 0);
  return now > new Date(lastTime.getTime() + 2 * 60 * 60 * 1000);
}

// 积分概览
function renderPointsBar() {
  const t = today();
  const todayCourses = appState.courses.filter(c => 
    c.schedules.some(s => s.dayOfWeek === t.dayOfWeek)
  );
  
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
    const hasClass = appState.courses.some(c => 
      c.schedules.some(s => s.dayOfWeek === d.dayOfWeek) ||
      (c.dateSchedules && c.dateSchedules.some(ds => ds.date === d.dateStr))
    );
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
  const courses = appState.courses.filter(c => 
    c.schedules.some(s => s.dayOfWeek === dayOfWeek) ||
    (c.dateSchedules && c.dateSchedules.some(ds => new Date(ds.date).getDay() === dayOfWeek))
  );
  
  if (courses.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">
      ${WEEKDAYS_FULL[dayOfWeek]}没有课程，点击下方按钮添加
    </div>`;
    return;
  }
  
  container.innerHTML = courses.map(c => {
    const daySchedules = getSchedulesForDay(c, dayOfWeek);
    const timeStr = daySchedules.map(s => s.time).join(' / ');
    return `
    <div class="schedule-course-item">
      <div class="course-color-dot" style="background:${c.color}"></div>
      <span style="font-size:22px;">${c.icon}</span>
      <div style="flex:1;">
        <div style="font-weight:700;">${c.name}</div>
        <div style="font-size:12px;color:var(--text-muted);">⏰ ${timeStr}</div>
      </div>
      <button class="btn-danger" onclick="deleteCourse('${c.id}')">删除</button>
    </div>`;
  }).join('');
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
    ${appState.courses.map(c => {
      const weeklySummary = c.schedules.map(s => 
        `${WEEKDAYS_FULL[s.dayOfWeek]} ${s.time}`
      ).join(' · ');
      const dateSummary = (c.dateSchedules || []).map(ds => 
        `${formatDate(ds.date)} ${ds.time}`
      ).join(' · ');
      const scheduleSummary = [weeklySummary, dateSummary].filter(Boolean).join(' · ');
      return `
      <div class="schedule-course-item">
        <div class="course-color-dot" style="background:${c.color}"></div>
        <span style="font-size:22px;">${c.icon}</span>
        <div style="flex:1;">
          <div style="font-weight:700;">${c.name}</div>
          <div style="font-size:12px;color:var(--text-muted);">
            ${scheduleSummary}
          </div>
        </div>
        <button class="btn btn-ghost" style="font-size:12px;padding:6px 10px;flex:0;" 
                onclick="editCourse('${c.id}')">✏️</button>
      </div>`;
    }).join('')}`;
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
    if (c.noteOnly) return; // 跳过仅备注的记录
    const course = getCourse(c.courseId);
    let text = `${course?.icon || '📚'} ${course?.name || '未知'} 打卡`;
    if (c.note) text += ` · 📝${c.note}`;
    items.push({
      date: c.date,
      type: 'checkin',
      text: text,
      points: c.time ? POINTS_PER_CHECKIN : 0,
      ts: new Date(c.date + 'T' + (c.time || '00:00')).getTime(),
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
  document.getElementById('prizeName').textContent = prize.name || prize.prize;
  const w = prize.weight || 20;
  const rarity = w <= 5 ? '超级稀有' : w <= 10 ? '稀有' : '普通';
  document.getElementById('prizeRarity').textContent = 
    `${rarity}奖品 · ${prize.courseName} 第${prize.round}轮`;
  document.getElementById('prizeReveal').style.display = 'flex';
  
  if (appState.settings.sound) playWinSound();
}

function closePrize() {
  document.getElementById('prizeReveal').style.display = 'none';
  stopConfetti();
  renderAll();
}

// =============================================
//  浮动粒子背景
// =============================================
let particlesAnimationId = null;
const particlesCanvas = document.getElementById('particles-canvas');
const pctx = particlesCanvas.getContext('2d');
let bgParticles = [];

// Canvas roundRect polyfill
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    this.beginPath();
    this.moveTo(x + r.tl, y);
    this.lineTo(x + w - r.tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    this.lineTo(x + w, y + h - r.br);
    this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    this.lineTo(x + r.bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    this.lineTo(x, y + r.tl);
    this.quadraticCurveTo(x, y, x + r.tl, y);
    this.closePath();
  };
}

function resizeParticles() {
  particlesCanvas.width = window.innerWidth;
  particlesCanvas.height = window.innerHeight;
}

function initParticles() {
  resizeParticles();
  bgParticles = [];
  const count = Math.floor((particlesCanvas.width * particlesCanvas.height) / 18000);
  for (let i = 0; i < count; i++) {
    bgParticles.push(createBgParticle());
  }
  animateBgParticles();
}

function createBgParticle() {
  const shapes = ['circle', 'star', 'diamond'];
  return {
    x: Math.random() * particlesCanvas.width,
    y: Math.random() * particlesCanvas.height,
    size: 2 + Math.random() * 4,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    color: ['rgba(255,107,53,0.2)', 'rgba(78,205,196,0.15)', 'rgba(255,230,109,0.2)', 
            'rgba(167,139,250,0.15)', 'rgba(244,114,182,0.12)'][Math.floor(Math.random() * 5)],
    vx: (Math.random() - 0.5) * 0.4,
    vy: -0.2 - Math.random() * 0.4,
    opacity: 0.3 + Math.random() * 0.4,
    pulseSpeed: 0.02 + Math.random() * 0.03,
    pulseOffset: Math.random() * Math.PI * 2,
  };
}

function animateBgParticles() {
  pctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
  
  bgParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    
    // 循环边界
    if (p.y < -20) { p.y = particlesCanvas.height + 10; p.x = Math.random() * particlesCanvas.width; }
    if (p.x < -20) p.x = particlesCanvas.width + 10;
    if (p.x > particlesCanvas.width + 20) p.x = -10;
    
    const pulse = Math.sin(Date.now() * p.pulseSpeed + p.pulseOffset) * 0.3 + 0.7;
    const alpha = p.opacity * pulse;
    
    pctx.save();
    pctx.globalAlpha = alpha;
    pctx.fillStyle = p.color;
    pctx.translate(p.x, p.y);
    
    if (p.shape === 'circle') {
      pctx.beginPath();
      pctx.arc(0, 0, p.size, 0, Math.PI * 2);
      pctx.fill();
    } else if (p.shape === 'star') {
      drawStar(pctx, 0, 0, p.size, p.size * 0.4, 5);
    } else {
      pctx.beginPath();
      pctx.moveTo(0, -p.size);
      pctx.lineTo(p.size, 0);
      pctx.lineTo(0, p.size);
      pctx.lineTo(-p.size, 0);
      pctx.closePath();
      pctx.fill();
    }
    
    pctx.restore();
  });
  
  particlesAnimationId = requestAnimationFrame(animateBgParticles);
}

function drawStar(ctx, cx, cy, outerR, innerR, points) {
  const step = Math.PI / points;
  ctx.beginPath();
  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// =============================================
//  撒花特效 (升级版：彩色纸片 + emoji)
// =============================================
let confettiAnimationId = null;
const confettiCanvas = document.getElementById('confetti-canvas');
const cctx = confettiCanvas.getContext('2d');
let confettiParticles = [];

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

function createConfettiParticle() {
  const colors = ['#FF6B35', '#4ECDC4', '#FFE66D', '#F472B6', '#A78BFA', 
                   '#60A5FA', '#6BCB77', '#FFD700', '#FF4444', '#00E5FF'];
  const emojis = ['⭐', '🌟', '✨', '💫', '🎉', '🎊', '💎', '🎀', '🌈'];
  const type = Math.random() < 0.25 ? 'emoji' : 'rect';
  
  return {
    x: Math.random() * confettiCanvas.width,
    y: -20 - Math.random() * 120,
    type: type,
    w: 6 + Math.random() * 10,
    h: 4 + Math.random() * 7,
    emoji: type === 'emoji' ? emojis[Math.floor(Math.random() * emojis.length)] : null,
    emojiSize: 16 + Math.random() * 20,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 5,
    vy: 2 + Math.random() * 5,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 12,
    opacity: 1,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.03 + Math.random() * 0.05,
  };
}

function launchConfetti() {
  resizeConfetti();
  confettiParticles = [];
  for (let i = 0; i < 150; i++) {
    confettiParticles.push(createConfettiParticle());
  }
  animateConfetti();
}

function animateConfetti() {
  cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  
  let alive = false;
  confettiParticles.forEach(p => {
    p.x += p.vx + Math.sin(p.wobble) * 1.5;
    p.y += p.vy;
    p.rotation += p.rotationSpeed;
    p.vy += 0.04;
    p.wobble += p.wobbleSpeed;
    p.opacity -= 0.0015;
    
    if (p.opacity > 0 && p.y < confettiCanvas.height + 60) {
      alive = true;
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate((p.rotation * Math.PI) / 180);
      cctx.globalAlpha = p.opacity;
      
      if (p.type === 'emoji') {
        cctx.font = `${p.emojiSize}px sans-serif`;
        cctx.textAlign = 'center';
        cctx.textBaseline = 'middle';
        cctx.fillText(p.emoji, 0, 0);
      } else {
        // 带圆角的彩色纸片
        const w = p.w, h = p.h;
        cctx.fillStyle = p.color;
        cctx.beginPath();
        cctx.roundRect(-w/2, -h/2, w, h, 2);
        cctx.fill();
      }
      
      cctx.restore();
    }
  });
  
  if (alive) {
    confettiAnimationId = requestAnimationFrame(animateConfetti);
  } else {
    cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

function stopConfetti() {
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
  confettiParticles = [];
  cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
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
  document.getElementById('inputCourseIcon').value = courseData?.icon || '📚';
  editingCourseId = courseData?.id || null;
  
  // 编辑模式显示删除按钮
  document.getElementById('btnDeleteCourse').style.display = editingCourseId ? '' : 'none';
  
  // 构建时间段列表
  const schedules = courseData?.schedules || [{ dayOfWeek: 1, time: '16:00' }];
  const container = document.getElementById('scheduleRows');
  container.innerHTML = '';
  schedules.forEach((s, idx) => {
    container.appendChild(buildScheduleRow(s.dayOfWeek, s.time, idx === 0));
  });
  
  // 构建日期课程列表
  const dateSchedules = courseData?.dateSchedules || [];
  const dateContainer = document.getElementById('dateScheduleRows');
  dateContainer.innerHTML = '';
  dateSchedules.forEach(ds => {
    dateContainer.appendChild(buildDateScheduleRow(ds.date, ds.time));
  });
  
  // 颜色选择器
  const colorContainer = document.getElementById('colorPicker');
  colorContainer.innerHTML = COURSE_COLORS.map(color => `
    <div class="color-dot ${courseData?.color === color ? 'selected' : ''}" 
         style="background:${color}" data-color="${color}" 
         onclick="selectColor(this, '${color}')"></div>
  `).join('');
  
  if (courseData?.color) {
    document.querySelector(`.color-dot[data-color="${courseData.color}"]`)?.classList.add('selected');
  }
  
  modal.style.display = 'flex';
}

function buildScheduleRow(dayOfWeek = 1, time = '16:00', isFirst = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'schedule-row';
  
  // 星期选择（小号芯片）
  const daySel = document.createElement('div');
  daySel.className = 'mini-day-selector';
  WEEKDAYS_FULL.forEach((name, idx) => {
    const chip = document.createElement('button');
    chip.className = 'mini-day-chip' + (idx === dayOfWeek ? ' selected' : '');
    chip.textContent = name[1];
    chip.type = 'button';
    chip.onclick = () => {
      daySel.querySelectorAll('.mini-day-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    };
    daySel.appendChild(chip);
  });
  wrapper.appendChild(daySel);
  
  // 时间输入
  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.className = 'schedule-time-input';
  timeInput.value = time;
  wrapper.appendChild(timeInput);
  
  // 删除按钮
  const delBtn = document.createElement('button');
  delBtn.className = 'del-schedule-btn';
  delBtn.textContent = '✕';
  delBtn.type = 'button';
  delBtn.onclick = () => {
    const rows = document.querySelectorAll('#scheduleRows .schedule-row');
    if (rows.length <= 1) {
      showToast('至少保留一个时间段');
      return;
    }
    wrapper.remove();
  };
  wrapper.appendChild(delBtn);
  
  return wrapper;
}

function addScheduleRow() {
  const container = document.getElementById('scheduleRows');
  container.appendChild(buildScheduleRow(1, '16:00', false));
}

function buildDateScheduleRow(date = '', time = '16:00') {
  const wrapper = document.createElement('div');
  wrapper.className = 'schedule-row';
  
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'schedule-time-input';
  dateInput.style.width = '130px';
  dateInput.value = date;
  wrapper.appendChild(dateInput);
  
  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.className = 'schedule-time-input';
  timeInput.value = time;
  wrapper.appendChild(timeInput);
  
  const delBtn = document.createElement('button');
  delBtn.className = 'del-schedule-btn';
  delBtn.textContent = '✕';
  delBtn.type = 'button';
  delBtn.onclick = () => wrapper.remove();
  wrapper.appendChild(delBtn);
  
  return wrapper;
}

function addDateScheduleRow() {
  const container = document.getElementById('dateScheduleRows');
  container.appendChild(buildDateScheduleRow('', '16:00'));
}

function closeModal() {
  document.getElementById('modalCourse').style.display = 'none';
  editingCourseId = null;
}

function selectColor(el, color) {
  document.querySelectorAll('#colorPicker .color-dot').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
}

function getSelectedColor() {
  const selected = document.querySelector('#colorPicker .color-dot.selected');
  return selected ? selected.dataset.color : COURSE_COLORS[0];
}

function collectSchedulesFromForm() {
  const rows = document.querySelectorAll('#scheduleRows .schedule-row');
  const schedules = [];
  rows.forEach(row => {
    const chips = row.querySelectorAll('.mini-day-chip');
    let dayOfWeek = 1;
    chips.forEach((chip, idx) => {
      if (chip.classList.contains('selected')) dayOfWeek = idx;
    });
    const timeInput = row.querySelector('.schedule-time-input');
    const time = timeInput ? timeInput.value : '16:00';
    if (time) {
      schedules.push({ dayOfWeek, time });
    }
  });
  return schedules;
}

function collectDateSchedulesFromForm() {
  const rows = document.querySelectorAll('#dateScheduleRows .schedule-row');
  const dateSchedules = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const date = inputs[0] ? inputs[0].value : '';
    const time = inputs[1] ? inputs[1].value : '16:00';
    if (date && time) {
      dateSchedules.push({ date, time });
    }
  });
  return dateSchedules;
}

function saveCourse() {
  const name = document.getElementById('inputCourseName').value.trim();
  if (!name) { showToast('请输入课程名称'); return; }
  
  const schedules = collectSchedulesFromForm();
  const dateSchedules = collectDateSchedulesFromForm();
  
  if (schedules.length === 0 && dateSchedules.length === 0) { 
    showToast('请至少设置一个时间段'); return; 
  }
  
  const icon = document.getElementById('inputCourseIcon').value || '📚';
  const color = getSelectedColor();
  
  if (editingCourseId) {
    const idx = appState.courses.findIndex(c => c.id === editingCourseId);
    if (idx >= 0) {
      appState.courses[idx] = { ...appState.courses[idx], name, schedules, icon, color, dateSchedules };
    }
  } else {
    const newCourse = {
      id: 'c_' + Date.now(),
      name, schedules, icon, color, dateSchedules,
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

function deleteCourseFromModal() {
  if (!editingCourseId) return;
  deleteCourse(editingCourseId);
  closeModal();
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
  const todayCourses = appState.courses.filter(c => 
    c.schedules.some(s => s.dayOfWeek === t.dayOfWeek)
  );
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
  const todayCourses = appState.courses.filter(c => 
    c.schedules.some(s => s.dayOfWeek === t.dayOfWeek)
  );
  
  todayCourses.forEach(course => {
    const daySchedules = getSchedulesForDay(course, t.dayOfWeek, t.dateStr);
    daySchedules.forEach(schedule => {
      const [h, m] = schedule.time.split(':').map(Number);
      const classTime = new Date(t.year, t.month - 1, t.day, h, m);
      const remindTime = new Date(classTime.getTime() - 15 * 60 * 1000);
      const now = new Date();
      
      if (remindTime > now) {
        const delay = remindTime.getTime() - now.getTime();
        setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification('⏰ 可乐爱上课', {
              body: `${course.icon} ${course.name} ${schedule.time} 还有15分钟就要开始啦！记得打卡哦~`,
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">🎒</text></svg>',
            });
          }
        }, delay);
      }
    });
  });
}

function updateSettingsUI() {
  const soundBtn = document.getElementById('btnSound');
  soundBtn.textContent = appState.settings.sound ? '🔊' : '🔇';
  soundBtn.classList.toggle('active', appState.settings.sound);
}

// =============================================
//  打卡日历
// =============================================
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based
let selectedCalDate = null; // 'YYYY-MM-DD'

function changeMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calGrid');
  const label = document.getElementById('calMonthLabel');
  label.textContent = `${calYear}年${calMonth + 1}月`;
  
  // 星期头
  let html = WEEKDAYS_FULL.map((d, i) => 
    `<div class="cal-day-header${i === 0 || i === 6 ? ' weekend' : ''}">${d[0]}</div>`
  ).join('');
  
  // 当月第一天
  const firstDay = new Date(calYear, calMonth, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const t = today();
  
  // 构建当月所有日期的状态映射
  const dayStatusMap = buildDayStatusMap(calYear, calMonth, daysInMonth);
  
  // 前置空白
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += '<div class="cal-day other-month"></div>';
  }
  
  // 当月日期
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const status = dayStatusMap[dateStr] || 'no-course';
    const isToday = dateStr === t.dateStr;
    
    let cls = 'cal-day ' + status;
    if (isToday) cls += ' today';
    if (status === 'no-course') cls += ' no-course';
    
    html += `<div class="${cls}" data-date="${dateStr}" onclick="onCalDayClick('${dateStr}', '${status}')">
      <span class="cal-day-num">${d}</span>
      ${status !== 'no-course' ? '<span class="cal-day-dot"></span>' : ''}
    </div>`;
  }
  
  grid.innerHTML = html;
  
  // 如果之前有选中日期，恢复详情面板
  if (selectedCalDate) {
    showDayDetail(selectedCalDate);
  }
}

function buildDayStatusMap(year, month, daysInMonth) {
  const map = {};
  const now = new Date();
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month, d).getDay();
    
    // 当天是否有课程（每周固定 + 按日期）
    const hasCourse = appState.courses.some(c => 
      c.schedules.some(s => s.dayOfWeek === dayOfWeek) ||
      (c.dateSchedules && c.dateSchedules.some(ds => ds.date === dateStr))
    );
    
    if (!hasCourse) {
      map[dateStr] = 'no-course';
      continue;
    }
    
    // 未来日期 → pending
    const dateObj = new Date(year, month, d + 1); // +1 for end of day
    if (dateObj > now) {
      map[dateStr] = 'pending';
      continue;
    }
    
    // 过去日期：检查是否已打卡/请假
    const todayCourses = appState.courses.filter(c => 
      c.schedules.some(s => s.dayOfWeek === dayOfWeek)
    );
    
    let allChecked = true;
    let hasAbsence = false;
    
    todayCourses.forEach(c => {
      const checked = isCheckedIn(c.id, dateStr);
      const isAbsent = appState.checkins.some(chk => 
        chk.courseId === c.id && chk.date === dateStr && chk.isAbsence
      );
      if (!checked && !isAbsent) allChecked = false;
      if (isAbsent) hasAbsence = true;
    });
    
    if (allChecked) {
      map[dateStr] = 'checked';
    } else if (hasAbsence && !todayCourses.some(c => !isCheckedIn(c.id, dateStr) && !appState.checkins.some(chk => chk.courseId === c.id && chk.date === dateStr && chk.isAbsence))) {
      // 全部课程要么已打卡要么已请假
      map[dateStr] = 'absent';
    } else {
      map[dateStr] = 'missed';
    }
  }
  
  return map;
}

function onCalDayClick(dateStr, status) {
  if (status === 'no-course') return;
  selectedCalDate = dateStr;
  showDayDetail(dateStr);
}

function showDayDetail(dateStr) {
  const container = document.getElementById('calDayDetail');
  const dayOfWeek = new Date(dateStr).getDay();
  const courses = appState.courses.filter(c => 
    c.schedules.some(s => s.dayOfWeek === dayOfWeek)
  );
  
  if (courses.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  const t = today();
  const isFuture = dateStr > t.dateStr;
  const isToday = dateStr === t.dateStr;
  
  let html = `<div style="font-weight:700;margin-bottom:8px;">${formatDate(dateStr)} ${WEEKDAYS_FULL[dayOfWeek]}</div>`;
  
  courses.forEach(course => {
    const schedules = getSchedulesForDay(course, dayOfWeek, dateStr);
    const timeStr = schedules.map(s => s.time).join(' / ');
    const checked = isCheckedIn(course.id, dateStr);
    const checkinRecord = appState.checkins.find(c => c.courseId === course.id && c.date === dateStr && !c.isAbsence && !c.noteOnly);
    const absenceRecord = appState.checkins.find(c => c.courseId === course.id && c.date === dateStr && c.isAbsence);
    const noteRecord = appState.checkins.find(c => c.courseId === course.id && c.date === dateStr && (c.noteOnly || c.isAbsence || c.note));
    
    let statusLabel, statusCls;
    if (checked) {
      statusLabel = '✅ 已打卡';
      statusCls = 'checked';
    } else if (absenceRecord) {
      statusLabel = '🏠 请假';
      statusCls = 'absent';
    } else if (isFuture || isToday) {
      statusLabel = '⏳ 待打卡';
      statusCls = 'pending';
    } else {
      statusLabel = '❌ 漏打卡';
      statusCls = 'missed';
    }
    
    const note = noteRecord?.note || '';
    const escapedName = course.name.replace(/'/g, "\\'");
    const hasEditBtn = !checked && !isFuture;
    
    html += `
      <div class="cal-detail-course">
        <span style="font-size:20px;">${course.icon}</span>
        <div style="flex:1;">
          <div style="font-weight:600;">${course.name}</div>
          <div style="font-size:11px;color:var(--text-muted);">⏰ ${timeStr}</div>
          ${note ? `<div class="cal-detail-note">📝 ${note}</div>` : ''}
        </div>
        <span class="cal-detail-status ${statusCls}">${statusLabel}</span>
        ${(hasEditBtn || absenceRecord) ? 
          `<button class="btn btn-ghost" style="font-size:11px;padding:4px 8px;flex:0;margin-left:4px;" 
             onclick="openNotesModal('${course.id}', '${dateStr}', '${course.icon}', '${escapedName}')">📝</button>` : ''}
      </div>`;
  });
  
  container.innerHTML = html;
  container.style.display = 'block';
}

// =============================================
//  补卡备注弹窗
// =============================================
let notesCourseId = null;
let notesDateStr = null;

function openNotesModal(courseId, dateStr, icon, name) {
  notesCourseId = courseId;
  notesDateStr = dateStr;
  
  // 检查已有记录
  const existing = appState.checkins.find(c => c.courseId === courseId && c.date === dateStr && !c.noteOnly);
  const noteRecord = appState.checkins.find(c => c.courseId === courseId && c.date === dateStr && (c.noteOnly || c.isAbsence));
  const isAbsence = noteRecord?.isAbsence;
  
  const modal = document.getElementById('modalNotes');
  document.getElementById('notesModalTitle').textContent = `${icon} ${name}`;
  
  let statusHTML = `📅 ${formatDate(dateStr)} ${WEEKDAYS_FULL[new Date(dateStr).getDay()]}`;
  if (existing) {
    statusHTML += '<br>已打卡 ✅';
  } else if (isAbsence) {
    statusHTML += '<br><span style="color:#F59E0B;">已请假 🏠</span>';
  } else {
    statusHTML += '<br><span style="color:var(--danger);">漏打卡 ❌</span>';
  }
  
  document.getElementById('notesModalBody').innerHTML = `
    <div style="text-align:center;padding:8px 0;color:var(--text-muted);">${statusHTML}</div>`;
  
  document.getElementById('inputNote').value = noteRecord?.note || existing?.note || '';
  
  // 调整按钮
  const btnCheckin = document.getElementById('btnCheckinNote');
  const btnSave = document.getElementById('btnSaveNote');
  const btnAbsence = document.getElementById('btnMarkAbsence');
  
  if (existing) {
    btnCheckin.style.display = 'none';
    btnAbsence.style.display = 'none';
    btnSave.textContent = '💾 更新备注';
    btnSave.style.flex = '1';
  } else if (isAbsence) {
    btnCheckin.style.display = '';
    btnCheckin.textContent = '❌ 取消请假';
    btnCheckin.style.background = '#F59E0B';
    btnCheckin.style.color = 'white';
    btnAbsence.style.display = 'none';
    btnSave.textContent = '💾 更新备注';
    btnSave.style.flex = '1';
  } else {
    btnCheckin.style.display = '';
    btnCheckin.textContent = '✅ 补打卡 +10⭐';
    btnCheckin.style.background = '';
    btnCheckin.style.color = '';
    btnAbsence.style.display = '';
    btnSave.textContent = '💾 备注';
    btnSave.style.flex = '0.7';
  }
  
  modal.style.display = 'flex';
}

function closeNotesModal() {
  document.getElementById('modalNotes').style.display = 'none';
  notesCourseId = null;
  notesDateStr = null;
}

function saveNoteOnly() {
  if (!notesCourseId || !notesDateStr) return;
  const note = document.getElementById('inputNote').value.trim();
  
  // 查找任何已有记录（打卡、备注、请假）
  const existing = appState.checkins.find(c => 
    c.courseId === notesCourseId && c.date === notesDateStr && !c.noteOnly
  );
  const noteOnly = appState.checkins.find(c => 
    c.courseId === notesCourseId && c.date === notesDateStr && c.noteOnly
  );
  const absence = appState.checkins.find(c => 
    c.courseId === notesCourseId && c.date === notesDateStr && c.isAbsence
  );
  
  const target = existing || noteOnly || absence;
  
  if (target) {
    target.note = note || null;
  } else {
    appState.checkins.push({
      id: 'note_' + Date.now(),
      courseId: notesCourseId,
      date: notesDateStr,
      time: '',
      note: note || null,
      noteOnly: true,
    });
  }
  
  saveState();
  closeNotesModal();
  renderAll();
  showToast('📝 备注已保存');
}

function doCheckinWithNote() {
  if (!notesCourseId || !notesDateStr) return;
  const note = document.getElementById('inputNote').value.trim();
  
  // 检查是否是取消请假
  const absenceRecord = appState.checkins.find(c => 
    c.courseId === notesCourseId && c.date === notesDateStr && c.isAbsence
  );
  
  if (absenceRecord) {
    // 取消请假 → 删除请假记录
    appState.checkins = appState.checkins.filter(c => 
      !(c.courseId === notesCourseId && c.date === notesDateStr && c.isAbsence)
    );
    saveState();
    closeNotesModal();
    renderAll();
    showToast('已取消请假，恢复为待打卡状态');
    return;
  }
  
  // 正常补打卡
  appState.checkins = appState.checkins.filter(c => 
    !(c.courseId === notesCourseId && c.date === notesDateStr && (c.noteOnly || c.isAbsence))
  );
  
  const reached100 = doCheckin(notesCourseId, notesDateStr, note || null);
  closeNotesModal();
  renderAll();
  
  const course = getCourse(notesCourseId);
  if (reached100) {
    showToast(`🎉 ${course?.icon || ''} 补打卡成功！满分！快去抽盲盒！`);
    setTimeout(() => {
      switchTab('blindbox');
      openBlindBox(notesCourseId);
    }, 500);
  } else {
    showToast(`✅ 补打卡成功！+${POINTS_PER_CHECKIN}⭐`);
  }
}

// 标记请假
function markAbsence() {
  if (!notesCourseId || !notesDateStr) return;
  const note = document.getElementById('inputNote').value.trim();
  
  // 删除旧记录
  appState.checkins = appState.checkins.filter(c => 
    !(c.courseId === notesCourseId && c.date === notesDateStr && (c.noteOnly || c.isAbsence))
  );
  
  // 添加请假记录（不加分）
  appState.checkins.push({
    id: 'abs_' + Date.now(),
    courseId: notesCourseId,
    date: notesDateStr,
    time: '',
    note: note || null,
    isAbsence: true,
  });
  
  saveState();
  closeNotesModal();
  renderAll();
  showToast('🏠 已标记请假');
}

// --- 全局渲染 ---
function renderAll() {
  updateProfileUI();
  renderTodayClasses();
  renderPointsBar();
  renderCalendar();
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
  
  // 备注弹窗关闭
  document.getElementById('modalNotes').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeNotesModal();
  });
  
  // 保存备注按钮
  document.getElementById('btnSaveNote').addEventListener('click', saveNoteOnly);
  
  // 补打卡按钮
  document.getElementById('btnCheckinNote').addEventListener('click', doCheckinWithNote);
  
  // 奖品编辑弹窗
  document.getElementById('modalPrize').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePrizeEditor();
  });
  document.getElementById('btnSavePrize').addEventListener('click', savePrize);
  document.getElementById('inputPrizeWeight').addEventListener('input', function() {
    document.getElementById('weightDisplay').textContent = this.value;
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
  window.addEventListener('resize', () => {
    resizeConfetti();
    resizeParticles();
  });
  
  // 初始化粒子背景
  initParticles();
  
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
  
  // 初始化门禁和云端同步
  initGate();
});

// =============================================
//  PWA 注册
// =============================================
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        console.log('[PWA] Service Worker 已注册', reg.scope);
        
        // 监听 SW 消息：新版本可用时提示刷新
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'NEW_VERSION') {
            console.log('[PWA] 新版本:', event.data.version);
            // 自动静默刷新
            setTimeout(() => {
              if (confirm('🎉 可乐爱上课有更新！点击确定刷新到最新版本')) {
                window.location.reload();
              }
            }, 1000);
          }
        });
        
        // 检测 SW 更新
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] 新版本已就绪，即将刷新');
              }
            });
          }
        });
      })
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
  
  const now = new Date();
  
  // 两个月后的日期（ICS UNTIL 格式）
  const twoMonthsLater = new Date(now);
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);
  const untilStr = twoMonthsLater.getFullYear() +
    String(twoMonthsLater.getMonth() + 1).padStart(2, '0') +
    String(twoMonthsLater.getDate()).padStart(2, '0') + 'T235959';
  
  // 为每门课的每个时间段生成重复事件
  appState.courses.forEach(course => {
    
    // 格式化为ICS日期
    const formatICSDate = (d, hour, min) => {
      return d.getFullYear() +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0') + 'T' +
        String(hour).padStart(2, '0') +
        String(min).padStart(2, '0') + '00';
    };
    
    course.schedules.forEach(schedule => {
      const [h, m] = schedule.time.split(':').map(Number);
      const startDate = new Date(now);
      
      // 找到下一个匹配的星期几
      while (startDate.getDay() !== schedule.dayOfWeek) {
        startDate.setDate(startDate.getDate() + 1);
      }
      
      const dtStart = formatICSDate(startDate, h, m);
      const dtEnd = formatICSDate(startDate, h, m + 60);
      
      const uid = `cola-${course.id}-${schedule.dayOfWeek}-${schedule.time.replace(':', '')}@colalovesclass`;
      
      ics.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${course.icon} ${course.name}`,
        `DESCRIPTION:🎒 可乐爱上课提醒\\n课程：${course.name}\\n时间：${schedule.time}\\n记得打卡赚积分哦！`,
        `RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:⏰ ${course.name} ${schedule.time} 还有15分钟开始！`,
        'END:VALARM',
        'END:VEVENT'
      );
    });
    
    // 按日期课程（仅导出未来两个月内的）
    if (course.dateSchedules) {
      course.dateSchedules.forEach(ds => {
        const d = new Date(ds.date);
        if (d < now || d > twoMonthsLater) return; // 跳过过去和超出两个月的
        const [h, m] = ds.time.split(':').map(Number);
        const dtStart = formatICSDate(d, h, m);
        const dtEnd = formatICSDate(d, h, m + 60);
        const uid = `cola-${course.id}-date-${ds.date}-${ds.time.replace(':', '')}@colalovesclass`;
        
        ics.push(
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${course.icon} ${course.name}`,
          `DESCRIPTION:🎒 可乐爱上课提醒\\n课程：${course.name}\\n日期：${formatDate(ds.date)} ${ds.time}\\n记得打卡赚积分哦！`,
          'BEGIN:VALARM',
          'TRIGGER:-PT15M',
          'ACTION:DISPLAY',
          `DESCRIPTION:⏰ ${course.name} ${ds.time} 还有15分钟开始！`,
          'END:VALARM',
          'END:VEVENT'
        );
      });
    }
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
  renderPrizeListSettings();
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

// ========== Profile UI ==========
function updateProfileUI() {
  const profile = getCurrentProfile();
  const header = document.getElementById('headerProfile');
  const nameEl = document.getElementById('headerProfileName');
  if (profile) {
    header.style.display = 'inline-flex';
    nameEl.textContent = profile.name || '小朋友';
    renderProfileDropdown();
  } else {
    header.style.display = 'none';
  }
}

function renderProfileDropdown() {
  const profiles = getProfiles();
  const list = document.getElementById('profileDropdownList');
  const currentKey = localStorage.getItem('cola_active_key');
  
  let html = '';
  Object.entries(profiles).forEach(([key, p]) => {
    const isActive = key === currentKey;
    html += '<div class="profile-dropdown-item' + (isActive ? ' active' : '') + '" onclick="event.stopPropagation();switchProfile(\'' + key + '\')">' + p.name + (isActive ? ' ●' : '') + '<span class="delete-icon" onclick="event.stopPropagation();deleteProfile(\'' + key + '\')">✕</span></div>';
  });
  list.innerHTML = html;
}

function toggleProfileMenu(e) {
  e.stopPropagation();
  const dd = document.getElementById('profileDropdown');
  const show = dd.style.display === 'block';
  dd.style.display = show ? 'none' : 'block';
  if (!show) {
    renderProfileDropdown();
    setTimeout(function() { document.addEventListener('click', hideProfileMenu, { once: true }); }, 0);
  }
}

function hideProfileMenu() {
  document.getElementById('profileDropdown').style.display = 'none';
}

function closeSettings() {
  document.getElementById('modalSettings').style.display = 'none';
}

// =============================================
//  奖品池管理
// =============================================
let editingPrizeIndex = -1;

function renderPrizeListSettings() {
  const container = document.getElementById('prizeListSettings');
  const pool = appState.prizePool || DEFAULT_PRIZE_POOL;
  const enabledPool = pool.filter(p => p.enabled !== false);
  const totalWeight = enabledPool.reduce((s, p) => s + p.weight, 0);
  
  let html = '';
  if (totalWeight > 0) {
    html += `<div class="prize-total-info">总权重: ${totalWeight} | 当前启用的奖品: ${enabledPool.length} 个</div>`;
  }
  
  pool.forEach((prize, idx) => {
    const pct = totalWeight > 0 && prize.enabled !== false ? ((prize.weight / totalWeight) * 100).toFixed(1) : 0;
    const disabled = prize.enabled === false;
    html += `
      <div class="prize-list-item ${disabled ? 'disabled' : ''}">
        <span class="prize-emoji">${prize.emoji}</span>
        <div class="prize-info">
          <div class="prize-name">${prize.name}</div>
          <div class="prize-weight">权重: ${prize.weight}</div>
          ${!disabled ? `<div class="prize-pct">概率: ${pct}%</div>` : ''}
        </div>
        <div class="prize-actions">
          <button class="prize-action-btn" onclick="openPrizeEditor(${idx})" title="编辑">✏️</button>
          <button class="prize-action-btn" onclick="togglePrize(${idx})" title="${disabled ? '启用' : '停用'}">${disabled ? '▶' : '⏸'}</button>
          <button class="prize-action-btn del" onclick="deletePrize(${idx})" title="删除">✕</button>
        </div>
      </div>`;
  });
  
  container.innerHTML = html || '<div style="text-align:center;color:var(--text-muted);padding:8px;">还没有奖品，点下方添加</div>';
}

function openPrizeEditor(idx = -1) {
  editingPrizeIndex = idx;
  const pool = appState.prizePool || DEFAULT_PRIZE_POOL;
  const modal = document.getElementById('modalPrize');
  
  if (idx >= 0 && pool[idx]) {
    const p = pool[idx];
    document.getElementById('prizeModalTitle').textContent = '编辑奖品';
    document.getElementById('inputPrizeName').value = p.name;
    document.getElementById('inputPrizeEmoji').value = p.emoji;
    document.getElementById('inputPrizeWeight').value = p.weight;
    document.getElementById('weightDisplay').textContent = p.weight;
  } else {
    document.getElementById('prizeModalTitle').textContent = '添加奖品';
    document.getElementById('inputPrizeName').value = '';
    document.getElementById('inputPrizeEmoji').value = '🎁';
    document.getElementById('inputPrizeWeight').value = 15;
    document.getElementById('weightDisplay').textContent = '15';
  }
  
  modal.style.display = 'flex';
  
  // 实时显示权重
  const rangeEl = document.getElementById('inputPrizeWeight');
  rangeEl.oninput = () => {
    document.getElementById('weightDisplay').textContent = rangeEl.value;
  };
}

function closePrizeEditor() {
  document.getElementById('modalPrize').style.display = 'none';
  editingPrizeIndex = -1;
}

function savePrize() {
  const name = document.getElementById('inputPrizeName').value.trim();
  if (!name) { showToast('请输入奖品名称'); return; }
  
  const emoji = document.getElementById('inputPrizeEmoji').value || '🎁';
  const weight = parseInt(document.getElementById('inputPrizeWeight').value) || 10;
  
  if (!appState.prizePool) appState.prizePool = JSON.parse(JSON.stringify(DEFAULT_PRIZE_POOL));
  
  if (editingPrizeIndex >= 0) {
    appState.prizePool[editingPrizeIndex] = { name, emoji, weight, enabled: true };
  } else {
    appState.prizePool.push({ name, emoji, weight, enabled: true });
  }
  
  saveState();
  closePrizeEditor();
  renderPrizeListSettings();
  showToast('✅ 奖品已保存');
}

function deletePrize(idx) {
  if (!appState.prizePool || idx < 0 || idx >= appState.prizePool.length) return;
  const prize = appState.prizePool[idx];
  if (!confirm(`确定删除「${prize.name}」吗？`)) return;
  appState.prizePool.splice(idx, 1);
  saveState();
  renderPrizeListSettings();
  showToast(`已删除「${prize.name}」`);
}

function togglePrize(idx) {
  if (!appState.prizePool || idx < 0 || idx >= appState.prizePool.length) return;
  const prize = appState.prizePool[idx];
  prize.enabled = prize.enabled === false ? true : false;
  saveState();
  renderPrizeListSettings();
}
