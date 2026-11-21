// The Passport Page of a Country That Isn't There
// make.fun bounty: the-passport-page-of-a-countr-2-20261121-0318
// Node 22, stdlib only, no network, fully deterministic.
// Writes one open passport spread (1024x768) to /output/entry.png.
//
// The country: the REPUBLIC OF MERIDIA, a small ferry-only island nation
// in the Meridian Sea. Capital Port Lumen. No airport: every arrival and
// departure is by ferry, which is the telling paperwork detail of the spread.

import * as fs from "node:fs";
import * as zlib from "node:zlib";

const W = 1024;
const H = 768;

// ---- palette: restrained official tones -------------------------------
const CREAM: RGB = [247, 241, 222]; // page paper
const CREAM_DK: RGB = [238, 230, 203]; // page shading
const INK: RGB = [28, 38, 62]; // deep navy ink
const NAVY: RGB = [24, 47, 87]; // header navy
const BURG: RGB = [122, 31, 43]; // burgundy accent
const GOLD: RGB = [176, 141, 74]; // rule gold
const TEAL: RGB = [27, 94, 94]; // sea teal (stamps)
const FADED: RGB = [96, 104, 122]; // small-print grey-navy
const PORTRAIT_BG: RGB = [214, 226, 222]; // portrait backdrop
const SKIN: RGB = [224, 186, 150];
const SKIN_SH: RGB = [198, 158, 122];
const HAIR: RGB = [43, 32, 26];
const JACKET: RGB = [36, 64, 96];
const SCARF: RGB = [27, 94, 94];
const TRANSPARENT: RGB = [255, 0, 255]; // sentinel: never drawn in the palette

type RGB = [number, number, number];

// ---- CRC32 + minimal PNG encoder (RGB, no interlace) ------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- tiny raster canvas ------------------------------------------------
class Canvas {
  w: number;
  h: number;
  px: Uint8Array; // RGB
  constructor(w: number, h: number, fill: RGB) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    this.fill(fill);
  }
  fill(c: RGB): void {
    for (let i = 0; i < this.w * this.h; i++) {
      this.px[i * 3] = c[0];
      this.px[i * 3 + 1] = c[1];
      this.px[i * 3 + 2] = c[2];
    }
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }
  get(x: number, y: number): RGB {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return TRANSPARENT;
    const i = (y * this.w + x) * 3;
    return [this.px[i], this.px[i + 1], this.px[i + 2]];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  hline(x: number, y: number, w: number, c: RGB, t = 1): void {
    for (let i = 0; i < t; i++) this.rect(x, y + i, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: RGB, t = 1): void {
    for (let i = 0; i < t; i++) this.rect(x + i, y, 1, h, c);
  }
  frame(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.hline(x, y, w, c, t);
    this.hline(x, y + h - t, w, c, t);
    this.vline(x, y, h, c, t);
    this.vline(x + w - t, y, h, c, t);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    // Round first: Bresenham terminates on exact equality, so a fractional
    // endpoint (e.g. a shield edge at x = 242.5) would loop forever.
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      this.set(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let yy = -r; yy <= r; yy++)
      for (let xx = -r; xx <= r; xx++)
        if (xx * xx + yy * yy <= r * r) this.set(cx + xx, cy + yy, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let yy = -ry; yy <= ry; yy++)
      for (let xx = -rx; xx <= rx; xx++)
        if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) <= 1) this.set(cx + xx, cy + yy, c);
  }
  // blit another canvas rotated by angleDeg about its centre onto (cx, cy)
  blitRotated(src: Canvas, cx: number, cy: number, angleDeg: number): void {
    const a = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const scx = src.w / 2;
    const scy = src.h / 2;
    const r = Math.ceil(Math.hypot(src.w, src.h) / 2) + 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // inverse rotation: source coords for this dest offset
        const srcX = Math.round(scx + dx * cos + dy * sin);
        const srcY = Math.round(scy - dx * sin + dy * cos);
        if (srcX < 0 || srcY < 0 || srcX >= src.w || srcY >= src.h) continue;
        const p = src.get(srcX, srcY);
        if (p[0] === 255 && p[1] === 0 && p[2] === 255) continue;
        this.set(cx + dx, cy + dy, p);
      }
    }
  }
  // plain blit: copy another canvas at (x, y), skipping transparent pixels
  blit(src: Canvas, x: number, y: number): void {
    for (let yy = 0; yy < src.h; yy++) {
      for (let xx = 0; xx < src.w; xx++) {
        const p = src.get(xx, yy);
        if (p[0] === 255 && p[1] === 0 && p[2] === 255) continue;
        this.set(x + xx, y + yy, p);
      }
    }
  }
}

