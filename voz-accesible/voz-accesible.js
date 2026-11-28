/*!
 * Voz Accesible 2.1: control por voz en español, en lenguaje natural, para cualquier página web.
 * Motor tomado de «Organizatones para Preguntones» y «NoteKiebres»
 * (Profr. Eduardo Kantún Martínez, con colaboración de IA). Licencia: úsese y adáptese libremente citando la fuente.
 *
 * Un solo archivo, sin dependencias. Usa el reconocimiento de voz del navegador (Chrome o Edge; necesita internet
 * y permiso para el micrófono). Funciona con una etiqueta script (src="voz-accesible.js"), pegado dentro de la página o como módulo (CommonJS/AMD).
 *
 * Novedades v2.1 (auditoría del 28/11/2026):
 *   - No obedece lo que la propia página dice en voz alta (eco del lector), ni frases que Android entrega repetidas.
 *   - «marca» y «desmarca» respetan cómo está la casilla; «aceptar» y «cancelar» en ventanas ya no tocan otros botones.
 *   - Listas desplegables se nombran por su etiqueta, no por sus opciones; sin duplicados (etiqueta + control, tarjeta + botón).
 *   - Dictado visible en el campo mientras se habla, con puntuación dentro de la frase, mayúsculas y «punto final».
 *   - Confirmaciones que caducan (15 s) y no actúan sobre botones que ya desaparecieron; «recarga» también pide confirmar.
 *   - «ve al inicio» y «regresa» no sacan de la aplicación; «navegar» solo acepta direcciones del mismo sitio.
 *   - Opciones nuevas: posicion y tamano del micrófono, recordar (vuelve a encender al abrir), alCambiar,
 *     mascara (oculta en pantalla lo dicho, p. ej. una clave) y sinConfirmar (botones que ya son una confirmación).
 *   - El micrófono y su barra reaparecen solos si la aplicación reescribe la página entera.
 *   - pausar() y reanudar(): ceden el micrófono a otro dictado de la aplicación sin olvidar que estaba encendido.
 *
 * Novedades v2.0:
 *   - Dictado ampliado (8 s por defecto, configurable) con puntuación hablada («coma», «punto», «nueva línea»),
 *     corrección («borra la última palabra») y cierre sin falsos positivos («terminar dictado», «listo ya»).
 *   - Desambiguación visual: muestra etiquetas numeradas [1], [2]... cuando hay varios botones con el mismo nombre.
 *   - Soporte para Shadow DOM abierto, controles personalizados con tabindex/onclick y selección en <select>.
 *   - Encadenamiento inteligente con «y luego» (espera a que el DOM termine de actualizarse con MutationObserver).
 *   - Confirmación por voz para acciones críticas/destructivas (ej. eliminar, borrar cuenta) y lematización mejorada.
 *   - Retardo anti-pitidos en reinicio móvil y prevención de colisión con lectores de pantalla externos.
 *
 * API global: window.VozAccesible
 *   VozAccesible.iniciar(opciones)       crea el botón y prepara todo (llámalo una vez)
 *   VozAccesible.encender() / apagar()   prende o apaga el micrófono
 *   VozAccesible.oir(texto)              procesa un texto como si se hubiera dicho (sirve para probar o para chat escrito)
 *   VozAccesible.ejecutar(accion)        ejecuta una acción estructurada {accion:'clic', objetivo:'Guardar', indice:1}
 *   VozAccesible.describirPantalla()     lista de controles y campos visibles (contexto para una IA)
 *   VozAccesible.agregarComando(cmd)     agrega un comando {nombre, patron, hacer, ejemplos}
 *   VozAccesible.ayuda()                 muestra la ventana de ayuda
 *   VozAccesible.aviso(texto)            muestra un aviso breve
 */
