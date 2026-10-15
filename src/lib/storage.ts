export interface StorageInfo {
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

/** يطلب من المتصفح حماية البيانات من الحذف التلقائي (قد يرفض، ولا ضمان). */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return null;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const info: StorageInfo = { persisted: null, usage: null, quota: null };
  try {
    if (navigator.storage?.persisted) info.persisted = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      info.usage = e.usage ?? null;
      info.quota = e.quota ?? null;
    }
  } catch {
    /* ignore */
  }
  return info;
}
