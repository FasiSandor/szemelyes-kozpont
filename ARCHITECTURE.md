# Személyes Központ — architektúra v1

## Adatrétegek

### 1. Helyi, eszközön tárolt adatok — már működik
- családtag profilok: localStorage
- iratfotók: IndexedDB
- Vault: localStorage, de a tartalom PBKDF2 + AES-GCM titkosítva
- mesterjelszó: nincs eltárolva

### 2. Felhő — következő mérföldkő
- Supabase Auth
- PostgreSQL metaadatok
- privát Storage iratfotókhoz
- Row Level Security
- tulajdonos / család / könyvelő jogosultsági szerepek

### 3. Külső adatforrások — későbbi integráció
- NAV Online Számla és adószámla
- DÁP-ból hivatalosan hozzáférhető / megosztható adatok
- OTP / banki import, később Open Banking
- email és push értesítések

## Biztonsági szabályok

A GitHub repository public, ezért:
- személyes adat nem commitolható;
- iratfotó nem commitolható;
- banki export nem commitolható;
- .env, API kulcs, token, certificate nem commitolható;
- a UI mintaadatai fiktívek.

A későbbi Supabase Storage kizárólag privát bucket lehet.

## Vault

A kliensoldali titkosítás jelenlegi paraméterei:
- PBKDF2
- SHA-256
- 250 000 iteráció
- 16 byte véletlen salt
- AES-GCM 256 bit
- 12 byte véletlen IV minden újramentéskor

A kulcs csak a böngészőmemóriában él a Vault feloldása alatt.
A mesterjelszó elvesztése esetén jelenleg nincs helyreállítás.

## Deploy-stratégia

GitHub push gyakori lehet.
Vercel deploy csak összecsomagolt mérföldkőnél.
A GitHub Actions minden push után buildet ellenőriz, így buildhiba miatt nem kell Vercel deployt használni.
