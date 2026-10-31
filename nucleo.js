/* =========================================================================
   INCIDENCIAS SI - Nucleo: utilerias, API y reglas del procedimiento PAG-28
   ========================================================================= */
"use strict";
const B = window.B = { estado: null, usuario: null, token: null };

/* Membrete en piezas (logo izquierdo, logo derecho, emblema del pie). Los originales vienen en
   app/img; se pueden reemplazar desde Configuracion (se guardan con los datos en imagenes.json). */
B.imgs = { logoIzq: "", logoDer: "", pieEmblema: "", ver: null };
const IMG_ARCHIVO = { logoIzq: "logo_izq.png", logoDer: "logo_der.png", pieEmblema: "pie_emblema.png" };
B.imgUrl = tipo => B.imgs[tipo] || new URL("/img/" + IMG_ARCHIVO[tipo], location.href).href;
B.cargarImagenes = async function (ver) {
  if (ver !== undefined && ver === B.imgs.ver) return;
  try {
    const r = await (await fetch("/api/imagenes")).json();
    for (const k of Object.keys(IMG_ARCHIVO)) B.imgs[k] = r[k] || "";
    B.imgs.ver = r.ver || "";
  } catch (e) { }
  const DEF = { logoIzq: 94 / 454, logoDer: 184 / 175, pieEmblema: 153 / 300 };
  B.imgs.asp = { ...DEF };
  await Promise.all(Object.keys(IMG_ARCHIVO).map(k => new Promise(res => {
    const i = new Image(), t = setTimeout(res, 3000);   // nunca bloquea el inicio
    i.onload = () => { if (i.naturalWidth) B.imgs.asp[k] = i.naturalHeight / i.naturalWidth; clearTimeout(t); res(); };
    i.onerror = () => { clearTimeout(t); res(); };
    i.src = B.imgUrl(k);
  })));
};

/* ---------------------------------------------------------------- utilerias */
const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const pad = n => String(n).padStart(2, "0");
B.u = {
  esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); },
  br(s) { return B.u.esc(s).replace(/\n/g, "<br>"); },
  md(s) { return B.u.esc(s).replace(/\*\*([\s\S]+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>"); },
  norm(s) { return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim(); },
  iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); },
  hoy() { return B.u.iso(new Date()); },
  ahoraHora() { const d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); },
  fecha(s) { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); },
  sumar(s, n) { const d = B.u.fecha(s); d.setDate(d.getDate() + n); return B.u.iso(d); },
  corta(s) { if (!s) return ""; const [y, m, d] = String(s).slice(0, 10).split("-"); return d + "/" + m + "/" + y; },
  // "26-oct-2026"
  media(s) { if (!s) return ""; const d = B.u.fecha(s); return pad(d.getDate()) + "-" + MESES_C[d.getMonth()] + "-" + d.getFullYear(); },
  // "26 de octubre de 2026"
  larga(s) { if (!s) return ""; const d = B.u.fecha(s); return d.getDate() + " de " + MESES[d.getMonth()].toLowerCase() + " de " + d.getFullYear(); },
  fh(s) { if (!s) return ""; return B.u.corta(s) + (String(s).length > 10 ? " " + String(s).slice(11, 16) : ""); },
  diaSemana(s) { return DIAS[B.u.fecha(s).getDay()]; },
  dias(a, b) { return Math.round((B.u.fecha(b) - B.u.fecha(a)) / 864e5); },
  up(s) { return String(s || "").trim().toUpperCase(); },
  cap(s) { s = String(s || "").trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; },
  // "FRANCISCO EDGAR GONZALEZ VALDEZ" se queda como viene del padron
  descargar(nombre, contenido, tipo) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo || "text/plain" }));
    a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  },
  limpioArchivo(s) { return String(s || "documento").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim(); },
  debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
  plural(n, s, p) { return n + " " + (n === 1 ? s : (p || s + "s")); },
  id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  copia(o) { return JSON.parse(JSON.stringify(o ?? null)); }
};
const U = B.u;