// ---- hand-written 5x7 bitmap font --------------------------------------
// Each glyph: 7 rows, each a 5-bit number (bit 4 = leftmost pixel).
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "<": [2, 4, 8, 16, 8, 4, 2],
  "-": [0, 0, 0, 31, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "/": [1, 2, 2, 4, 8, 8, 16],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  ":": [0, 12, 0, 12, 0, 12, 12],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "%": [25, 26, 2, 4, 8, 11, 19],
  "=": [0, 0, 31, 0, 31, 0, 0],
  "*": [0, 21, 14, 31, 14, 21, 0],
  "?": [14, 17, 1, 6, 4, 0, 4],
  '"': [10, 10, 0, 0, 0, 0, 0],
  ";": [0, 12, 0, 12, 0, 4, 8],
  _: [0, 0, 0, 0, 0, 0, 31],
};

function textWidth(s: string, scale: number, tracking = 1): number {
  if (s.length === 0) return 0;
  return s.length * (5 * scale + tracking * scale) - tracking * scale;
}

function drawText(
  cv: Canvas,
  x: number,
  y: number,
  s: string,
  scale: number,
  color: RGB,
  tracking = 1,
): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      const bits = g[row];
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          cv.rect(cx + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cx += (5 + tracking) * scale;
  }
}

function drawTextC(
  cv: Canvas,
  cx: number,
  y: number,
  s: string,
  scale: number,
  color: RGB,
  tracking = 1,
): void {
  drawText(cv, Math.round(cx - textWidth(s, scale, tracking) / 2), y, s, scale, color, tracking);
}

// ---- ICAO 9303 MRZ check digits ----------------------------------------
function mrzValue(ch: string): number {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  return 0; // '<' filler
}
function mrzCheck(s: string): number {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += mrzValue(s[i]) * w[i % 3];
  return sum % 10;
}
function mrzLine1(): string {
  // P< + issuing state MRD + surname + << + given names, padded to 44
  let s = "P<MRDVOSS<<ELENA<MARIS";
  while (s.length < 44) s += "<";
  return s;
}
function mrzLine2(): string {
  const docNo = "MRD847291"; // passport number (9 chars)
  const nat = "MRD";
  const dob = "940314"; // 14 MAR 1994
  const exp = "340111"; // 11 JAN 2034
  const personal = "<<<<<<<<<<<<<<"; // 14 filler
  const persCheck = String(mrzCheck(personal));
  const body =
    docNo + mrzCheck(docNo) + nat + dob + mrzCheck(dob) + "F" + exp + mrzCheck(exp) + personal + persCheck;
  return body + String(mrzCheck(body)); // 44 chars total
}

// ---- guilloche: fine wavy security lines -------------------------------
function guilloche(cv: Canvas, x0: number, y0: number, w: number, h: number, c: RGB): void {
  for (let y = y0 + 6; y < y0 + h; y += 9) {
    for (let x = x0; x < x0 + w; x++) {
      const yy = y + Math.round(2.2 * Math.sin((x - x0) / 26) + 1.4 * Math.sin((x - x0) / 9));
      if ((x + y) % 3 === 0) cv.set(x, yy, c);
    }
  }
}

// ---- coat of arms: a lighthouse on waves under a star -------------------
function drawArms(cv: Canvas, cx: number, cy: number, s: number, ink: RGB, accent: RGB): void {
  // A shield with a star above the lamp, a lighthouse tower, and waves.
  const w = Math.round(54 * s);
  const h = Math.round(66 * s);
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - h / 2);
  const t = Math.max(2, Math.round(2 * s));
  cv.frame(x0, y0, w, h, ink, t);
  // star
  const sx = cx;
  const sy = y0 + Math.round(10 * s);
  cv.disc(sx, sy, Math.max(2, Math.round(2.5 * s)), accent);
  cv.line(sx - Math.round(7 * s), sy, sx + Math.round(7 * s), sy, accent);
  cv.line(sx, sy - Math.round(7 * s), sx, sy + Math.round(7 * s), accent);
  // lamp + tower
  const tw = Math.round(12 * s);
  const tx = Math.round(cx - tw / 2);
  const ty = y0 + Math.round(24 * s);
  const th = Math.round(24 * s);
  cv.rect(tx - Math.round(2 * s), ty - Math.round(5 * s), tw + Math.round(4 * s), Math.round(5 * s), accent);
  cv.disc(cx, ty - Math.round(6 * s), Math.max(2, Math.round(2 * s)), GOLD);
  cv.rect(tx, ty, tw, th, ink);
  // light beams to the shield's top corners
  cv.line(cx - Math.round(4 * s), ty - Math.round(4 * s), x0 + 4, y0 + Math.round(12 * s), GOLD);
  cv.line(cx + Math.round(4 * s), ty - Math.round(4 * s), x0 + w - 4, y0 + Math.round(12 * s), GOLD);
  // waves under the tower
  for (let i = 0; i < 3; i++) {
    const yy = ty + th + Math.round(4 * s) + i * Math.round(4 * s);
    for (let x = x0 + 4; x < x0 + w - 4; x++) {
      const off = Math.round(1.6 * s * Math.sin((x - x0) / (8 * s) + i * 1.3));
      cv.set(x, yy + off, TEAL);
    }
  }
}

