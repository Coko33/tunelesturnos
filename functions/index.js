const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const {getFirestore} = require("firebase-admin/firestore");
const crypto = require("crypto");
const {defineSecret} = require("firebase-functions/params");

admin.initializeApp();
const db = getFirestore();

// Configuración del transportador de email (usando variables de entorno)
const EMAIL_USER = defineSecret("EMAIL_USER");
const EMAIL_PASS = defineSecret("EMAIL_PASS");

exports.enviarConfirmacionDeTurno = onDocumentCreated({
  document: "reservas_pendientes/{reservaId}",
  region: "us-central1",
  secrets: [EMAIL_USER, EMAIL_PASS],
}, async (event) => {
  const snap = event.data;
  if (!snap) {
    console.log("No data associated with the event");
    return;
  }

  const emailUser = EMAIL_USER.value();
  const emailPass = EMAIL_PASS.value();
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
  const reservaData = snap.data();
  let fechaLegible = "Fecha y hora no especificadas";
  if (reservaData.turno && reservaData.turno.toDate) {
    const date = reservaData.turno.toDate();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
      // timeZoneName: 'short'
    };
    fechaLegible = date.toLocaleDateString("es-ES", options);
  }
  // Generar un token de confirmación único y una fecha de expiración
  const token = crypto.randomBytes(20).toString("hex");
  // 1 hora para confirmar
  const expira = Date.now() + 3600000;
  // Actualizar el documento de reserva pendiente con el token
  await snap.ref.update({
    confirmationToken: token,
    tokenExpires: expira,
  });
  // URL de confirmación dinámica para producción y emulador
  let confirmationUrl;
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    // URL para el emulador local
    confirmationUrl = `http://127.0.0.1:5001/${process.env.GCLOUD_PROJECT}/us-central1/confirmarTurno?token=${token}`;
  } else {
    // URL para producción
    confirmationUrl = `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/confirmarTurno?token=${token}`;
  }
  const mailOptions = {
    from: `"Manzana de las Luces" <${emailUser}>`,
    to: reservaData.email,
    subject: "Confirma tu turno para para visitar los túneles",
    html: `
          <h1>¡Hola ${reservaData.nombre}!</h1>
          <p>Gracias por reservar un turno. Por favor, haz clic en el 
          siguiente enlace para confirmar tu reserva:</p>
          <div style="border: 1px solid #ccc; padding: 15px; 
          margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0;"><strong>Detalles de tu Reserva:</strong></p>
            <h3 style="color: #007bff; margin: 
            5px 0 10px 0;">${fechaLegible}</h3>
          </div>
          <a href="${confirmationUrl}" style="padding: 10px 20px; color: 
          white; background-color: #007bff; text-decoration: none; 
          border-radius: 5px;">Confirmar mi turno</a>
          <p>Este enlace expirará en 1 hora.</p>
          <p>Si no solicitaste este turno, puedes ignorar este email.</p>
        `,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log("Email de confirmación enviado a:", reservaData.email);
  } catch (error) {
    console.error("Error al enviar email:", error);
  }
});

exports.confirmarTurno = onRequest({
  region: "us-central1"}, async (req, res) => {
  const token = req.query.token;
  if (!token) {
    res.status(400).send("Token de confirmación no proporcionado.");
    return;
  }
  try {
    const query = db.collection("reservas_pendientes")
        .where("confirmationToken", "==", token)
        .where("tokenExpires", ">", Date.now());
    const snapshot = await query.get();
    if (snapshot.empty) {
      console.log("Token no válido o expirado.");
      res.status(400).send(
          "El enlace de confirmación no es válido o ha expirado. " +
        "Por favor, intenta reservar de nuevo.",
      );
      return;
    }
    const reservaPendienteDoc = snapshot.docs[0];
    const reservaData = reservaPendienteDoc.data();
    // Usar una transacción para garantizar la atomicidad
    await db.runTransaction(async (transaction) => {
      // Crear el turno en la colección 'turnos'
      // eslint-disable-next-line no-unused-vars
      const {confirmationToken, tokenExpires, ...turnoFinal} = reservaData;
      const turnosRef = db.collection("turnos");
      transaction.set(turnosRef.doc(), turnoFinal);
      // Eliminar la reserva pendiente para que no se pueda usar de nuevo
      transaction.delete(reservaPendienteDoc.ref);
    });
    // Redirigir al usuario a una página de éxito en tu app
    // ¡Crea esta página en tu app de React!
    // TODO: Reemplazar con la URL de producción antes de desplegar
    const successUrl = process.env.NODE_ENV === "production" ?
      "https://tunelesturnos.web.app/confirmacion-exitosa" :
      "http://localhost:3000/confirmacion-exitosa";
    res.redirect(successUrl);
  } catch (error) {
    console.error("Error al confirmar el turno:", error);
    res.status(500).send(
        "Ocurrió un error al confirmar tu turno."+
        "Por favor, inténtalo más tarde.",
    );
  }
});