/* ---------------------------------------------------------------- API */
B.api = {
  async llamar(ruta, cuerpo, metodo) {
    const op = { method: metodo || (cuerpo ? "POST" : "GET"), headers: {} };
    if (B.token) op.headers["X-Token"] = B.token;
    if (cuerpo) { op.headers["Content-Type"] = "application/json"; op.body = JSON.stringify(cuerpo); }
    let r;
    try { r = await fetch("/api/" + ruta, op); }
    catch (e) { throw new Error("No hay conexión con el servidor de Incidencias SI. Revisa que estés en la red de la oficina o vuelve a abrir el icono del sistema."); }
    let d = {};
    try { d = await r.json(); } catch (e) { }
    if (r.status === 401) { B.app && B.app.sesionExpirada(); throw new Error(d.error || "Sesión expirada"); }
    if (!d.ok) throw new Error(d.error || ("Error " + r.status));
    return d;
  },
  op(col, accion, datos) {
    if (B.d.lector() && !(col === "usuarios" && accion === "tourVisto")) return Promise.reject(new Error("Tu usuario es de solo consulta: no puede capturar ni modificar."));
    return B.api.llamar("op", { col, accion, datos });
  },
  async recargar() {
    const r = await B.api.llamar("estado");
    B.estado = r; B.usuario = r.usuario;
    if (r.imgVer !== B.imgs.ver) await B.cargarImagenes(r.imgVer);
    B.d._idx = null;
    return r;
  }
};
// dataURL de un archivo protegido (para incrustarlo en PDF / Word)
B.evidUrl = eid => "/evidencia/" + encodeURIComponent(eid) + "?t=" + encodeURIComponent(B.token || "");
B.dataUrl = async function (url) {
  const r = await fetch(url); if (!r.ok) throw new Error("No se pudo leer la imagen.");
  const bl = await r.blob();
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(bl); });
};

