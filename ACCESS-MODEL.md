# Jogosultsági modell v2 — Neon

## Alapelv

A böngésző nem kap közvetlen PostgreSQL-hozzáférést.
A Next.js/Vercel szerver ellenőrzi a Neon Auth sessiont, majd a szerveroldali adatbázis-kliens hajtja végre a lekérdezést.

## Szerepek

### owner
- teljes családi irattár
- NAV / vállalkozás
- pénzügyek
- járművek
- értesítési címzettek
- saját Vault
- hozzáférések kezelése

### family
- családi profilok és iratok
- családi határidők
- járművek
- nincs owner Vault-hozzáférés
- nincs vállalkozói/NAV módosítás

### accountant
- vállalkozás
- számlák
- NAV / bevallási előkészítő
- vállalkozási határidők
- nincs Vault
- nincs személyes iratokhoz alapértelmezett hozzáférés

## Feleség hozzáférése

A feleség saját Neon Auth belépést kap.
A household_memberships táblában a saját Neon Auth user ID-jához rendeljük a szükséges szerepet.

A szerver minden érzékeny kérésnél újra ellenőrzi:
1. be van-e jelentkezve,
2. tagja-e az adott családi térnek,
3. jogosult-e az adott műveletre.

## Vault

A Vault szerverre csak AES-GCM ciphertextként kerül.
A mesterjelszó és a visszafejtett titkok nem kerülnek PostgreSQL-be, logba vagy GitHubra.
