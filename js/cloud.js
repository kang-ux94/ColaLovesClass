/* ============================================
   云存储层 - GitHub Gist
   需要一次配置：在设置中粘贴 GitHub Token
   ============================================ */

const GIST_FILENAME = 'cola_data.json';

let cloudToken = null;
let cloudGistId = null;
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

async function initCloud() {
  updateCloudStatus('connecting', '连接中...');
  cloudToken = localStorage.getItem('cola_cloud_token');
  cloudGistId = localStorage.getItem('cola_cloud_gist_id');
  if (cloudToken && cloudGistId) {
    cloudReady = true;
    updateCloudStatus('ok', '已连接');
  } else if (cloudToken) {
    updateCloudStatus('connecting', '需要生成同步ID');
  } else {
    updateCloudStatus('connecting', '等待配置...');
  }
}

function ghHeaders() {
  return {
    'Authorization': `token ${cloudToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

async function loadFromCloud() {
  if (!cloudGistId) return null;
  try {
    // 公开 gist 可以不需 token 读取
    const h = cloudToken ? ghHeaders() : { 'Accept': 'application/vnd.github.v3+json' };
    const resp = await fetch(`https://api.github.com/gists/${cloudGistId}`, { headers: h });
    if (!resp.ok) return null;
    const gist = await resp.json();
    const file = gist.files[GIST_FILENAME];
    if (file?.content) {
      const data = JSON.parse(file.content);
      if (data._updatedAt !== undefined) return data;
    }
    return null;
  } catch (e) {
    console.warn('[云端] 读取失败:', e.message);
    return null;
  }
}

async function saveToCloud(data) {
  if (!cloudToken || cloudSyncing) return;
  cloudSyncing = true;
  updateCloudStatus('connecting', '同步中...');
  try {
    const payload = JSON.stringify({ ...data, _updatedAt: Date.now() }, null, 2);
    
    if (cloudGistId) {
      const resp = await fetch(`https://api.github.com/gists/${cloudGistId}`, {
        method: 'PATCH',
        headers: ghHeaders(),
        body: JSON.stringify({ files: { [GIST_FILENAME]: { content: payload } } }),
      });
      if (resp.ok) {
        updateCloudStatus('ok', '已连接');
      } else {
        console.warn('[云端] 更新失败:', resp.status);
      }
    } else {
      // 创建新 Gist
      const resp = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: ghHeaders(),
        body: JSON.stringify({
          description: '可乐爱上课 - 数据同步',
          public: false,
          files: { [GIST_FILENAME]: { content: payload } },
        }),
      });
      if (resp.ok) {
        const gist = await resp.json();
        cloudGistId = gist.id;
        cloudReady = true;
        localStorage.setItem('cola_cloud_gist_id', gist.id);
        updateCloudStatus('ok', '已连接');
        console.log('[云端] Gist ID:', gist.id);
      } else {
        updateCloudStatus('error', '创建失败（检查Token）');
      }
    }
  } catch (e) {
    console.warn('[云端] 保存失败:', e.message);
  }
  cloudSyncing = false;
}

// 手动触发同步
async function manualSync() {
  if (!cloudGistId) {
    // 首次：创建 gist 并上传
    if (!cloudToken) {
      updateCloudStatus('error', '请先在设置中输入GitHub Token');
      return;
    }
    await saveToCloud(appState);
  } else {
    // 已有 gist：先拉再推
    const cloudData = await loadFromCloud();
    if (cloudData) {
      const localTime = appState._updatedAt || 0;
      const cloudTime = cloudData._updatedAt || 0;
      if (cloudTime > localTime) {
        delete cloudData._updatedAt;
        const s = appState.settings;
        appState = cloudData;
        appState.settings = { ...appState.settings, ...s };
        saveState();
        renderAll();
        updateCloudStatus('ok', '已从云端同步');
      } else {
        await saveToCloud(appState);
      }
    } else {
      await saveToCloud(appState);
    }
  }
}
window.manualSync = manualSync;

let cloudSaveTimer = null;
function scheduleCloudSave() {
  if (!cloudToken) return;
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => saveToCloud(appState), 3000);
}

// 配置同步
function configureSync(token, gistId) {
  if (token) {
    cloudToken = token;
    localStorage.setItem('cola_cloud_token', token);
  }
  if (gistId) {
    cloudGistId = gistId;
    cloudReady = true;
    localStorage.setItem('cola_cloud_gist_id', gistId);
    updateCloudStatus('ok', '已连接');
  } else if (cloudToken) {
    updateCloudStatus('connecting', '点击"生成同步ID"');
  }
}
window.configureSync = configureSync;
