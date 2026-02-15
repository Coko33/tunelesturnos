const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const {
  onRequest,
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const dayjs = require("dayjs");
require("dayjs/locale/es");
dayjs.locale("es");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const isSameOrBefore = require("dayjs/plugin/isSameOrBefore");
const isSameOrAfter = require("dayjs/plugin/isSameOrAfter");
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

admin.initializeApp();
const db = getFirestore();

const EMAIL_USER = defineSecret("EMAIL_USER");

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
  APERTURA: isDev ? "apertura_dev" : "apertura",
};

const COLLECTION_PATH = `${COLS.RESERVAS}/{reservaId}`;
const HORAS_EXPIRACION = 1 / 12; // 5min
const MAX_PERSONAS_POR_TURNO = 6;

async function enviarMailExitoDirecto(reservaData, emailFrom) {
  const sesClient = new SESClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const fechaLegible = dayjs(reservaData.start.toDate())
    .tz("America/Argentina/Buenos_Aires")
    .format("dddd D [de] MMMM [a las] HH:mm [hs]");

  const emailParams = {
    Source: `"Manzana de las Luces" <${emailFrom}>`,
    Destination: { ToAddresses: [reservaData.email] },
    Message: {
      Subject: { Data: "¡Reserva Confirmada! - Visita a los túneles" },
      Body: {
        Html: {
          Data: `
            <h1>¡Hola ${reservaData.nombreYApellido}!</h1>
            <p>Tu reserva ha sido confirmada exitosamente.</p>
            <div style="border: 1px solid #007bff; padding: 15px; margin: 20px 0; border-radius: 5px; background-color: #f8f9fa;">
              <p><strong>Detalles de tu Visita:</strong></p>
              <h3 style="color: #007bff;">${fechaLegible}</h3>
              <p><strong>Lugar:</strong> Perú 222, CABA.</p>
              <p><strong>Personas:</strong> ${reservaData.cantidadPersonas}</p>
            </div>
            <p>¡Te esperamos!</p>
          `,
        },
      },
    },
  };

  try {
    await sesClient.send(new SendEmailCommand(emailParams));
    console.log("Email de confirmación enviado a:", reservaData.email);
  } catch (error) {
    console.error("Error enviando email post-reserva:", error);
    // No lanzamos error aquí para no anular la reserva en la DB si el mail falla
  }
}