/* ---------------------------------------------------------------- reglas (PAG-28) */
B.d = {
  cfg() { return (B.estado && B.estado.config) || {}; },
  cat() { return (B.estado && B.estado.catalogos) || {}; },
  lector() { return !!(B.usuario && B.usuario.rol === "consulta"); },
  incidencias(conAnuladas) { return ((B.estado && B.estado.incidencias) || []).filter(x => conAnuladas || x.estado !== "anulado"); },
  inc(id) { return ((B.estado && B.estado.incidencias) || []).find(x => String(x.id) === String(id)); },
  persona(rpe) {
    if (!this._idx) { this._idx = {}; for (const p of (B.estado?.personal || [])) this._idx[p.rpe] = p; }
    return this._idx[U.up(rpe)] || null;
  },
  supervisor(rpe) { return (B.estado?.supervisores || []).find(s => s.rpe === rpe); },
  nombreSup(rpe) { const s = this.supervisor(rpe); return s ? s.nombre : (rpe || ""); },

  ESTADOS: { investigacion: ["En investigación", "d"], acciones: ["Acciones en curso", "a"], cerrado: ["Cerrado", "v"], anulado: ["Anulado", "n"] },
  estadoTxt(e) { return (this.ESTADOS[e] || [e || "", "n"])[0]; },

  // dias habiles (sin sabados, domingos ni dias inhabiles de Configuracion)
  esHabil(iso) { const d = U.fecha(iso).getDay(); return d !== 0 && d !== 6 && !(this.cfg().inhabiles || []).includes(iso); },
  habiles(desde, n) { let f = desde, k = 0; while (k < n) { f = U.sumar(f, 1); if (this.esHabil(f)) k++; } return f; },
  habilesEntre(a, b) { if (b <= a) return 0; let f = a, k = 0; while (f < b) { f = U.sumar(f, 1); if (this.esHabil(f)) k++; } return k; },
  // investigacion preliminar: <= 10 dias habiles a partir del accidente (PAG-28 6.4 b.2)
  plazo(x) {
    const f = x.evento?.fecha; if (!f) return null;
    const n = +this.cfg().plazoDias || 10, vence = this.habiles(f, n), hoy = U.hoy();
    const quedan = vence >= hoy ? this.habilesEntre(hoy, vence) : -this.habilesEntre(vence, hoy);
    return { vence, quedan, n, vencido: hoy > vence };
  },
  acciones(x) { return (x.acciones || []).map(a => ({ ...a, vencida: a.estado !== "Cerrada" && a.fecha && a.fecha < U.hoy(), sinResp: !a.resp })); },
  accionesAbiertas(x) { return this.acciones(x).filter(a => a.estado !== "Cerrada"); },
  todasAcciones() {
    const r = [];
    for (const x of this.incidencias()) for (const a of this.acciones(x)) r.push({ ...a, inc: x });
    return r;
  },

  // equivalencias palabra de campo -> clasificacion oficial 28-11
  eqLesion(t) { const c = (this.cat().tiposLesion || []).find(z => U.norm(z.n) === U.norm(t)); return c ? c.eq : ""; },
  eqParte(t) { const c = (this.cat().partesCuerpo || []).find(z => U.norm(z.n) === U.norm(t)); return c ? c.eq : ""; },
  codigo(n) { return (this.cat().codigos281 || []).find(c => +c.n === +n) || null; },
  codigoTxt(n) { const c = this.codigo(n); return c ? c.n + " · Evento Industrial – " + c.c : ""; },

  hayLesion(x) { return !!(x.evento && x.evento.hayLesion); },
  tituloInc(x) {
    const a = (x.afectados || [])[0], l = a && a.lesion;
    const que = this.hayLesion(x) ? (l && l.tipo ? U.cap(l.tipo) + (l.parte ? " en " + l.parte.toLowerCase() : "") : "Lesión") : "Cuasi-accidente";
    return que + (x.evento?.lugar ? " · " + x.evento.lugar : "");
  },
  afectadoTxt(x) {
    const a = x.afectados || [];
    if (!a.length) return x.evento?.hayLesion === false ? "Sin lesionados" : "—";
    return a.map(p => p.nombre || p.rpe).join(", ");
  },
  // desviaciones registradas por trabajador (flujo PAG-28-13): para avisar reincidencias
  desviaciones(rpe, excepto) {
    const r = [];
    for (const x of this.incidencias()) {
      if (String(x.id) === String(excepto)) continue;
      if (x.desviacion?.acto === "si" && (x.afectados || []).some(a => U.up(a.rpe) === U.up(rpe))) r.push({ folio: x.folio, fecha: x.evento?.fecha, motivo: x.desviacion.motivo });
    }
    return r;
  },
  // a la 3a por descuido/olvido o a la 2a por desconocimiento -> 28-14; cultura deficiente -> 28-14 directo (PAG-28 6.7)
  reglaDesviacion(rpe, motivo, excepto) {
    const prev = this.desviaciones(rpe, excepto);
    const n = prev.filter(p => p.motivo === motivo).length + 1;
    if (motivo === "cultura") return { aplica: "28-14", n, txt: "Deficiente cultura de seguridad: aplicar directamente el anexo PAG-28-14." };
    if (motivo === "descuido") return n >= 3 ? { aplica: "28-14", n, txt: "Es la " + n + "ª desviación por descuido u olvido: aplicar el anexo PAG-28-14." } : { aplica: "retro", n, txt: "Desviación " + n + " de 3 por descuido u olvido: el supervisor inmediato da retroalimentación." };
    if (motivo === "desconocimiento") return n >= 2 ? { aplica: "28-14", n, txt: "Es la " + n + "ª desviación por desconocimiento: aplicar el anexo PAG-28-14." } : { aplica: "28-15", n, txt: "Desconocimiento: módulo de Seguridad Industrial del curso OLV en 10 días hábiles y anexo PAG-28-15." };
    return null;
  },

  // link publico del formulario: la direccion de red (no localhost) para que abra en el celular
  urlLink(token) {
    const base = (this.cfg().urlBase || "").trim();
    if (base) return base.replace(/\/+$/, "") + "/f/" + token;
    const urls = B.estado?.servidor?.urls || [];
    const red = urls.find(u => /\/\/\d+\.\d+\.\d+\.\d+/.test(u)) || urls.find(u => !u.includes("localhost"));
    return (red || location.origin + "/").replace(/\/+$/, "") + "/f/" + token;
  },
  enRed() { return !!B.estado?.servidor?.enRed || !!(this.cfg().urlBase || "").trim(); }
};
