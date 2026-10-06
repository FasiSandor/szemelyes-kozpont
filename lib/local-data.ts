export type FamilyMember = {
  id: string;
  name: string;
  relation: string;
  color: string;
};

export type LocalDocument = {
  id: string;
  memberId: string;
  type: string;
  name: string;
  note?: string;
  createdAt: string;
  mimeType: string;
  blob: Blob;
};

const FAMILY_KEY = "szemelyes-kozpont-family-v1";
const DB_NAME = "szemelyes-kozpont";
const DB_VERSION = 1;
const DOC_STORE = "documents";

export const defaultFamily: FamilyMember[] = [
  { id: "me", name: "Sándor", relation: "Saját", color: "#3B82F6" },
  { id: "wife", name: "Feleség", relation: "Házastárs / könyvelő", color: "#EF4444" },
  { id: "child-1", name: "Gyermek 1", relation: "Gyermek", color: "#22D3EE" },
  { id: "child-2", name: "Gyermek 2", relation: "Gyermek", color: "#8B5CF6" },
];

export function loadFamily(): FamilyMember[] {
  if (typeof window === "undefined") return defaultFamily;
  const raw = localStorage.getItem(FAMILY_KEY);
  if (!raw) return defaultFamily;
  try { return JSON.parse(raw) as FamilyMember[]; } catch { return defaultFamily; }
}

export function saveFamily(members: FamilyMember[]) {
  localStorage.setItem(FAMILY_KEY, JSON.stringify(members));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        const store = db.createObjectStore(DOC_STORE, { keyPath: "id" });
        store.createIndex("memberId", "memberId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDocument(doc: LocalDocument) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, "readwrite");
    tx.objectStore(DOC_STORE).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listDocuments(memberId?: string) {
  const db = await openDb();
  return new Promise<LocalDocument[]>((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, "readonly");
    const store = tx.objectStore(DOC_STORE);
    const request = memberId ? store.index("memberId").getAll(memberId) : store.getAll();
    request.onsuccess = () => resolve(request.result as LocalDocument[]);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDocument(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, "readwrite");
    tx.objectStore(DOC_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
