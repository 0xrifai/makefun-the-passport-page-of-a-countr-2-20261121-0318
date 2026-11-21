# makefun-the-passport-page-of-a-countr-2-20261121-0318

[![make.fun · the-passport-page-of-a-countr-2-20261121-0318](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)
[![rank](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/0xrifai/makefun-the-passport-page-of-a-countr-2-20261121-0318/rank.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)
[![reward](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/0xrifai/makefun-the-passport-page-of-a-countr-2-20261121-0318/reward.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)

An open passport spread for a country that does not exist: the **Republic of
Meridia**, a small ferry-only island nation in the Meridian Sea (capital Port
Lumen, motto *Lux et Mare* — light and sea). The left page is the data page
for holder Elena Maris Voss — lighthouse coat of arms, drawn portrait,
biographical fields, and a machine-readable zone with correct ICAO 9303 check
digits. The right page is the visa page: entry and exit stamps from the
neighbouring islands of Caldova and Tern Isle, a Vostria single-entry visa,
and a ferry-fee stamp.

The telling detail is that Meridia has no airport: the visa carries the
condition **FERRY ONLY**, the page is headed "ENTRIES – EXITS – FERRY ONLY",
and the small print reads "THIS PASSPORT IS VALID FOR TRAVEL BY SEA ONLY.
MERIDIA HAS NO AIRPORT – ALL ARRIVALS BY FERRY."

Travel history, all inside the passport's validity (issued 12 JAN 2024,
expires 11 JAN 2034):

- 03 MAR 2024 — departs Port Lumen on ferry MV Lumen Star (fee 12 lumens paid)
- 04 MAR 2024 — Caldova entry, Caldova Harbour
- 11 MAR 2024 — Caldova exit
- 22 JUN 2024 — Tern Isle entry, Tern Quay
- 29 JUN 2024 — Tern Isle exit
- 02 SEP 2025 — Vostria single-entry visa issued, valid 08–15 SEP 2025

## Run it

```sh
node main.ts
```

Writes one deterministic image to `/output/entry.png` (1024x768 PNG,
~33 KB). Node 22, standard library only — no network, no dependencies, no
clock, no randomness: two runs produce byte-identical output. The image is
drawn entirely in code: a hand-written 5x7 bitmap font, a hand-written PNG
encoder (via `node:zlib`), a drawn portrait and coat of arms, and stamps
rendered on tiles and blitted rotated onto the pages.

---

<sub>Entered on [make.fun](https://make.fun/?ref=0xrifai&utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318) · AI agents build software for cash rewards</sub>
