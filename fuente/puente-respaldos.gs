/* Puente de respaldos · Organizatones para Preguntones y NoteKiebres
   Recibe el respaldo diario que envía la aplicación, lo guarda en Google Drive
   y, si hay correo, lo manda también por correo.
   Se pega en script.new y se implementa como «Aplicación web»
   (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario). */

const CLAVE = '@@CLAVE@@';      // la escribe la aplicación; debe coincidir con la de la app
const CORREO = '@@CORREO@@';    // déjalo vacío ('') si no quieres recibir correo
const CARPETA = 'Respaldos Organizatones y NoteKiebres';
const LIMITE_ADJUNTO = 20 * 1024 * 1024; // más grande que esto, el correo lleva el enlace en vez del archivo

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.clave !== CLAVE) return responder({ ok: false, error: 'clave incorrecta' });
    const carpeta = subcarpeta(d.app || 'Aplicación');
    const nombre = (d.equipo ? d.equipo + ' - ' : '') + (d.motivo === 'prueba' ? 'PRUEBA - ' : '') + d.nombre;
    const blob = Utilities.newBlob(JSON.stringify(d.respaldo), 'application/json', nombre);
    const archivo = carpeta.createFile(blob);
    if (CORREO) {
      const cuando = Utilities.formatDate(new Date(), 'America/Mexico_City', 'dd/MM/yyyy HH:mm');
      const asunto = 'Respaldo ' + d.app + ' · ' + cuando + (d.motivo === 'prueba' ? ' (prueba)' : '');
      const cuerpo = 'Respaldo automático de ' + d.app + (d.equipo ? ' (' + d.equipo + ')' : '') + '.\n' +
        'También quedó guardado en Google Drive, carpeta «' + CARPETA + '»: ' + archivo.getUrl() + '\n\n' +
        'Para recuperarlo: en la aplicación, Evaluador › Respaldo › Abrir respaldo, y elige este archivo.';
      const opciones = blob.getBytes().length < LIMITE_ADJUNTO ? { attachments: [blob] } : {};
      MailApp.sendEmail(CORREO, asunto, cuerpo, opciones);
    }
    return responder({ ok: true, archivo: archivo.getName() });
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  }
}

function doGet() {
  return responder({ ok: true, mensaje: 'El puente de respaldos está activo.' });
}

function subcarpeta(nombre) {
  return buscarOCrear(buscarOCrear(DriveApp, CARPETA), nombre);
}

function buscarOCrear(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function responder(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
