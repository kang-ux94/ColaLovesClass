/* ============================================
   云存储层 - 多通行证 · 多孩子
   通行证哈希 → COS文件名 → 数据隔离
   ============================================ */

const COS_BASE = 'https://636f-colaloveclass-d9gzna4izc7622225-1355124202.cos.ap-shanghai.myqcloud.com/';
const OLD_FILE = COS_BASE + 'cola_data.json';
const PROFILE_KEY = 'cola_profiles';      // { key1: {name,icon}, key2: ... }
const ACTIVE_KEY = 'cola_active_key';     // 当前活跃的 key

let cloudKey = null;    // 当前 COS 文件名哈希部分
let cloudFile = null;   // 完整 COS URL
let cloudReady = false;
let cloudSyncing = false;

// ========== 通行证哈希 ==========
function hashPass(passcode) {
  let h = 0;
  const s = 'cola_salt_2026_' + passcode;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function setCloudKey(key) {
  cloudKey = key;
  cloudFile = COS_BASE + 'cola_data_' + key + '.json';
  localStorage.setItem(ACTIVE_KEY, key);
}

// ========== Profile 管理 ==========
function getProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; }
  catch { return {}; }
}

function saveProfiles(profiles) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
}

function getCurrentProfile() {
  const key = localStorage.getItem(ACTIVE_KEY);
  const profiles = getProfiles();
  return key && profiles[key] ? { key, ...profiles[key] } : null;
}

function saveCurrentProfile() {
  const key = localStorage.getItem(ACTIVE_KEY);
  if (!key) return;
  const profiles = getProfiles();
  if (!profiles[key]) return;
  // 保存本地数据到 profile 专属 key
  if (typeof appState !== 'undefined' && appState) {
    try {
      appState._updatedAt = Date.now();
      localStorage.setItem('cola_data_' + key, JSON.stringify(appState));
    } catch(e) {}
  }
}

function loadProfileData(key) {
  try {
    const raw = localStorage.getItem('cola_data_' + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ========== 门禁系统 ==========
function initGate() {
  const key = localStorage.getItem(ACTIVE_KEY);
  const profiles = getProfiles();
  
  if (key && profiles[key]) {
    // 已有通行证，直接进
    setCloudKey(key);
    document.getElementById('gate-overlay').style.display = 'none';
    if (typeof onGatePassed === 'function') {
      // 加载 profile 专属数据
      const data = loadProfileData(key);
      onGatePassed(data || null);
    }
  } else {
    // 首次或重置：显示门禁
    document.getElementById('gate-overlay').style.display = 'flex';
    document.getElementById('gate-step1').style.display = '';
    document.getElementById('gate-step2').style.display = 'none';
    document.getElementById('gate-input').focus();
  }
}

function enterGateStep1() {
  const pass = document.getElementById('gate-input').value.trim();
  const err = document.getElementById('gate-error');
  if (!pass) { err.style.display = 'block'; err.textContent = '请输入通行证'; return; }
  err.style.display = 'none';
  
  const key = hashPass(pass);
  const profiles = getProfiles();
  
  if (profiles[key]) {
    // 已存在的 profile → 直接切换
    localStorage.setItem(ACTIVE_KEY, key);
    setCloudKey(key);
    document.getElementById('gate-overlay').style.display = 'none';
    const data = loadProfileData(key);
    if (typeof onGatePassed === 'function') onGatePassed(data || null);
  } else {
    // 新通行证 → 第2步：输入名字
    document.getElementById('gate-step1').style.display = 'none';
    document.getElementById('gate-btn1').style.display = 'none';
    document.getElementById('gate-step2').style.display = '';
    document.getElementById('gate-btn2').style.display = '';
    document.getElementById('gate-name-input').focus();
    document.getElementById('gate-name-input').dataset.key = key;
  }
}

function enterGateStep2() {
  const name = document.getElementById('gate-name-input').value.trim();
  const key = document.getElementById('gate-name-input').dataset.key;
  const err = document.getElementById('gate-name-error');
  if (!name) { err.style.display = 'block'; return; }
  err.style.display = 'none';
  
  // 保存新 profile
  const profiles = getProfiles();
  profiles[key] = { name, icon: '🎒' };
  saveProfiles(profiles);
  
  localStorage.setItem(ACTIVE_KEY, key);
  setCloudKey(key);
  document.getElementById('gate-overlay').style.display = 'none';
  
  // 尝试从旧文件迁移
  migrateOldData().then(oldData => {
    if (typeof onGatePassed === 'function') onGatePassed(oldData);
    else if (typeof onGatePassed === 'function') onGatePassed(null);
  });
}

function skipGate() {
  localStorage.removeItem(ACTIVE_KEY);
  cloudKey = null;
  cloudFile = null;
  cloudReady = false;
  updateCloudStatus('error', '仅本地模式');
  document.getElementById('gate-overlay').style.display = 'none';
  if (typeof onGatePassed === 'function') onGatePassed(null);
}

function resetGate() {
  saveCurrentProfile(); // 先保存当前数据
  localStorage.removeItem(ACTIVE_KEY);
  cloudKey = null;
  cloudFile = null;
  cloudReady = false;
  updateCloudStatus('error', '请选择家庭成员');
  if (typeof closeSettings === 'function') closeSettings();
  document.getElementById('gate-overlay').style.display = 'flex';
  document.getElementById('gate-step1').style.display = '';
  document.getElementById('gate-step2').style.display = 'none';
  document.getElementById('gate-input').value = '';
  document.getElementById('gate-input').focus();
}

// 切换 profile
function switchProfile(key) {
  if (key === cloudKey) return; // 已经是当前
  
  // 保存当前数据
  saveCurrentProfile();
  
  // 切换
  setCloudKey(key);
  const data = loadProfileData(key);
  
  if (typeof onGatePassed === 'function') {
    onGatePassed(data || null);
  }
}

// 创建新 profile
function createProfile() {
  const pass = prompt('新孩子的通行证（用于跨设备同步）:');
  if (!pass) return;
  const key = hashPass(pass);
  const profiles = getProfiles();
  if (profiles[key]) { alert('该通行证已存在'); return; }
  
  const name = prompt('小朋友的名字（如：玥玥）:');
  if (!name) return;
  
  profiles[key] = { name, icon: '🎒' };
  saveProfiles(profiles);
  saveCurrentProfile();
  switchProfile(key);
}

// 删除 profile
function deleteProfile(key) {
  const profiles = getProfiles();
  if (!profiles[key]) return;
  if (Object.keys(profiles).length <= 1) { alert('至少保留一个家庭成员'); return; }
  if (!confirm('确定删除「' + profiles[key].name + '」吗？本地数据将被清除。')) return;
  
  delete profiles[key];
  saveProfiles(profiles);
  localStorage.removeItem('cola_data_' + key);
  
  if (cloudKey === key) {
    // 切到另一个
    const nextKey = Object.keys(profiles)[0];
    switchProfile(nextKey);
  }
}

// ========== 迁移旧数据 ==========
async function migrateOldData() {
  try {
    const resp = await fetch(OLD_FILE + '?t=' + Date.now(), { cache: 'no-store' });
    if (resp.ok) {
      const old = await resp.json();
      if (old && Array.isArray(old.courses)) {
        console.log('[云端] 发现旧数据，迁移中...');
        await fetch(cloudFile, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...old, _updatedAt: Date.now() }),
        });
        console.log('[云端] 数据已迁移');
        return old;
      }
    }
  } catch (e) {}
  return null;
}

