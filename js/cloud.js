/* ============================================
   云存储层 - CloudBase COS（零配置）
   直接读写云存储文件，无需Token、无需登录
   ============================================ */

const CLOUD_FILE = 'https://636f-colaloveclass-d9gzna4izc7622225-1355124202.cos.ap-shanghai.myqcloud.com/cola_data.json';

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
  updateCloudStatus('connecting', '检测中...');
  try {
    // 快速 HEAD 检测 COS 是否可达
    const resp = await fetch(CLOUD_FILE, { method: 'HEAD', cache: 'no-store' });
    cloudReady = true;
    updateCloudStatus('ok', '已连接');
  } catch (e) {
    cloudReady = false;
    updateCloudStatus('error', '无法连接云存储');
    console.warn('[云端] 连接失败:', e.message);
  }
}

function isValidCloudData(data) {
  // 必须有课程列表（即使是空数组也行）
  return data && Array.isArray(data.courses);
}

async function loadFromCloud() {
  try {
    const resp = await fetch(CLOUD_FILE + '?t=' + Date.now(), { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (isValidCloudData(data)) return data;
    return null;
  } catch (e) {
    console.warn('[云端] 读取失败:', e.message);
    return null;
  }
}

async function saveToCloud(data) {
  if (!cloudReady || cloudSyncing) return;
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
      console.warn('[云端] 保存失败:', resp.status, resp.statusText);
      updateCloudStatus('error', '保存失败 HTTP ' + resp.status);
    }
  } catch (e) {
    console.warn('[云端] 保存失败:', e.message);
    updateCloudStatus('error', '网络异常');
  }
  cloudSyncing = false;
}

let cloudSaveTimer = null;
function scheduleCloudSave() {
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => saveToCloud(appState), 3000);
}