// ---- stylised portrait: island woman, hair in a bun, teal scarf --------
// Drawn on its own tile so shoulders and hair can never spill past the
// portrait frame onto the signature or the fields below it.
function drawPortrait(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const t = new Canvas(w, h, TRANSPARENT);
  t.rect(0, 0, w, h, PORTRAIT_BG);
  const cx = Math.round(w / 2);
  const headY = Math.round(h * 0.4);
  const hr = Math.round(w * 0.2);
  // torso: flat-topped shoulders with a rounded crown, reaching the neck
  t.rect(4, Math.round(h * 0.72), w - 8, h - Math.round(h * 0.72), JACKET);
  t.ellipse(cx, Math.round(h * 0.72), Math.round(w * 0.46), Math.round(h * 0.09), JACKET);
  // neck, chin to collar, same tone as the face
  t.rect(
    cx - Math.round(w * 0.07),
    headY + hr - 6,
    Math.round(w * 0.14),
    Math.round(h * 0.72) - (headY + hr - 6),
    SKIN,
  );
  // head
  t.ellipse(cx, headY, hr, Math.round(hr * 1.18), SKIN);
  // hair: dark cap + bun, slim side sweeps
  t.ellipse(cx, headY - Math.round(hr * 0.3), hr, Math.round(hr * 0.8), HAIR);
  t.disc(cx, headY - hr - 2, Math.round(hr * 0.4), HAIR);
  t.ellipse(cx - hr + 3, headY + Math.round(hr * 0.15), Math.round(hr * 0.22), Math.round(hr * 0.55), HAIR);
  t.ellipse(cx + hr - 3, headY + Math.round(hr * 0.15), Math.round(hr * 0.22), Math.round(hr * 0.55), HAIR);
  // teal scarf at the collar
  t.ellipse(cx, h - Math.round(h * 0.13), Math.round(w * 0.3), Math.round(h * 0.06), SCARF);
  // simple features: eyes, brows, nose hint, mouth
  const ey = headY - Math.round(hr * 0.08);
  const ex = Math.round(hr * 0.42);
  t.rect(cx - ex - 3, ey, 6, 2, HAIR);
  t.rect(cx + ex - 3, ey, 6, 2, HAIR);
  t.rect(cx - ex - 3, ey - 5, 7, 2, HAIR);
  t.rect(cx + ex - 4, ey - 5, 7, 2, HAIR);
  t.vline(cx, ey + 2, Math.round(hr * 0.32), SKIN_SH);
  t.hline(cx - 5, headY + Math.round(hr * 0.55), 10, [150, 92, 84]);
  // jacket lapels
  t.line(cx - 2, h - Math.round(h * 0.17), cx - Math.round(w * 0.16), h - 2, CREAM);
  t.line(cx + 2, h - Math.round(h * 0.17), cx + Math.round(w * 0.16), h - 2, CREAM);
  cv.blit(t, x, y);
  cv.frame(x, y, w, h, INK, 2);
}

// ---- stamps --------------------------------------------------------------
// A round entry/exit stamp, drawn on its own tile then rotated on blit.
// `place` is the foreign port that issued it: a Caldova stamp is struck
// in Caldova harbour, not in Port Lumen.
function makeRoundStamp(
  country: string,
  kind: string,
  date: string,
  place: string,
  ink: RGB,
): Canvas {
  const t = new Canvas(210, 150, TRANSPARENT);
  t.circle(105, 75, 66, ink);
  t.circle(105, 75, 58, ink);
  t.circle(105, 75, 30, ink);
  drawTextC(t, 105, 20, country, 2, ink);
  drawTextC(t, 105, 38, kind, 2, ink);
  drawTextC(t, 105, 56, date, 2, ink);
  // small lighthouse mark in the inner circle, below the date
  t.rect(102, 80, 6, 14, ink);
  t.rect(100, 76, 10, 4, ink);
  drawTextC(t, 105, 98, place, 1, ink);
  drawTextC(t, 105, 112, "FERRY TERMINAL", 1, ink);
  return t;
}

