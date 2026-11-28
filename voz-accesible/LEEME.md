# Voz Accesible 2.1

Con este motor puedes manejar cualquier página web con la voz, en español y hablando de forma natural. Viene de las aplicaciones **Organizatones para Preguntones** y **NoteKiebres** (Profr. Eduardo Kantún Martínez, con colaboración de IA).

Es un solo archivo, `voz-accesible.js`, sin dependencias externas. Usa el reconocimiento de voz del navegador (Chrome o Edge, con internet y permiso para el micrófono). **Privacidad:** el navegador manda el audio a su servicio de reconocimiento (en Chrome, a Google) para convertirlo en texto; avisa de esto a quien use tu aplicación y no pidas que dicte datos personales.

Prueba en vivo: https://lalitoelprofefulanito-dot.github.io/Organizatones_para_Preguntones/voz-accesible/ejemplo.html

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `voz-accesible.js` | El motor (v2.1). Es lo único que necesitas copiar a tu aplicación; también se puede pegar dentro de la página. |
| `ejemplo.html` | Página para probar dictado con puntuación, listas, botones repetidos, casillas y confirmación segura. |
| `acciones.schema.json` | Esquema JSON de las acciones que una IA puede enviar a `VozAccesible.ejecutar()`. |
| `pruebas/` | Pruebas automáticas (Playwright + Chrome): `audita.py` (13 fallas que tenía la 2.0) y `regresion.py` (24 funciones). |
| `LEEME.md` | Esta guía. |

## Integrarlo en 2 pasos

```html
<script src="voz-accesible.js"></script>
<script>
  VozAccesible.iniciar();   // aparece el micrófono abajo a la derecha
</script>
```

También puedes encender y apagar el micrófono con **Alt+M**.

## Lo que entiende sin configurar nada

| Grupo | Ejemplos |
|---|---|
| Tocar botones, enlaces, pestañas y casillas | «toca guardar», «abre Ajustes», «marca acepto» (si ya está marcada, no la desmarca), «abre detalles» |
| Elegir en listas desplegables | «elige México en país», «selecciona segunda en estado» |
| Botones repetidos | Si hay varios «Editar», muestra `[1]`, `[2]` y basta decir «el dos» |
| Escribir en un campo | «escribe Ana López en nombre», «pon 25 en edad», «borra el campo correo» |
| Dictado largo | «escribe en comentarios»: se ve en el campo mientras hablas; «coma», «punto», «dos puntos», «abre pregunta», «nueva línea», «borra la última palabra»; termina con «terminar dictado», «listo ya» o «punto final» |
| Desplazar la pantalla | «baja la pantalla», «sube un poco», «hasta abajo», «hasta arriba» |
| Moverse | «regresa» (usa el botón Volver de la página si lo hay), «ve al inicio» (de la aplicación, no del sitio), «recarga» (pide confirmar) |
| Ventanas y confirmaciones | «entendido», «cerrar», «aceptar», «sí, confirmar», «cancelar» |
| Leer en voz alta | «lee la pantalla», «lee esto», «calla» |
| Control | «ayuda», «otra vez», «apaga el micrófono» |

## Qué cambió de la 2.0 a la 2.1 (auditoría del 28/11/2026)

