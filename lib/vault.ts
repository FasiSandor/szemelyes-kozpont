export type VaultEntry = {
  id: string;
  title: string;
  category: "Fontos" | "Bank" | "Weboldal" | "Email" | "Felhő" | "Kártya PIN" | "Egyéb";
  url?: string;
  username?: string;
  password?: string;
  pin?: string;
  note?: string;
  updatedAt: string;
};

type StoredVault = {
  version: 1;
  salt: string;
  iv: string;
  cipher: string;
};

const STORAGE_KEY = "szemelyes-kozpont-vault-v1";
const ITERATIONS = 250_000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptEntries(key: CryptoKey, entries: VaultEntry[], salt: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(entries));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  const stored: StoredVault = {
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(new Uint8Array(encrypted)),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function vaultExists() {
  return typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) !== null;
}

export async function createVault(password: string) {
  if (password.length < 8) throw new Error("A mesterjelszó legalább 8 karakter legyen.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  await encryptEntries(key, [], salt);
  return { key, entries: [] as VaultEntry[] };
}

export async function unlockVault(password: string) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error("Nincs még létrehozott Vault.");
  const stored = JSON.parse(raw) as StoredVault;
  const salt = base64ToBytes(stored.salt);
  const key = await deriveKey(password, salt);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(stored.iv) },
      key,
      base64ToBytes(stored.cipher),
    );
    const entries = JSON.parse(new TextDecoder().decode(decrypted)) as VaultEntry[];
    return { key, entries };
  } catch {
    throw new Error("Hibás mesterjelszó.");
  }
}

export async function saveVault(key: CryptoKey, entries: VaultEntry[]) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error("A Vault nem található.");
  const stored = JSON.parse(raw) as StoredVault;
  await encryptEntries(key, entries, base64ToBytes(stored.salt));
}

export function destroyVault() {
  localStorage.removeItem(STORAGE_KEY);
}
