const DB_NAME = "multiespectral-cubes-v1";
const DB_VERSION = 1;
const STORE = "cubes";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

/**
 * @param {string} id
 * @param {{ label: string; timestampLabel: string; stats: object }} meta
 * @param {Record<string, Blob | File | undefined>} blobs
 */
export async function saveCubeToIndexedDB(id, meta, blobs) {
  const db = await openDb();
  const record = {
    id,
    label: meta.label,
    timestampLabel: meta.timestampLabel,
    stats: meta.stats,
    blobs: {},
  };

  for (const key of ["r", "g", "b", "re", "nir", "ndvi"]) {
    const b = blobs[key];
    if (b) {
      const buf = await b.arrayBuffer();
      record.blobs[key] = buf;
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(record);
  });
}

function recordToCube(record) {
  const bands = {
    r: null,
    g: null,
    b: null,
    re: null,
    nir: null,
    ndvi: null,
  };
  for (const key of ["r", "g", "b", "re", "nir", "ndvi"]) {
    const buf = record.blobs[key];
    if (buf) {
      const blob = new Blob([buf], {
        type: key === "ndvi" ? "image/png" : "image/png",
      });
      bands[key] = URL.createObjectURL(blob);
    }
  }
  return {
    id: record.id,
    label: record.label,
    timestampLabel: record.timestampLabel,
    stats: record.stats,
    bands,
  };
}

/** @returns {Promise<Array<{ id: string; label: string; timestampLabel: string; stats: object; bands: object }>>} */
export async function loadAllCubesFromIndexedDB() {
  if (typeof indexedDB === "undefined") return [];

  let db;
  try {
    db = await openDb();
  } catch {
    return [];
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rows = req.result || [];
      resolve(rows.map(recordToCube));
    };
  });
}

export async function removeCubeFromIndexedDB(id) {
  if (typeof indexedDB === "undefined") return;
  let db;
  try {
    db = await openDb();
  } catch {
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(id);
  });
}

/** Borra todos los cubes guardados en IndexedDB de este navegador. */
export async function clearAllCubesFromIndexedDB() {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).clear();
  });
}
