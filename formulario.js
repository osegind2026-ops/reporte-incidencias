/* =========================================================================
   INCIDENCIAS SI - Formulario del REPORTE INMEDIATO (por pasos)
   Lo usan: el link publico (supervisor de la actividad, sin cuenta) y la captura de S.I.
   B.form.montar(cont, { modo: "link"|"si", catalogos, buscar(q), fotoPersona(p), enviar(payload), clave })
   ========================================================================= */
"use strict";
B.form = (function () {
  const E = s => U.esc(s);
  // palabras que convierten un hecho en juicio (el reporte inmediato debe quedar en hechos)
  const JUICIOS = [
    [/descuid/i, "\"descuido\" es una conclusión. Describe lo que se observó."],
    [/neglig/i, "\"negligencia\" es un juicio. Describe el hecho."],
    [/culpa/i, "No asignes culpas en el reporte inmediato."],
    [/\bprisa\b|apurad|a la carrera/i, "\"prisa\" es una interpretación. Si alguien lo dijo, anótalo como su declaración."],
    [/presi[oó]n de (entrega|trabajo|tiempo)/i, "\"presión de entrega\" no es un hecho observable. Si alguien lo declaró, anótalo como su declaración."],
    [/se confi[oó]|exceso de confianza|confiado/i, "\"exceso de confianza\" es un juicio sobre la persona."],
    [/no tuvo cuidado|imprudencia|irresponsab|distra[ií]d/i, "Evita calificar a la persona. Describe la acción."]
  ];
  const vacioAfectado = () => ({ tipo: "CFE", rpe: "", nombre: "", area: "", puesto: "", ocupacion: "", empresa: "", contrato: "", supContrato: "", foto: "", fotoB64: "", tieneFoto: false, lesion: { tipo: "", parte: "", lado: "" } });

  function montar(cont, op) {
    const cat = op.catalogos || {};
    const clave = "inc_borrador_" + (op.clave || op.modo);
    let f = null;
    try { f = JSON.parse(localStorage.getItem(clave) || "null"); } catch (e) { f = null; }
    if (!f || !f.evento) f = {
      evento: { hayLesion: true, fecha: U.hoy(), hora: U.ahoraHora(), horaAprox: true, turno: "", lugar: "", actividad: "", reunion: "", ot: "" },
      afectados: [vacioAfectado()], reporta: { rpe: "", nombre: "" }, relato: "", declAfectado: "", testigos: "", fotos: [],
      epp: (cat.epp || []).map(e => ({ equipo: e, indicado: false, portado: false })), eppGuante: "", eppEstado: "",
      medico: { traslado: 0, horaAviso: "", horaMedico: "", indicacion: "" }, inm: [], inmOtra: ""
    };
    let paso = 0, enviando = false;
    const guardarBorrador = U.debounce(() => { try { const c = U.copia(f); c.fotos = []; c.afectados.forEach(a => a.fotoB64 = ""); localStorage.setItem(clave, JSON.stringify(c)); } catch (e) { } }, 400);

    const PASOS = [
      { t: "El evento", r: "Datos del anexo PAG-28-11 §3 · Clasificación PAG-28-1", h: pasoEvento, v: validarEvento },
      { t: "Persona afectada", r: "Datos del trabajador · anexo PAG-28-11 §2", h: pasoAfectados, v: validarAfectados },
      { t: "La lesión", r: "Seguridad Industrial la clasifica según PAG-28-11 §4.5 (tipo de lesión y parte del cuerpo)", h: pasoLesion, v: validarLesion, soloLesion: true },
      { t: "Cómo pasó", r: "Relatoría de los hechos y declaraciones · PAG-28 6.4 b", h: pasoHechos, v: validarHechos },
      { t: "Equipo de protección", r: "Permite concluir si hubo error de prescripción o acto inseguro · PAG-28-11 §4.2–4.3", h: pasoEpp },
      { t: "Atención y acciones", r: "Aviso ≤ 15 min y Servicio Médico (PAG-28 6.4 c) · código de comunicación PAG-28-1", h: pasoAtencion, v: validarAtencion },
      { t: "Revisar y enviar", h: pasoResumen }
    ];
    const visibles = () => PASOS.filter(p => f.evento.hayLesion || !p.soloLesion);

    cont.innerHTML = `<div class="frm">
      <div class="frm-cab"><div class="frm-t1">Reporte inmediato de incidencia</div><div class="frm-t2" data-tit></div><div class="frm-pasos" data-pasos></div></div>
      <div class="frm-cuerpo" data-cuerpo></div>
      <div class="frm-pie"><button class="btn sec" data-ant>Atrás</button><button class="btn" data-sig>Siguiente</button></div></div>`;
    const cuerpo = cont.querySelector("[data-cuerpo]");
    cont.querySelector("[data-ant]").onclick = () => { if (paso) { paso--; pintar(); } };
    cont.querySelector("[data-sig]").onclick = () => {
      const p = visibles()[paso];
      const err = p.v ? p.v() : "";
      if (err) { aviso(err); return; }
      if (paso < visibles().length - 1) { paso++; pintar(); }
    };
    function aviso(m) {
      let a = cuerpo.querySelector(".frm-error");
      if (!a) { a = document.createElement("div"); a.className = "frm-error"; cuerpo.prepend(a); }
      a.innerHTML = B.ico("alerta") + "<div>" + E(m) + "</div>";
      cuerpo.scrollTop = 0;
    }
    function pintar() {
      const vis = visibles(); if (paso >= vis.length) paso = vis.length - 1;
      const p = vis[paso];
      cont.querySelector("[data-tit]").textContent = "Paso " + (paso + 1) + " de " + vis.length + " · " + p.t;
      cont.querySelector("[data-pasos]").innerHTML = vis.map((_, i) => `<i class="${i <= paso ? "si" : ""}"></i>`).join("");
      cont.querySelector("[data-ant]").style.visibility = paso ? "visible" : "hidden";
      cont.querySelector("[data-sig]").style.display = paso === vis.length - 1 ? "none" : "";
      cuerpo.innerHTML = p.h() + (p.r ? `<div class="frm-ref">${E(p.r)}</div>` : "");
      enlazar(cuerpo);
      cuerpo.scrollTop = 0;
      const ventana = cont.closest(".frm-pagina"); if (ventana) window.scrollTo(0, 0);
      guardarBorrador();
    }

    /* ---------- utilidades de controles */
    const seg = (ruta, opciones, valor) => `<div class="frm-seg" data-seg="${ruta}">${opciones.map(o => `<button type="button" class="${String(o) === String(valor) ? "on" : ""}" data-v="${E(o)}">${E(o)}</button>`).join("")}</div>`;
    const obtener = ruta => ruta.split(".").reduce((o, k) => o == null ? o : o[k], f);
    const fijar = (ruta, v) => { const ks = ruta.split("."); let o = f; ks.slice(0, -1).forEach(k => o = o[k]); o[ks[ks.length - 1]] = v; guardarBorrador(); };
    const inp = (ruta, tipo, ph, extra) => `<input class="inp" type="${tipo || "text"}" data-r="${ruta}" value="${E(obtener(ruta) ?? "")}" placeholder="${E(ph || "")}" ${extra || ""}>`;
    const area = (ruta, filas, ph) => `<textarea class="inp" rows="${filas || 3}" data-r="${ruta}" placeholder="${E(ph || "")}">${E(obtener(ruta) ?? "")}</textarea>`;
    function enlazar(raiz) {
      raiz.querySelectorAll("[data-r]").forEach(el => {
        const ev = el.type === "checkbox" ? "change" : "input";
        el.addEventListener(ev, () => { fijar(el.dataset.r, el.type === "checkbox" ? el.checked : el.value); if (el.dataset.r === "relato") revisarJuicios(); });
      });
      raiz.querySelectorAll("[data-seg]").forEach(s => s.querySelectorAll("button").forEach(b => b.onclick = () => {
        s.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
        fijar(s.dataset.seg, b.dataset.v);
      }));
      raiz.querySelectorAll("[data-accion]").forEach(b => b.onclick = e => acciones[b.dataset.accion](b, e));
      raiz.querySelectorAll("[data-buscar]").forEach(el => buscador(el));
      raiz.querySelectorAll("input[type=file]").forEach(el => el.onchange = () => cargarFotos(el));
      revisarJuicios();
    }

    /* ---------- paso 1: evento */
    function pasoEvento() {
      const e = f.evento;
      return `<h2>¿Qué ocurrió?</h2><p class="frm-ayuda">Toca la opción que corresponda.</p>
        <div class="frm-opc">
          <button type="button" class="${e.hayLesion ? "on" : ""}" data-accion="lesion" data-v="si"><b>Hubo una persona lesionada</b><span>Aunque sea leve o solo de primeros auxilios</span></button>
          <button type="button" class="${!e.hayLesion ? "on" : ""}" data-accion="lesion" data-v="no"><b>No hubo lesión, pero pudo haberla</b><span>Cuasi-accidente</span></button>
        </div>
        <div class="frm-dos">
          <div class="campo"><label>Fecha</label>${inp("evento.fecha", "date", "", `max="${U.hoy()}"`)}</div>
          <div class="campo"><label>Hora</label>${inp("evento.hora", "time")}</div>
        </div>
        <label class="frm-chk"><input type="checkbox" data-r="evento.horaAprox" ${e.horaAprox ? "checked" : ""}> La hora es aproximada</label>
        <div class="campo"><label>Turno</label>${seg("evento.turno", ["Diurno", "Nocturno", "Mixto"], e.turno)}</div>
        <div class="campo"><label>¿Dónde? <span class="op-t">edificio, área y nivel</span></label>${inp("evento.lugar", "text", "Ej. Pozo Seco, Nivel 35")}</div>
        <div class="campo"><label>¿Qué trabajo se hacía?</label>${inp("evento.actividad", "text", "Ej. Retiro de marco de carcasa")}</div>
        <div class="campo"><label>¿Se hizo reunión pre-trabajo?</label>${seg("evento.reunion", ["Sí", "No"], e.reunion)}</div>
        <div class="campo"><label>Orden de trabajo <span class="op-t">(si la sabes)</span></label>${inp("evento.ot", "text", "No. OT")}</div>`;
    }
    function validarEvento() {
      const e = f.evento;
      if (!e.fecha) return "Captura la fecha del evento.";
      if (e.fecha > U.hoy()) return "La fecha no puede ser posterior a hoy.";
      if (!e.hora) return "Captura la hora (aunque sea aproximada).";
      if (!e.turno) return "Elige el turno.";
      if (e.lugar.trim().length < 3) return "Escribe dónde ocurrió.";
      if (e.actividad.trim().length < 3) return "Escribe qué trabajo se hacía.";
      if (!e.reunion) return "Indica si se hizo reunión pre-trabajo.";
      return "";
    }

    /* ---------- paso 2: afectados */
    function tarjetaAfectado(a, i) {
      const foto = a.fotoB64 || (a.tieneFoto || a.foto ? op.fotoPersona(a) : "");
      const quitar = f.afectados.length > 1 ? `<button type="button" class="btn fantasma chico" data-accion="quitarAf" data-i="${i}">Quitar</button>` : "";
      if (a.tipo === "Contratista") return `<div class="frm-af" data-i="${i}">
        <div class="frm-af-cab"><b>${f.evento.hayLesion ? "Persona afectada" : "Persona involucrada"} ${f.afectados.length > 1 ? i + 1 : ""}</b>${quitar}</div>
        ${segAf(i, "Contratista")}
        <div class="campo"><label>Nombre completo</label>${inp("afectados." + i + ".nombre")}</div>
        <div class="campo"><label>Empresa contratista</label>${inp("afectados." + i + ".empresa")}</div>
        <div class="frm-dos"><div class="campo"><label>No. de contrato</label>${inp("afectados." + i + ".contrato")}</div>
        <div class="campo"><label>Supervisor CFE del contrato</label>${inp("afectados." + i + ".supContrato")}</div></div>
        <div class="campo"><label>¿Qué hacía en la cuadrilla?</label>${inp("afectados." + i + ".ocupacion", "text", "Ej. ayudante, soldador")}</div>
        ${botonFoto(a, i, foto)}</div>`;
      return `<div class="frm-af" data-i="${i}">
        <div class="frm-af-cab"><b>${f.evento.hayLesion ? "Persona afectada" : "Persona involucrada"} ${f.afectados.length > 1 ? i + 1 : ""}</b>${quitar}</div>
        ${segAf(i, "CFE")}
        ${a.nombre ? `<div class="frm-emp">${foto ? `<img src="${E(foto)}" alt="">` : `<div class="frm-sinfoto">${B.ico("usuario")}</div>`}
            <div><div class="nm">${E(a.nombre)}</div><div class="dt">RPE ${E(a.rpe)} · ${E(a.area || "")}</div><div class="dt"><a href="#" data-accion="cambiarAf" data-i="${i}">cambiar persona</a></div></div></div>`
          : `<div class="campo"><label>RPE o nombre</label><input class="inp" data-buscar="${i}" placeholder="${E(op.ayudaBuscar || "Escribe el RPE o 3 letras del nombre")}" autocomplete="off"><div class="frm-sug" hidden></div>
             <span class="frm-ayuda">¿No aparece? <a href="#" data-accion="contratista" data-i="${i}">Captúralo como contratista</a> o avisa a S.I.</span></div>`}
        ${a.nombre ? `<div class="campo"><label>¿Qué hacía en la cuadrilla?</label>${inp("afectados." + i + ".ocupacion", "text", "Ej. ayudante, oficial, operador de polipasto")}</div>${botonFoto(a, i, foto)}` : ""}
      </div>`;
    }
    const segAf = (i, v) => `<div class="frm-seg" data-tipo-af="${i}">${["CFE", "Contratista"].map(o => `<button type="button" class="${o === v ? "on" : ""}" data-v="${o}">${o === "CFE" ? "Personal CFE" : "Contratista CFE"}</button>`).join("")}</div>`;
    const botonFoto = (a, i, foto) => `<label class="frm-agregar">${B.ico("camara")} ${foto ? "Cambiar la foto de la persona" : "Agregar foto de la persona"}<input type="file" accept="image/*" data-foto-af="${i}" hidden></label>`;
    function pasoAfectados() {
      return `<h2>${f.evento.hayLesion ? "¿Quién resultó afectado?" : "¿Quién estaba involucrado?"}</h2>
        ${!f.evento.hayLesion ? `<p class="frm-ayuda">En un cuasi-accidente es opcional; si nadie estuvo directamente expuesto, deja el espacio vacío.</p>` : ""}
        ${f.afectados.map(tarjetaAfectado).join("")}
        <button type="button" class="frm-agregar" data-accion="otroAf">+ Agregar otra persona</button>
        <div class="campo" style="margin-top:16px"><label>Quién reporta <span class="op-t">${op.modo === "link" ? "(tú, supervisor de la actividad)" : "(supervisor de la actividad)"}</span></label>
          ${f.reporta.nombre ? `<div class="frm-emp chico"><div><div class="nm">${E(f.reporta.nombre)}</div><div class="dt">${E(f.reporta.rpe)} · <a href="#" data-accion="cambiarRep">cambiar</a></div></div></div>`
          : `<input class="inp" data-buscar="rep" placeholder="Tu RPE o nombre" autocomplete="off"><div class="frm-sug" hidden></div>`}</div>`;
    }
    function validarAfectados() {
      const llenos = f.afectados.filter(a => a.nombre.trim());
      if (f.evento.hayLesion && !llenos.length) return "Indica quién resultó lesionado.";
      for (const a of llenos) if (a.tipo === "Contratista" && !a.empresa.trim()) return "Escribe la empresa contratista de " + a.nombre + ".";
      if (!f.reporta.nombre) return "Indica quién reporta (supervisor de la actividad).";
      return "";
    }

    /* ---------- paso 3: lesion */
    function pasoLesion() {
      const tipos = cat.tiposLesion || [], partes = cat.partesCuerpo || [];
      return f.afectados.filter(a => a.nombre).map((a, i) => {
        const l = a.lesion, k = f.afectados.indexOf(a);
        return `<div class="frm-bloque">${f.afectados.filter(x => x.nombre).length > 1 ? `<div class="frm-af-cab"><b>${E(a.nombre)}</b></div>` : ""}
          <h2>¿Qué lesión tuvo?</h2><p class="frm-ayuda">Elige la palabra que usarías en campo. Si no está, agrégala.</p>
          <div class="frm-chips" data-chips="afectados.${k}.lesion.tipo">${tipos.map(t => `<button type="button" class="${t.n === l.tipo ? "on" : ""}" data-v="${E(t.n)}">${E(t.n)}</button>`).join("")}
            ${l.tipo && !tipos.some(t => t.n === l.tipo) ? `<button type="button" class="on nuevo" data-v="${E(l.tipo)}">${E(l.tipo)}</button>` : ""}
            <button type="button" class="mas" data-accion="otroTipo" data-k="${k}">+ Otro</button></div>
          <div class="frm-nuevo" data-nuevo="${k}" hidden><input class="inp" placeholder="Ej. ampolla, piquete, mordedura"><button type="button" class="btn chico" data-accion="agregarTipo" data-k="${k}">Agregar</button></div>
          <h2 style="margin-top:16px">¿En qué parte del cuerpo?</h2>
          <div class="frm-chips" data-chips="afectados.${k}.lesion.parte">${partes.map(t => `<button type="button" class="${t.n === l.parte ? "on" : ""}" data-v="${E(t.n)}">${E(t.n)}</button>`).join("")}</div>
          <div class="campo" style="margin-top:12px"><label>Lado</label>${seg("afectados." + k + ".lesion.lado", ["Izquierdo", "Derecho", "Ambos", "No aplica"], l.lado)}</div></div>`;
      }).join("");
    }
    function validarLesion() {
      for (const a of f.afectados.filter(x => x.nombre)) {
        if (!a.lesion.tipo) return "Elige el tipo de lesión" + (f.afectados.length > 1 ? " de " + a.nombre : "") + ".";
        if (!a.lesion.parte) return "Elige la parte del cuerpo" + (f.afectados.length > 1 ? " de " + a.nombre : "") + ".";
        if (!a.lesion.lado) return "Indica el lado (o \"No aplica\").";
      }
      return "";
    }

    /* ---------- paso 4: hechos */
    function pasoHechos() {
      return `<h2>Cuenta qué pasó</h2>
        <div class="frm-guia"><b>Solo hechos:</b> qué se hacía, qué pasó, dónde y a qué hora.<br><b>No escribas</b> causas ni culpas ("por descuido", "por prisa"). Eso lo analiza Seguridad Industrial.</div>
        <div class="campo">${area("relato", 6, "Ej. Durante el retiro del marco, el trabajador sujetó el borde con la mano derecha y sufrió una cortadura…")}<div class="frm-juicio" data-juicio hidden></div></div>
        ${f.afectados.some(a => a.nombre) ? `<div class="campo"><label>¿Qué dijo la persona afectada? <span class="op-t">con sus palabras</span></label>${area("declAfectado", 3, 'Ej. "No sentí el corte, me di cuenta cuando vi sangre"')}</div>` : ""}
        <div class="campo"><label>¿Quién más lo vio?</label>${inp("testigos", "text", "RPE o nombre de testigos")}</div>
        <div class="frm-fotos">${f.fotos.map((x, i) => `<div class="frm-foto"><img src="${E(x.b64)}" alt=""><button type="button" data-accion="quitarFoto" data-i="${i}" title="Quitar">×</button></div>`).join("")}</div>
        <label class="frm-agregar">${B.ico("camara")} Agregar fotos del lugar, la herramienta o el material<input type="file" accept="image/*" multiple data-fotos hidden></label>
        <p class="frm-ayuda" style="margin-top:6px">No tomes fotos de la lesión aquí; el Servicio Médico y S.I. las agregan al expediente.</p>`;
    }
    function validarHechos() { return f.relato.trim().length < 20 ? "Describe con un poco más de detalle qué pasó." : ""; }
    function revisarJuicios() {
      const c = cuerpo.querySelector("[data-juicio]"); if (!c) return;
      const m = JUICIOS.filter(j => j[0].test(f.relato)).map(j => "• " + E(j[1]));
      c.innerHTML = m.length ? "<b>Revisa la redacción:</b><br>" + m.join("<br>") : "";
      c.hidden = !m.length;
    }

    /* ---------- paso 5: EPP */
    function pasoEpp() {
      return `<h2>Equipo de protección personal</h2>
        <p class="frm-ayuda">Para cada equipo marca si <b>se indicó en la reunión pre-trabajo</b> y si <b>lo traía puesto</b>.</p>
        <div class="frm-epp enc"><span>Equipo</span><span>Se indicó</span><span>Lo traía</span></div>
        ${f.epp.map((e, i) => `<div class="frm-epp"><span>${E(e.equipo)}</span>
          <span><button type="button" class="frm-tg ${e.indicado ? "on" : ""}" data-accion="tg" data-r="epp.${i}.indicado" aria-label="Se indicó"></button></span>
          <span><button type="button" class="frm-tg ${e.portado ? "on" : ""}" data-accion="tg" data-r="epp.${i}.portado" aria-label="Lo traía"></button></span></div>`).join("")}
        <div class="campo" style="margin-top:12px"><label>¿Qué guante traía?</label>${seg("eppGuante", cat.guantes || [], f.eppGuante)}</div>
        <div class="campo"><label>¿Cómo estaba el equipo?</label>${seg("eppEstado", ["Buen estado", "Dañado", "No sé"], f.eppEstado)}</div>`;
    }

    /* ---------- paso 6: atencion */
    function pasoAtencion() {
      const m = f.medico, tr = cat.traslados || [];
      return (f.evento.hayLesion ? `<h2>Atención médica</h2>
        <div class="frm-opc">${tr.map(t => `<button type="button" class="${+m.traslado === +t.cod ? "on" : ""}" data-accion="traslado" data-v="${t.cod}"><b>${E(t.t)}</b><span>${E(t.s)}</span></button>`).join("")}</div>
        <div class="frm-dos" style="margin-top:12px">
          <div class="campo"><label>Hora de aviso a S.I.</label>${inp("medico.horaAviso", "time")}</div>
          <div class="campo"><label>Hora en Servicio Médico</label>${inp("medico.horaMedico", "time")}</div></div>
        <div class="campo"><label>¿Qué indicó el médico? <span class="op-t">si ya lo sabes</span></label>${area("medico.indicacion", 2)}</div>`
        : `<div class="campo"><label>Hora de aviso a S.I.</label>${inp("medico.horaAviso", "time")}</div>`) +
        `<h2 style="margin-top:6px">¿Qué se hizo de inmediato?</h2>
        ${(cat.accionesInm || []).filter(a => f.evento.hayLesion || !/Servicio Médico/i.test(a)).map(a => `<label class="frm-op"><input type="checkbox" data-inm="${E(a)}" ${f.inm.includes(a) ? "checked" : ""}><span>${E(a)}</span></label>`).join("")}
        <div class="campo">${area("inmOtra", 2, "Otra acción: qué se hizo, quién y a qué hora")}</div>`;
    }
    function validarAtencion() { return f.evento.hayLesion && !+f.medico.traslado ? "Elige cómo fue el traslado o la atención." : ""; }

    /* ---------- paso 7: resumen */
    function pasoResumen() {
      const e = f.evento, af = f.afectados.filter(a => a.nombre);
      const tr = (cat.traslados || []).find(t => +t.cod === +f.medico.traslado);
      const filas = [
        ["Evento", e.hayLesion ? "Persona lesionada" : "Cuasi-accidente (sin lesión)"],
        ["Cuándo", U.media(e.fecha) + ", " + (e.horaAprox ? "~" : "") + e.hora + " h · turno " + (e.turno || "").toLowerCase()],
        ["Dónde", e.lugar], ["Trabajo", e.actividad + " · " + (e.reunion === "Sí" ? "con" : "sin") + " reunión pre-trabajo"],
        [e.hayLesion ? "Afectado" : "Involucrado", af.length ? af.map(a => a.nombre + (a.rpe ? " (" + a.rpe + ")" : "") + (a.tipo === "Contratista" ? " · " + a.empresa : "")).join("<br>") : "—"]
      ];
      if (e.hayLesion) af.forEach(a => filas.push(["Lesión", E(a.lesion.tipo + " en " + a.lesion.parte.toLowerCase() + (a.lesion.lado && a.lesion.lado !== "No aplica" ? ", lado " + a.lesion.lado.toLowerCase() : ""))]));
      filas.push(["Qué pasó", E(f.relato.length > 160 ? f.relato.slice(0, 160) + "…" : f.relato)]);
      const ep = f.epp.filter(x => x.portado).map(x => x.equipo);
      filas.push(["EPP portado", E((ep.length ? ep.join(", ") : "No se marcó") + (f.eppGuante ? " · guante " + f.eppGuante.toLowerCase() : ""))]);
      if (e.hayLesion) filas.push(["Atención", E((tr ? tr.t : "") + (f.medico.horaAviso ? " · aviso a S.I. " + f.medico.horaAviso : ""))]);
      filas.push(["Fotos", f.fotos.length ? U.plural(f.fotos.length, "foto") : "Sin fotos"], ["Reporta", E(f.reporta.nombre)]);
      return `<h2>Revisa antes de enviar</h2>
        <div class="frm-resumen">${filas.map(r => `<div><span>${r[0]}</span><span>${r[0] === "Afectado" || r[0] === "Involucrado" ? E(r[1]).replace(/&lt;br&gt;/g, "<br>") : r[1]}</span></div>`).join("")}</div>
        <button type="button" class="btn bloque" style="margin-top:14px" data-accion="enviar">${B.ico("ok")} Enviar reporte a Seguridad Industrial</button>
        <p class="frm-ayuda" style="text-align:center;margin-top:10px">${op.modo === "link" ? "Llega como <b>\"Por revisar\"</b>. Un supervisor de S.I. lo valida, asigna folio e inicia la investigación." : "Se abrirá el folio y el expediente para iniciar la investigación."}</p>`;
    }

    /* ---------- busqueda de personal */
    function buscador(el) {
      const sug = el.parentNode.querySelector(".frm-sug");
      const q = U.debounce(async () => {
        const t = el.value.trim();
        if (t.length < 3) { sug.hidden = true; return; }
        let r = [];
        try { r = await op.buscar(t); } catch (e) { r = []; }
        // quien reporta puede no estar en el padron: se permite escribir su nombre
        // si no aparece en el padron se permite escribir el nombre (quien reporta siempre; el afectado en el formulario en linea)
        const esRpe = /^[0-9A-Z]{5}$/i.test(t);
        const libre = el.dataset.buscar === "rep" && !esRpe ? `<div data-libre><b>Usar "${E(t)}"</b><small>No está en la lista: escribe tu nombre completo</small></div>`
          : el.dataset.buscar !== "rep" && op.libreAfectado && !r.length ? `<div data-libre><b>${esRpe ? "Usar el RPE " + E(U.up(t)) : "Usar el nombre \"" + E(t) + "\""}</b><small>${esRpe ? "No lo encontré; escribe después su nombre completo" : "Escribe el nombre completo; S.I. lo verificará"}</small></div>` : "";
        sug.innerHTML = (r.length ? r.map((p, i) => `<div data-i="${i}"><b>${E(p.rpe)}</b> · ${E(p.nombre)}<small>${E(p.area || p.empresa || "")}</small></div>`).join("") : `<div class="vacio-s">Sin coincidencias</div>`) + libre;
        sug.hidden = false;
        sug.querySelectorAll("[data-i]").forEach(d => d.onmousedown = ev => { ev.preventDefault(); elegir(el.dataset.buscar, r[+d.dataset.i]); });
        const dl = sug.querySelector("[data-libre]");
        if (dl) dl.onmousedown = ev => {
          ev.preventDefault();
          if (el.dataset.buscar === "rep") { elegir("rep", { rpe: "", nombre: U.up(t) }); return; }
          const nombre = esRpe ? (prompt("Nombre completo del trabajador con RPE " + U.up(t) + ":") || "").trim() : t;
          if (!nombre) return;
          elegir(el.dataset.buscar, { rpe: esRpe ? U.up(t) : "", nombre: U.up(nombre), area: "", tipo: "CFE" });
        };
      }, 250);
      el.addEventListener("input", q);
      el.addEventListener("blur", () => setTimeout(() => sug.hidden = true, 150));
    }
    function elegir(destino, p) {
      if (destino === "rep") f.reporta = { rpe: p.rpe, nombre: p.nombre };
      else {
        const a = f.afectados[+destino];
        Object.assign(a, { rpe: p.rpe, nombre: p.nombre, area: p.area || "", puesto: p.puesto || "", tipo: p.tipo === "Contratista" ? "Contratista" : "CFE", empresa: p.empresa || "", tieneFoto: !!p.foto, foto: typeof p.foto === "string" ? p.foto : "" });
      }
      pintar();
    }

    async function cargarFotos(el) {
      const files = [...el.files];
      try {
        if (el.dataset.fotoAf !== undefined) {
          const a = f.afectados[+el.dataset.fotoAf];
          a.fotoB64 = await B.ui.leerImagen(files[0], op.maxFotoPersona || 900, op.calidadFoto);
        } else {
          for (const fl of files.slice(0, 12 - f.fotos.length)) f.fotos.push({ nombre: fl.name.replace(/\.[^.]+$/, "") + ".jpg", b64: await B.ui.leerImagen(fl, op.maxFoto || 1600, op.calidadFoto), desc: "" });
          if (files.length + f.fotos.length > 12) aviso("Máximo 12 fotos por reporte.");
        }
      } catch (e) { aviso(e.message || "No se pudo leer la foto."); return; }
      pintar();
    }

    const acciones = {
      lesion(b) { f.evento.hayLesion = b.dataset.v === "si"; pintar(); },
      otroAf() { f.afectados.push(vacioAfectado()); pintar(); },
      quitarAf(b) { f.afectados.splice(+b.dataset.i, 1); pintar(); },
      cambiarAf(b, e) { e.preventDefault(); const a = f.afectados[+b.dataset.i]; Object.assign(a, { rpe: "", nombre: "", area: "", puesto: "", foto: "", fotoB64: "", tieneFoto: false }); pintar(); },
      contratista(b, e) { e.preventDefault(); f.afectados[+b.dataset.i].tipo = "Contratista"; pintar(); },
      cambiarRep(b, e) { e.preventDefault(); f.reporta = { rpe: "", nombre: "" }; pintar(); },
      otroTipo(b) { const n = cuerpo.querySelector(`[data-nuevo="${b.dataset.k}"]`); n.hidden = false; n.querySelector("input").focus(); },
      agregarTipo(b) {
        const n = cuerpo.querySelector(`[data-nuevo="${b.dataset.k}"]`), v = U.cap(n.querySelector("input").value);
        if (!v) return;
        const ex = (cat.tiposLesion || []).find(t => U.norm(t.n) === U.norm(v));
        if (!ex) { cat.tiposLesion = cat.tiposLesion || []; cat.tiposLesion.push({ n: v, eq: "", nuevo: true }); }
        f.afectados[+b.dataset.k].lesion.tipo = ex ? ex.n : v; pintar();
      },
      tg(b) { b.classList.toggle("on"); fijar(b.dataset.r, b.classList.contains("on")); },
      traslado(b) { f.medico.traslado = +b.dataset.v; cuerpo.querySelectorAll('[data-accion="traslado"]').forEach(x => x.classList.toggle("on", x === b)); guardarBorrador(); },
      quitarFoto(b) { f.fotos.splice(+b.dataset.i, 1); pintar(); },
      enviar: enviar
    };
    // chips de seleccion unica (tipo de lesion / parte del cuerpo) y casillas de acciones inmediatas
    cuerpo.addEventListener("click", e => {
      const b = e.target.closest("[data-chips] button[data-v]");
      if (b) { const c = b.closest("[data-chips]"); c.querySelectorAll("button[data-v]").forEach(x => x.classList.toggle("on", x === b)); fijar(c.dataset.chips, b.dataset.v); }
      const t = e.target.closest("[data-tipo-af] button");
      if (t) { const i = +t.closest("[data-tipo-af]").dataset.tipoAf; const a = f.afectados[i]; if (a.tipo !== t.dataset.v) { Object.assign(a, vacioAfectado(), { tipo: t.dataset.v === "Contratista" ? "Contratista" : "CFE" }); pintar(); } }
    });
    cuerpo.addEventListener("change", e => {
      const c = e.target.closest("[data-inm]"); if (!c) return;
      const v = c.dataset.inm; f.inm = f.inm.filter(x => x !== v); if (c.checked) f.inm.push(v); guardarBorrador();
    });

    function payload() {
      const e = f.evento;
      const af = f.afectados.filter(a => a.nombre.trim()).map(a => {
        const x = { tipo: a.tipo, rpe: a.rpe, nombre: U.up(a.nombre), area: a.area, puesto: a.puesto, ocupacion: a.ocupacion, foto: a.foto || "", lesion: e.hayLesion ? a.lesion : { tipo: "", parte: "", lado: "" } };
        if (a.tipo === "Contratista") Object.assign(x, { empresa: a.empresa, contrato: a.contrato, supContrato: a.supContrato });
        if (a.fotoB64) x.fotoB64 = a.fotoB64;
        return x;
      });
      const inm = f.inm.map(a => ({ hora: "", accion: a, quien: "Supervisor de la actividad" }));
      if (f.inmOtra.trim()) inm.push({ hora: "", accion: f.inmOtra.trim(), quien: "" });
      const decl = [];
      if (f.declAfectado.trim() && af.length) decl.push({ quien: "Persona afectada · " + af[0].nombre + (af[0].rpe ? " (" + af[0].rpe + ")" : ""), texto: f.declAfectado.trim(), fecha: e.fecha });
      const datos = {
        evento: { ...e }, afectados: af, reporta: f.reporta, relato: f.relato.trim(), declaraciones: decl, testigos: f.testigos.trim(),
        epp: f.epp.map(x => ({ ...x, adecuado: "" })), eppGuante: f.eppGuante, eppEstado: f.eppEstado,
        medico: { ...f.medico, atencion: "", incapacidad: false, dias: 0, st7: false },
        accionesInm: inm,
        clasif: { tipo: e.hayLesion ? "" : "Cuasi-accidente (sin lesión)", codigo281: e.hayLesion ? (+f.medico.traslado || 0) : 0, calificacion: e.hayLesion ? "" : "" },
        preguntas: { reunion: e.reunion === "Sí" ? "si" : e.reunion === "No" ? "no" : "" }
      };
      return { datos, fotos: f.fotos.map(x => ({ nombre: x.nombre, b64: x.b64, desc: x.desc })) };
    }
    async function enviar(b) {
      if (enviando) return;
      for (const p of visibles()) { const err = p.v ? p.v() : ""; if (err) { paso = visibles().indexOf(p); pintar(); aviso(err); return; } }
      enviando = true; b.disabled = true; b.innerHTML = '<span class="giro chico"></span> Enviando…';
      try {
        const r = await op.enviar(payload());
        try { localStorage.removeItem(clave); } catch (e) { }
        op.alEnviar && op.alEnviar(r);
      } catch (e) { aviso(e.message || "No se pudo enviar."); b.disabled = false; b.innerHTML = B.ico("ok") + " Enviar reporte a Seguridad Industrial"; }
      enviando = false;
    }

    pintar();
    return { datos: () => f, descartar() { try { localStorage.removeItem(clave); } catch (e) { } } };
  }
  // revision de redaccion reutilizable (expediente: relatoria y factores)
  const juicios = txt => JUICIOS.filter(j => j[0].test(txt || "")).map(j => j[1]);
  return { montar, juicios };
})();
