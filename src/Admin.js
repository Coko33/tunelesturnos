import "./Admin.css";
import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useCotasProximos } from "./hooks/useCotasProximos";
import {
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  writeBatch,
  collection,
  where,
  limit,
} from "firebase/firestore";
import { TURNOS_CONFIRMADOS_REF, TURNOS_CAIDOS_REF, db } from "./firebase";
import dayjs from "dayjs";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import SelectorApertura from "./componentes/SelectorApertura";

export default function Admin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [turnosAgrupados, setTurnosAgrupados] = useState({});
  const [pendientes, setPendientes] = useState(0);
  const [turnoActual, setTurnoActual] = useState([]); //array con las reservas del turno actual
  const [turnoSiguiente, setTurnoSiguiente] = useState([]); //array con las reservas del turno proximo
  const [inicioFranja, setInicioFranja] = useState(null);
  const [finFranja, setFinFranja] = useState(null);

  /* useEffect(() => {
    const obtenerContador = async () => {
      const q = query(TURNOS_CAIDOS_REF, where("relevado", "==", false));
      const snap = await getDocs(q);
      setPendientes(snap.size);
    };
    obtenerContador();
  }, []);

  useEffect(() => {
    fetchTurnos();
  }, []); */

  const cotas = useCotasProximos();
  const { logout } = useAuth();

  useEffect(() => {
    if (cotas) {
      fetchProximosTurnos();
    }
  }, [cotas?.inicioTurnoActual]);

  const fetchTurnos = async () => {
    setLoading(true);
    setError(null);
    try {
      const turnosQuery = query(
        TURNOS_CONFIRMADOS_REF, //TURNOS_CAIDOS_REF,
        orderBy("turno", "desc"),
      );
      const querySnapshot = await getDocs(turnosQuery);

      const grupos = {};
      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const fechaAgrupacion = formatTimestampToDate(data.turno);
        const turnoFormateado = formatTimestampToDateTime(data.turno);
        const fechaDisplay = formatDateForDisplay(data.turno);

        const turno = {
          id: doc.id,
          ...data,
          turno: turnoFormateado,
          fecha: fechaDisplay,
          start: formatTimestampToDateTime(data.start),
          end: formatTimestampToDateTime(data.end),
        };
        if (!grupos[fechaAgrupacion]) {
          grupos[fechaAgrupacion] = [];
        }
        grupos[fechaAgrupacion].push(turno);
      });
      setTurnosAgrupados(grupos);
    } catch (e) {
      console.error("Error al obtener turnos: ", e);
      setError("Error al cargar los turnos.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProximosTurnos = async () => {
    if (!cotas.inicioTurnoActual || !cotas.finTurnoActual) return;
    try {
      const qActual = query(
        TURNOS_CONFIRMADOS_REF,
        where("turno", ">=", cotas.inicioTurnoActual.toDate()),
        where("turno", "<", cotas.finTurnoActual.toDate()),
        orderBy("turno", "asc"),
      );
      const qSiguiente = query(
        TURNOS_CONFIRMADOS_REF,
        where("turno", "==", cotas.finTurnoActual.toDate()),
        orderBy("turno", "asc"),
      );

      const [snapActual, snapSiguiente] = await Promise.all([
        getDocs(qActual),
        getDocs(qSiguiente),
      ]);

      const turnoAct = snapActual.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const turnoSig = snapSiguiente.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTurnoActual(turnoAct);
      setTurnoSiguiente(turnoSig);
    } catch (e) {
      console.error("Error al obtener turnos: ", e);
      setError("Error al cargar los turnos.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTurnosByFranja = async (inicio, fin) => {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        TURNOS_CONFIRMADOS_REF,
        where("turno", ">=", inicio),
        where("turno", "<", fin),
        orderBy("turno", "asc"),
      );
      const querySnapshot = await getDocs(q);
      const grupos = {};
      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const fechaAgrupacion = formatTimestampToDate(data.turno);
        const turnoFormateado = formatTimestampToDateTime(data.turno);
        const fechaDisplay = formatDateForDisplay(data.turno);

        const turno = {
          id: doc.id,
          ...data,
          turno: turnoFormateado,
          fecha: fechaDisplay,
          start: formatTimestampToDateTime(data.start),
          end: formatTimestampToDateTime(data.end),
        };
        if (!grupos[fechaAgrupacion]) {
          grupos[fechaAgrupacion] = [];
        }
        grupos[fechaAgrupacion].push(turno);
      });
      setTurnosAgrupados(grupos);
    } catch (e) {
      console.error("Error al obtener turnos: ", e);
      setError("Error al cargar los turnos.");
    } finally {
      setLoading(false);
    }
  };

  const formatTimestampToDate = (timestamp) => {
    if (timestamp && typeof timestamp.toDate === "function") {
      return timestamp.toDate().toISOString().split("T")[0];
    }
    return "Fecha no definida";
  };

  const formatTimestampToDateTime = (timestamp) => {
    if (timestamp && typeof timestamp.toDate === "function") {
      return timestamp.toDate().toLocaleString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "Hora no definida";
  };

  const formatDateForDisplay = (timestamp) => {
    if (timestamp && typeof timestamp.toDate === "function") {
      const fecha = timestamp.toDate();
      const diaSemana = fecha
        .toLocaleString("es-ES", { weekday: "long" })
        .replace(".", "");
      const diaNumero = fecha.getDate();
      const mes = fecha.toLocaleString("es-ES", { month: "long" });
      const anio = fecha.getFullYear();
      const diaSemanaMayus =
        diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
      return (
        <strong>
          {diaSemanaMayus} {diaNumero}
          <br />
          {mes} {anio}
        </strong>
      );
    }
    return "Fecha no definida";
  };

  if (loading) return <p>Cargando turnos...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!cotas) return <div>Calculando próximos turnos...</div>;
  const { inicioTurnoActual, finTurnoActual, finTurnoSiguiente } = cotas;

  //ANTES DE BORRAR EL DOC SE PODRIA PASAR A UNA COLECCION DE BORRADOS
  /* const deleteTurno = async (id) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este turno?")) {
      try {
        await deleteDoc(doc(TURNOS_CONFIRMADOS_REF, id));
        fetchTurnos();
      } catch (e) {
        console.error("Error al eliminar el turno:", e);
        setError("No se pudo eliminar el turno.");
      }
    }
  }; */

  //MIGRACION
  const inicializarCampoRelevadoMasivo = async () => {
    console.log("Iniciando migración...");

    try {
      const snapshot = await getDocs(TURNOS_CAIDOS_REF);
      const todosLosDocs = snapshot.docs;
      const totalDocs = todosLosDocs.length;

      let documentosProcesados = 0;
      let documentosActualizados = 0;

      for (let i = 0; i < totalDocs; i += 500) {
        const batch = writeBatch(db);
        const segmento = todosLosDocs.slice(i, i + 500);
        segmento.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          if (data.relevado === undefined) {
            batch.update(docSnapshot.ref, { relevado: false });
            documentosActualizados++;
          }
          documentosProcesados++;
        });

        await batch.commit();
        console.log(
          `Progreso: ${documentosProcesados} de ${totalDocs} revisados...`,
        );
      }

      console.log(`¡Migración terminada!`);
      console.log(
        `Se agregaron campos a ${documentosActualizados} documentos.`,
      );
    } catch (error) {
      console.error("Error durante la migración:", error);
    }
  };
  //DESCARGAR LOTE DE 100 EMAILS CAIDOS
  const descargarLoteEmailsCSV = async () => {
    console.log("Iniciando descarga de lote de 100 emails...");

    try {
      // 1. Consultamos solo 100 que no hayan sido relevados
      const q = query(
        TURNOS_CAIDOS_REF,
        where("relevado", "==", false),
        limit(100),
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("No hay más emails pendientes por relevar.");
        return;
      }

      const idsParaActualizar = [];
      const listaEmails = [];

      // 2. Extraemos los emails y guardamos los IDs
      querySnapshot.forEach((documento) => {
        const data = documento.data();
        if (data.email) {
          listaEmails.push(data.email);
          idsParaActualizar.push(documento.id);
        }
      });

      // 3. GENERAR CSV (solo una columna con los emails)
      // Usamos el encabezado "Email" que la mayoría de plataformas aceptan
      const csvContent = "Email\n" + listaEmails.join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      // Nombre del archivo con la fecha y hora para no confundirlos
      const timestamp = new Date().toLocaleTimeString().replace(/:/g, "-");
      link.setAttribute("href", url);
      link.setAttribute("download", `lote_emails_${timestamp}.csv`);

      document.body.appendChild(link);
      link.click(); // Dispara la descarga
      document.body.removeChild(link);

      // 4. ACTUALIZAR EN FIREBASE (Marcar como relevados)
      const batch = writeBatch(db);
      idsParaActualizar.forEach((id) => {
        const ref = doc(db, "turnos_caidos", id);
        batch.update(ref, { relevado: true });
      });

      await batch.commit();

      console.log(`Lote de ${idsParaActualizar.length} procesado con éxito.`);
      alert(
        `Descargados ${idsParaActualizar.length} emails. Estos registros ya no aparecerán en la próxima descarga.`,
      );
    } catch (error) {
      console.error("Error al procesar el lote:", error);
      alert("Hubo un error. Revisa la consola.");
    }
  };

  const imprimirTablaTurnos = () => {
    // Creamos una nueva ventana o pestaña
    const ventanaImpresion = window.open("", "_blank");
    // Construimos el contenido HTML
    let contenidoHtml = `
      <html>
        <head>
          <title>Reporte de Turnos - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { text-align: center; color: #000; }
            .fecha-grupo { background: #f0f0f0; padding: 10px; margin-top: 20px; font-weight: bold; border-left: 5px solid #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #eee; }
            .observaciones { font-size: 10px; color: #666; font-style: italic; }
            @media print {
              .no-print { display: none; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>Planilla de Turnos Confirmados</h1>
          <p>Generado el: ${dayjs().format("DD/MM/YYYY HH:mm")}</p>
    `;
    // Recorremos los turnos agrupados por día
    Object.keys(turnosAgrupados)
      .sort()
      .forEach((fecha) => {
        contenidoHtml += `
        <div class="fecha-grupo">Día: ${fecha}</div>
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Nombre y Apellido</th>
              <th>Pers.</th>
              <th>Documento</th>
              <th>Email</th>
              <th>Edad</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
      `;
        turnosAgrupados[fecha].forEach((t) => {
          contenidoHtml += `
          <tr>
            <td>${t.turno.split(", ")[1]}</td>
            <td>${t.nombreYApellido}</td>
            <td>${t.cantidadPersonas || 1}</td>
            <td>${t.numeroDocumento}</td>
            <td>${t.email}</td>
            <td>${t.edad || "-"}</td>
            <td class="observaciones">${t.observaciones || ""}</td>
          </tr>
        `;
        });
        contenidoHtml += `</tbody></table>`;
      });
    contenidoHtml += `
          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer;">Confirmar Impresión</button>
          </div>
        </body>
      </html>
    `;
    ventanaImpresion.document.write(contenidoHtml);
    ventanaImpresion.document.close();
  };

  return (
    <>
      <SelectorApertura></SelectorApertura>
      <div className="admin__headerContainer">
        <h1>Panel de Administración</h1>
        <button onClick={logout}>Salir</button>

        <div className="admin__actions">
          <button
            onClick={imprimirTablaTurnos}
            className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-black"
          >
            🖨️ Descargar Planilla para Imprimir
          </button>
        </div>

        {/* <div className="p-4 border rounded-lg shadow-sm">
          <h2 className="text-xl font-bold mb-4">Cronograma de Turnos</h2>

          <div className="mb-4">
            <p className="text-sm text-gray-500">Turno Actual:</p>
            <p className="font-mono font-bold text-blue-600">
              {inicioTurnoActual.format("dddd DD/MM")} |{" "}
              {inicioTurnoActual.format("HH:mm")} a{" "}
              {finTurnoActual.format("HH:mm")}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Dni</th>
                  <th>Email</th>
                  <th>Reservas</th>
                </tr>
              </thead>
              <tbody>
                {turnoActual.length > 0 ? (
                  turnoActual.map((t) => (
                    <tr key={t.id}>
                      <td>{t.nombreYApellido}</td>
                      <td>{t.numeroDocumento}</td>
                      <td>{t.email}</td>
                      <td>{t.cantidadPersonas}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3">No hay reservas</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <p className="text-sm text-gray-500">Siguiente bloque:</p>
            <p className="font-mono text-gray-700">
              {finTurnoActual.format("HH:mm")} a{" "}
              {finTurnoSiguiente.format("HH:mm")}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Dni</th>
                  <th>Email</th>
                  <th>Reservas</th>
                  <th>Turno</th>
                </tr>
              </thead>
              <tbody>
                {turnoSiguiente.length > 0 ? (
                  turnoSiguiente.map((t) => (
                    <tr key={t.id}>
                      <td>{t.nombreYApellido}</td>
                      <td>{t.numeroDocumento}</td>
                      <td>{t.email}</td>
                      <td>{t.cantidadPersonas}</td>
                      <td>{formatTimestampToDateTime(t.turno)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3">No hay reservas</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {cotas.esEnVivo && (
            <span className="mt-4 inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full animate-pulse">
              • Turno en curso
            </span>
          )}
        </div> */}
      </div>

      <div className="admin__tablaFranjaContainer">
        <DatePicker
          selected={inicioFranja}
          onChange={(date) => setInicioFranja(date)}
          showTimeSelect
          dateFormat="Pp"
        />
        <DatePicker
          selected={finFranja}
          onChange={(date) => setFinFranja(date)}
          showTimeSelect
          dateFormat="Pp"
        />
        <button onClick={() => fetchTurnosByFranja(inicioFranja, finFranja)}>
          Buscar
        </button>
      </div>

      <div className="admin__tableContainer">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Nombre</th>
              <th>Documento</th>
              <th>Reservas</th>
              <th>Email</th>
              <th>Hora Turno</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(turnosAgrupados).map((fecha) =>
              turnosAgrupados[fecha].map((turno, index) => (
                <tr key={turno.id}>
                  {index === 0 && (
                    <td
                      className="fecha-rowspan"
                      rowSpan={turnosAgrupados[fecha].length}
                    >
                      {turno.fecha}
                    </td>
                  )}
                  <td>{turno.nombreYApellido}</td>
                  <td>{turno.numeroDocumento}</td>
                  <td>{turno.cantidadPersonas}</td>
                  <td>{turno.email}</td>
                  <td>{turno.turno.split(", ")[1]}</td>
                  <td></td>
                </tr>
              )),
            )}
          </tbody>
        </table>
        {Object.keys(turnosAgrupados).length === 0 && !loading && (
          <p>No hay turnos registrados.</p>
        )}
      </div>
      {/*       <div>
        <p>Turnos caidos sin relevar: {pendientes}</p>
        <button onClick={descargarLoteEmailsCSV}>Descargar lote</button>
        <button onClick={inicializarCampoRelevadoMasivo}>
          inicializarCampoRelevadoMasivo
        </button>
      </div> */}
    </>
  );
}
