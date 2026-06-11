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

async function initCloud() {
  try {
    if (typeof cloudbase === 'undefined') {
      console.warn('[CloudBase] SDK 未加载，使用纯本地存储');
      return;
    }
    const app = cloudbase.init({ env: CLOUD_ENV });
    const auth = app.auth({ persistence: 'local' });
    await auth.anonymousAuthProvider().signIn();
    cloudDB = app.database();
    cloudReady = true;
    console.log('[CloudBase] 已连接 ✅');
  } catch (e) {
    console.warn('[CloudBase] 连接失败，使用本地存储:', e.message);
  }
}

async function loadFromCloud() {
  if (!cloudReady || !cloudDB) return null;
  try {
    const res = await cloudDB.collection(CLOUD_COLLECTION).doc(CLOUD_DOC).get();
    if (res.data && res.data.length > 0) {
      const doc = res.data[0];
      // 移除 CloudBase 元数据字段
      delete doc._id;
      delete doc._openid;
      return doc;
    }
    return null;
  } catch (e) {
    // 集合或文档不存在时静默处理
    if (!e.message?.includes('collection not exists')) {
      console.warn('[CloudBase] 读取失败:', e.message);
    }
    return null;
  }
}

async function saveToCloud(data) {
  if (!cloudReady || !cloudDB || cloudSyncing) return;
  cloudSyncing = true;
  try {
    const payload = { ...data, _updatedAt: Date.now() };
    await cloudDB.collection(CLOUD_COLLECTION).doc(CLOUD_DOC).set(payload);
  } catch (e) {
    // 集合不存在时尝试创建
    if (e.message?.includes('collection not exists')) {
      try {
        await cloudDB.createCollection(CLOUD_COLLECTION);
        await cloudDB.collection(CLOUD_COLLECTION).doc(CLOUD_DOC).set({ ...data, _updatedAt: Date.now() });
      } catch (e2) {
        console.warn('[CloudBase] 创建集合失败，可能需在控制台手动创建:', e2.message);
      }
    } else {
      console.warn('[CloudBase] 保存失败:', e.message);
    }
  }
  cloudSyncing = false;
}

// 防抖保存（避免频繁写入云端）
let cloudSaveTimer = null;
function scheduleCloudSave() {
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    saveToCloud(appState);
  }, 2000);
}
