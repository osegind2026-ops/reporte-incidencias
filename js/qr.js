/* =========================================================================
   INCIDENCIAS SI - Codigo QR (sin librerias ni internet)
   Modo byte, correccion de errores M, versiones 1 a 15 (hasta ~410 caracteres).
   Algoritmo segun ISO/IEC 18004 (misma estructura que la implementacion de referencia de Nayuki).
   B.qr.matriz(texto) -> [[bool]]   B.qr.svg(texto, {px}) -> "<svg…>"
   ========================================================================= */
"use strict";
(function (raiz) {
  // tablas para el nivel M, indice = version
  const ECC_POR_BLOQUE = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24];
  const BLOQUES = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10];
  const BITS_FORMATO_M = 0;

  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  const modulosDatos = v => {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  };
  const palabrasDatos = v => Math.floor(modulosDatos(v) / 8) - ECC_POR_BLOQUE[v] * BLOQUES[v];

  // aritmetica GF(2^8) con el polinomio 0x11D
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; };
  const divisor = g => { const r = new Array(g).fill(0); r[g - 1] = 1; let raizG = 1; for (let i = 0; i < g; i++) { for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], raizG); if (j + 1 < r.length) r[j] ^= r[j + 1]; } raizG = mul(raizG, 2); } return r; };
  const residuo = (datos, div) => { const r = div.map(() => 0); for (const b of datos) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => r[i] ^= mul(c, f)); } return r; };

  function codificar(texto) {
    const bytes = Array.from(new TextEncoder().encode(texto));
    let v = 1;
    for (; v <= 15; v++) { const cc = v <= 9 ? 8 : 16; if (4 + cc + bytes.length * 8 <= palabrasDatos(v) * 8) break; }
    if (v > 15) throw new Error("Texto demasiado largo para el código QR.");
    const bits = [];
    const poner = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    poner(4, 4); poner(bytes.length, v <= 9 ? 8 : 16); bytes.forEach(b => poner(b, 8));
    const cap = palabrasDatos(v) * 8;
    poner(0, Math.min(4, cap - bits.length));
    poner(0, (8 - bits.length % 8) % 8);
    for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) poner(p, 8);
    const datos = []; for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    // bloques, correccion de errores e intercalado
    const nb = BLOQUES[v], ecc = ECC_POR_BLOQUE[v], total = Math.floor(modulosDatos(v) / 8);
    const cortos = nb - total % nb, largoCorto = Math.floor(total / nb), div = divisor(ecc);
    const bloques = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const d = datos.slice(k, k + largoCorto - ecc + (i < cortos ? 0 : 1)); k += d.length;
      const e = residuo(d, div); if (i < cortos) d.push(0);
      bloques.push(d.concat(e));
    }
    const final = [];
    for (let i = 0; i < bloques[0].length; i++) bloques.forEach((b, j) => { if (i !== largoCorto - ecc || j >= cortos) final.push(b[i]); });
    return { v, palabras: final };
  }

  function matriz(texto) {
    const { v, palabras } = codificar(texto);
    const n = v * 4 + 17;
    const m = Array.from({ length: n }, () => new Array(n).fill(false));
    const fn = Array.from({ length: n }, () => new Array(n).fill(false));
    const fija = (x, y, b) => { m[y][x] = b; fn[y][x] = true; };
    // patrones de funcion
    for (let i = 0; i < n; i++) { fija(6, i, i % 2 === 0); fija(i, 6, i % 2 === 0); }
    const buscador = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy; if (xx >= 0 && xx < n && yy >= 0 && yy < n) fija(xx, yy, d !== 2 && d !== 4); } };
    buscador(3, 3); buscador(n - 4, 3); buscador(3, n - 4);
    const pos = [];
    if (v > 1) { const na = Math.floor(v / 7) + 2, paso = Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2; pos.push(6); for (let p = n - 7; pos.length < na; p -= paso) pos.splice(1, 0, p); }
    for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fija(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const formato = mask => {
      const d = (BITS_FORMATO_M << 3) | mask; let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) fija(8, i, bit(b, i));
      fija(8, 7, bit(b, 6)); fija(8, 8, bit(b, 7)); fija(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) fija(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) fija(n - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) fija(8, n - 15 + i, bit(b, i));
      fija(8, n - 8, true);
    };
    formato(0);
    if (v >= 7) {
      let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const b = (v << 12) | r;
      for (let i = 0; i < 18; i++) { const a = n - 11 + i % 3, c = Math.floor(i / 3); fija(a, c, bit(b, i)); fija(c, a, bit(b, i)); }
    }
    // datos en zigzag
    let k = 0;
    for (let der = n - 1; der >= 1; der -= 2) {
      if (der === 6) der = 5;
      for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
        const x = der - j, arriba = ((der + 1) & 2) === 0, y = arriba ? n - 1 - vert : vert;
        if (!fn[y][x] && k < palabras.length * 8) { m[y][x] = bit(palabras[k >>> 3], 7 - (k & 7)); k++; }
      }
    }
    const MASK = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const aplicar = mk => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fn[y][x] && MASK[mk](x, y)) m[y][x] = !m[y][x]; };
    // penalizacion (reglas 1 a 4) para elegir la mejor mascara
    const castigo = () => {
      let p = 0, oscuros = 0;
      const linea = get => {
        let run = 1, c = get(0);
        for (let i = 1; i < n; i++) { const b = get(i); if (b === c) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else { c = b; run = 1; } }
        const s = []; for (let i = 0; i < n; i++) s.push(get(i) ? 1 : 0);
        const t = s.join("");
        for (const pat of ["10111010000", "00001011101"]) { let i = t.indexOf(pat); while (i >= 0) { p += 40; i = t.indexOf(pat, i + 1); } }
      };
      for (let y = 0; y < n; y++) linea(i => m[y][i]);
      for (let x = 0; x < n; x++) linea(i => m[i][x]);
      for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
      for (const f of m) for (const c of f) if (c) oscuros++;
      p += Math.floor(Math.abs(oscuros * 20 - n * n * 10) / (n * n)) * 10;
      return p;
    };
    let mejor = 0, min = Infinity;
    for (let mk = 0; mk < 8; mk++) { aplicar(mk); formato(mk); const c = castigo(); if (c < min) { min = c; mejor = mk; } aplicar(mk); }
    aplicar(mejor); formato(mejor);
    return m;
  }

  function svg(texto, op = {}) {
    const m = matriz(texto), n = m.length, q = 4, t = n + 2 * q, px = op.px || 200;
    let d = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) d += `M${x + q},${y + q}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="Código QR del link"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  raiz.qr = { matriz, svg };
})(typeof B !== "undefined" ? B : (globalThis.B = globalThis.B || {}));
