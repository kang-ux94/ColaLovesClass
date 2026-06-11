/* ============================================
   云存储层 - CloudBase COS（零配置）
   直接读写云存储文件，无需Token、无需登录
   ============================================ */

const CLOUD_FILE = 'https://636f-colaloveclass-d9gzna4izc7622225-1355124202.cos.ap-shanghai.myqcloud.com/cola_data.json';

let cloudReady = false;
let cloudSyncing = false;

function updateCloudStatus(status, msg) {
  const dot = document.getElementById('cloudStatusDot');
  const text = document.getElementById('cloudStatusText');
  if (dot) {
    dot.style.background = status === 'ok' ? '#6BCB77' : status === 'connecting' ? '#FFD93D' : '#FF6B6B';
  }
  if (text) { text.textContent = msg || ''; }
}

function initCloud() {
  updateCloudStatus('connecting', '检测中...');
  cloudReady = true; // 先假设可用，实际操作中验证
}

function isValidCloudData(data) {
  return data && Array.isArray(data.courses);
}

async function loadFromCloud() {
  try {
    const resp = await fetch(CLOUD_FILE + '?t=' + Date.now(), { cache: 'no-store' });
    if (!resp.ok) {
      if (resp.status === 404) {
        // 文件不存在是正常的首次状态
        cloudReady = true;
        updateCloudStatus('ok', '已连接');
        return null;
      }
      console.warn('[云端] HTTP', resp.status);
      return null;
    }
    const data = await resp.json();
    cloudReady = true;
    updateCloudStatus('ok', '已连接');
    if (isValidCloudData(data)) return data;
    return null;
  } catch (e) {
    console.warn('[云端] 读取失败:', e.message);
    cloudReady = false;
    updateCloudStatus('error', '无法连接云端');
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
      cloudReady = true;
      updateCloudStatus('ok', '已连接');
    } else {
      console.warn('[云端] PUT', resp.status, resp.statusText);
      updateCloudStatus('error', '保存失败 HTTP' + resp.status);
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