// ========== 云存储操作 ==========
function updateCloudStatus(status, msg) {
  const dot = document.getElementById('cloudStatusDot');
  const text = document.getElementById('cloudStatusText');
  if (dot) {
    dot.style.background = status === 'ok' ? '#6BCB77' : status === 'connecting' ? '#FFD93D' : '#FF6B6B';
  }
  if (text) { text.textContent = msg || ''; }
}

function initCloud() {
  if (!cloudFile) { updateCloudStatus('error', '仅本地模式'); return; }
  updateCloudStatus('connecting', '检测中...');
  cloudReady = true;
}

function isValidCloudData(data) {
  return data && Array.isArray(data.courses);
}

async function loadFromCloud() {
  if (!cloudFile) return null;
  try {
    const resp = await fetch(cloudFile + '?t=' + Date.now(), { cache: 'no-store' });
    if (!resp.ok) {
      if (resp.status === 404) { cloudReady = true; updateCloudStatus('ok', '已连接'); return null; }
      return null;
    }
    const data = await resp.json();
    cloudReady = true;
    updateCloudStatus('ok', '已连接');
    return isValidCloudData(data) ? data : null;
  } catch (e) {
    cloudReady = false;
    updateCloudStatus('error', '无法连接云端');
    return null;
  }
}

async function saveToCloud(data) {
  if (!cloudFile || cloudSyncing) return;
  cloudSyncing = true;
  updateCloudStatus('connecting', '同步中...');
  try {
    const payload = JSON.stringify({ ...data, _updatedAt: Date.now() });
    const resp = await fetch(cloudFile, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: payload });
    if (resp.ok) { cloudReady = true; updateCloudStatus('ok', '已连接'); }
    else { updateCloudStatus('error', '保存失败 HTTP' + resp.status); }
  } catch (e) { updateCloudStatus('error', '网络异常'); }
  cloudSyncing = false;
}

let cloudSaveTimer = null;
function scheduleCloudSave() {
  if (!cloudFile) return;
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    if (typeof appState !== 'undefined' && appState) saveToCloud(appState);
  }, 3000);
}
