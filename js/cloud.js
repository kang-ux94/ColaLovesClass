/* ============================================
   云存储层 - jsonblob.com
   无需注册、无需API key、国内可用
   ============================================ */

let cloudBlobId = null;
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
  // 从 localStorage 读取已保存的 blob ID（跨设备共享此 ID 即可同步）
  cloudBlobId = localStorage.getItem('cola_cloud_blob_id');
  if (cloudBlobId) {
    cloudReady = true;
    updateCloudStatus('ok', '已连接');
  } else {
    updateCloudStatus('connecting', '等待首次同步...');
  }
}

async function loadFromCloud() {
  if (!cloudBlobId) return null;
  try {
    const resp = await fetch(`https://jsonblob.com/api/jsonBlob/${cloudBlobId}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    // 提取实际数据（排除元数据）
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
    
    if (cloudBlobId) {
      // 更新已有 blob
      const resp = await fetch(`https://jsonblob.com/api/jsonBlob/${cloudBlobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: payload,
      });
      if (resp.ok) {
        updateCloudStatus('ok', '已连接');
      } else {
        // blob 可能过期，重新创建
        cloudBlobId = null;
        localStorage.removeItem('cola_cloud_blob_id');
        await saveToCloud(data);
        return;
      }
    } else {
      // 创建新 blob
      const resp = await fetch('https://jsonblob.com/api/jsonBlob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: payload,
      });
      if (resp.ok) {
        const location = resp.headers.get('Location') || '';
        const id = location.split('/').pop();
        if (id) {
          cloudBlobId = id;
          cloudReady = true;
          localStorage.setItem('cola_cloud_blob_id', id);
          updateCloudStatus('ok', '已连接');
          console.log('[云端] Blob ID:', id);
        }
      } else {
        updateCloudStatus('error', '创建失败');
      }
    }
  } catch (e) {
    console.warn('[云端] 保存失败:', e.message);
  }
  cloudSyncing = false;
}

let cloudSaveTimer = null;
function scheduleCloudSave() {
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    saveToCloud(appState);
  }, 2000);
}

// 设置同步 ID（用于跨设备）
function setCloudBlobId(id) {
  cloudBlobId = id;
  localStorage.setItem('cola_cloud_blob_id', id);
  cloudReady = true;
  updateCloudStatus('ok', '已连接');
}
window.setCloudBlobId = setCloudBlobId;