exports.crearReserva = onCall(
  {
    region: "us-central1",
    secrets: [
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_REGION",
      EMAIL_USER,
    ],
  },
  async (request) => {
    // Validar que llamada se hizo en el horario de apertura de la turnera
    const configDoc = await db
      .collection(COLS.APERTURA_CONFIG)
      .doc("horarios")
      .get();
    if (!configDoc.exists) {
      throw new HttpsError(
        "internal",
        "No se encontró la configuración de horarios.",
      );
    }
    const { dia, inicio, fin } = configDoc.data();
    const zonaHoraria = "America/Argentina/Buenos_Aires";
    const ahora = dayjs().tz(zonaHoraria);
    const diaActual = ahora.format("dddd");
    const diaActualCapitalizado =
      diaActual.charAt(0).toUpperCase() + diaActual.slice(1);
    if (diaActualCapitalizado !== dia) {
      throw new HttpsError(
        "failed-precondition",
        `El sistema de reservas solo abre los días ${dia}.`,
      );
    }
    const [horaInicio, minInicio] = inicio.split(":").map(Number);
    const [horaFin, minFin] = fin.split(":").map(Number);

    const momentoInicio = ahora.hour(horaInicio).minute(minInicio).second(0);
    const momentoFin = ahora.hour(horaFin).minute(minFin).second(0);

    if (ahora.isBefore(momentoInicio) || ahora.isAfter(momentoFin)) {
      throw new HttpsError(
        "failed-precondition",
        `Reservas habilitadas solo de ${inicio} a ${fin} hs.`,
      );
    }

    // Validación del del form lado del servidor
    // no llega vacio
    const form = request.data;
    if (!form || typeof form !== "object") {
      throw new HttpsError(
        "invalid-argument",
        "La solicitud debe ser un objeto con los datos del formulario.",
      );
    }
    // tiene los datos requeridos
    if (!form.email || !form.start || !form.cantidadPersonas) {
      throw new HttpsError("invalid-argument", "Faltan campos requeridos.");
    }
    // solicita para 1 o 2 personas
    if (
      Number(form.cantidadPersonas) > 2 ||
      Number(form.cantidadPersonas) < 1
    ) {
      throw new HttpsError("out-of-range", "Capacidad excedida.");
    }

    const fechaStart = dayjs(form.start).tz("America/Argentina/Buenos_Aires");
    // la reserva es con fecha posterior a la actual
    if (fechaStart.isBefore(ahora)) {
      throw new HttpsError(
        "out-of-range",
        "No puedes reservar un turno en el pasado.",
      );
    }

    const minDatePermitido = ahora.day(5).startOf("day");
    const maxDatePermitido = ahora.day(7).endOf("day");
    // la reserva es para el sabado o domingo siguientes
    if (
      fechaStart.isBefore(minDatePermitido, "day") ||
      fechaStart.isAfter(maxDatePermitido, "day")
    ) {
      throw new HttpsError(
        "out-of-range",
        "Solo se permiten reservas para el próximo fin de semana.",
      );
    }

    const diaSemana = fechaStart.day();
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
    const hora = fechaStart.hour();
    const esHorarioValido = hora >= 15 && hora < 18;
    // el horario de la reserva es entre las 15 y las 18
    if (!esFinDeSemana || !esHorarioValido) {
      throw new HttpsError(
        "out-of-range",
        "Los turnos solo están disponibles sábados y domingos de 15 a 18 hs.",
      );
    }

    try {
      const result = await db.runTransaction(async (transaction) => {
        // Verificar si el email ya tiene una reserva futura
        const emailRef = db
          .collection(COLS.MAPEO_EMAILS)
          .doc(form.email.toLowerCase());
        const emailSnap = await transaction.get(emailRef);

        if (emailSnap.exists) {
          const data = emailSnap.data();
          if (data.start && data.start.toDate() > new Date()) {
            throw new HttpsError("already-exists", "EMAIL_RESERVED");
          }
        }

        // Verificar capacidad
        const startDate = new Date(form.start);
        const slotKey = dayjs(startDate)
          .tz("America/Argentina/Buenos_Aires")
          .format("YYYY-MM-DD_HH-mm");
        const counterRef = db.collection(COLS.COUNTERS).doc(slotKey);
        const counterSnap = await transaction.get(counterRef);
        const currentCount = counterSnap.exists ? counterSnap.data().count : 0;

        if (
          currentCount + Number(form.cantidadPersonas) >
          MAX_PERSONAS_POR_TURNO
        ) {
          throw new HttpsError("resource-exhausted", "CAPACITY_FULL");
        }

        // ESCRITURA en la BD
        const turnoRef = db.collection(COLS.TURNOS).doc();
        const publicoRef = db.collection(COLS.TURNOS_PUBLICOS).doc();

        const turnoData = {
          ...form,
          turno: Timestamp.fromDate(startDate),
          start: Timestamp.fromDate(startDate),
          end: Timestamp.fromDate(new Date(form.end)),
          status: "confirmed",
          createdAt: FieldValue.serverTimestamp(),
        };

        transaction.set(turnoRef, turnoData);

        transaction.set(publicoRef, {
          start: Timestamp.fromDate(startDate),
          end: Timestamp.fromDate(new Date(form.end)),
          cantidadPersonas: Number(form.cantidadPersonas),
          status: "confirmed",
          turnoId: turnoRef.id,
        });

        transaction.set(emailRef, {
          reservaId: turnoRef.id,
          status: "confirmed",
          start: Timestamp.fromDate(startDate),
        });

        transaction.set(
          counterRef,
          { count: currentCount + Number(form.cantidadPersonas) },
          { merge: true },
        );

        return { id: turnoRef.id, data: turnoData };
      });

      // ENVÍO DE MAIL DE CONFIRMACIÓN (cuando termina la transaction)
      await enviarMailExitoDirecto(result.data, EMAIL_USER.value());

      return { success: true, id: result.id };
    } catch (error) {
      console.error("Error al procesar turno directo:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error interno", error.message);
    }
  },
);

// no deploy
const enviarConfirmacionDeTurno = onDocumentCreated(
  {
    document: COLLECTION_PATH,
    region: "us-central1",
    secrets: [
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_REGION",
      // EMAIL_USER lo usamos para el remitente 'From'
      EMAIL_USER,
    ],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.log("No data associated with the event");
      return;
    }

    const sesClient = new SESClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
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
    const token = crypto.randomBytes(20).toString("hex");
    const expira = Date.now() + HORAS_EXPIRACION * 60 * 60 * 1000;
    await snap.ref.update({
      confirmationToken: token,
      tokenExpires: expira,
    });
    let confirmationUrl;
    const PROJECT_ID = process.env.GCLOUD_PROJECT || "tunelesturnos";
    if (process.env.FUNCTIONS_EMULATOR === "true") {
      confirmationUrl = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/confirmarTurno?token=${token}`;
    } else {
      confirmationUrl = `https://us-central1-${PROJECT_ID}.cloudfunctions.net/confirmarTurno?token=${token}`;
    }
    const emailParams = {
      Source: `"Manzana de las Luces" <${EMAIL_USER.value()}>`,
      Destination: {
        ToAddresses: [reservaData.email],
      },
      Message: {
        Subject: { Data: "Confirma tu turno para visitar los túneles" },
        Body: {
          Html: {
            Data: `
              <h1>¡Hola ${reservaData.nombreYApellido}!</h1>
              <p>Por favor, haz clic en el siguiente enlace para confirmar tu reserva:</p>
              <div style="border: 1px solid #ccc; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <p><strong>Detalles de tu Reserva:</strong></p>
                <h3 style="color: #007bff;">${fechaLegible}</h3>
              </div>
              <a href="${confirmationUrl}" style="padding: 10px 20px; color: white; background-color: #007bff; text-decoration: none; border-radius: 5px;">
                Confirmar mi turno
              </a>
              <p>Este enlace expirará en 24 horas.</p>
            `,
          },
        },
      },
    };

    try {
      const command = new SendEmailCommand(emailParams);
      await sesClient.send(command);
      console.log("Email enviado vía AWS SES a:", reservaData.email);
    } catch (error) {
      console.error("Error al enviar vía AWS SES:", error);
    }
  },
);

