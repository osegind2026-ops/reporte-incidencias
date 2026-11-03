/* =========================================================================
   INCIDENCIAS SI - App de celular (pagina en GitHub Pages: movil/)
   - Entra con RPE y contrasena: descarga de la hoja de Google el paquete INC2U del usuario y lo descifra
     con su contrasena (la contrasena nunca sale del celular).
   - Lee la ultima foto de datos INC2S que la PC cifro para el (indicadores, incidencias sin nombres,
     acciones y links).
   - Genera links del formulario (firmados igual que en la PC) y los cancela o elimina: cada operacion va a la
     hoja como INC2M, cifrada para S.I. y firmada con la llave del usuario; la PC la aplica al sincronizar.
   Debe funcionar en navegadores anteriores: nada de ?. ?? ni {...obj} (ver js/arranque.js).
   ========================================================================= */
"use strict";
(function () {
  const C = window.INC_CFG || {}, ui = B.ui, E = s => U.esc(s);
  // capturas de la guia rapida (guia/capturas.js): datos de ejemplo sin Google; nunca existe en la pagina publicada
  const DEMO = window.INC_MOVIL_DEMO || null;
  const raiz = document.getElementById("raiz");
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s); };
  const b64u = buf => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const deB64u = s => { const t = atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); const a = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; };
  const listo = () => { window.INC_LISTO = true; const c = document.querySelector(".cargando"); if (c) c.remove(); };
  const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const leer = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const sesion = { get: () => { try { return JSON.parse(sessionStorage.getItem("inc_movil") || "null"); } catch (e) { return null; } },
    set: v => { try { v ? sessionStorage.setItem("inc_movil", JSON.stringify(v)) : sessionStorage.removeItem("inc_movil"); } catch (e) { } } };
  const MEMBRETE = `<div class="frm-membrete"><img src="../img/logo_izq.png" alt="Gobierno de México · CFE"><div class="membrete-titulo"><span class="mt-sup">Seguridad Industrial · CNLV</span><b>Incidencias SI</b><span class="mt-sub">Consulta y links desde el celular</span></div><img src="../img/logo_der.png" alt=""></div>`;

  if (!C.formId || !C.hojaId || !window.crypto || !crypto.subtle) {
    listo();
    raiz.innerHTML = `<div class="mv-login">${MEMBRETE}<div class="aviso r">${B.ico("alerta")}<div>${!C.hojaId ? "Esta página todavía no está configurada: en la PC genera y sube de nuevo los «Archivos para GitHub»." : "Abre esta página en Chrome o Safari actualizados."}</div></div></div>`;
    return;
  }

  /* ---------- hoja de Google (consulta gviz por JSONP) */
  function hoja(tq) {
    return new Promise((res, rej) => {
      const fn = "incmv" + Date.now() + Math.floor(Math.random() * 1000), s = document.createElement("script");
      const t = setTimeout(() => { limpiar(); rej(new Error("Google no respondió. Revisa tu señal e intenta de nuevo.")); }, 30000);
      const limpiar = () => { delete window[fn]; s.remove(); clearTimeout(t); };
      window[fn] = d => {
        limpiar();
        if (d.status === "error") { rej(new Error("Google rechazó la consulta.")); return; }
        try { res(d.table.rows.map(r => (r.c || []).map(c => c && c.v != null ? String(c.f || c.v) : ""))); } catch (e) { rej(e); }
      };
      s.onerror = () => { limpiar(); rej(new Error("No se pudo consultar Google. Revisa tu señal.")); };
      s.src = "https://docs.google.com/spreadsheets/d/" + C.hojaId + "/gviz/tq?tqx=responseHandler:" + fn + "&headers=1&tq=" + encodeURIComponent(tq) + "&_=" + Date.now();
      document.head.appendChild(s);
    });
  }
  async function publicar(texto) {
    if (DEMO) return;
    const cuerpo = new URLSearchParams();
    cuerpo.append("entry." + C.entry, texto); cuerpo.append("fvv", "1"); cuerpo.append("pageHistory", "0");
    await fetch("https://docs.google.com/forms/d/e/" + C.formId + "/formResponse", { method: "POST", mode: "no-cors", body: cuerpo });
  }

  /* ---------- llaves del usuario */
  let S = null;            // { rpe, nombre, consulta, llaves:{fir, uFir, uRec}, paq }
  async function importar(paq) {
    const imp = (j, alg, uso) => { const k = Object.assign({}, j); delete k.key_ops; return crypto.subtle.importKey("jwk", k, alg, false, uso); };
    return {
      fir: paq.firPri ? await imp(paq.firPri, { name: "ECDSA", namedCurve: "P-256" }, ["sign"]) : null,
      uFir: await imp(paq.uFir, { name: "ECDSA", namedCurve: "P-256" }, ["sign"]),
      uRec: await imp(paq.uRec, { name: "ECDH", namedCurve: "P-256" }, ["deriveKey"])
    };
  }
  async function entrar(rpe, clave) {
    rpe = U.up(rpe);
    if (DEMO) {
      const g = (alg, uso) => crypto.subtle.generateKey(alg, false, uso).then(k => k.privateKey);
      S = { rpe, nombre: DEMO.nombre || rpe, consulta: false, paq: null, llaves: { fir: await g({ name: "ECDSA", namedCurve: "P-256" }, ["sign", "verify"]), uFir: await g({ name: "ECDSA", namedCurve: "P-256" }, ["sign", "verify"]), uRec: null } };
      return;
    }
    if (!/^[0-9A-Z]{5}$/.test(rpe)) throw new Error("Escribe tu RPE (5 caracteres).");
    const f = await hoja("select A,B where B starts with 'INC2U|" + rpe + "|' order by A desc limit 1");
    const fila = f[0] && f[0][1];
    if (!fila) throw new Error("Tu acceso desde el celular no está activado. En la PC: menú de tu usuario → «Usar desde el celular».");
    const partes = fila.split("|")[2].split(".");
    const base = await crypto.subtle.importKey("raw", enc.encode(clave), "PBKDF2", false, ["deriveKey"]);
    const llave = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: deB64u(partes[0]), iterations: 300000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    let paq;
    try { paq = JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64u(partes[1]) }, llave, deB64u(partes[2])))); }
    catch (e) { throw new Error("Contraseña incorrecta. Si la cambiaste en la PC, vuelve a activar tu acceso desde la PC."); }
    S = { rpe: paq.rpe, nombre: paq.nombre, consulta: !!paq.consulta || !paq.firPri, llaves: await importar(paq), paq };
    sesion.set({ paq, t: Date.now() });
    guardar("inc_movil_rpe", rpe);
  }

  /* ---------- foto de datos que la PC cifro para este usuario */
  let D = null;
  async function cargarDatos() {
    if (DEMO) { D = DEMO.datos; B.estado = { aperturas: D.ap || {}, config: { linkHoras: D.linkHoras, plazoDias: D.plazoDias } }; return D; }
    const f = await hoja("select A,B where B starts with 'INC2S|' order by A desc limit 80");
    const env = [], por = {};
    f.forEach(r => { const p = (r[1] || "").split("|"); if (p.length < 5) return; if (!por[p[1]]) { por[p[1]] = { n: +p[3], partes: {} }; env.push(p[1]); } por[p[1]].partes[+p[2]] = p.slice(4).join("|"); });
    for (const id of env) {
      const e = por[id];
      if (Object.keys(e.partes).length < e.n) continue;
      let txt = ""; for (let i = 1; i <= e.n; i++) txt += e.partes[i];
      const m = JSON.parse(txt), k = m.k && m.k[S.rpe];
      if (!k) continue;                                  // foto anterior a su activacion o sin acceso
      const pub = await crypto.subtle.importKey("raw", deB64u(m.e), { name: "ECDH", namedCurve: "P-256" }, false, []);
      const kw = await crypto.subtle.deriveKey({ name: "ECDH", public: pub }, S.llaves.uRec, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      const [iv2, ct2] = k.split(".");
      try {
        const clave = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64u(iv2) }, kw, deB64u(ct2));
        const aes = await crypto.subtle.importKey("raw", clave, "AES-GCM", false, ["decrypt"]);
        D = JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64u(m.iv) }, aes, deB64u(m.ct))));
        B.estado = { aperturas: D.ap || {}, config: { linkHoras: D.linkHoras, plazoDias: D.plazoDias } };
        guardar("inc_movil_vista_" + S.rpe, D.fh);
        return D;
      } catch (er) { continue; }                          // cifrada con una llave anterior (se volvio a activar)
    }
    D = null;
    return null;
  }

  /* ---------- operaciones hechas aqui (se aplican en la PC al sincronizar) */
  const pendKey = () => "inc_movil_pend_" + S.rpe;
  function pendientes() {
    const l = leer(pendKey()) || [], hace2d = Date.now() - 2 * 86400000;
    const vivos = l.filter(p => {
      if (new Date(p.fh) < hace2d) return false;
      if (!D || D.fh < p.fhLocal) return true;           // la foto es anterior a la operacion
      const x = D.links.find(z => z.t === p.datos.token);
      if (p.op === "link") return !x;
      if (p.op === "anular") return x && !x.an;
      if (p.op === "eliminar") return p.datos.tokens.some(t => D.links.some(z => z.t === t));
      return false;
    });
    if (vivos.length !== l.length) guardar(pendKey(), vivos);
    return vivos;
  }
  async function cifrarSI(texto) {
    const pub = await crypto.subtle.importKey("jwk", C.cifPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const ef = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
    const aes = await crypto.subtle.deriveKey({ name: "ECDH", public: pub }, ef.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, enc.encode(texto));
    return "INC2." + b64(await crypto.subtle.exportKey("raw", ef.publicKey)) + "." + b64(iv) + "." + b64(ct);
  }
  async function operacion(op, datos) {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(36).padStart(2, "0")).join("").toUpperCase();
    const c = JSON.stringify({ op, id, rpe: S.rpe, fh: new Date().toISOString(), datos });
    const f = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, S.llaves.uFir, enc.encode(c));
    if (!DEMO) await publicar("INC2M|" + id + "|" + await cifrarSI(JSON.stringify({ c, f: b64u(f) })));
    const l = leer(pendKey()) || [];
    l.push({ op, id, datos, fh: new Date().toISOString(), fhLocal: U.ahora() });
    guardar(pendKey(), l);
  }
  // link firmado igual que en la PC: URL#k=<datos>.<firma>
  async function firmarLink(token, vence) {
    const datos = b64u(enc.encode(JSON.stringify({ t: token, v: vence })));
    const f = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, S.llaves.fir, enc.encode(datos));
    return datos + "." + b64u(f);
  }
  const urlDe = k => C.url + "#k=" + k;
  async function nuevoLink(para) {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = crypto.getRandomValues(new Uint8Array(8));
    const token = Array.from(r, b => abc[b % abc.length]).join("");
    const horas = (D && D.linkHoras) || 24, vence = U.ahora(new Date(Date.now() + horas * 3600000));
    const k = await firmarLink(token, vence);
    await operacion("link", { token, vence, para, creado: U.ahora(), k });
    return { token, vence, para, url: urlDe(k) };
  }

  /* ---------- pantallas */
  let vista = "inicio", filtroLinks = "Vigentes", buscar = "";
  function pantallaLogin(msg) {
    listo();
    raiz.innerHTML = `<div class="mv-login">${MEMBRETE}
      <form class="tarjeta" id="mF" autocomplete="on">
        <h2 style="margin:0 0 4px;color:var(--guinda);font-size:19px">Entrar</h2>
        <p class="muted peque" style="margin:0 0 14px;line-height:1.5">Usa tu RPE y tu contraseña de Incidencias SI. Antes activa tu acceso en la PC: menú de tu usuario → <b>Usar desde el celular</b>.</p>
        ${msg ? `<div class="aviso d">${B.ico("info")}<div>${E(msg)}</div></div>` : ""}
        <div class="campo"><label for="mR">RPE</label><input class="inp" id="mR" maxlength="5" autocomplete="username" style="text-transform:uppercase" value="${E(leer("inc_movil_rpe") || "")}"></div>
        <div class="campo"><label for="mC">Contraseña</label><input class="inp" id="mC" type="password" autocomplete="current-password"></div>
        <button class="btn bloque" type="submit">${B.ico("llave")} Entrar</button>
        <div class="aviso r oculto" id="mE" style="margin:12px 0 0"></div>
      </form></div>`;
    const f = document.getElementById("mF");
    f.onsubmit = async e => {
      e.preventDefault();
      const b = f.querySelector("button[type=submit]"), er = document.getElementById("mE");
      b.disabled = true; b.innerHTML = `<span class="giro chico"></span> Entrando…`; er.classList.add("oculto");
      try { await entrar(document.getElementById("mR").value, document.getElementById("mC").value); await abrir(); }
      catch (x) { er.textContent = x.message; er.classList.remove("oculto"); b.disabled = false; b.innerHTML = `${B.ico("llave")} Entrar`; }
    };
  }
  async function abrir() {
    raiz.innerHTML = `<div class="mv"><div class="mv-top"><div><b>Incidencias SI</b><div class="mini" id="mFh">Cargando datos…</div></div><button id="mAct">Actualizar</button></div><div id="mV"></div></div>
      <nav class="mv-nav">${[["inicio", "inicio", "Inicio"], ["links", "link", "Links"], ["inc", "doc", "Incidencias"], ["acc", "lista", "Acciones"], ["salir", "salir", "Salir"]].map(([v, i, t]) => `<button data-v="${v}" class="${v === vista ? "on" : ""}">${B.ico(i)}${t}</button>`).join("")}</nav>`;
    listo();
    document.querySelectorAll(".mv-nav button").forEach(b => b.onclick = () => {
      if (b.dataset.v === "salir") { sesion.set(null); S = null; D = null; pantallaLogin(); return; }
      vista = b.dataset.v; document.querySelectorAll(".mv-nav button").forEach(x => x.classList.toggle("on", x === b)); pintar(); window.scrollTo(0, 0);
    });
    document.getElementById("mAct").onclick = () => actualizar(true);
    pintar();
    await actualizar(false);
  }
  async function actualizar(aviso) {
    const fh = document.getElementById("mFh"), b = document.getElementById("mAct");
    if (b) { b.disabled = true; b.textContent = "…"; }
    try {
      await cargarDatos();
      if (fh) fh.textContent = D ? "Datos al " + U.fh(D.fh) : "Sin datos todavía";
      if (aviso) ui.toast(D ? "Datos actualizados." : "Aún no hay datos para ti.", D ? "ok" : "aviso");
    } catch (e) { if (fh) fh.textContent = "Sin conexión"; ui.error(e); }
    if (b) { b.disabled = false; b.textContent = "Actualizar"; }
    pintar();
  }
  const sinDatos = () => `<div class="tarjeta">${ui.vacio("Todavía no hay datos para ti. Aparecen unos minutos después de activar tu acceso, cuando la app esté abierta en alguna PC de la oficina.<br><br>Mientras tanto puedes generar links.", "reloj")}</div>`;

  function pintar() {
    const v = document.getElementById("mV"); if (!v || !S) return;
    if (vista === "inicio") v.innerHTML = vInicio();
    if (vista === "links") { v.innerHTML = vLinks(); enlazarLinks(v); }
    if (vista === "inc") { v.innerHTML = vInc(); const q = v.querySelector("#mQ"); if (q) q.oninput = () => { buscar = q.value; const l = v.querySelector("#mIL"); l.innerHTML = listaInc(); }; }
    if (vista === "acc") v.innerHTML = vAcc();
  }
  function kpi(valor, etiqueta, detalle, clase) { return `<div class="tarjeta kpi ${clase || ""}"><div class="valor">${valor}</div><div class="etiqueta">${etiqueta}</div>${detalle ? `<div class="detalle">${detalle}</div>` : ""}</div>`; }
  function vInicio() {
    const saludo = `<p class="muted peque" style="margin:0 0 10px">${E(S.nombre || S.rpe)}${S.consulta ? " · solo consulta" : ""}</p>`;
    if (!D) return saludo + sinDatos();
    const k = D.kpi, t = k.porTipo || {}, total = Object.keys(t).reduce((s, x) => s + t[x], 0);
    return saludo + `<div class="mv-kpis">
        ${kpi(total, "Incidencias " + k.anio, "", "neu")}
        ${kpi(k.abiertas, "Abiertas", "en investigación o con acciones", k.abiertas ? "amb" : "ok")}
        ${kpi(k.porRevisar, "Por revisar", "reportes que llegaron por link", k.porRevisar ? "amb" : "ok")}
        ${kpi(k.plazoVencido, "Plazo vencido", k.porVencer ? k.porVencer + " por vencer (2 días hábiles o menos)" : "investigaciones fuera de plazo", k.plazoVencido ? "alerta" : "ok")}
        ${kpi(k.accVencidas, "Acciones vencidas", "", k.accVencidas ? "alerta" : "ok")}
        ${k.inpo ? kpi(k.inpo.n + " de " + k.inpo.lim, "Casos INPO", k.inpo.sem, k.inpo.n > k.inpo.lim ? "alerta" : k.inpo.n === k.inpo.lim ? "amb" : "ok") : ""}
      </div>
      <div class="tarjeta"><b>Por tipo de evento (${E(k.anio)})</b><div class="mv-tipos">${Object.keys(B.d.TIPO_EVENTO).map(x => `<span class="badge ${x === "lesion" ? "r" : x === "salud" ? "a" : x === "menor" ? "d" : "n"}">${E(B.d.TIPO_EVENTO[x])}: ${t[x] || 0}</span>`).join("")}</div></div>`;
  }

  /* links */
  function linksVista() {
    const pend = pendientes(), base = D ? D.links.map(l => ({ token: l.t, para: l.p, creado: l.cr, vence: l.ve, usado: l.u, anulado: l.an, origen: l.o, rpe: l.r })) : [];
    pend.filter(p => p.op === "link").forEach(p => { if (!base.some(l => l.token === p.datos.token)) base.unshift({ token: p.datos.token, para: p.datos.para, creado: p.datos.creado, vence: p.datos.vence, origen: "celular", rpe: S.rpe, pend: "Generado aquí: se registra en la PC al sincronizar" }); });
    pend.filter(p => p.op === "anular").forEach(p => { const l = base.find(z => z.token === p.datos.token); if (l) l.pend = "Cancelación pendiente de sincronizar"; });
    pend.filter(p => p.op === "eliminar").forEach(p => p.datos.tokens.forEach(t => { const l = base.find(z => z.token === t); if (l) l.pend = "Eliminación pendiente de sincronizar"; }));
    return base.sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
  }
  const vigente = l => !l.usado && !l.anulado && l.vence > U.ahora();
  function vLinks() {
    const l = linksVista(), F = { Vigentes: vigente, Todos: () => true, Vencidos: x => !x.usado && !x.anulado && !vigente(x) };
    const vis = l.filter(F[filtroLinks]);
    return (S.consulta ? "" : `<div class="tarjeta"><b>Generar link del formulario</b>
        <p class="muted peque" style="margin:4px 0 10px;line-height:1.45">El supervisor de la actividad lo abre en su celular y llena el reporte inmediato. Sirve para un solo reporte y vence en ${(D && D.linkHoras) || 24} h.</p>
        <div class="campo"><label>Para (opcional)</label><input class="inp" id="mPara" placeholder="Nombre o RPE del supervisor"></div>
        <button class="btn bloque" id="mGen">${B.ico("link")} Generar link</button><div id="mRes" style="margin-top:10px"></div></div>`)
      + `<div style="margin:4px 0 10px">${ui.seg("fl", Object.keys(F), filtroLinks, "envuelve")}</div>`
      + (vis.length ? vis.map(x => {
        const a = x.pend ? { t: "Pendiente", c: "am", det: x.pend } : B.d.actividadLink(x);
        return `<div class="item"><div class="cuerpo"><div class="tit"><span style="font-family:Consolas,monospace">${E(x.token)}</span> <span class="badge ${a.c}">${E(a.t)}</span></div>
          <div class="meta"><span>${E(x.para || "Sin referencia")}</span><span>vence ${U.fh(x.vence)}</span>${x.origen === "celular" ? "<span>desde celular</span>" : ""}</div>${a.det ? `<div class="mini">${E(a.det)}</div>` : ""}
          ${S.consulta ? "" : `<div class="mv-acc">${vigente(x) && S.llaves.fir ? `<button class="btn sec chico" data-qr="${E(x.token)}">QR y compartir</button>` : ""}${vigente(x) && !x.pend ? `<button class="btn sec chico" data-anu="${E(x.token)}">Cancelar</button>` : ""}${!x.pend || x.pend.indexOf("Generado") === 0 ? `<button class="btn peligro chico" data-eli="${E(x.token)}">Eliminar</button>` : ""}</div>`}</div></div>`;
      }).join("") : `<div class="tarjeta">${ui.vacio("No hay links en esta lista.")}</div>`)
      + (!S.consulta && l.some(x => !x.pend && (x.anulado || (!x.usado && !vigente(x)))) ? `<button class="btn sec bloque" id="mLimp" style="margin-top:6px">Limpiar vencidos y cancelados</button>` : "");
  }
  function caja(url, l) {
    const txt = "Reporte inmediato de incidencia (Seguridad Industrial CNLV). Llénalo aquí: " + url;
    return `<div class="aviso v">${B.ico("ok")}<div>Link ${E(l.token)} listo. Vence el ${U.fh(l.vence)}.</div></div>
      <div style="text-align:center;margin:8px 0">${B.qr.svg(url, { px: 190 })}</div>
      <div class="mv-acc"><a class="btn chico" target="_blank" href="https://wa.me/?text=${encodeURIComponent(txt)}">WhatsApp</a>
      <button class="btn sec chico" data-copiar="${E(url)}">Copiar link</button>
      <a class="btn sec chico" href="mailto:?subject=${encodeURIComponent("Reporte inmediato de incidencia")}&body=${encodeURIComponent(txt)}">Correo</a></div>`;
  }
  function enlazarCaja(c) {
    c.querySelectorAll("[data-copiar]").forEach(b => b.onclick = () => {
      const t = b.dataset.copiar;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => ui.toast("Link copiado.", "ok"), () => { window.prompt("Copia el link:", t); });
    });
  }
  async function confirmarEliminar(tokens) {
    const l = linksVista().filter(x => tokens.indexOf(x.token) >= 0), vig = l.filter(vigente);
    return ui.confirmar(`Se eliminará${l.length > 1 ? "n" : ""} ${U.plural(l.length, "link", "links")}.` + (vig.length ? `<br><br><b>${U.plural(vig.length, "está vigente", "están vigentes")}</b>: dejará${vig.length > 1 ? "n" : ""} de funcionar.` : "") + "<br><br>Se aplica en la PC al sincronizar.", "Eliminar links", "Eliminar", true);
  }
  function enlazarLinks(v) {
    ui.activarSeg(v, (s, x) => { filtroLinks = x; pintar(); });
    const g = v.querySelector("#mGen");
    if (g) g.onclick = async () => {
      g.disabled = true; g.innerHTML = `<span class="giro chico"></span> Generando…`;
      try {
        const l = await nuevoLink(v.querySelector("#mPara").value.trim());
        pintar();
        const r = document.getElementById("mRes"); r.innerHTML = caja(l.url, l); enlazarCaja(r);
        ui.toast("Link generado. Compártelo con el supervisor.", "ok");
      } catch (e) { ui.error(e); g.disabled = false; g.innerHTML = `${B.ico("link")} Generar link`; }
    };
    v.querySelectorAll("[data-qr]").forEach(b => b.onclick = async () => {
      const l = linksVista().find(x => x.token === b.dataset.qr);
      const url = urlDe(await firmarLink(l.token, l.vence));
      await ui.modal({ titulo: "Link " + l.token + (l.para ? " · " + l.para : ""), icono: "link", html: caja(url, l), botones: [{ t: "Cerrar", c: "sec", v: null }], alAbrir: enlazarCaja });
    });
    v.querySelectorAll("[data-anu]").forEach(b => b.onclick = async () => {
      if (!await ui.confirmar("El link " + E(b.dataset.anu) + " dejará de funcionar.", "Cancelar link", "Cancelar link", true)) return;
      try { await operacion("anular", { token: b.dataset.anu }); ui.toast("Cancelación enviada.", "ok"); pintar(); } catch (e) { ui.error(e); }
    });
    v.querySelectorAll("[data-eli]").forEach(b => b.onclick = async () => {
      const t = b.dataset.eli, p = (leer(pendKey()) || []).find(x => x.op === "link" && x.datos.token === t);
      if (!await confirmarEliminar([t])) return;
      try { await operacion("eliminar", { tokens: [t] }); if (p) guardar(pendKey(), (leer(pendKey()) || []).filter(x => x !== p && x.id !== p.id)); ui.toast("Eliminación enviada.", "ok"); pintar(); } catch (e) { ui.error(e); }
    });
    const lp = v.querySelector("#mLimp");
    if (lp) lp.onclick = async () => {
      const t = linksVista().filter(x => !x.pend && (x.anulado || (!x.usado && !vigente(x)))).map(x => x.token);
      if (!t.length || !await confirmarEliminar(t)) return;
      try { await operacion("eliminar", { tokens: t }); ui.toast("Limpieza enviada.", "ok"); pintar(); } catch (e) { ui.error(e); }
    };
  }

  /* incidencias y acciones (sin nombres de personas) */
  const COLOR = { investigacion: "d", acciones: "a", cerrado: "v", anulado: "n" };
  function listaInc() {
    const q = U.norm(buscar), l = D.inc.filter(x => !q || U.norm([x.f, x.l, x.a, B.d.TIPO_EVENTO[x.t], B.d.estadoTxt(x.e)].join(" ")).indexOf(q) >= 0);
    return l.length ? l.map(x => `<div class="item"><div class="cuerpo"><div class="tit">${E(x.f)} <span class="badge ${COLOR[x.e] || "n"}">${E(B.d.estadoTxt(x.e))}</span></div>
        <div class="meta"><span>${U.media(x.fe)}${x.h ? " · " + E(x.h) + " h" : ""}</span><span>${E(B.d.TIPO_EVENTO[x.t] || "")}</span></div>
        <div class="peque" style="margin-top:4px">${E(x.l || "Sin lugar")}${x.a ? " · " + E(x.a) : ""}</div>
        <div class="mv-acc">${x.q !== null && x.q !== undefined ? `<span class="badge ${x.q < 0 ? "r" : x.q <= 2 ? "am" : "n"}">${x.q < 0 ? "Plazo vencido hace " + U.plural(-x.q, "día hábil", "días hábiles") : "Quedan " + U.plural(x.q, "día hábil", "días hábiles")}</span>` : ""}${x.av ? `<span class="badge r">${U.plural(x.av, "acción vencida", "acciones vencidas")}</span>` : x.ac ? `<span class="badge a">${U.plural(x.ac, "acción abierta", "acciones abiertas")}</span>` : ""}</div></div></div>`).join("")
      : `<div class="tarjeta">${ui.vacio("Sin resultados.")}</div>`;
  }
  function vInc() {
    if (!D) return sinDatos();
    return `<input class="inp mv-buscar" id="mQ" placeholder="Buscar folio, lugar, área, tipo o estado" value="${E(buscar)}"><p class="mini" style="margin:-4px 0 8px">Incidencias de ${E(D.kpi.anio)} y las abiertas de años anteriores.</p><div id="mIL">${listaInc()}</div>`;
  }
  function vAcc() {
    if (!D) return sinDatos();
    if (!D.acc.length) return `<div class="tarjeta">${ui.vacio("No hay acciones vencidas ni por vencer en los próximos 15 días.", "ok")}</div>`;
    return `<p class="mini" style="margin:0 0 8px">Acciones abiertas vencidas o que vencen en los próximos 15 días.</p>` + D.acc.map(a => `<div class="item"><div class="cuerpo">
        <div class="tit">${E(a.a)}</div><div class="meta"><span>${E(a.f)}</span><span>${E(a.r || "Sin responsable")}</span></div>
        <div class="mv-acc"><span class="badge ${a.v ? "r" : "am"}">${a.v ? "Venció el " : "Vence el "}${U.media(a.fe)}</span>${a.e ? `<span class="badge n">${E(a.e)}</span>` : ""}</div></div></div>`).join("");
  }

  /* ---------- arranque: si hay sesion en esta pestana (menos de 30 min sin uso) no pide la contrasena otra vez */
  (async function () {
    const s = sesion.get();
    if (s && s.paq && Date.now() - s.t < 30 * 60000) {
      try { S = { rpe: s.paq.rpe, nombre: s.paq.nombre, consulta: !!s.paq.consulta || !s.paq.firPri, llaves: await importar(s.paq), paq: s.paq }; sesion.set({ paq: s.paq, t: Date.now() }); await abrir(); return; }
      catch (e) { sesion.set(null); }
    }
    pantallaLogin();
  })();
  document.addEventListener("click", () => { const s = sesion.get(); if (s) sesion.set({ paq: s.paq, t: Date.now() }); });
})();
