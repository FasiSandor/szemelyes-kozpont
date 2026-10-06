# Jogosultsági modell v1

## Szerepek

### Tulajdonos
- teljes családi irattár
- NAV / vállalkozás
- pénzügyek
- járművek
- értesítési címzettek
- saját Vault
- családtagok és jogosultságok kezelése

### Család
- családi profilok és iratok olvasása
- családi iratok feltöltése/módosítása
- családi határidők
- járművek
- nincs hozzáférés a tulajdonos Vaultjához
- nincs vállalkozói/NAV írási jogosultság

### Könyvelő
- vállalkozási adatok és számlák
- NAV / adózási határidők
- bevallási előkészítő
- nincs jelszótár-hozzáférés
- nincs személyes okmányfeltöltési jogosultság

A feleség ugyanazzal a saját belépésével egyszerre kaphat családi és könyvelői feladatokat, de az adatbázis-szerep első körben egyetlen legmagasabb szükséges szerep. Ha később finomabb engedélyezés kell, capability-alapú jogosultságokra bontjuk.

## Vault

A Vault különleges:
- a DB/felhő csak AES-GCM ciphertextet tárol;
- a mesterjelszó és a visszafejtési kulcs nem kerül a szerverre;
- másik családtag vagy könyvelő RLS-szinten sem olvashatja a ciphertext sort;
- a frontend feloldás után memóriában tartja a kulcsot, zároláskor eldobja.
