# Organizatones para Preguntones

Aplicación de la **Biblioteca Viva** para aprender a pensar con los 26 organizadores gráficos: Reconoce, Comprende, Construye y Elige.

- **Página de la biblioteca (por grado):** `index.html`
- **Versión por colores:** `por-colores.html`
- **Familias:** en la página, botón **Familias** → elijan grado y grupo, marquen las actividades que falten e imprímanlas. También pueden entrar con el **código QR** de su grupo (`#cuaderno-4A`, por ejemplo).

En clase: horario de la biblioteca con «Ahora toca» (🗓), tarjeta «Empezar con…» con el siguiente organizador del grupo, modo proyector (📽, se avanza con las flechas o con un control de presentaciones), lectura al lado del tablero y «Ver en grande», sorteo de número de lista (🎲), lectura en voz alta (🔊), banco de lecturas con buscador (`#lecturas`), planeación imprimible, juego «¿Qué organizador uso?», ruta de avance y sellos por grupo, y resumen mensual en el Evaluador.

La computadora de la biblioteca sube sola lo trabajado en clase a la carpeta `datos/` (el trabajo de cada grupo, sin nombres de alumnos):

- Lo que se escribe en los tableros **sí se publica**; la aplicación lo recuerda en pantalla para que no se escriban nombres ni datos personales.
- Las **fotos de las lecturas no se publican** (derechos de autor): se quedan en la computadora de la biblioteca y las familias ven un aviso.
- El nivel de la rúbrica que calcula la aplicación es un **indicador de avance**: revisa si el tablero está completo, no si se comprendió el tema. El docente lo confirma o lo ajusta.
- Si el navegador se llena, la aplicación descarga un respaldo completo **antes** de hacer espacio y avisa qué hizo.

## Cómo se construye

Las tres aplicaciones (`index.html`, `por-colores.html` y NoteKiebres) salen de **un solo motor**: `fuente/motor.html`. Los cambios se hacen ahí y después se corre:

```
python3 fuente/construir.py
```

El script escribe `index.html`, `por-colores.html` y, si el repositorio NoteKiebres está en la carpeta de al lado, también `../NoteKiebres/index.html`. No edite a mano los archivos generados.

Autor: Eduardo Kantún Martínez, Promotor de Lecturas. Desarrollado con apoyo de IA (Claude), con dirección y revisión del autor. Incluye qrcode-generator (Kazuhiko Arase, licencia MIT).
