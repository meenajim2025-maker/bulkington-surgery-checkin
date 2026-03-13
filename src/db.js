import { openDB } from 'idb';

const DB_NAME = 'BulkingtonCheckinDB';
const STORE_NAME = 'checkins';

export async function initDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        },
    });
}

export async function saveCheckin(checkin) {
    const db = await initDB();
    return db.add(STORE_NAME, { ...checkin, timestamp: new Date().toISOString() });
}

export async function getCheckins() {
    const db = await initDB();
    return db.getAll(STORE_NAME);
}
