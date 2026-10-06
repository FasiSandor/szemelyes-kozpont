# Neon backend terv — Személyes Központ

## Végleges irány

Frontend:
- Next.js 16
- Vercel

Backend:
- Neon Lakebase Postgres
- Neon Managed Better Auth
- Neon Object Storage (private)
- Vercel/Next.js server route-ok az alkalmazás API-jához

## Régió

A projektet `eu-central-1` / Frankfurt régióba kell létrehozni, mert a Neon Object Storage jelenleg támogatott ebben az európai régióban.

## Adatbiztonsági elv

- GitHub: csak forráskód
- Postgres: strukturált családi, vállalkozási, NAV és határidő adatok
- Object Storage: lefotózott iratok és dokumentumok
- Vault: csak kliensoldalon titkosított adat kerülhet a szerverre
- mesterjelszó: soha nem kerül szerverre
- production bucket: private

## Jogosultságok

- owner: teljes hozzáférés
- family: családi dokumentumok és határidők
- accountant: vállalkozás, számlák, NAV előkészítő
- Vault: kizárólag az adott felhasználó

## Következő infrastruktúra-lépés

1. külön Neon projekt: `Szemelyes-Kozpont`
2. régió: `eu-central-1`
3. Managed Better Auth engedélyezése
4. private bucket: `personal-documents`
5. schema telepítése biztonságos migration flow-val
6. DATABASE_URL és Auth URL Vercel env-be
