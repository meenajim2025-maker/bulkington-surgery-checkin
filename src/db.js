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

export async function saveCheckin(patientData) {
    const db = await initDB();
    const checkin = {
        ...patientData,
        timestamp: new Date().toISOString()
    };
    return db.add(STORE_NAME, checkin);
}

export async function getCheckins() {
    const db = await initDB();
    return db.getAll(STORE_NAME);
}