(function (raiz, fabrica) {
  if (typeof define === 'function' && define.amd) define([], fabrica);
  else if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.VozAccesible = fabrica();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ opciones */
  var OPC = {
    idioma: 'es-MX',
    boton: true,                  // muestra el micrófono flotante
    color: '#12A3A8',             // color del micrófono apagado
    colorActivo: '#C62828',       // color con el micrófono encendido
    inicio: null,                 // dirección para «ve al inicio» (por omisión, la carpeta de la aplicación)
    posicion: 'abajo-derecha',    // dónde va el micrófono: abajo-derecha, abajo-izquierda, arriba-derecha, arriba-izquierda
    tamano: 'normal',             // normal o grande (útil en pantallas dañadas o para motricidad fina)
    recordar: null,               // clave de localStorage: si se da, recuerda si el micrófono quedó encendido y lo vuelve a encender al abrir
    alCambiar: null,              // function(encendido) cada vez que se prende o se apaga
    mascara: null,                // function(texto) -> texto que se muestra en pantalla (para no mostrar claves dichas en voz alta)
    sinConfirmar: null,           // selector de botones que ya son el paso de confirmación de la aplicación (no se vuelve a preguntar)
    zona: null,                   // función que devuelve el elemento donde buscar controles
    excluir: '[data-voz-ignorar]',// controles que la voz no debe tocar
    umbral: 0.5,                  // qué tan parecido debe ser un nombre para tocarlo (0 a 1)
    leerRespuestas: false,        // si true, también dice en voz alta los avisos (evita solaparse con lectores externos)
    tiempoDictado: 8500,          // ms de pausa antes de cerrar el dictado automáticamente
    retardoReinicio: 220,         // ms de pausa al reiniciar escucha continua (reduce pitidos en Android)
    confirmarPeligrosos: true,    // pide confirmación por voz antes de tocar botones destructivos
    patronPeligroso: /\b(eliminar|elimina|borrar|borra|suprimir|destruir|vaciar|restablecer|reemplazar todo|descartar|formatear|cancelar cuenta|cerrar sesion|salir sin guardar|pagar|transferir|revocar)\b/,
    ia: null,                     // async function(texto, contexto) -> acción | [acciones] | null
    alNoEntender: null,           // function(texto) cuando nada lo entendió
    alOir: null,                  // function(texto) cada vez que oye una frase final
    textos: {
      escucho: 'Te escucho',
      pista: 'Di una orden. Di «ayuda» para ver ejemplos.',
      dictando: 'Dictando en',
      pistaDictado: 'Habla con calma. Di «terminar dictado» o «listo ya» al acabar.',
      ayuda: 'Ayuda', apagar: 'Apagar', listo: 'Listo', entendido: 'Entendido',
      noEntendi: 'No entendí «{t}». Di «ayuda» para ver ejemplos.',
      sinNavegador: 'El micrófono necesita Google Chrome o Microsoft Edge, con internet.',
      sinPermiso: 'Permite el micrófono en el navegador (el ícono junto a la dirección) y vuelve a tocar el micrófono.',
      sinRed: 'El reconocimiento de voz necesita internet.',
      sinMicrofono: 'No encuentro un micrófono en este aparato.'
    }
  };

  var VZ = {
    on: false, rec: null, modo: 'orden', dest: null, destN: '', txt: '', ult: '', tm: 0,
    candidatos: null, pendiente: null, hablando: false, finAt: 0, ultFin: '', ultFinAt: 0, base: '', iniciado: false
  };
  var COMANDOS = [];       // comandos del usuario (se revisan primero)
  var AYUDA_EXTRA = [];    // grupos de ayuda agregados por el usuario
  var SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  var $ = function (s, z) { return (z || document).querySelector(s); };

  /* ------------------------------------------------------------------ texto y lematización */
  function nrm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[¿?¡!.,;:«»"()]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var NUMS = {
    uno: 1, una: 1, primero: 1, primera: 1, primer: 1,
    dos: 2, segundo: 2, segunda: 2,
    tres: 3, tercero: 3, tercera: 3, tercer: 3,
    cuatro: 4, cuarto: 4, cuarta: 4,
    cinco: 5, quinto: 5, quinta: 5,
    seis: 6, sexto: 6, sexta: 6,
    siete: 7, septimo: 7, septima: 7,
    ocho: 8, octavo: 8, octava: 8,
    nueve: 9, noveno: 9, novena: 9,
    diez: 10, decimo: 10, decima: 10
  };
  var VACIAS = {};
  'el la los las lo un una unos unas de del al en a y con para por mi tu su sus'.split(' ').forEach(function (w) { VACIAS[w] = 1; });

  // Palabras singulares terminadas en -s que no deben recortarse en canon()
  var SINGULARES_S = {
    lunes: 1, martes: 1, miercoles: 1, jueves: 1, viernes: 1,
    crisis: 1, analisis: 1, tesis: 1, sintesis: 1, dosis: 1, hipotesis: 1, enfasis: 1,
    pais: 1, mes: 1, gas: 1, tos: 1, bus: 1, virus: 1, campus: 1, atlas: 1, gratis: 1, lejos: 1, cerca: 1, atras: 1, despues: 1, antes: 1
  };

  /* quita cortesía y rodeos: «¿me puedes abrir ajustes, por favor?» -> «abrir ajustes» */
  function limpia(s) {
    s = nrm(s);
    var prev;
    do {
      prev = s;
      s = s.replace(/\b(por favor|porfa|porfavor|please)\b/g, ' ').replace(/\s+/g, ' ').trim()
        .replace(/^(oye|oiga|ey|hey|bueno|a ver|ahora|ok|okay|vale|este|mmm|eh|entonces|y)\s+/, '')
        .replace(/^(me )?(puedes|podrias|podria|pudieras|quieres|quisieras|puede|podrian)\s+(me\s+)?/, '')
        .replace(/^(quiero|quisiera|necesito|me gustaria|deseo)( que)?\s+/, '')
        .replace(/^(ayudame a|ayudame)\s+/, '');
    } while (s !== prev);
    return s;
  }

  /* palabras comparables: sin relleno, números en cifra, plurales cuidadosos */
  function canon(t) {
    var T = nrm(String(t || '').replace(/[º°ª]/g, ' ')).split(' ').filter(Boolean).map(function (w) {
      var m = w.match(/^(\d+)(?:er|ro|do|to|vo|no|mo|o)?$/);
      if (m) return String(+m[1]);
      if (w !== 'un' && w !== 'una' && NUMS[w]) return String(NUMS[w]);
      if (SINGULARES_S[w]) return w;
      if (w.length > 5 && /es$/.test(w) && /[lnrdrz]es$/.test(w)) return w.slice(0, -2); // botones -> boton, opciones -> opcion
      if (w.length > 4 && w.charAt(w.length - 1) === 's' && !/[isus]s$/.test(w)) return w.slice(0, -1);
      return w;
    });
    return T.filter(function (w) { return !VACIAS[w]; });
  }

  /* parecido entre lo dicho (q) y el nombre de un control (L), de 0 a 1.5 */
  function parecido(q, L) {
    if (!q.length || !L.length) return 0;
    var dq = q.filter(function (w) { return /^\d+$/.test(w); }), dl = L.filter(function (w) { return /^\d+$/.test(w); });
    if (dq.some(function (d) { return dl.indexOf(d) < 0; })) return 0;
    var ok = function (w) {
      return L.indexOf(w) >= 0 || (w.length > 4 && L.some(function (c) {
        return c.length > 4 && (c.indexOf(w.slice(0, 5)) === 0 || w.indexOf(c.slice(0, 5)) === 0);
      }));
    };
    var p = q.filter(ok).length / q.length, c = L.filter(function (w) { return q.indexOf(w) >= 0; }).length / L.length;
    return p < 0.6 ? 0 : p * 0.7 + c * 0.3 + (p === 1 && c === 1 ? 0.5 : 0);
  }

  var VERBOS = /^(?:(?:ver|verlo|abre|abrir|abra|abreme|cierra|cerrar|oculta|ocultar|ve a|ve al|ir a|ir al|vamos a|vamos al|entra a|entra al|entrar a|muestra|muestrame|ensename|selecciona|seleccionar|elige|elegir|escoge|toca|tocar|presiona|presionar|pulsa|oprime|aprieta|da clic en|dale clic a|dale clic en|haz clic en|clic en|click en|click|activa|activar|desactiva|desactivar|marca|marcar|desmarca|desmarcar|palomea|despalomea|el boton|boton|la opcion|opcion|la pestana|pestana|el enlace|enlace|la liga|liga)\s+)+/;

  /* ------------------------------------------------------------------ recorrido DOM + Shadow DOM */
  function consultarProfundo(raiz, selector) {
    var res = [];
    if (!raiz || !raiz.querySelectorAll) return res;
    res = [].slice.call(raiz.querySelectorAll(selector));
    var todos = raiz.querySelectorAll('*');
    for (var i = 0; i < todos.length; i++) {
      if (todos[i].shadowRoot) {
        res = res.concat(consultarProfundo(todos[i].shadowRoot, selector));
      }
    }
    return res;
  }

  function visible(e) {
    if (!e) return false;
    if (e.checkVisibility && !e.getRootNode().host) {
      if (!e.checkVisibility({ checkVisibilityCSS: true })) return false;
      if (e.closest('[hidden],[aria-hidden="true"]')) return false;
      var rr = e.getBoundingClientRect(); return rr.width > 0 && rr.height > 0;
    }
    var cur = e;
    while (cur && cur.nodeType === 1) {
      if (cur.hasAttribute('hidden') || cur.getAttribute('aria-hidden') === 'true') return false;
      var st = getComputedStyle(cur);
      if (st.display === 'none' || st.visibility === 'hidden') return false;
      cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host);
    }
    var r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function zona() {
    if (typeof OPC.zona === 'function') { var z = OPC.zona(); if (z) return z; }
    var dlg = consultarProfundo(document, 'dialog[open],[role="dialog"],[aria-modal="true"]').filter(visible).pop();
    return dlg || document;
  }

  function etiquetaDe(el) {
    if (!el.id) return null;
    var id = window.CSS && CSS.escape ? CSS.escape(el.id) : el.id;
    var root = el.getRootNode ? el.getRootNode() : document;
    return (root.querySelector && root.querySelector('label[for="' + id + '"]')) || document.querySelector('label[for="' + id + '"]');
  }
  function nombreDe(el) {
    var lab = etiquetaDe(el);
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    var lb = el.getAttribute('aria-labelledby'), lbe = lb && document.getElementById(lb.split(' ')[0]);
    if (lbe) return lbe.textContent;
    if (el.tagName === 'SELECT' || (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type))) {
      var env = el.closest && el.closest('label');
      return (lab && lab.textContent) || (env && env.textContent) || el.title || el.name || '';
    }
    return (lab && lab.textContent) || el.title || el.textContent || el.value || el.placeholder || el.name || '';
  }

  var SEL_CONTROLES = 'a[href],button,summary,[role="button"],[role="tab"],[role="link"],[role="menuitem"],[role="checkbox"],[role="switch"],input[type="checkbox"],input[type="radio"],input[type="submit"],input[type="button"],select,label,[tabindex="0"],[onclick]';
  var SEL_CAMPOS = 'input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="number"],input[type="tel"],input[type="url"],input[type="date"],textarea,[contenteditable="true"]';

  function controles() {
    return consultarProfundo(zona(), SEL_CONTROLES).filter(function (e) {
      if (e.disabled || !visible(e)) return false;
      if (e.closest && e.closest('#va-mic,#va-barra,#va-ayuda,#va-badges,' + OPC.excluir)) return false;
      // Evitar contenedores genéricos con tabindex="0" si no tienen nombre accesible claro
      if ((e.hasAttribute('tabindex') || e.hasAttribute('onclick')) && !/^(A|BUTTON|SUMMARY|INPUT|SELECT|LABEL)$/.test(e.tagName) && !e.getAttribute('role')) {
        var nm = nombreDe(e).trim();
        if (!nm || nm.length > 60) return false;
      }
      return true;
    });
  }

  function campos() {
    return consultarProfundo(zona(), SEL_CAMPOS).filter(function (e) {
      return !e.disabled && !e.readOnly && visible(e) && !(e.closest && e.closest('#va-mic,#va-barra,#va-ayuda,' + OPC.excluir));
    });
  }

  function nombreCampo(el) {
    var root = el.getRootNode ? el.getRootNode() : document;
    var lab = el.id && root.querySelector && root.querySelector('label[for="' + el.id + '"]');
    if (!lab && el.id) lab = document.querySelector('label[for="' + el.id + '"]');
    var envuelto = el.closest && el.closest('label');
    var prev = el.previousElementSibling;
    return [el.getAttribute('aria-label'), lab && lab.textContent, envuelto && envuelto.textContent, el.placeholder, el.name, el.title,
      prev && /LABEL|P|B|SPAN|H\d/.test(prev.tagName) ? prev.textContent : ''].filter(Boolean)
      .map(function (x) { return x.trim(); }).filter(function (x, i, L) { return x && L.map(nrm).indexOf(nrm(x)) === i; }).join(' · ');
  }

  function coincidenciaControles(q, min) {
    var Q = canon(q);
    if (!Q.length) return [];
    var umbral = min == null ? OPC.umbral : min;
    var scored = [];
    controles().forEach(function (el) {
      var sc = parecido(Q, canon(nombreDe(el)));
      if (sc >= umbral) scored.push({ el: el, sc: sc });
    });
    scored.sort(function (a, b) { return b.sc - a.sc; });
    if (!scored.length) return [];
    // Mantener todos los empatados o muy cercanos al mejor puntaje
    var top = scored[0].sc;
    var L = sinDuplicados(scored.filter(function (x) { return x.sc >= top - 0.05; }).map(function (x) { return x.el; }));
    // si uno se llama exactamente como se dijo («Escuelas» frente a la lista «Escuela»), ese gana
    if (L.length > 1) {
      var qn = nrm(q), ex = L.filter(function (el) { return nrm(nombreDe(el)) === qn; });
      if (ex.length === 1) return ex;
      // y dos enlaces que llevan al mismo lugar son un solo destino
      var h0 = L[0].tagName === 'A' && L[0].href;
      if (h0 && L.every(function (el) { return el.tagName === 'A' && el.href === h0; })) return [L[0]];
    }
    return L;
  }
  /* una etiqueta y su control, o una tarjeta y el botón que contiene, son un solo objetivo: se queda el control */
  function sinDuplicados(L) {
    return L.filter(function (el) {
      if (el.tagName === 'LABEL') {
        var c = el.control || (el.querySelector && el.querySelector('input,select,textarea'));
        if (c && L.indexOf(c) >= 0) return false;
        if (c && c.tagName === 'SELECT') return false;
      }
      return !L.some(function (o) { return o !== el && el.contains(o) && !(el.tagName === 'LABEL'); });
    });
  }

  function mejor(lista, q, nombre, min) {
    var Q = canon(q); if (!Q.length) return null;
    var best = null, bs = 0;
    lista.forEach(function (el) { var sc = parecido(Q, canon(nombre(el))); if (sc > bs) { bs = sc; best = el; } });
    return bs >= (min == null ? OPC.umbral : min) ? best : null;
  }

  function controlPor(q, min, indice) {
    var lista = coincidenciaControles(q, min);
    if (!lista.length) return null;
    if (indice && indice >= 1 && indice <= lista.length) return lista[indice - 1];
    return lista[0];
  }
  function campoPor(q, min) { return mejor(campos(), q, nombreCampo, min); }

  /* ------------------------------------------------------------------ desambiguación visual */
  function limpiarBadges() {
    var cont = $('#va-badges');
    if (cont) cont.remove();
    VZ.candidatos = null;
  }
  function ubicarBadges() {
    var cont = $('#va-badges'); if (!cont || !VZ.candidatos) return;
    [].forEach.call(cont.children, function (b, i) {
      var el = VZ.candidatos[i]; if (!el) return;
      var r = el.getBoundingClientRect(), fuera = r.bottom < 0 || r.top > innerHeight;
      b.style.display = fuera ? 'none' : '';
      b.style.left = Math.max(4, r.left - 6) + 'px'; b.style.top = Math.max(4, r.top - 10) + 'px';
    });
  }

  function mostrarBadges(lista, nombreEtiqueta) {
    limpiarBadges();
    VZ.candidatos = lista;
    var cont = document.createElement('div');
    cont.id = 'va-badges';
    lista.forEach(function (el, idx) {
      var b = document.createElement('span');
      b.className = 'va-badge';
      b.textContent = String(idx + 1);
      cont.appendChild(b);
    });
    document.body.appendChild(cont);
    if (lista[0] && lista[0].scrollIntoView) lista[0].scrollIntoView({ block: 'nearest' });
    ubicarBadges();
    aviso('Hay ' + lista.length + ' opciones para «' + nombreEtiqueta + '». Di «el uno», «el dos»…', 4500);
  }

  function seleccionarEnSelect(sel, valorBuscado) {
    var Q = canon(valorBuscado);
    var opts = [].slice.call(sel.options || []);
    var elegido = null, bestSc = 0;
    // Primero intentar por índice numérico si dijeron «la segunda»
    var mNum = nrm(valorBuscado).match(/^(?:la |el )?(?:opcion )?(primera|segunda|tercera|cuarta|quinta|sexta|septima|octava|novena|decima|\d+)$/);
    if (mNum) {
      var k = NUMS[mNum[1]] || +mNum[1];
      if (k >= 1 && k <= opts.length) elegido = opts[k - 1];
    }
    if (!elegido && Q.length) {
      opts.forEach(function (o) {
        var sc = parecido(Q, canon(o.textContent || o.value));
        if (sc > bestSc) { bestSc = sc; elegido = o; }
      });
    }
    if (elegido) {
      sel.value = elegido.value;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return elegido.textContent.trim();
    }
    return null;
  }

  function casillaDe(el) {
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type)) return el;
    if (el.getAttribute('role') === 'checkbox' || el.getAttribute('role') === 'switch') return el;
    if (el.tagName === 'LABEL') { var c = el.control || el.querySelector('input'); if (c && /^(checkbox|radio)$/.test(c.type)) return c; }
    return null;
  }
  function marcada(c) { return c.tagName === 'INPUT' ? c.checked : c.getAttribute('aria-checked') === 'true'; }
  function ejecutarClicSeguro(el, s, saltandoConfirmacion) {
    var nombre = nombreDe(el).trim().replace(/\s+/g, ' ').slice(0, 50);
    var yaEsConfirmacion = OPC.sinConfirmar && el.closest && el.closest(OPC.sinConfirmar);
    if (!saltandoConfirmacion && !yaEsConfirmacion && OPC.confirmarPeligrosos && OPC.patronPeligroso.test(nrm(nombre))) {
      VZ.pendiente = { el: el, s: s, nombre: nombre, hasta: Date.now() + 15000 };
      aviso('¿Seguro que deseas activar «' + nombre + '»? Di «sí, confirmar» o «cancelar».', 6000);
      return;
    }
    var cas = casillaDe(el);
    if (cas && /^(marca|marcar|activa|activar|prende|enciende|palomea)\b/.test(s) && marcada(cas)) { aviso('«' + nombre + '» ya está marcada.', 1600); return; }
    if (cas && /^(desmarca|desmarcar|desactiva|desactivar|apaga|quita la marca|despalomea)\b/.test(s)) {
      if (!marcada(cas)) { aviso('«' + nombre + '» ya está sin marcar.', 1600); return; }
    }
    var d = el.tagName === 'SUMMARY' && el.parentNode;
    if (d && /^(abre|abrir|abra|muestra|ver)\b/.test(s)) { d.open = true; return; }
    if (d && /^(cierra|cerrar|oculta|ocultar)\b/.test(s)) { d.open = false; return; }
    if (el.tagName === 'SELECT' || (el.tagName === 'LABEL' && !el.control)) { el.focus(); return; }
    el.scrollIntoView && el.scrollIntoView({ block: 'nearest' });
    el.click();
    if (nombre) aviso('Toqué: ' + nombre, 1400);
  }

  function describirPantalla() {
    var conteo = {};
    var listaControles = controles().slice(0, 150).map(function (e) {
      var nm = nombreDe(e).trim().replace(/\s+/g, ' ').slice(0, 80);
      var key = nrm(nm);
      conteo[key] = (conteo[key] || 0) + 1;
      return {
        nombre: nm,
        tipo: e.getAttribute('role') || e.tagName.toLowerCase(),
        indice: conteo[key],
        opciones: e.tagName === 'SELECT' ? [].slice.call(e.options).map(function (o) { return o.textContent.trim(); }).slice(0, 20) : undefined
      };
    });
    return {
      titulo: document.title,
      direccion: location.href,
      controles: listaControles,
      campos: campos().slice(0, 60).map(function (e) {
        return { nombre: nombreCampo(e).trim().replace(/\s+/g, ' ').slice(0, 80), valor: (e.value || e.textContent || '').slice(0, 80) };
      }),
      ventanaAbierta: zona() !== document
    };
  }

  /* ------------------------------------------------------------------ interfaz */
  var CSS_VA = '' +
    '#va-mic{position:fixed;right:12px;bottom:12px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;color:#fff;background:var(--va-c);box-shadow:0 4px 12px rgba(0,0,0,.3)}' +
    '#va-mic:focus-visible{outline:3px solid #FFC107;outline-offset:3px}' +
    '#va-mic.on{background:var(--va-on);animation:va-pulso 1.4s infinite}' +
    '@keyframes va-pulso{50%{box-shadow:0 0 0 8px rgba(198,40,40,.25)}}' +
    '#va-barra{position:fixed;left:8px;bottom:12px;right:80px;max-width:620px;z-index:2147482999;display:flex;align-items:center;gap:10px;background:#fff;color:#151515;border:3px solid var(--va-on);border-radius:16px;padding:6px 10px;box-shadow:0 4px 0 rgba(0,0,0,.15);font:16px/1.3 system-ui,Arial,sans-serif}' +
    '#va-barra[hidden]{display:none}' +
    '#va-barra small{color:#555;font-size:13px}' +
    '#va-barra .va-t{flex:1;min-width:0;font-style:italic;color:#1565C0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#va-barra .va-p{width:14px;height:14px;border-radius:50%;background:var(--va-on);flex:none;animation:va-pulso 1.4s infinite}' +
    '#va-barra button{font:inherit;font-size:15px;border:2px solid #151515;background:#fff;color:#151515;border-radius:10px;padding:4px 10px;cursor:pointer;min-height:36px}' +
    '#va-barra button.va-rojo{border-color:var(--va-on);color:var(--va-on)}' +
    '#va-aviso{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:2147483001;background:#151515;color:#fff;border-radius:12px;padding:9px 14px;font:bold 15px system-ui,Arial,sans-serif;max-width:min(560px,90vw);text-align:center;opacity:0;transition:opacity .2s;pointer-events:none}' +
    '#va-aviso.ver{opacity:1}' +
    '#va-badges{position:fixed;inset:0;pointer-events:none;z-index:2147483003}' +
    '#va-badges .va-badge{position:fixed;background:#FFC107;color:#151515;border:2px solid #151515;border-radius:8px;padding:1px 6px;font:bold 13px/1.2 system-ui,Arial,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.35)}' +
    '#va-ayuda{position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:10px 10px 76px}' +
    '#va-ayuda[hidden]{display:none}' +
    '#va-ayuda .va-dlg{background:#fff;color:#151515;border-radius:16px;border:4px solid var(--va-c);width:min(680px,100%);max-height:100%;overflow:auto;padding:16px 18px 0;font:16px/1.5 system-ui,Arial,sans-serif}' +
    '#va-ayuda h2{margin:0 0 8px;font-size:22px}' +
    '#va-ayuda ul{padding-left:20px}' +
    '#va-ayuda .va-acts{position:sticky;bottom:0;background:#fff;display:flex;justify-content:flex-end;padding:10px 0 14px;border-top:1px solid #ddd}' +
    '#va-ayuda .va-acts button{font:bold 16px system-ui,Arial,sans-serif;background:var(--va-c);color:#fff;border:0;border-radius:10px;padding:10px 18px;cursor:pointer}' +
    '@media (max-width:700px){#va-mic{width:48px;height:48px;right:8px;bottom:8px}#va-barra{left:6px;right:62px;bottom:8px;gap:6px;padding:4px 6px;border-width:2px;flex-wrap:nowrap}' +
    '#va-barra small{display:none}#va-barra .va-n{font-size:14px;white-space:nowrap}#va-barra button{font-size:14px;min-height:32px;padding:2px 8px}#va-aviso{bottom:64px}#va-ayuda .va-dlg{font-size:15px;padding:12px 14px 0}' +
    '#va-mic.va-izq{left:8px}#va-barra.va-izq{left:62px;right:6px}#va-barra.va-g{left:6px;right:6px;bottom:92px}#va-mic.va-g{width:72px;height:72px}#va-barra.va-arr{top:8px;bottom:auto}#va-barra.va-arr.va-g{top:88px;bottom:auto}#va-aviso.va-arr{top:64px;bottom:auto}}' +
    '#va-mic.va-izq{right:auto;left:12px}#va-mic.va-arr{bottom:auto;top:12px}#va-mic.va-g{width:76px;height:76px}#va-mic.va-g svg{width:36px;height:36px}' +
    '#va-barra.va-arr{bottom:auto;top:12px}#va-barra.va-arr.va-g{top:96px;bottom:auto}#va-aviso.va-arr{bottom:auto;top:84px}' +
    '#va-barra.va-izq{left:80px;right:8px}#va-barra.va-g{left:8px;right:8px;bottom:96px}#va-barra.va-izq.va-g{left:8px;right:8px}' +
    '@media print{#va-mic,#va-barra,#va-aviso,#va-ayuda,#va-badges{display:none!important}}' +
    '@media (prefers-color-scheme:dark){#va-barra,#va-ayuda .va-dlg,#va-ayuda .va-acts{background:#16213F;color:#E6EBF7}#va-barra button{background:#16213F;color:#E6EBF7;border-color:#E6EBF7}#va-barra small{color:#B8C2DA}}';
  var ICONO = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/></svg>';

  function enmascara(t) { if (typeof OPC.mascara !== 'function') return t; try { return OPC.mascara(String(t)); } catch (e) { return t; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function crearInterfaz() {
    if (!$('#va-estilo')) {
      var st = document.createElement('style'); st.id = 'va-estilo'; st.textContent = CSS_VA; document.head.appendChild(st);
    }
    document.documentElement.style.setProperty('--va-c', OPC.color);
    document.documentElement.style.setProperty('--va-on', OPC.colorActivo);
    if (OPC.boton && !$('#va-mic')) {
      var b = document.createElement('button'); b.id = 'va-mic'; b.type = 'button';
      b.setAttribute('aria-label', 'Micrófono: órdenes de voz y dictado'); b.title = 'Micrófono: órdenes de voz y dictado';
      b.setAttribute('aria-pressed', 'false'); b.innerHTML = ICONO; b.addEventListener('click', alternar);
      document.body.appendChild(b);
    }
    if (!$('#va-barra')) {
      var br = document.createElement('div'); br.id = 'va-barra'; br.setAttribute('role', 'status'); br.hidden = true;
      br.addEventListener('click', function (e) {
        var a = e.target.closest('[data-va]'); if (!a) return;
        if (a.dataset.va === 'ayuda') ayuda(); else if (a.dataset.va === 'apagar') apagar(); else if (a.dataset.va === 'listo') finDictado();
      });
      document.body.appendChild(br);
    }
    if (!$('#va-aviso')) { var av = document.createElement('div'); av.id = 'va-aviso'; av.setAttribute('aria-live', 'polite'); document.body.appendChild(av); }
    ubicarMic();
  }
  function ubicarMic() {
    var m = $('#va-mic'), br = $('#va-barra'), pos = String(OPC.posicion || ''), g = OPC.tamano === 'grande';
    [m, br].forEach(function (x) {
      if (!x) return;
      x.classList.toggle('va-izq', /izquierda/.test(pos));
      x.classList.toggle('va-g', g);
    });
    if (m) m.classList.toggle('va-arr', /arriba/.test(pos));
    if (br) br.classList.toggle('va-arr', /arriba/.test(pos));
    var av = $('#va-aviso'); if (av) av.classList.toggle('va-arr', /arriba/.test(pos));
  }
  function barra() {
    var b = $('#va-barra'), m = $('#va-mic'); if (!b) return;
    if (m) { m.classList.toggle('on', VZ.on); m.setAttribute('aria-pressed', VZ.on ? 'true' : 'false'); }
    b.hidden = !VZ.on; if (!VZ.on) return;
    var T = OPC.textos;
    b.innerHTML = VZ.modo === 'dictado'
      ? '<span class="va-p"></span><span class="va-n"><b>' + esc(T.dictando) + ': ' + esc(VZ.destN) + '</b><br><small>' + esc(T.pistaDictado) + '</small></span><span class="va-t">' + esc(VZ.txt) + '</span><button type="button" data-va="listo">' + esc(T.listo) + '</button>'
      : '<span class="va-p"></span><span class="va-n"><b>' + esc(T.escucho) + '</b><br><small>' + esc(T.pista) + '</small></span><span class="va-t">' + esc(enmascara(VZ.txt)) + '</span><button type="button" data-va="ayuda">' + esc(T.ayuda) + '</button><button type="button" class="va-rojo" data-va="apagar">' + esc(T.apagar) + '</button>';
  }
  var avisoT = 0;
  function aviso(t, ms) {
    var a = $('#va-aviso'); if (!a) return; a.textContent = t; a.classList.add('ver');
    clearTimeout(avisoT); avisoT = setTimeout(function () { a.classList.remove('ver'); }, ms || 2600);
    // Evita pisar lectores de pantalla externos salvo que leerRespuestas esté explícitamente activo
    if (OPC.leerRespuestas && !(window.speechSynthesis && speechSynthesis.speaking)) decir(t);
  }
  /* lee en trozos (Chrome corta los textos largos) y marca que la página habla, para no obedecer su propio eco */
  function decir(t) {
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      var trozos = String(t || '').replace(/\s+/g, ' ').match(/[^.!?¿¡\n]{1,220}[.!?]?|.{1,220}/g) || [];
      var voz = (speechSynthesis.getVoices() || []).filter(function (v) { return /^es(-|_|$)/i.test(v.lang); })
        .sort(function (a, b) { return (b.lang === OPC.idioma) - (a.lang === OPC.idioma); })[0];
      trozos.forEach(function (x, i) {
        if (!x.trim()) return;
        var u = new SpeechSynthesisUtterance(x.trim());
        u.lang = OPC.idioma; if (voz) u.voice = voz;
        u.onstart = function () { VZ.hablando = true; };
        u.onend = u.onerror = function () { if (i === trozos.length - 1 || !speechSynthesis.pending) { VZ.hablando = false; VZ.finHabla = Date.now(); } };
        speechSynthesis.speak(u);
      });
    } catch (e) {}
  }
  function hablandoAhora() {
    return VZ.hablando || (window.speechSynthesis && speechSynthesis.speaking) || Date.now() - (VZ.finHabla || 0) < 700;
  }

  /* ------------------------------------------------------------------ ayuda */
  var AYUDA_BASE = [
    ['Tocar cualquier botón por su nombre', ['toca guardar', 'abre Ajustes', 'elige México en país', 'marca acepto']],
    ['Cuando hay varios botones iguales', ['toca eliminar', 'el dos']],
    ['Escribir', ['escribe Juan Pérez en nombre', 'pon 25 en edad', 'borra el campo correo']],
    ['Dictado largo con puntuación y corrección', ['escribe en comentarios', 'coma', 'punto', 'nueva línea', 'borra la última palabra', 'terminar dictado']],
    ['Desplazar la pantalla', ['baja la pantalla', 'sube la pantalla', 'scroll down', 'scroll up', 'baja un poco', 'hasta abajo', 'hasta arriba']],
    ['Moverte', ['regresa', 've al inicio', 'adelante', 'recarga la página']],
    ['Ventanas y confirmaciones', ['entendido', 'cerrar', 'sí confirmar', 'cancelar']],
    ['Leer en voz alta', ['lee la pantalla', 'lee esto', 'calla']],
    ['Control', ['otra vez', 'apaga el micrófono', 'ayuda']]
  ];
  function ayuda() {
    var cont = $('#va-ayuda');
    if (!cont) {
      cont = document.createElement('div'); cont.id = 'va-ayuda'; cont.hidden = true;
      cont.addEventListener('click', function (e) { if (e.target === cont || e.target.closest('[data-va="cerrar"]')) cerrarAyuda(); });
      document.body.appendChild(cont);
    }
    var grupos = AYUDA_EXTRA.concat(AYUDA_BASE);
    COMANDOS.forEach(function (c) { if (c.ejemplos && c.ejemplos.length && !c.enAyuda) grupos.unshift([c.nombre || 'Comando', c.ejemplos]); });
    cont.innerHTML = '<div class="va-dlg" role="dialog" aria-modal="true" aria-labelledby="va-ay-t"><h2 id="va-ay-t">Órdenes de voz</h2>' +
      '<p>Toca el micrófono y habla como le hablarías a una persona. Puedes decir «por favor» y encadenar órdenes con «y luego».</p><ul>' +
      grupos.map(function (g) { return '<li><b>' + esc(g[0]) + ':</b> ' + g[1].map(function (x) { return '«' + esc(x) + '»'; }).join(', ') + '.</li>'; }).join('') +
      '</ul><p style="font-size:14px">Usa el reconocimiento de voz del navegador (Chrome o Edge): necesita internet y permiso para el micrófono.</p>' +
      '<div class="va-acts"><button type="button" data-va="cerrar">' + esc(OPC.textos.entendido) + '</button></div></div>';
    cont.hidden = false;
    var bt = cont.querySelector('[data-va="cerrar"]'); if (bt) bt.focus();
  }
  function cerrarAyuda() { var c = $('#va-ayuda'); if (c && !c.hidden) { c.hidden = true; return true; } return false; }

  /* ------------------------------------------------------------------ micrófono */
  var reinicioT = 0;
  function encender() {
    if (VZ.on) return;
    if (!SR) { aviso(OPC.textos.sinNavegador, 4500); return; }
    var r = nuevoRec(); if (!r) { aviso('No se pudo encender el micrófono.'); return; }
    VZ.rec = r; VZ.on = true; VZ.modo = 'orden'; VZ.txt = '';
    try { r.start(); } catch (e) {}
    guardarEstado(); barra(); aviso('Micrófono encendido. Di una orden.');
  }
  /* cada escucha usa un reconocedor nuevo: algunos Android no se dejan volver a encender con el mismo */
  function reiniciar() {
    clearTimeout(reinicioT);
    reinicioT = setTimeout(function () {
      if (!VZ.on || document.hidden) return;
      var r = nuevoRec(); if (!r) return;
      VZ.rec = r; try { r.start(); } catch (e) {}
    }, OPC.retardoReinicio);
  }
  function nuevoRec() {
    var r; try { r = new SR(); } catch (e) { return null; }
    r.lang = OPC.idioma; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = function (ev) {
      if (hablandoAhora()) return; // es la propia página leyendo en voz alta
      var fin = '', tmp = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) fin += t; else tmp += t;
      }
      fin = depurarFinal(fin.trim());
      var e = $('#va-barra .va-t');
      if (e) e.textContent = enmascara((VZ.modo === 'dictado' ? VZ.txt + ' ' : '') + (fin || tmp));
      if (fin) oir(fin);
      else if (VZ.modo === 'dictado' && tmp) { clearTimeout(VZ.tm); VZ.tm = setTimeout(finDictado, OPC.tiempoDictado); }
    };
    r.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { apagar(); aviso(OPC.textos.sinPermiso, 5000); }
      else if (e.error === 'network') { apagar(); aviso(OPC.textos.sinRed, 4000); }
      else if (e.error === 'audio-capture') { apagar(); aviso(OPC.textos.sinMicrofono, 4000); }
    };
    r.onend = function () { if (VZ.on && VZ.rec === r) reiniciar(); };
    return r;
  }
  function apagar() {
    VZ.on = false; clearTimeout(VZ.tm); clearTimeout(reinicioT);
    limpiarBadges(); VZ.pendiente = null;
    if (VZ.modo === 'dictado') finDictado();
    try { VZ.rec && VZ.rec.stop(); } catch (e) {}
    VZ.rec = null; VZ.modo = 'orden'; guardarEstado(); barra();
  }
  function guardarEstado() {
    if (OPC.recordar) try { localStorage.setItem(OPC.recordar, VZ.on ? '1' : '0'); } catch (e) {}
    if (OPC.alCambiar) try { OPC.alCambiar(VZ.on); } catch (e) {}
  }
  /* Android repite la última frase o la entrega acumulada («hola», «hola cómo estás»): solo pasa lo nuevo */
  function depurarFinal(f) {
    if (!f) return '';
    var ahora = Date.now(), n = nrm(f), u = nrm(VZ.ultFin), reciente = ahora - VZ.ultFinAt < 2500;
    if (reciente && n === u) return '';
    var res = f;
    if (reciente && u && n.indexOf(u + ' ') === 0) {
      var W = f.split(/\s+/), k = u.split(' ').length; res = W.slice(k).join(' ');
    }
    VZ.ultFin = f; VZ.ultFinAt = ahora;
    return res.trim();
  }
  function alternar() { VZ.pausado = false; if (VZ.on) apagar(); else encender(); }
  /* cede el micrófono a otro dictado de la aplicación; reanudar() lo vuelve a tomar */
  function pausar() {
    if (!VZ.on) return false;
    VZ.pausado = true; VZ.on = false; clearTimeout(VZ.tm); clearTimeout(reinicioT);
    if (VZ.modo === 'dictado') finDictado();
    try { VZ.rec && VZ.rec.stop(); } catch (e) {}
    VZ.rec = null; VZ.modo = 'orden'; barra(); return true;
  }
  function reanudar() { if (VZ.pausado) { VZ.pausado = false; encender(); } }

  /* ------------------------------------------------------------------ dictado enriquecido */
  function ponValor(el, v, agregar) {
    if (el.isContentEditable) {
      el.textContent = agregar && el.textContent ? el.textContent.trim() + ' ' + v : v;
    } else {
      var nuevo = agregar && el.value ? el.value.trim() + ' ' + v : v;
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var set = Object.getOwnPropertyDescriptor(proto, 'value'); // compatible con React/Vue
      if (set && set.set) set.set.call(el, nuevo); else el.value = nuevo;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function valorDe(el) { return el.isContentEditable ? el.textContent : el.value || ''; }
  function dictarEn(el, nombre) {
    VZ.modo = 'dictado'; VZ.dest = el; VZ.destN = nombre; VZ.txt = ''; VZ.base = valorDe(el).replace(/\s+$/, ''); clearTimeout(VZ.tm); barra();
    el.focus(); el.scrollIntoView && el.scrollIntoView({ block: 'center' });
    VZ.tm = setTimeout(finDictado, OPC.tiempoDictado * 2);
  }
  /* lo dictado se ve en el campo mientras se habla */
  function volcarDictado() {
    var d = VZ.dest; if (!d) return;
    var t = VZ.txt, b = VZ.base;
    var junto = !b ? t : !t ? b : b + (/\n$/.test(b) ? '' : ' ') + t;
    ponValor(d, d.tagName === 'INPUT' ? junto.replace(/\n/g, ' ') : junto, false);
  }
  function finDictado() {
    clearTimeout(VZ.tm); var d = VZ.dest, t = VZ.txt.trim();
    if (d) volcarDictado();
    VZ.modo = 'orden'; VZ.dest = null; VZ.txt = ''; VZ.base = '';
    if (d && t) aviso('Escrito: «' + t.slice(0, 80) + (t.length > 80 ? '…' : '') + '»');
    barra();
  }
  /* «coma», «punto y aparte», «abre interrogación»… también dentro de una frase larga */
  var SIGNOS = [
    [/\s*\b(?:punto y aparte|nueva linea|nuevo renglon|salto de linea)\b\s*/g, '.\n'],
    [/\s*\b(?:punto y coma)\b\s*/g, '; '],
    [/\s*\b(?:dos puntos)\b\s*/g, ': '],
    [/\s*\b(?:punto y seguido)\b\s*/g, '. '],
    [/\s*\b(?:puntos suspensivos)\b\s*/g, '… '],
    [/\s*\bcoma\b\s*/g, ', '],
    [/\s*\b(?:abre|abrir|signo de) (?:interrogacion|pregunta)\b\s*/g, ' ¿'],
    [/\s*\b(?:cierra|cerrar) (?:interrogacion|pregunta)\b\s*/g, '? '],
    [/\s*\b(?:abre|abrir|signo de) (?:admiracion|exclamacion)\b\s*/g, ' ¡'],
    [/\s*\b(?:cierra|cerrar) (?:admiracion|exclamacion)\b\s*/g, '! '],
    [/\s*\bpunto\s*$/g, '.']
  ];
  function signosEnFrase(f) {
    // se trabaja sobre la frase original sin acentos solo para hallar las palabras de puntuación
    var W = String(f).split(/\s+/).filter(Boolean), N = W.map(nrm), out = nrm(f) === N.join(' ');
    if (!out) return f;
    var s = ' ' + W.map(function (w, i) { return '\u0001' + i + '\u0001'; }).join(' ') + ' ';
    var plano = N.join(' ');
    SIGNOS.forEach(function (par) { plano = plano.replace(par[0], function (m) { return ' \u0002' + par[1].replace(/ /g, '\u0003') + '\u0002 '; }); });
    // reconstruye con las palabras originales (mayúsculas y acentos) y los signos puestos
    var idx = 0, res = '';
    plano.split(/\s+/).filter(Boolean).forEach(function (tok) {
      if (tok.charAt(0) === '\u0002') { res = res.replace(/\s+$/, '') + tok.slice(1, -1).replace(/\u0003/g, ' '); return; }
      while (idx < N.length && N[idx] !== tok) idx++;
      res += (/[\s¿¡\n]$/.test(res) || !res ? '' : ' ') + (idx < W.length ? W[idx] : tok); idx++;
    });
    return res.replace(/ +\n/g, '\n');
  }
  function capitaliza(t) {
    return t.replace(/(^|[.!?…]\s+|\n\s*|[¿¡])([a-zñáéíóú])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  function aplicarPuntuacionDictado(actual, fragmento) {
    var s = nrm(fragmento);
    if (/^(coma)$/.test(s)) return actual.replace(/\s+$/, '') + ',';
    if (/^(punto|punto y seguido)$/.test(s)) return actual.replace(/\s+$/, '') + '.';
    if (/^(punto y coma)$/.test(s)) return actual.replace(/\s+$/, '') + ';';
    if (/^(dos puntos)$/.test(s)) return actual.replace(/\s+$/, '') + ':';
    if (/^(punto y aparte|nueva linea|salto de linea|enter)$/.test(s)) return actual.replace(/\s+$/, '') + '.\n';
    if (/^(signo de interrogacion|abre interrogacion)$/.test(s)) return (actual + ' ¿').trim();
    if (/^(cierra interrogacion)$/.test(s)) return actual.replace(/\s+$/, '') + '?';
    if (/^(signo de admiracion|signo de exclamacion)$/.test(s)) return actual.replace(/\s+$/, '') + '!';
    if (/^(borra la ultima palabra|borrar ultima palabra|borra ultima palabra|deshacer|corrige)$/.test(s)) {
      return actual.replace(/\s*\S+\s*$/, '');
    }
    if (/^(borra todo|limpia todo)$/.test(s)) return '';
    fragmento = signosEnFrase(fragmento);
    var r = /[¿¡\n]$/.test(actual) || /^[.,;:?!…]/.test(fragmento) ? actual + fragmento : (actual + ' ' + fragmento);
    return capitaliza(r.replace(/^\s+/, ''));
  }
  function enDictado(t) {
    var s = nrm(t), cierre = /\s*\b(terminar dictado|termina dictado|termina el dictado|fin del dictado|fin dictado|listo ya|ya termine|termine de dictar|punto final)$/;
    if (/^(cancela dictado|cancelar dictado|cancela el dictado|olvidalo)$/.test(s)) { VZ.txt = ''; return finDictado(); }
    var mc = s.match(cierre);
    if (mc) {
      var antes = t.split(/\s+/).slice(0, s.replace(cierre, '').split(' ').filter(Boolean).length).join(' ');
      if (antes.trim()) VZ.txt = aplicarPuntuacionDictado(VZ.txt, antes);
      if (mc[1] === 'punto final' && VZ.txt && !/[.!?…]$/.test(VZ.txt)) VZ.txt = VZ.txt.replace(/\s+$/, '') + '.';
      return finDictado();
    }
    VZ.txt = aplicarPuntuacionDictado(VZ.txt, t);
    volcarDictado(); barra();
    clearTimeout(VZ.tm);
    VZ.tm = setTimeout(finDictado, OPC.tiempoDictado);
  }

  /* ------------------------------------------------------------------ desplazar */
  function zonaScroll() {
    var z = zona();
    if (z !== document) {
      var d = z.querySelector('*') && [z].concat([].slice.call(z.querySelectorAll('*'))).filter(function (e) {
        return e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY);
      })[0];
      if (d) return d;
    }
    var ay = $('#va-ayuda'); if (ay && !ay.hidden) return ay.querySelector('.va-dlg');
    return document.scrollingElement || document.documentElement;
  }
  function vozScroll(s) {
    var pant = /\b(pantalla|pagina|hoja|vista|texto|lista|scroll|scrol|escrol|desplaza|desplazate|desplazar)\b/.test(s);
    var corto = s.split(' ').length <= 4;
    var abajo = /\b(scroll down|scrolldown|scroll abajo|baja|bajale|bajar|bajala|abajo|desciende|descender|avanza|avanzale|siguiente pantalla|down)\b/.test(s);
    var arriba = /\b(scroll up|scrollup|scroll arriba|sube|subele|subir|subela|arriba|asciende|up)\b/.test(s);
    var finA = /\b(hasta abajo|hasta el final|al final|del todo abajo|hasta el fondo|al fondo|todo abajo)\b/.test(s);
    var finR = /\b(hasta arriba|al principio|al inicio de la pagina|del todo arriba|todo arriba|hasta el inicio)\b/.test(s);
    if (!(abajo || arriba || finA || finR)) return false;
    if (!pant && !(corto && /^(baja|sube|mas abajo|mas arriba|sigue bajando|sigue subiendo|baja mas|sube mas|baja un poco|sube un poco|baja mucho|sube mucho|scroll|scroll down|scroll up|hasta abajo|hasta arriba|ve hasta abajo|ve hasta arriba|al final|al principio|pagina abajo|pagina arriba)$/.test(s))) return false;
    var z = zonaScroll(), doc = z === document.scrollingElement || z === document.documentElement;
    var alto = doc ? innerHeight : z.clientHeight;
    if (finA || finR) { z.scrollTo({ top: finA ? z.scrollHeight : 0, behavior: 'smooth' }); aviso(finA ? 'Hasta abajo' : 'Hasta arriba', 1200); return true; }
    var f = /\b(un poco|poquito|poquitito|tantito|ligeramente)\b/.test(s) ? 0.3 : /\b(mucho|bastante|harto)\b/.test(s) ? 1 : 0.7;
    z.scrollBy({ top: (abajo && !arriba ? 1 : -1) * alto * f, behavior: 'smooth' });
    return true;
  }

  /* ------------------------------------------------------------------ intérprete y encadenamiento inteligente */
  function esperarEstabilidadDOM(cb) {
    var listo = false, tmMax = 0, obs = null;
    function terminar() {
      if (listo) return;
      listo = true;
      clearTimeout(tmMax);
      if (obs) obs.disconnect();
      cb();
    }
    var tmSilencio = setTimeout(terminar, 280);
    if (typeof MutationObserver !== 'undefined' && document.body) {
      obs = new MutationObserver(function () {
        clearTimeout(tmSilencio);
        tmSilencio = setTimeout(terminar, 180);
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    }
    tmMax = setTimeout(terminar, 1400);
  }

  function ejecutarSecuencia(partes, idx) {
    if (idx >= partes.length) return;
    unaOrden(partes[idx]);
    if (idx + 1 < partes.length) {
      esperarEstabilidadDOM(function () {
        ejecutarSecuencia(partes, idx + 1);
      });
    }
  }

  function oir(t) {
    if (!t) return;
    if (OPC.alOir) try { OPC.alOir(t); } catch (e) {}
    if (VZ.modo === 'dictado') return enDictado(t);
    var partes = String(t).split(/\s+(?:y luego|y después|y despues|luego|después|despues|y también|y tambien|además|ademas|y enseguida|enseguida)\s+/i).filter(function (x) { return x.trim(); });
    ejecutarSecuencia(partes, 0);
  }

  function unaOrden(t, repetida) {
    var s = limpia(t);
    VZ.txt = t; barra();
    if (!s) return;
    if (!repetida && !/^(otra vez|de nuevo|repite|repitelo)$/.test(s)) VZ.ult = t;

    // 0a) confirmación pendiente de acción crítica
    if (VZ.pendiente) {
      var pend = VZ.pendiente;
      VZ.pendiente = null;
      if (/^(si|si confirmar|confirmo|confirmar|si confirmo|adelante|hazlo|aceptar|ok)$/.test(s)) {
        if (Date.now() > pend.hasta || !pend.el.isConnected || !visible(pend.el)) { aviso('Esa confirmación ya no aplica. Vuelve a pedirlo.', 3000); return; }
        if (pend.accion) { pend.accion(); return; }
        ejecutarClicSeguro(pend.el, pend.s, true);
        return;
      }
      if (/^(no|cancelar|cancela|olvidalo|detente)$/.test(s)) {
        aviso('Acción cancelada.');
        return;
      }
    }

    // 0b) desambiguación numérica activa («el dos», «toca el 3»)
    if (VZ.candidatos && VZ.candidatos.length) {
      var mIdx = s.match(/^(?:toca |elige |selecciona |abre )?(?:el |la |numero |opcion )?(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|primero|primera|segundo|segunda|tercero|tercera|cuarto|cuarta|quinto|quinta|sexto|sexta|septimo|septima|octavo|octava|noveno|novena|decimo|decima|\d+)$/);
      if (mIdx) {
        var idx = NUMS[mIdx[1]] || +mIdx[1];
        var elegido = VZ.candidatos[idx - 1];
        limpiarBadges();
        if (elegido) { ejecutarClicSeguro(elegido, s, false); return; }
      }
      if (/^(cancelar|cancela|ninguno|cerrar)$/.test(s)) {
        limpiarBadges();
        aviso('Selección cancelada.');
        return;
      }
      limpiarBadges();
    }

    // 1) comandos propios de la aplicación
    for (var i = 0; i < COMANDOS.length; i++) {
      var c = COMANDOS[i], m = null;
      if (c.patron instanceof RegExp) m = s.match(c.patron);
      else if (typeof c.patron === 'string') m = nrm(c.patron) === s ? [s] : null;
      else if (typeof c.patron === 'function') m = c.patron(s, t) ? [s] : null;
      if (m) { try { if (c.hacer(m, s, t) !== false) return; } catch (e) { console.error('[VozAccesible]', e); return; } }
    }
    // 2) comandos generales
    if (base(s, t)) return;
    // 3) otra inteligencia
    if (typeof OPC.ia === 'function') {
      aviso('Pensando…', 1500);
      Promise.resolve(OPC.ia(t, describirPantalla())).then(function (r) {
        if (!r) return noEntendi(t);
        var L = Array.isArray(r) ? r : [r]; var ok = false;
        L.forEach(function (a) { if (ejecutar(a)) ok = true; });
        if (!ok) noEntendi(t);
      }).catch(function (e) { console.error('[VozAccesible] ia', e); noEntendi(t); });
      return;
    }
    noEntendi(t);
  }
  function noEntendi(t) {
    if (OPC.alNoEntender) try { if (OPC.alNoEntender(t) === true) return; } catch (e) {}
    aviso(OPC.textos.noEntendi.replace('{t}', enmascara(t)), 3200);
  }

  /* recupera de lo dicho el fragmento con sus mayúsculas y acentos: («ana lopez» -> «Ana López») */
  function original(t, frag) {
    var W = String(t).split(/\s+/).filter(Boolean), objetivo = nrm(frag);
    for (var i = 0; i < W.length; i++) for (var j = i + 1; j <= W.length; j++) {
      var trozo = W.slice(i, j).join(' '); if (nrm(trozo) === objetivo) return trozo.replace(/^[¿¡«"(]+|[?!.,;:»")]+$/g, '');
    }
    return frag;
  }

  function base(s, t) {
    // micrófono y ayuda
    if (/^(apaga|apagar|desactiva|cierra|quita)( el)? (microfono|micro|mic)$|^(deja de escuchar|ya no escuches|silencio microfono)$/.test(s)) { apagar(); return true; }
    if (/^(ayuda|que puedo decir|que puedo hacer|comandos|ordenes|como funciona|instrucciones)$/.test(s)) { ayuda(); return true; }
    if (/^(otra vez|de nuevo|repite|repitelo)$/.test(s)) { if (VZ.ult) unaOrden(VZ.ult, true); return true; }
    // ventanas
    if (/^(entendido|cerrar|cierra|cierra la ventana|cierra esto|cancelar|cancela|aceptar|acepta|ok|listo|salir|sal)$/.test(s)) {
      if (cerrarAyuda()) return true;
      var z = zona();
      if (z !== document) {
        var si = /^(aceptar|acepta|ok|listo|entendido)$/.test(s);
        var pref = si ? ['aceptar', 'ok', 'listo', 'entendido', 'si', 'continuar', 'guardar'] : ['cerrar', 'cancelar', 'salir', 'no', 'x', '×', '✕'];
        var bts = consultarProfundo(z, 'button,[role="button"]').filter(visible).filter(function (b) { return !(b.closest && b.closest(OPC.excluir)); });
        var bt = null;
        // primero el botón que se llama exactamente así; después el que empieza con esa palabra
        pref.some(function (w) { bt = bts.filter(function (b) { return nrm(nombreDe(b)) === w; })[0]; return !!bt; });
        if (!bt) pref.some(function (w) { bt = bts.filter(function (b) { return new RegExp('^' + w + '\\b').test(nrm(nombreDe(b))) && !OPC.patronPeligroso.test(nrm(nombreDe(b))); })[0]; return !!bt; });
        if (bt) { ejecutarClicSeguro(bt, s, false); return true; }
        document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        if (z.tagName === 'DIALOG' && z.close) z.close();
        return true;
      }
    }
    // desplazar
    if (vozScroll(s)) return true;
    // moverse
    if (/^(regresa|regresar|atras|ve atras|vuelve|volver|anterior|pagina anterior|regresame)$/.test(s)) {
      var vb = controles().filter(function (b) { return /^(volver|regresar|atras|anterior|←|‹|<)(\b|$)/.test(nrm(nombreDe(b)).replace(/^[^a-z←‹<]+/, '')) || /^[←‹]/.test(nombreDe(b).trim()); })[0];
      if (vb) { ejecutarClicSeguro(vb, s, false); return true; }
      if (history.length > 1) history.back(); else aviso('No hay a dónde regresar.', 1800);
      return true;
    }
    if (/^(adelante|ve adelante|siguiente pagina|avanza pagina)$/.test(s)) { history.forward(); return true; }
    if (/^(recarga|recargar|actualiza|actualizar)( la)?( pagina| pantalla)?$/.test(s)) {
      VZ.pendiente = { el: document.body, hasta: Date.now() + 15000, accion: function () { location.reload(); } };
      aviso('Recargar puede perder lo que no se ha guardado. Di «sí, confirmar» o «cancelar».', 6000); return true;
    }
    if (/\b(inicio|menu principal|pagina principal|portada)\b/.test(s) && /^(ve|vete|ir|vamos|llevame|lleva me|regresa|regresar|vuelve|volver|sal|salir|abre|muestra|muestrame|al|el|a)\b/.test(s) && !/\bsesion\b/.test(s)) {
      var ini = controlPor('inicio', 0.9); if (ini) { ejecutarClicSeguro(ini, s, false); return true; }
      location.href = OPC.inicio || location.pathname.replace(/[^/]*$/, ''); return true;
    }
    // leer
    if (/^(calla|callate|silencio|deja de leer|para de leer|detente)$/.test(s)) { try { speechSynthesis.cancel(); } catch (e) {} return true; }
    if (/^(lee|leer|leeme)( la| esta| el| lo)? ?(pantalla|pagina|texto|esto|seleccion|seleccionado|lo seleccionado)?$/.test(s)) {
      var sel = String(window.getSelection && getSelection() || '').trim();
      var txt = sel || (/(esto|seleccion)/.test(s) && document.activeElement && document.activeElement !== document.body ? nombreDe(document.activeElement) : '') ||
        (($('main') || $('[role="main"]') || (zona() !== document && zona()) || document.body).innerText || '').slice(0, 4000);
      if (!sel) txt = txt.replace(/Te escucho[\s\S]*?Apagar/g, '');
      decir(txt); return true;
    }
    // seleccionar opción dentro de un <select> desplegable: «elige México en país»
    var m = s.match(/^(?:elige|elegir|selecciona|seleccionar|escoge|pon)\s+(.+?)\s+(?:en|de|del)\s+(?:el |la |lista |selector |desplegable )?(.+?)$/);
    if (m) {
      var elSel = controlPor(m[2], 0.45);
      if (elSel && elSel.tagName === 'LABEL' && elSel.control) elSel = elSel.control;
      if (elSel && elSel.tagName === 'SELECT') {
        var elegidoTxt = seleccionarEnSelect(elSel, m[1]);
        if (elegidoTxt) { aviso('Elegido: «' + elegidoTxt + '»'); return true; }
      }
    }
    // escribir: «escribe X en Y», «pon X en Y», «escribe en Y» (dictado)
    m = s.match(/^(?:escribe|escribir|pon|ponle|anota|anotar|captura|llena|rellena|teclea|redacta)\s+(?:en|dentro de)\s+(?:el |la |los |las )?(?:campo |casilla |cuadro |espacio )?(?:de |del )?(.+)$/);
    if (m) { var c1 = campoPor(m[1]); if (c1) { dictarEn(c1, nombreCampo(c1).trim().slice(0, 40) || m[1]); return true; } }
    m = s.match(/^(?:escribe|escribir|pon|ponle|anota|anotar|captura|teclea)\s+(.+?)\s+(?:en|dentro de)\s+(?:el |la |los |las )?(?:campo |casilla |cuadro |espacio )?(?:de |del )?(.+?)$/);
    if (m) { var c2 = campoPor(m[2]); if (c2) { var v = original(t, m[1]); ponValor(c2, v, false); aviso('Escrito: «' + v + '»'); return true; } }
    m = s.match(/^(?:borra|borrar|limpia|limpiar|vacia|vaciar)\s+(?:el |la )?(?:campo |casilla |cuadro )?(?:de |del )?(.+)$/);
    if (m) { var c3 = campoPor(m[1]); if (c3) { ponValor(c3, '', false); aviso('Campo borrado.'); return true; } }
    if (/^(escribe|escribir|dicta|dictar|anota)$/.test(s)) {
      var f = document.activeElement && document.activeElement.matches && document.activeElement.matches(SEL_CAMPOS) ? document.activeElement : campos()[0];
      if (f) { dictarEn(f, nombreCampo(f).trim().slice(0, 40) || 'el campo'); return true; }
    }
    // opción por número: «la segunda», «elijo la b», «opción 3»
    m = s.match(/^(?:la respuesta es |elijo |escojo |selecciona |elige |marca |es )?(?:la |el )?(?:opcion |respuesta |inciso )?(primera|segunda|tercera|cuarta|quinta|1|2|3|4|5|a|b|c|d|e)$/);
    if (m) {
      var ops = consultarProfundo(zona(), 'input[type="radio"],[role="radio"],[role="option"]').filter(visible);
      var k = { primera: 0, segunda: 1, tercera: 2, cuarta: 3, quinta: 4, a: 0, b: 1, c: 2, d: 3, e: 4 }[m[1]]; if (k == null) k = +m[1] - 1;
      if (ops[k]) { ops[k].click(); return true; }
    }
    // cualquier control por su nombre (con desambiguación visual si hay múltiples iguales)
    var q = s.replace(VERBOS, '').trim() || s;
    var umbralCtrl = VERBOS.test(s) ? OPC.umbral : Math.max(OPC.umbral, 0.75);
    var matches = coincidenciaControles(q, umbralCtrl);
    if (matches.length === 1) {
      ejecutarClicSeguro(matches[0], s, false);
      return true;
    } else if (matches.length > 1) {
      mostrarBadges(matches, q);
      return true;
    }
    // un campo por su nombre: lo enfoca y dicta
    if (VERBOS.test(s)) { var c4 = campoPor(q, 0.75); if (c4) { dictarEn(c4, nombreCampo(c4).trim().slice(0, 40)); return true; } }
    return false;
  }

  /* ------------------------------------------------------------------ acciones estructuradas (para IA) */
  function ejecutar(a) {
    if (!a || typeof a !== 'object') return false;
    var tipo = nrm(a.accion || a.action || '');
    var obj = a.objetivo || a.target || '';
    var idx = a.indice || a.index || null;
    switch (tipo) {
      case 'clic': case 'click': case 'tocar': case 'abrir': case 'open': {
        var el = controlPor(obj, 0.4, idx);
        if (!el) return false;
        ejecutarClicSeguro(el, tipo === 'abrir' || tipo === 'open' ? 'abre' : '', !!a.forzar);
        return true;
      }
      case 'seleccionar': case 'select': {
        var sel = controlPor(obj, 0.4, idx);
        if (sel && sel.tagName === 'LABEL' && sel.control) sel = sel.control;
        if (!sel || sel.tagName !== 'SELECT') return false;
        var resSel = seleccionarEnSelect(sel, String(a.texto || a.valor || a.text || ''));
        if (resSel) { aviso('Elegido: «' + resSel + '»'); return true; }
        return false;
      }
      case 'escribir': case 'type': case 'write': {
        var c = obj ? campoPor(obj, 0.4) : (document.activeElement && document.activeElement.matches(SEL_CAMPOS) ? document.activeElement : null);
        if (!c) return false;
        ponValor(c, String(a.texto != null ? a.texto : a.text || ''), !!(a.agregar || a.append));
        return true;
      }
      case 'borrar': case 'clear': {
        var cb = obj ? campoPor(obj, 0.4) : (document.activeElement && document.activeElement.matches(SEL_CAMPOS) ? document.activeElement : null);
        if (!cb) return false;
        ponValor(cb, '', false);
        return true;
      }
      case 'dictar': case 'dictate': {
        var d = campoPor(obj, 0.4);
        if (!d) return false;
        dictarEn(d, nombreCampo(d).trim().slice(0, 40));
        return true;
      }
      case 'desplazar': case 'scroll': {
        var dir = nrm(a.direccion || a.direction || 'abajo');
        return vozScroll(dir === 'arriba' || dir === 'up' ? 'sube la pantalla' : dir === 'inicio' || dir === 'top' ? 'hasta arriba' : dir === 'final' || dir === 'bottom' ? 'hasta abajo' : 'baja la pantalla');
      }
      case 'navegar': case 'navigate': {
        if (!a.url) return false;
        var u; try { u = new URL(String(a.url), location.href); } catch (e) { return false; }
        if (!/^https?:$/.test(u.protocol) || u.origin !== location.origin) return false; // nada de javascript: ni otros sitios
        location.href = u.href; return true;
      }
      case 'atras': case 'back': history.back(); return true;
      case 'decir': case 'say': case 'hablar': aviso(String(a.texto || a.text || ''), 3500); if (a.voz !== false) decir(String(a.texto || a.text || '')); return true;
      case 'leer': case 'read': decir(String(a.texto || a.text || (document.body.innerText || '').slice(0, 4000))); return true;
      case 'orden': case 'command': if (!(a.texto || a.text)) return false; unaOrden(String(a.texto || a.text)); return true;
      case 'ayuda': case 'help': ayuda(); return true;
      case 'apagar': apagar(); return true;
      default: return false;
    }
  }

  /* ------------------------------------------------------------------ API */
  function agregarComando(c) {
    if (!c || !c.patron || typeof c.hacer !== 'function') throw new Error('VozAccesible.agregarComando necesita {patron, hacer}');
    COMANDOS.push(c); return api;
  }
  function iniciar(o) {
    o = o || {};
    Object.keys(o).forEach(function (k) {
      if (k === 'textos') Object.keys(o.textos).forEach(function (t) { OPC.textos[t] = o.textos[t]; });
      else if (k === 'comandos') (o.comandos || []).forEach(agregarComando);
      else if (k === 'ayudaExtra') AYUDA_EXTRA = o.ayudaExtra || [];
      else OPC[k] = o[k];
    });
    var listo = function () {
      crearInterfaz(); barra(); // por si se encendió antes de que la página terminara de cargar
      if (VZ.iniciado) return;
      VZ.iniciado = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { cerrarAyuda(); limpiarBadges(); VZ.pendiente = null; }
        if (e.altKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); alternar(); } // Alt+M prende/apaga
      });
      addEventListener('scroll', ubicarBadges, true); addEventListener('resize', ubicarBadges);
      // con la pestaña oculta el navegador corta el micrófono: se pausa y se retoma al volver
      document.addEventListener('visibilitychange', function () {
        if (!VZ.on) return;
        if (document.hidden) { clearTimeout(reinicioT); try { VZ.rec && VZ.rec.stop(); } catch (e) {} }
        else reiniciar();
      });
      // si la aplicación reescribe la página entera, el micrófono y su barra vuelven a aparecer
      if (typeof MutationObserver !== 'undefined') new MutationObserver(function () {
        if ((OPC.boton && !document.getElementById('va-mic')) || !document.getElementById('va-barra') || !document.getElementById('va-aviso')) { crearInterfaz(); barra(); }
      }).observe(document.body, { childList: true });
      if (OPC.recordar && SR) { var g = null; try { g = localStorage.getItem(OPC.recordar); } catch (e) {} if (g === '1') encender(); }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', listo); else listo();
    return api;
  }

  function configurar(o) {
    Object.keys(o || {}).forEach(function (k) { if (k !== 'textos' && k !== 'comandos') OPC[k] = o[k]; });
    if (o && ('posicion' in o || 'tamano' in o)) ubicarMic();
    return api;
  }
  var api = {
    version: '2.1', configurar: configurar,
    iniciar: iniciar, encender: encender, apagar: apagar, alternar: alternar, pausar: pausar, reanudar: reanudar,
    oir: oir, ejecutar: ejecutar, describirPantalla: describirPantalla,
    agregarComando: agregarComando, ayuda: ayuda, aviso: aviso, decir: decir,
    normalizar: nrm, limpiar: limpia, parecido: function (a, b) { return parecido(canon(a), canon(b)); },
    get encendido() { return VZ.on; }, get pausado() { return !!VZ.pausado; }, get disponible() { return !!SR; }
  };
  return api;
}));