// A rectangular visa sticker / fee stamp tile.
function makeRectStamp(lines: string[], ink: RGB, w: number, h: number): Canvas {
  const t = new Canvas(w, h, TRANSPARENT);
  t.frame(3, 3, w - 6, h - 6, ink, 2);
  t.frame(7, 7, w - 14, h - 14, ink, 1);
  let y = 16;
  for (const ln of lines) {
    drawTextC(t, w / 2, y, ln, ln.length > 26 ? 1 : 2, ink);
    y += ln.length > 26 ? 12 : 18;
  }
  return t;
}

// ---- the spread ----------------------------------------------------------
// 1024x768, two cream pages on a dark desk. Left: data page. Right: visas.
// Travel history (all after issue 12 JAN 2024, before expiry 11 JAN 2034):
//   03 MAR 2024  depart Port Lumen, ferry MV LUMEN STAR
//   04 MAR 2024  CALDOVA entry        11 MAR 2024  CALDOVA exit
//   22 JUN 2024  TERN ISLE entry      29 JUN 2024  TERN ISLE exit
//   02 SEP 2025  VOSTRIA visa issued, valid 08-15 SEP 2025, ferry only

function field(cv: Canvas, x: number, y: number, label: string, value: string): void {
  drawText(cv, x, y, label, 1, FADED);
  drawText(cv, x, y + 9, value, 2, INK);
}

function drawLeftPage(cv: Canvas): void {
  const px = 14;
  const py = 14;
  const pw = 488;
  const ph = 740;
  cv.rect(px, py, pw, ph, CREAM);
  guilloche(cv, px + 8, py + 180, pw - 16, 430, [226, 216, 182]);
  cv.frame(px, py, pw, ph, INK, 2);

  // header: arms, country, document type, motto
  drawArms(cv, 258, 60, 1, NAVY, BURG);
  drawTextC(cv, 258, 100, "REPUBLIC OF MERIDIA", 3, NAVY);
  drawTextC(cv, 258, 128, "PASSPORT", 2, BURG);
  drawTextC(cv, 258, 150, "LUX ET MARE  -  LIGHT AND SEA", 1, FADED);
  cv.hline(px + 24, 168, pw - 48, GOLD, 2);

  // portrait
  drawPortrait(cv, 38, 190, 150, 205);

  // data fields, right of the portrait
  const fx = 208;
  let fy = 190;
  field(cv, fx, fy, "SURNAME", "VOSS");
  fy += 27;
  field(cv, fx, fy, "GIVEN NAMES", "ELENA MARIS");
  fy += 27;
  field(cv, fx, fy, "NATIONALITY", "MERIDIAN");
  fy += 27;
  field(cv, fx, fy, "DATE OF BIRTH", "14 MAR 1994");
  fy += 27;
  field(cv, fx, fy, "PLACE OF BIRTH", "PORT LUMEN");
  fy += 27;
  field(cv, fx, fy, "SEX", "F");
  fy += 27;
  field(cv, fx, fy, "DATE OF ISSUE", "12 JAN 2024");
  fy += 27;
  field(cv, fx, fy, "DATE OF EXPIRY", "11 JAN 2034");
  fy += 27;
  field(cv, fx, fy, "AUTHORITY", "PORT LUMEN");
  // document number line, top right of the page
  drawText(cv, 380, 192, "TYPE", 1, FADED);
  drawText(cv, 380, 201, "P", 2, INK);
  drawText(cv, 424, 192, "CODE", 1, FADED);
  drawText(cv, 424, 201, "MRD", 2, INK);
  drawText(cv, 380, 226, "PASSPORT NO.", 1, FADED);
  drawText(cv, 380, 235, "MRD847291", 2, INK);

  // holder's signature under the portrait
  drawText(cv, 38, 408, "HOLDER'S SIGNATURE", 1, FADED);
  cv.hline(38, 432, 150, INK, 1);
  // a quick ink squiggle for a signature
  const sig: Array<[number, number]> = [
    [44, 428], [56, 416], [66, 426], [78, 414], [90, 424], [104, 416], [118, 425], [132, 418],
    [146, 424], [160, 417], [176, 424],
  ];
  for (let i = 0; i < sig.length - 1; i++) cv.line(sig[i][0], sig[i][1], sig[i + 1][0], sig[i + 1][1], INK);

  // language column: the second official tongue of the island
  cv.frame(38, 452, 440, 56, NAVY, 1);
  drawText(cv, 50, 464, "LANGUAGES", 1, FADED);
  drawText(cv, 50, 476, "MERIDIAN  /  ENGLISH", 2, INK);
  drawText(cv, 50, 494, "MERIDIAN IS WRITTEN IN THE LATIN ALPHABET", 1, FADED);

  // MRZ band
  cv.rect(px + 12, 620, pw - 24, 108, CREAM_DK);
  cv.frame(px + 12, 620, pw - 24, 108, FADED, 1);
  drawText(cv, px + 24, 632, "MACHINE READABLE ZONE", 1, FADED);
  drawText(cv, px + 24, 652, mrzLine1(), 2, INK, 0);
  drawText(cv, px + 24, 678, mrzLine2(), 2, INK, 0);
  drawText(cv, px + 24, 736, "12", 1, FADED);
}

