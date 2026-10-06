# Személyes Központ

Mobil-first személyes, családi és vállalkozói adminisztrációs központ.

## Aktuális állapot — UI v1

Elkészült:
- determinisztikus design system
- főoldali dashboard
- család és fényképezett iratok
- pénzügyi grafikonok
- vállalkozói számla/bevétel nézet
- NAV adószámla és határidők
- jelszótár / Vault UI
- bank- és egyéb kártyák
- járművek és határidők
- értesítések / teendők
- riportok / PDF-export UI
- PWA manifest és saját appikon

## Biztonság

A repository public, ezért:
- valódi okmány, export, scan vagy személyes adat nem kerülhet Gitbe;
- `.env*`, kulcsok és certificate-ek tiltva vannak;
- a jelenlegi adatok kizárólag demonstrációs adatok;
- a Vault jelenleg csak UI-demó, valódi jelszót még nem tárol.

A későbbi valódi Vault kliensoldali titkosítást és külön feloldást kap.

## Következő fejlesztési fázis

1. Supabase Auth + PostgreSQL + privát Storage
2. családtag-profilok és iratfotó feltöltés
3. Vault titkosítás
4. NAV integráció és bevallási előkészítő
5. értesítési címzettek
6. banki import / későbbi Open Banking
