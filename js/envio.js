/* =========================================================================
   INCIDENCIAS SI - Formulario EN LINEA (pagina publicada en GitHub Pages)
   - Verifica el link firmado (#k=...) y su vencimiento.
   - Busca al trabajador por RPE exacto en el padron protegido.
   - Cifra el reporte completo (con fotos) con la llave publica de S.I. y lo envia en pedazos
     al Google Form "buzon". Solo la app de S.I. (llave privada) puede leerlo.
   ========================================================================= */
"use strict";
(async function () {
  const C = window.INC_CFG, P = window.INC_PADRON;
  const raiz = document.getElementById("raiz");
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s); };
  const deB64u = s => { const t = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); const a = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; };
  const final = (ok, titulo, texto) => {
    document.querySelector(".cargando")?.remove();
    raiz.innerHTML = `<div class="frm"><div class="frm-cab"><div class="frm-t1">Reporte inmediato de incidencia</div><div class="frm-t2">Oficina de Seguridad Industrial · CNLV</div></div>
      <div class="frm-final ${ok ? "ok" : "mal"}"><div class="circ">${B.ico(ok ? "ok" : "alerta")}</div><h2>${titulo}</h2><p>${texto}</p></div></div>`;
  };
  if (!C || !window.crypto || !crypto.subtle) { final(false, "No se puede abrir el formulario", "Abre el link en Chrome, Safari o Edge actualizados."); return; }

  // link firmado: #k=<datos>.<firma>
  const k = (location.hash.match(/k=([A-Za-z0-9_.-]+)/) || [])[1] || "";
  let link = null;
  try {
    const [datos, firma] = k.split(".");
    const pub = await crypto.subtle.importKey("jwk", C.firPub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    if (datos && firma && await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, deB64u(firma), enc.encode(datos))) link = JSON.parse(dec.decode(deB64u(datos)));
  } catch (e) { link = null; }
  if (!link) { final(false, "Link no válido", "Abre el link completo que te envió Seguridad Industrial (por WhatsApp o con el código QR)."); return; }
  if (new Date(link.v) < new Date()) { final(false, "Este link venció", "Pide a Seguridad Industrial que te envíe uno nuevo."); return; }
  let enviado = null;
  try { enviado = localStorage.getItem("inc_enviado_" + link.t); } catch (e) { }
  if (enviado) { final(true, "Este reporte ya se envió", "Desde este celular ya se envió el reporte de este link. Si necesitas corregir algo, avisa directamente al supervisor de Seguridad Industrial."); return; }

  // padron protegido: solo se abre el registro del RPE escrito completo
  async function buscar(q) {
    const rpe = U.up(q).replace(/\s+/g, "");
    if (!P || !(/^[0-9A-Z]{5}$/.test(rpe) || /^C-\d{4}$/.test(rpe))) return [];
    const kk = await crypto.subtle.importKey("raw", enc.encode(rpe), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(P.sal), iterations: P.iter, hash: "SHA-256" }, kk, 384));
    const idx = b64(bits.slice(0, 12)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const reg = P.d[idx]; if (!reg) return [];
    const [iv, ct] = reg.split(".");
    const llave = await crypto.subtle.importKey("raw", bits.slice(16, 48), "AES-GCM", false, ["decrypt"]);
    const r = JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64u(iv) }, llave, deB64u(ct))));
    return [{ rpe: r.r, nombre: r.n, area: r.a, puesto: r.p, tipo: r.t, empresa: r.e, foto: false }];
  }

  async function cifrar(texto) {
    const pub = await crypto.subtle.importKey("jwk", C.cifPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const ef = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
    const aes = await crypto.subtle.deriveKey({ name: "ECDH", public: pub }, ef.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, enc.encode(texto));
    return "INC2." + b64(await crypto.subtle.exportKey("raw", ef.publicKey)) + "." + b64(iv) + "." + b64(ct);
  }
  // el mismo envio (mismo id y pedazos) se reintenta completo si se pierde la senal; la app ignora repetidos
  let preparado = null;
  async function enviar(payload) {
    if (!preparado) {
      const id = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(36).padStart(2, "0")).join("").toUpperCase();
      const txt = await cifrar(JSON.stringify({ k, enviado: new Date().toISOString(), datos: payload.datos, fotos: payload.fotos }));
      const n = Math.ceil(txt.length / C.pedazo), partes = [];
      for (let i = 0; i < n; i++) partes.push("INC2|" + id + "|" + (i + 1) + "|" + n + "|" + txt.slice(i * C.pedazo, (i + 1) * C.pedazo));
      preparado = { id, partes };
    }
    const url = "https://docs.google.com/forms/d/e/" + C.formId + "/formResponse";
    const boton = document.querySelector('[data-accion="enviar"]');
    for (let i = 0; i < preparado.partes.length; i++) {
      if (boton) boton.innerHTML = `<span class="giro chico"></span> Enviando ${i + 1} de ${preparado.partes.length}…`;
      const cuerpo = new URLSearchParams();
      cuerpo.append("entry." + C.entry, preparado.partes[i]); cuerpo.append("fvv", "1"); cuerpo.append("pageHistory", "0");
      let ok = false;
      for (let intento = 0; intento < 4 && !ok; intento++) {
        try { await fetch(url, { method: "POST", mode: "no-cors", body: cuerpo }); ok = true; }
        catch (e) { await new Promise(r => setTimeout(r, 1500 * (intento + 1))); }
      }
      if (!ok) throw new Error("Se perdió la señal mientras se enviaba. Revisa tus datos móviles y vuelve a tocar «Enviar» (no se duplica).");
    }
    try { localStorage.setItem("inc_enviado_" + link.t, new Date().toISOString()); } catch (e) { }
    return { id: preparado.id };
  }

  document.querySelector(".cargando")?.remove();
  raiz.innerHTML = `<div class="frm-membrete"><img src="img/logo_izq.png" alt="Gobierno de México · CFE"><img src="img/logo_der.png" alt=""></div><div id="frm"></div>`;
  B.form.montar(document.getElementById("frm"), {
    modo: "link", clave: link.t, catalogos: C.catalogos || {},
    buscar, fotoPersona: () => "", libreAfectado: true, ayudaBuscar: "Escribe el RPE completo (5 caracteres)",
    maxFoto: 1024, maxFotoPersona: 480, calidadFoto: 0.65,
    enviar,
    alEnviar: r => final(true, "Reporte enviado", `Gracias. Seguridad Industrial recibirá tu reporte (núm. ${U.esc(r.id)}) en unos minutos y lo revisará para iniciar la investigación.<br><br>Si recuerdas algo más, avísale directamente al supervisor de Seguridad Industrial.`)
  });
})();