function drawRightPage(cv: Canvas): void {
  const px = 522;
  const py = 14;
  const pw = 488;
  const ph = 740;
  cv.rect(px, py, pw, ph, CREAM);
  guilloche(cv, px + 8, py + 96, pw - 16, 380, [226, 216, 182]);
  cv.frame(px, py, pw, ph, INK, 2);

  drawTextC(cv, 766, 30, "VISAS", 3, NAVY);
  drawTextC(cv, 766, 58, "ENTRIES  -  EXITS  -  FERRY ONLY", 1, FADED);
  cv.hline(px + 24, 76, pw - 48, GOLD, 2);
  drawTextC(cv, 766, 88, "LAST DEPARTURE: PORT LUMEN 03 MAR 2024", 1, FADED);
  drawTextC(cv, 766, 102, "FERRY MV LUMEN STAR", 1, FADED);

  // four round stamps, chronological top to bottom
  const s1 = makeRoundStamp("CALDOVA", "ENTRY", "04 MAR 2024", "CALDOVA HARBOUR", TEAL);
  cv.blitRotated(s1, 662, 200, -8);
  const s2 = makeRoundStamp("CALDOVA", "EXIT", "11 MAR 2024", "CALDOVA HARBOUR", BURG);
  cv.blitRotated(s2, 872, 200, 6);
  const s3 = makeRoundStamp("TERN ISLE", "ENTRY", "22 JUN 2024", "TERN QUAY", NAVY);
  cv.blitRotated(s3, 662, 372, 5);
  const s4 = makeRoundStamp("TERN ISLE", "EXIT", "29 JUN 2024", "TERN QUAY", TEAL);
  cv.blitRotated(s4, 872, 372, -6);

  // Vostria visa sticker: the telling detail is its condition.
  const visa = makeRectStamp(
    ["VOSTRIA", "SINGLE ENTRY VISA", "ISSUED 02 SEP 2025", "VALID 08 SEP - 15 SEP 2025", "CONDITION: FERRY ONLY"],
    BURG,
    320,
    122,
  );
  cv.blitRotated(visa, 685, 550, -2);

  // ferry fee stamp, overlapping the visa's corner but clear of its text
  const fee = makeRectStamp(["FERRY FEE PAID", "12 LUMENS", "03 MAR 2024"], TEAL, 180, 68);
  cv.blitRotated(fee, 910, 598, -8);

  // the island's fact, printed as document text, not a caption
  drawTextC(cv, 766, 668, "THIS PASSPORT IS VALID FOR TRAVEL BY SEA ONLY.", 1, INK);
  drawTextC(cv, 766, 682, "MERIDIA HAS NO AIRPORT - ALL ARRIVALS BY FERRY.", 1, INK);
  cv.hline(px + 24, 700, pw - 48, GOLD, 1);
  drawTextC(cv, 766, 712, "IF FOUND, RETURN TO THE HARBOURMASTER, PORT LUMEN.", 1, FADED);
  drawText(cv, px + pw - 40, 736, "13", 1, FADED);
}

function main(): void {
  const cv = new Canvas(W, H, [14, 22, 40]);
  // centre gutter shadow between the two pages
  cv.rect(502, 14, 20, 740, [10, 16, 30]);
  drawLeftPage(cv);
  drawRightPage(cv);
  const png = encodePNG(W, H, cv.px);
  fs.mkdirSync("/output", { recursive: true });
  fs.writeFileSync("/output/entry.png", png);
  console.log(`wrote /output/entry.png ${W}x${H} ${png.length} bytes`);
}

main();
