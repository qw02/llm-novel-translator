const DB_NAME = 'TranslatorGlossaryDB';
const DB_VERSION = 1;
const STORE_NAME = 'glossaries';

let dbPromise = null;

/**
 * Opens (or reuses) the IndexedDB connection.
 * Creates the object store on first run.
 */
function openDatabase() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // seriesId is the primary key
        db.createObjectStore(STORE_NAME, { keyPath: 'seriesId' });
      }
    };
  });

  return dbPromise;
}

/**
 * Retrieves a glossary by seriesId.
 * Returns { entries: [] } if not found.
 */
export async function getGlossaryFromDB(seriesId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(seriesId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      // Strip seriesId from returned object to match original contract
      resolve(result ? { entries: result.entries } : { entries: [] });
    };
  });
}

/**
 * Saves a glossary. Uses put() for upsert behavior:
 * creates if seriesId doesn't exist, overwrites if it does.
 */
export async function saveGlossaryToDB(seriesId, glossary) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    // Merge seriesId into the stored record
    const request = store.put({ seriesId, ...glossary });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Deletes a glossary by ID.
 */
export async function deleteGlossaryFromDB(seriesId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(seriesId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * swiftly retrieves ALL primary keys without loading the heavy objects.
 */
export async function scanAllKeysFromDB() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}
