# Személyes Központ — Determinisztikus Design System v1

Ez a dokumentum a 2026-10-06-án elfogadott mockup vizuális szerződése. Új képernyő vagy komponens csak ezekből a tokenekből épülhet.

## 1. Színek

- `--bg: #0B0F14`
- `--surface: #111827`
- `--card: #172033`
- `--card-2: #101827`
- `--border: #2A3445`
- `--blue: #3B82F6`
- `--blue-light: #60A5FA`
- `--cyan: #22D3EE`
- `--green: #22C55E`
- `--amber: #F59E0B`
- `--red: #EF4444`
- `--text: #F8FAFC`
- `--muted: #94A3B8`

## 2. Tipográfia

- Font stack: `Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif`
- H1: 28/34, 750
- H2: 20/26, 720
- H3: 16/22, 700
- Body: 14/20, 500
- Small: 12/16, 550
- Pénzügyi számok: tabular-nums

## 3. Térközök

4 px alapritmus: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40.

## 4. Radius

- chip: 10px
- input: 12px
- card: 18px
- large card: 22px
- modal: 28px

## 5. Kártyák

Alap: sötét felület + 1px `--border`.
Aktív: blue border + enyhe blue glow.
Siker: green jelzés, de a kártya alapja nem változik.
Figyelmeztetés: amber ikon / badge.
Hiba: red ikon / badge.

## 6. Navigáció

Mobil-first, fix alsó navigáció 5 elemmel:
Főoldal / Iratok / Pénzügyek / Teendők / Több.

## 7. Dokumentumkártya

Fényképezett irat 16:10 arányú preview.
Mobilon 3 kártya is elférhet egy képernyőn.
Előlap/hátlap lapozható.
Teljes nézet csak külön megnyitáskor.

## 8. Grafikonok

- Idősor: vonal vagy oszlop
- Bevétel vs kiadás: vegyes
- Kategória-megoszlás: donut
- Negyedéves összevetés: csoportos oszlop
- Színkészlet kizárólag a globális tokenekből

## 9. Biztonsági UI

Jelszó/PIN alapból maszkolva.
Felfedés külön felhasználói művelet.
Vault-felület vizuálisan elkülönített, de ugyanazon design system része.

## 10. Responsive

- Mobile: 0–767
- Tablet: 768–1199
- Desktop: 1200+
A mobil elrendezés az elsődleges.
