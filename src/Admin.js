import "./Admin.css";
import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { db } from "./firebase";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import dayjs from "dayjs";

export default function Admin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [turnosAgrupados, setTurnosAgrupados] = useState({});
  const [turnoActual, setTurnoActual] = useState(dayjs().toDate());

  console.log(turnoActual);

  const formatTimestampToDate = (timestamp) => {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString().split('T')[0];
    }
    return 'Fecha no definida';
  };

  const formatTimestampToDateTime = (timestamp) => {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString('es-ES', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    return 'Hora no definida';
  };

  const formatDateForDisplay = (timestamp) => {
    if (timestamp && typeof timestamp.toDate === 'function') {
        const fecha = timestamp.toDate();
        const diaSemana = fecha.toLocaleString('es-ES', { weekday: 'long' }).replace('.', ''); 
        const diaNumero = fecha.getDate();
        const mes = fecha.toLocaleString('es-ES', { month: 'long' }); 
        const anio = fecha.getFullYear();
        const diaSemanaMayus = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
        return (
            <strong>
                {diaSemanaMayus} {diaNumero}
                <br />
                {mes} {anio}
            </strong>
        );
    }
    return 'Fecha no definida';
  };

  const fetchTurnos = async () => {
    setLoading(true);
    setError(null);
    try {
      const turnosQuery = query(
          collection(db, "turnos"), 
          orderBy("turno", "desc") 
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
              end: formatTimestampToDateTime(data.end)
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
  useEffect(() => {
    fetchTurnos(); 
  }, []);

  const deleteTurno = async (id) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este turno?")) {
      try {
        await deleteDoc(doc(db, "turnos", id));
        fetchTurnos(); 
      } catch (e) {
        console.error("Error al eliminar el turno:", e);
        setError("No se pudo eliminar el turno.");
      }
    }
  };

  const { logout } = useAuth();

  if (loading) return <p>Cargando turnos...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <>
      <div className="admin__headerContainer">
        <h1>Panel de Administración</h1>
        <button onClick={logout}>Salir</button>
      </div>
      <div className="admin__tableContainer"><table><thead><tr><th>Fecha</th><th>Nombre</th><th>Documento</th><th>Reservas</th><th>Email</th><th>Hora Turno</th><th>Acciones</th></tr></thead><tbody>
              {Object.keys(turnosAgrupados).map((fecha) => (
                  turnosAgrupados[fecha].map((turno, index) => (
                      <tr key={turno.id}>
                          {index === 0 && (
                              <td className="fecha-rowspan" rowSpan={turnosAgrupados[fecha].length}>
                                  {turno.fecha}
                              </td>
                          )}
                          <td>{turno.nombreYApellido}</td>
                          <td>{turno.numeroDocumento}</td>
                          <td>{turno.cantidadPersonas}</td>
                          <td>{turno.email}</td>
                          <td>{turno.turno.split(', ')[1]}</td>
                          <td>
                            <button onClick={() => deleteTurno(turno.id)}>Eliminar</button>
                          </td>
                      </tr>
                  ))
              ))}</tbody></table>
      {Object.keys(turnosAgrupados).length === 0 && !loading && <p>No hay turnos registrados.</p>}
      </div>
    </>
  );
}
