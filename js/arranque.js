/* =========================================================================
   INCIDENCIAS SI - Respaldo de arranque del formulario del supervisor (link local y en linea)
   Escrito en JavaScript antiguo (ES5) a proposito: si el navegador del celular no entiende el resto de
   la pagina o algo falla al cargar, en lugar de quedarse en blanco muestra que paso y que hacer.
   La pagina avisa que ya mostro el formulario (o un mensaje final) con window.INC_LISTO = true.
   ========================================================================= */
(function () {
  var errores = [], mostrado = false;
  function anotar(m) { if (m && errores.length < 3) errores.push(String(m).slice(0, 160)); }
  window.addEventListener("error", function (e) {
    var t = e && e.target;
    if (t && t !== window && (t.src || t.href)) anotar("No cargó " + String(t.src || t.href).split("/").slice(-2).join("/"));
    else anotar(e && e.message);
    if (!window.INC_LISTO) setTimeout(function () { revisar(true); }, 1500);
  }, true);
  window.addEventListener("unhandledrejection", function (e) { anotar(e && e.reason && (e.reason.message || e.reason)); setTimeout(function () { revisar(true); }, 500); });

  function navegador() {
    var u = navigator.userAgent, m;
    if ((m = u.match(/OS (\d+)_(\d+)[^)]*\) AppleWebKit/)) && /iPhone|iPad/.test(u)) return "iPhone con iOS " + m[1] + "." + m[2];
    if ((m = u.match(/SamsungBrowser\/(\d+)/))) return "Samsung Internet " + m[1];
    if ((m = u.match(/(?:Chrome|CriOS)\/(\d+)/))) return "Chrome " + m[1] + (/Android (\d+)/.test(u) ? " · Android " + u.match(/Android (\d+)/)[1] : "");
    if ((m = u.match(/Firefox\/(\d+)/))) return "Firefox " + m[1];
    return u.slice(0, 90);
  }
  // que partes alcanzaron a cargar (ayuda a S.I. a saber si fue la senal o el navegador)
  function partes() {
    var p = [];
    if ("INC_CFG" in window) p.push(window.INC_CFG ? "configuración" : "configuración vacía");
    if ("INC_PADRON" in window) p.push("padrón");
    p.push(window.B && window.B.form ? "formulario" : "formulario NO");
    p.push(window.crypto && window.crypto.subtle ? "cifrado" : "cifrado NO");
    return p.join(", ");
  }
  function revisar(porError) {
    var c = document.querySelector(".cargando"), raiz = document.getElementById("raiz");
    if (window.INC_LISTO || mostrado || !raiz) return;
    if (!porError && !errores.length && document.readyState !== "complete") { setTimeout(function () { revisar(false); }, 8000); return; }
    mostrado = true;
    if (c) c.parentNode.removeChild(c);
    var viejo = !(window.B && window.B.form);
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]; }); };
    raiz.innerHTML = '<div class="frm"><div class="frm-cab"><div class="frm-t1">Reporte inmediato de incidencia</div><div class="frm-t2">Oficina de Seguridad Industrial · CNLV</div></div>' +
      '<div class="frm-final mal"><h2>No se pudo abrir el formulario en este celular</h2><p>' +
      (viejo ? "Lo más probable es que el navegador esté desactualizado. Actualiza <b>Chrome</b> (Play Store) o el <b>sistema del iPhone</b> y vuelve a abrir el link. También puedes abrirlo desde otro celular."
             : "Revisa tu señal o datos móviles y vuelve a abrir el link completo.") +
      '</p><p style="font-size:12px;color:#6B6460;margin-top:14px;text-align:left">Si no se resuelve, manda una captura de esta pantalla a Seguridad Industrial.<br><b>Navegador:</b> ' + esc(navegador()) +
      '<br><b>Cargó:</b> ' + esc(partes()) + (errores.length ? '<br><b>Detalle:</b> ' + esc(errores.join(" | ")) : "") + '</p>' +
      '<button type="button" class="btn" style="margin-top:10px" onclick="location.reload()">Volver a intentar</button></div></div>';
  }
  // si en 20 s la pagina sigue cargando, se muestra el aviso (la carga normal tarda 1 a 5 s)
  setTimeout(function () { revisar(false); }, 20000);
})();
