const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const {getFirestore} = require("firebase-admin/firestore");
const crypto = require("crypto");
const {defineSecret} = require("firebase-functions/params");

admin.initializeApp();
const db = getFirestore();

const EMAIL_USER = defineSecret("EMAIL_USER");
const EMAIL_PASS = defineSecret("EMAIL_PASS");

const isDev =
  process.env.FUNCTIONS_EMULATOR === "true" ||
  process.env.NODE_ENV !== "production";

const COLS = {
  RESERVAS: isDev ? "reservas_pendientes_dev" : "reservas_pendientes",
  TURNOS: isDev ? "turnos_dev" : "turnos",
  TURNOS_PUBLICOS: isDev ? "turnos_publicos_dev" : "turnos_publicos",
  TURNOS_CAIDOS: isDev ? "turnos_caidos_dev" : "turnos_caidos",
  MAPEO_EMAILS: isDev ? "mapeo_emails_dev" : "mapeo_emails",
};

const COLLECTION_PATH =
  process.env.FUNCTIONS_EMULATOR === "true" ?
    "reservas_pendientes_dev/{reservaId}" :
    "reservas_pendientes/{reservaId}";

// ENVIAR CORREO DE CONFIRMACION
exports.enviarConfirmacionDeTurno = onDocumentCreated(
    {
      document: COLLECTION_PATH,
      region: "us-central1",
      secrets: [EMAIL_USER, EMAIL_PASS],
    },
    async (event) => {
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
      // 24 horas para confirmar
      const expira = Date.now() + 24 * 60 * 60 * 1000;
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
          <h1>¡Hola ${reservaData.nombreYApellido}!</h1>
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
          <p>Este enlace expirará en 24 horas.</p>
          <p>Si no solicitaste este turno, puedes ignorar este email.</p>
        `,
      };
      try {
        await transporter.sendMail(mailOptions);
        console.log("Email de confirmación enviado a:", reservaData.email);
      } catch (error) {
        console.error("Error al enviar email:", error);
      }
    },
);

exports.confirmarTurno = onRequest(
    {
      region: "us-central1",
    },
    async (req, res) => {
      const token = req.query.token;
      if (!token) {
        res.status(400).send("Token de confirmación no proporcionado.");
        return;
      }
      try {
        const query = db
            .collection(COLS.RESERVAS)
            .where("confirmationToken", "==", token)
            .where("tokenExpires", ">", Date.now());
        const snapshot = await query.get();
        if (snapshot.empty) {
          res
              .status(400)
              .send(
                  "El enlace de confirmación no es válido o ha expirado. " +
              "Por favor, intenta reservar de nuevo.",
              );
          return;
        }
        const reservaPendienteDoc = snapshot.docs[0];
        const reservaData = reservaPendienteDoc.data();
        const reservaId = reservaPendienteDoc.id;
        await db.runTransaction(async (transaction) => {
          const turnoFinal = {...reservaData};
          delete turnoFinal.confirmationToken;
          delete turnoFinal.tokenExpires;
          const turnosRef = db.collection(COLS.TURNOS).doc();
          const publicosRef = db.collection(COLS.TURNOS_PUBLICOS);
          const publicoSnapshot = await transaction.get(
              publicosRef.where("reservaId", "==", reservaId),
          );
          transaction.set(turnosRef, turnoFinal);
          if (!publicoSnapshot.empty) {
            const publicoDoc = publicoSnapshot.docs[0];
            transaction.update(publicoDoc.ref, {
              status: "confirmed",
              // Opcional: podrías guardar el ID del turno final si lo necesitas
              turnoId: turnosRef.id,
            });
          }
          transaction.delete(reservaPendienteDoc.ref);
        });
        const successUrl = isDev ?
          "http://localhost:3000/confirmacion-exitosa" :
          "https://tunelesturnos.web.app/confirmacion-exitosa";
        res.redirect(successUrl);
      } catch (error) {
        console.error("Error al confirmar el turno:", error);
        res
            .status(500)
            .send(
                "Ocurrió un error al confirmar tu turno." +
            "Por favor, inténtalo más tarde.",
            );
      }
    },
);

exports.limpiarTurnosExpirados = onSchedule(
    {
      schedule: "every 1 hours",
      region: "us-central1",
      timeZone: "America/Argentina/Buenos_Aires",
    },
    async (event) => {
      const ahora = Date.now();
      try {
        const expiradosSnapshot = await db
            .collection(COLS.RESERVAS)
            .where("tokenExpires", "<", ahora)
            .get();
        if (expiradosSnapshot.empty) {
          console.log("No hay reservas expiradas para limpiar.");
          return;
        }
        console.log(`Limpiando ${expiradosSnapshot.size} 
          reservas expiradas...`);
        const batch = db.batch();
        for (const doc of expiradosSnapshot.docs) {
          const data = doc.data();
          const reservaId = doc.id;
          const email = data.email ? data.email.toLowerCase() : null;
          const turnosCaidosRef = db
              .collection(COLS.TURNOS_CAIDOS)
              .doc(reservaId);
          batch.set(turnosCaidosRef, {
            ...data,
            motivo_caida: "expiracion_token",
            fecha_caida: admin.firestore.FieldValue.serverTimestamp(),
          });
          batch.delete(doc.ref);
          if (email) {
            const emailRef = db.collection(COLS.MAPEO_EMAILS).doc(email);
            batch.delete(emailRef);
          }
          const publicosSnapshot = await db
              .collection(COLS.TURNOS_PUBLICOS)
              .where("reservaId", "==", reservaId)
              .get();
          publicosSnapshot.forEach((pDoc) => {
            batch.delete(pDoc.ref);
          });
        }
        await batch.commit();
        console.log("Limpieza completada con éxito.");
      } catch (error) {
        console.error("Error en la limpieza de turnos:", error);
      }
    },
);
