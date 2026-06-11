/* ============================================
   云存储层 - CloudBase COS（零配置）
   直接读写云存储文件，无需Token、无需登录
   ============================================ */

const CLOUD_FILE = 'https://636f-colaloveclass-d9gzna4izc7622225-1355124202.tcb.qcloud.la/cola_data.json';

let cloudReady = true;
let cloudSyncing = false;

function updateCloudStatus(status, msg) {
  const dot = document.getElementById('cloudStatusDot');
  const text = document.getElementById('cloudStatusText');
  if (dot) {
    dot.style.background = status === 'ok' ? '#6BCB77' : status === 'connecting' ? '#FFD93D' : '#FF6B6B';
  }
  if (text) { text.textContent = msg || ''; }
}

async function initCloud() {
  cloudReady = true;
  updateCloudStatus('ok', '已连接');
}

async function loadFromCloud() {
  try {
    const resp = await fetch(CLOUD_FILE + '?t=' + Date.now(), { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data._updatedAt !== undefined) return data;
    return null;
  } catch (e) {
    console.warn('[云端] 读取失败:', e.message);
    return null;
  }
}

async function saveToCloud(data) {
  if (cloudSyncing) return;
  cloudSyncing = true;
  updateCloudStatus('connecting', '同步中...');
  try {
    const payload = JSON.stringify({ ...data, _updatedAt: Date.now() });
    const resp = await fetch(CLOUD_FILE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    if (resp.ok) {
      updateCloudStatus('ok', '已连接');
    } else {
      console.warn('[云端] 保存失败:', resp.status);
    }
  } catch (e) {
    console.warn('[云端] 保存失败:', e.message);
  }
  cloudSyncing = false;
}

let cloudSaveTimer = null;
function scheduleCloudSave() {
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => saveToCloud(appState), 3000);
}
