const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// Configuración del transportador de email (usando variables de entorno)
const emailUser = functions.config().email.user;
const emailPass = functions.config().email.pass;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});
exports.enviarConfirmacionDeTurno = functions.firestore
    .document("reservas_pendientes/{reservaId}")
    .onCreate(async (snap, context) => {
      const reservaData = snap.data();
      // Generar un token de confirmación único y una fecha de expiración
      const token = crypto.randomBytes(20).toString("hex");
      // 1 hora para confirmar
      const expira = admin.firestore.Timestamp.now().toMillis() + 3600000;
      // Actualizar el documento de reserva pendiente con el token
      await snap.ref.update({
        confirmationToken: token,
        tokenExpires: expira,
      });
      // URL de tu función HTTP de confirmación
      const confirmationUrl = "https://us-central1-" +
        `${process.env.GCLOUD_PROJECT}.cloudfunctions.net/` +
        `confirmarTurno?token=${token}`;
      const mailOptions = {
        from: `"Tu App de Turnos" <${emailUser}>`,
        to: reservaData.email,
        subject: "Confirma tu turno",
        html: `
          <h1>¡Hola ${reservaData.nombre}!</h1>
          <p>Gracias por reservar un turno. Por favor, haz clic en el 
          siguiente enlace para confirmar tu reserva:</p>
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
exports.confirmarTurno = functions.https.onRequest(async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).send("Token de confirmación no proporcionado.");
  }
  try {
    const query = db.collection("reservas_pendientes")
        .where("confirmationToken", "==", token)
        .where("tokenExpires", ">", Date.now());

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log("Token no válido o expirado.");
      return res.status(400).send(
          "El enlace de confirmación no es válido o ha expirado. " +
        "Por favor, intenta reservar de nuevo.",
      );
    }

    const reservaPendienteDoc = snapshot.docs[0];
    const reservaData = reservaPendienteDoc.data();

    // Crear el turno en la colección 'turnos'
    // eslint-disable-next-line no-unused-vars
    const {confirmationToken, tokenExpires, ...turnoFinal} = reservaData;
    await db.collection("turnos").add(turnoFinal);

    // Eliminar la reserva pendiente para que no se pueda usar de nuevo
    await reservaPendienteDoc.ref.delete();

    // Redirigir al usuario a una página de éxito en tu app
    // ¡Crea esta página en tu app de React!
    return res.redirect("http://localhost:3000/confirmacion-exitosa");
  } catch (error) {
    console.error("Error al confirmar el turno:", error);
    return res.status(500).send(
        "Ocurrió un error al confirmar tu turno."+
        "Por favor, inténtalo más tarde.",
    );
  }
});