const confirmarTurno = onRequest(
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

const crearReservaParaConfirmar = onCall(
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
        const slotKey = dayjs(startDate)
          .tz("America/Argentina/Buenos_Aires")
          .format("YYYY-MM-DD_HH-mm");
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

const limpiarTurnosExpirados = onSchedule(
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
        return;
      }
      const batch = db.batch();
      const reservaIds = [];
      for (const doc of expiradosSnapshot.docs) {
        const data = doc.data();
        if (data.start && data.cantidadPersonas) {
          const slotKey = dayjs(data.start.toDate())
            .tz("America/Argentina/Buenos_Aires")
            .format("YYYY-MM-DD_HH-mm");
          const counterRef = db.collection(COLS.COUNTERS).doc(slotKey);
          batch.update(counterRef, {
            count: FieldValue.increment(-Number(data.cantidadPersonas)),
          });
        }
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

const enviarRecordatoriosViernes = onSchedule(
  {
    schedule: "30 11 * * 5", // Todos los viernes a las 11:30 AM
    region: "us-central1",
    timeZone: "America/Argentina/Buenos_Aires",
    secrets: [
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_REGION",
      EMAIL_USER,
    ],
  },
  async (event) => {
    const sesClient = new SESClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // desde Sábado 00:00 a Domingo 23:59
    const proximoSabado = dayjs()
      .tz("America/Argentina/Buenos_Aires")
      .add(1, "day")
      .startOf("day");
    const proximoDomingoFin = dayjs()
      .tz("America/Argentina/Buenos_Aires")
      .add(2, "day")
      .endOf("day");

    try {
      const snapshot = await db
        .collection(COLS.TURNOS)
        .where("start", ">=", Timestamp.fromDate(proximoSabado.toDate()))
        .where("start", "<=", Timestamp.fromDate(proximoDomingoFin.toDate()))
        .where("recordatorioEnviado", "!=", true)
        .get();

      if (snapshot.empty) {
        console.log("No hay recordatorios pendientes por enviar.");
        return;
      }

      const turnos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log(`Enviando ${turnos.length} recordatorios...`);

      for (let i = 0; i < turnos.length; i += 20) {
        const lote = turnos.slice(i, i + 20);
        const batch = db.batch();

        const promesasLote = lote.map(async (doc) => {
          const reserva = doc.data();
          const fechaLegible = dayjs(reserva.start.toDate())
            .tz("America/Argentina/Buenos_Aires")
            .format("dddd D [de] MMMM [a las] HH:mm [hs]");

          const emailParams = {
            Source: `"Manzana de las Luces" <${EMAIL_USER.value()}>`,
            Destination: { ToAddresses: [reserva.email] },
            Message: {
              Subject: {
                Data: "Recordatorio: Tu visita a los túneles este fin de semana",
              },
              Body: {
                Html: {
                  Data: `
                    <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px;">
                      <h2 style="color: #333;">¡Hola ${reserva.nombreYApellido}!</h2>
                      <p>Te recordamos que tienes una reserva para visitar los túneles:</p>
                      <div style="background-color: #f8f9fa; padding: 15px; border-left: 5px solid #007bff;">
                        <p><strong>Fecha:</strong> ${fechaLegible}</p>
                        <p><strong>Lugar:</strong> Perú 222, CABA.</p>
                      </div>
                      <p>¡Te esperamos!</p>
                    </div>
                  `,
                },
              },
            },
          };

          try {
            await sesClient.send(new SendEmailCommand(emailParams));
            batch.update(doc.ref, {
              recordatorioEnviado: true,
              fechaRecordatorio: FieldValue.serverTimestamp(),
            });
            return true;
          } catch (err) {
            console.error(`Error enviando a ${reserva.email}:`, err);
            return false;
          }
        });

        await Promise.all(promesasLote);
        await batch.commit();
        console.log(
          `Lote finalizado. Progreso: ${Math.min(i + 20, turnos.length)}/${turnos.length}`,
        );
      }
    } catch (error) {
      console.error("Error en la función de recordatorios:", error);
    }
  },
);
