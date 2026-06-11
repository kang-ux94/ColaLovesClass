/* ============================================
   CloudBase 云存储层
   环境ID: colaloveclass-d9gzna4izc7622225
   ============================================ */

const CLOUD_ENV = 'colaloveclass-d9gzna4izc7622225';
const CLOUD_COLLECTION = 'cola_data';
const CLOUD_DOC = 'shared';

let cloudDB = null;
let cloudReady = false;
let cloudSyncing = false;

// 状态回调
function updateCloudStatus(status, msg) {
  const dot = document.getElementById('cloudStatusDot');
  const text = document.getElementById('cloudStatusText');
  if (dot) {
    dot.style.background = status === 'ok' ? '#6BCB77' : status === 'connecting' ? '#FFD93D' : '#FF6B6B';
  }
  if (text) {
    text.textContent = msg || '';
    text.title = msg || '';
  }
  console.log('[CloudBase]', msg);
}

async function initCloud() {
  updateCloudStatus('connecting', '连接云存储...');
  
  if (typeof cloudbase === 'undefined') {
    updateCloudStatus('error', 'SDK未加载（CDN可能被拦截）');
    return;
  }
  
  try {
    const app = cloudbase.init({ env: CLOUD_ENV });
    const auth = app.auth({ persistence: 'local' });
    const loginState = await auth.getLoginState();
    
    if (!loginState) {
      await auth.anonymousAuthProvider().signIn();
    }
    
    cloudDB = app.database();
    cloudReady = true;
    updateCloudStatus('ok', '云存储已连接');
  } catch (e) {
    const msg = e.message || String(e);
    if (msg.includes('not enabled') || msg.includes('未开通') || msg.includes('not authorized')) {
      updateCloudStatus('error', '匿名登录未开启（去控制台打开）');
    } else if (msg.includes('permission') || msg.includes('unauthorized')) {
      updateCloudStatus('error', '数据库权限未设置（需设为所有人可读写）');
    } else {
      updateCloudStatus('error', '连接失败: ' + msg.substring(0, 20));
    }
  }
}

async function loadFromCloud() {
  if (!cloudReady || !cloudDB) return null;
  try {
    const res = await cloudDB.collection(CLOUD_COLLECTION).doc(CLOUD_DOC).get();
    if (res.data && res.data.length > 0) {
      const doc = res.data[0];
      delete doc._id;
      delete doc._openid;
      return doc;
    }
    return null;
  } catch (e) {
    const msg = e.message || '';
    if (!msg.includes('collection not exists') && !msg.includes('doc not exists')) {
      console.warn('[CloudBase] 读取失败:', msg);
      updateCloudStatus('error', '读取失败（检查数据库权限）');
    }
    return null;
  }
}

async function saveToCloud(data) {
  if (!cloudReady || !cloudDB || cloudSyncing) return;
  cloudSyncing = true;
  updateCloudStatus('connecting', '同步中...');
  try {
    const payload = { ...data, _updatedAt: Date.now() };
    await cloudDB.collection(CLOUD_COLLECTION).doc(CLOUD_DOC).set(payload);
    updateCloudStatus('ok', '云存储已连接');
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('collection not exists')) {
      try {
        await cloudDB.createCollection(CLOUD_COLLECTION);
        await cloudDB.collection(CLOUD_COLLECTION).doc(CLOUD_DOC).set({ ...data, _updatedAt: Date.now() });
        updateCloudStatus('ok', '云存储已连接');
      } catch (e2) {
        updateCloudStatus('error', '集合创建失败（去控制台手动创建cola_data）');
      }
    } else if (msg.includes('permission') || msg.includes('403')) {
      updateCloudStatus('error', '无写入权限（设为所有人可读写）');
    } else {
      console.warn('[CloudBase] 保存失败:', msg);
    }
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
