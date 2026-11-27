# Organizatones para Preguntones

Aplicación de la **Biblioteca Viva** para aprender a pensar con los 26 organizadores gráficos: Reconoce, Comprende, Construye y Elige.

- **Página de la biblioteca (por grado):** `index.html`
- **Versión por colores:** `por-colores.html`
- **Familias:** en la página, botón **Familias** → elijan grado y grupo, marquen las actividades que falten e imprímanlas. También pueden entrar con el **código QR** de su grupo (`#cuaderno-4A`, por ejemplo).

En clase: horario de la biblioteca con «Ahora toca» (🗓, cada bloque con su duración real: 20, 30 o 60 min), tarjeta «Empezar con…» con el siguiente organizador del grupo, modo proyector (📽, se avanza con las flechas o con un control de presentaciones), lectura al lado del tablero y «Ver en grande», sorteo de número de lista (🎲), lectura en voz alta (🔊), banco de lecturas con buscador (`#lecturas`), planeación imprimible, juego «¿Qué organizador uso?», ruta de avance y sellos por grupo, y resumen mensual en el Evaluador.

En el organizador, cada recuadro del panel (¿Qué es?, Un ejemplo terminado, Pista para elegirlo…) se pliega y se despliega tocando su título; la aplicación recuerda cuáles se dejaron abiertos. En el celular empiezan plegados, el botón ▾ junto a los momentos oculta el panel y el tablero llena el alto disponible (se recorre deslizándolo con el dedo; «Completo» lo muestra entero).

La computadora de la biblioteca sube sola lo trabajado en clase a la carpeta `datos/` (el trabajo de cada grupo, sin nombres de alumnos):

- Lo que se escribe en los tableros **sí se publica**; la aplicación lo recuerda en pantalla para que no se escriban nombres ni datos personales.
- Las **fotos de las lecturas no se publican** (derechos de autor): se quedan en la computadora de la biblioteca y las familias ven un aviso.
- El nivel de la rúbrica que calcula la aplicación es un **indicador de avance**. Revisa cuatro cosas que se pueden contar: si el propósito marcado corresponde al organizador, cuántos espacios tienen texto y si hay frases demasiado largas, si faltan piezas o conexiones, y cuántas respuestas tiene la explicación. No puede leer si lo escrito es correcto: el docente confirma o ajusta el nivel.
- Si el navegador se llena, la aplicación descarga un respaldo completo **antes** de hacer espacio y avisa qué hizo.

## Cómo se construye

Las tres aplicaciones (`index.html`, `por-colores.html` y NoteKiebres) salen de **un solo motor**: `fuente/motor.html`. Los cambios se hacen ahí y después se corre:

```
python3 fuente/construir.py
```

El script escribe `index.html`, `por-colores.html` y, si el repositorio NoteKiebres está en la carpeta de al lado, también `../NoteKiebres/index.html` y el nombre de la caché sin internet en `../NoteKiebres/sw.js` (cambia solo cuando cambia la aplicación). Los archivos generados lo dicen en su primera línea: no se editan a mano.

### Herramientas de revisión (`fuente/herramientas/`)

- `visual.py`: prueba visual. Captura las tres aplicaciones en escritorio y celular (rutas, sesión, proyector, horario, modo oscuro e impresión) con hora fija, y compara dos corridas píxel por píxel. Antes de publicar un cambio que no debería verse, la comparación tiene que dar 0 diferencias. Necesita Playwright y Chrome (`CHROME=/ruta/a/chrome`).
  ```
  python3 fuente/herramientas/visual.py capturar antes/ carpeta_con_las_apps/
  python3 fuente/herramientas/visual.py capturar despues/ carpeta_con_las_apps/
  python3 fuente/herramientas/visual.py comparar antes/ despues/
  ```
- `css_limpia.py`: quita del motor los estilos que no tienen efecto (selectores de clases que ya no existen y declaraciones que otra regla igual anula después). Siempre se comprueba con `visual.py`.

Autor: Eduardo Kantún Martínez, Promotor de Lecturas. Desarrollado con apoyo de IA (Claude), con dirección y revisión del autor. Incluye qrcode-generator (Kazuhiko Arase, licencia MIT).
