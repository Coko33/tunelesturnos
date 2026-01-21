const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const {
  onRequest,
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const dayjs = require("dayjs");

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
  COUNTERS: isDev ? "counters_dev" : "counters",
};

const COLLECTION_PATH = `${COLS.RESERVAS}/{reservaId}`;

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

const MAX_PERSONAS_POR_TURNO = 6;

exports.crearReserva = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    const form = request.data;

    // Validación del lado del servidor
    if (!form || typeof form !== "object") {
      throw new HttpsError(
        "invalid-argument",
        "La solicitud debe ser un objeto con los datos del formulario.",
      );
    }
    if (!form.email || !form.start || !form.cantidadPersonas) {
      throw new HttpsError("invalid-argument", "Faltan campos requeridos.");
    }

    try {
      await db.runTransaction(async (transaction) => {
        // 1. Verificar si el email ya tiene una reserva futura
        const emailRef = db
          .collection(COLS.MAPEO_EMAILS)
          .doc(form.email.toLowerCase());
        const emailSnap = await transaction.get(emailRef);

        if (emailSnap.exists) {
          const data = emailSnap.data();
          if (data.start) {
            const fechaProxima = data.start.toDate();
            if (fechaProxima > new Date()) {
              throw new HttpsError(
                "already-exists",
                `EMAIL_RESERVED:${fechaProxima.toISOString()}`,
              );
            }
          }
        }

        // 2. Verificar capacidad del turno
        const startDate = new Date(form.start);
        const endDate = new Date(form.end);
        const slotKey = dayjs(startDate).format("YYYY-MM-DD_HH-mm");
        const counterRef = db.collection(COLS.COUNTERS).doc(slotKey);
        const counterSnap = await transaction.get(counterRef);
        const currentCount = counterSnap.exists ? counterSnap.data().count : 0;

        if (
          currentCount + Number(form.cantidadPersonas) >
          MAX_PERSONAS_POR_TURNO
        ) {
          throw new HttpsError("resource-exhausted", "CAPACITY_FULL");
        }

        // 3. Escrituras
        const reservaRef = db.collection(COLS.RESERVAS).doc();
        const reservaData = {
          ...form,
          turno: Timestamp.fromDate(startDate),
          start: Timestamp.fromDate(startDate),
          end: Timestamp.fromDate(endDate),
        };
        transaction.set(reservaRef, reservaData);

        const publicoRef = db.collection(COLS.TURNOS_PUBLICOS).doc();
        transaction.set(publicoRef, {
          start: Timestamp.fromDate(startDate),
          end: Timestamp.fromDate(endDate),
          cantidadPersonas: Number(form.cantidadPersonas),
          status: "pending",
          reservaId: reservaRef.id,
        });

        transaction.set(emailRef, {
          reservaId: reservaRef.id,
          status: "pending",
          start: Timestamp.fromDate(startDate),
        });

        transaction.set(
          counterRef,
          { count: currentCount + Number(form.cantidadPersonas) },
          { merge: true },
        );
      });

      return { success: true };
    } catch (error) {
      console.error("Error al reservar turno:", error);
      if (error instanceof HttpsError) throw error; // Re-lanzar HttpsError
      throw new HttpsError(
        "internal",
        "Ocurrió un error inesperado al procesar tu reserva.",
        error.message,
      );
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

      // Buscamos el turno público asociado ANTES de la transacción
      const publicosQuery = db
        .collection(COLS.TURNOS_PUBLICOS)
        .where("reservaId", "==", reservaId)
        .limit(1);
      const publicoSnapshot = await publicosQuery.get();
      const publicoDoc = !publicoSnapshot.empty
        ? publicoSnapshot.docs[0]
        : null;

      await db.runTransaction(async (transaction) => {
        // Preparamos los datos del turno final
        const turnoFinal = { ...reservaData };
        delete turnoFinal.confirmationToken;
        delete turnoFinal.tokenExpires;

        // Creamos la referencia para el nuevo turno confirmado
        const turnosRef = db.collection(COLS.TURNOS).doc();

        // 1. Escribir el nuevo turno confirmado
        transaction.set(turnosRef, turnoFinal);

        // 2. Actualizar el turno público si existe
        if (publicoDoc) {
          transaction.update(publicoDoc.ref, {
            status: "confirmed",
            turnoId: turnosRef.id,
          });
        }
        // 3. Borrar la reserva pendiente original
        transaction.delete(reservaPendienteDoc.ref);
      });
      const successUrl = isDev
        ? "http://localhost:3000/confirmacion-exitosa"
        : "https://tunelesturnos.web.app/confirmacion-exitosa";
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
      const reservaIds = [];

      for (const doc of expiradosSnapshot.docs) {
        const data = doc.data();
        const reservaId = doc.id;
        reservaIds.push(reservaId);

        const email = data.email ? data.email.toLowerCase() : null;
        const turnosCaidosRef = db
          .collection(COLS.TURNOS_CAIDOS)
          .doc(reservaId);
        batch.set(turnosCaidosRef, {
          ...data,
          motivo_caida: "expiracion_token",
          fecha_caida: FieldValue.serverTimestamp(),
        });
        batch.delete(doc.ref);
        if (email) {
          const emailRef = db.collection(COLS.MAPEO_EMAILS).doc(email);
          batch.delete(emailRef);
        }
      }

      // Optimización: Buscar turnos públicos en lotes de 30 (límite de 'in')
      const chunks = [];
      for (let i = 0; i < reservaIds.length; i += 30) {
        chunks.push(reservaIds.slice(i, i + 30));
      }

      const publicosPromises = chunks.map((chunk) =>
        db
          .collection(COLS.TURNOS_PUBLICOS)
          .where("reservaId", "in", chunk)
          .get(),
      );

      const publicosSnapshots = await Promise.all(publicosPromises);

      publicosSnapshots.forEach((snapshot) => {
        snapshot.forEach((pDoc) => {
          batch.delete(pDoc.ref);
        });
      });

      await batch.commit();
      console.log("Limpieza completada con éxito.");
    } catch (error) {
      console.error("Error en la limpieza de turnos:", error);
    }
  },
);