| Falla en 2.0 | Arreglo en 2.1 |
|---|---|
| Al leer en voz alta, el micrófono oía a la página y obedecía lo que ella decía | No obedece mientras la página habla ni un momento después |
| Android entregaba la misma frase dos veces («Ana Ana») | Se descarta la repetida y se toma solo lo nuevo de una frase acumulada |
| «marca acepto» dicho dos veces la desmarcaba | «marca» y «desmarca» respetan cómo está la casilla |
| «cancelar» en una ventana tocaba «Exportar» (tiene una x); «aceptar» tocaba «Cerrar sesión» (tiene «si») | Se buscan palabras completas, primero el nombre exacto, y lo peligroso pide confirmar |
| Las listas se nombraban con todas sus opciones; la etiqueta y su control contaban como dos botones; «elige España en país» fallaba | Las listas y casillas se nombran por su etiqueta; etiqueta + control, tarjeta + botón y dos enlaces al mismo lugar son un solo objetivo |
| «el dos» no funcionaba con números en palabra | Entiende «el uno», «el dos»… y «el 2» |
| La puntuación solo funcionaba si «coma» era una frase sola; «punto final» no ponía punto; un parcial dejaba el dictado abierto para siempre | Puntuación dentro de la frase, mayúsculas después del punto, «punto final» y cierre por silencio siempre |
| Un «sí» tardío tocaba un botón que ya no existía | La confirmación caduca a los 15 s y revisa que el botón siga ahí |
| `navegar` aceptaba `javascript:` y otros sitios | Solo direcciones http(s) del mismo sitio |
| «ve al inicio» llevaba a la raíz del dominio (en GitHub Pages, fuera de la aplicación) | Lleva a la carpeta de la aplicación |
| Sin micrófono conectado, se reiniciaba sin fin | Avisa y se apaga |
| El comentario `</script>` impedía pegar el motor dentro de una página | Se puede pegar en línea |

## Opciones

```js
VozAccesible.iniciar({
  idioma: 'es-MX',
  boton: true,
  posicion: 'abajo-derecha',    // abajo-izquierda, arriba-derecha, arriba-izquierda (pantallas dañadas, otros botones)
  tamano: 'normal',             // 'grande' para pantallas dañadas o motricidad fina
  color: '#12A3A8', colorActivo: '#C62828',
  inicio: null,                 // por omisión, la carpeta de la aplicación
  umbral: 0.5,
  excluir: '[data-voz-ignorar]',
  zona: () => document.querySelector('main'),
  leerRespuestas: false,
  tiempoDictado: 8500,
  retardoReinicio: 220,
  confirmarPeligrosos: true,
  patronPeligroso: /(eliminar|borrar|vaciar|reemplazar todo|pagar)/,
  sinConfirmar: '.mi-dialogo [data-ok]',  // botones que ya son la confirmación de tu aplicación
  mascara: t => t.replace(/\d/g, '•'),    // lo que se muestra en pantalla (para claves dichas en voz alta)
  recordar: 'mi-app-voz',       // recuerda si quedó encendido y lo vuelve a encender al abrir
  alCambiar: encendido => {},
  comandos: [], ayudaExtra: [],
  ia: null, alOir: texto => {}, alNoEntender: texto => {}
});
```

## API

| Función | Qué hace |
|---|---|
| `iniciar(opciones)` | Crea el micrófono y prepara todo (una sola vez; volver a llamarla solo cambia opciones). |
| `encender()`, `apagar()`, `alternar()` | Prende o apaga el micrófono. |
| `pausar()`, `reanudar()` | Cede el micrófono a otro dictado de tu aplicación y lo retoma, sin olvidar que estaba encendido. |
| `configurar(opciones)` | Cambia opciones en caliente (por ejemplo `posicion` o `tamano`). |
| `oir(texto)` | Procesa un texto como si se hubiera dicho. |
| `ejecutar(accion)` | Acción estructurada: `{accion:'clic', objetivo:'Editar', indice:2}`, `{accion:'seleccionar', objetivo:'País', texto:'México'}`. |
| `describirPantalla()` | Controles y campos visibles (contexto para una IA). |
| `agregarComando({nombre, patron, hacer, ejemplos})` | Agrega una orden propia; se revisa antes que las generales. |
| `ayuda()`, `aviso(texto)`, `decir(texto)` | Ventana de ayuda, aviso breve y lectura en voz alta. |
| `encendido`, `pausado`, `disponible` | Estado. |

Si tu aplicación reescribe la página entera (`document.body.innerHTML = …`), el micrófono y su barra vuelven a aparecer solos.
