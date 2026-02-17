// ────────────────────────────────────────────
// model-store — IndexedDB storage for uploaded GLB models
// Stores uploaded .glb files as ArrayBuffers and generates
// blob URLs for use with useGLTF.
// ────────────────────────────────────────────

const DB_NAME = "corpcraft-models";
const DB_VERSION = 1;
const STORE_NAME = "models";

export interface ModelMeta {
  id: string;
  name: string;
  fileSize: number;
  uploadedAt: number; // timestamp
  blobUrl?: string;   // generated at runtime, not persisted
}

interface StoredModel {
  id: string;
  name: string;
  fileSize: number;
  uploadedAt: number;
  data: ArrayBuffer;
}

// ── DB helpers ──

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode) {
  const tx = db.transaction(STORE_NAME, mode);
  return tx.objectStore(STORE_NAME);
}

// ── Blob URL cache (runtime only) ──

const blobCache = new Map<string, string>();

function toBlobUrl(data: ArrayBuffer): string {
  const blob = new Blob([data], { type: "model/gltf-binary" });
  return URL.createObjectURL(blob);
}

// ── Public API ──

/** Save an uploaded GLB file to IndexedDB */
export async function saveModel(
  id: string,
  name: string,
  file: File | ArrayBuffer,
): Promise<ModelMeta> {
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const record: StoredModel = {
    id,
    name,
    fileSize: data.byteLength,
    uploadedAt: Date.now(),
    data,
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const req = store.put(record);
    req.onsuccess = () => {
      const url = toBlobUrl(data);
      blobCache.set(id, url);
      resolve({
        id: record.id,
        name: record.name,
        fileSize: record.fileSize,
        uploadedAt: record.uploadedAt,
        blobUrl: url,
      });
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get a single model by ID (with blob URL) */
export async function getModel(id: string): Promise<(ModelMeta & { blobUrl: string }) | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readonly");
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result as StoredModel | undefined;
      if (!record) return resolve(null);

      let url = blobCache.get(id);
      if (!url) {
        url = toBlobUrl(record.data);
        blobCache.set(id, url);
      }
      resolve({
        id: record.id,
        name: record.name,
        fileSize: record.fileSize,
        uploadedAt: record.uploadedAt,
        blobUrl: url,
      });
    };
    req.onerror = () => reject(req.error);
  });
}

/** List all stored models (metadata + blob URLs) */
export async function listModels(): Promise<ModelMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readonly");
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result as StoredModel[];
      const metas: ModelMeta[] = records.map((r) => {
        let url = blobCache.get(r.id);
        if (!url) {
          url = toBlobUrl(r.data);
          blobCache.set(r.id, url);
        }
        return {
          id: r.id,
          name: r.name,
          fileSize: r.fileSize,
          uploadedAt: r.uploadedAt,
          blobUrl: url,
        };
      });
      resolve(metas);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete a model from IndexedDB and revoke its blob URL */
export async function deleteModel(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txStore(db, "readwrite");
    const req = store.delete(id);
    req.onsuccess = () => {
      const url = blobCache.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        blobCache.delete(id);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Max upload size: 10MB */
export const MAX_MODEL_SIZE = 10 * 1024 * 1024;
