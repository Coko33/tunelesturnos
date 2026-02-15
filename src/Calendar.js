import { useState, useEffect, useRef, use } from "react";
import { getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { Calendar, dayjsLocalizer } from "react-big-calendar";
import Formulario from "./Formulario";
import Instructivo from "./Instructivo";
import Spinner from "./Spinner";
import CustomToolbar from "./CustomToolbar";
//import Anuncio from "./componentes/Anuncio";
import "react-big-calendar/lib/css/react-big-calendar.css";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "./Calendar.css";
import NoHayMasHabilitados from "./NoHayMasHabilitados";
import {
  TURNOS_CONFIRMADOS_REF,
  RESERVAS_PENDIENTES_REF,
  TURNOS_PUBLICOS_REF,
  APERTURA_REF,
} from "./firebase";
import HabilitadaBanner from "./componentes/HabilitadaBanner";
dayjs.locale("es");
const turnosMaxByDay = 54;
const turnosMaxBySlot = 6;
const horaMin = 15;
const horaMax = 18;

const FERIADOS_EVENTUALES = [
  "2025-12-25", // Ejemplo: Navidad
  "2026-01-01", // Ejemplo: Año Nuevo
  "2026-03-02", // Ejemplo: Carnaval Lunes
  "2026-03-03", // Ejemplo: Carnaval Martes
];

export default function Calendario() {
  const localizer = dayjsLocalizer(dayjs);
  const [turnos, setTurnos] = useState([]);
  const [view, setView] = useState("month");
  const [error, setError] = useState(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date());
  const [eventCountByDay, setEventCountByDay] = useState({});
  const [eventCountByHour, setEventCountByHour] = useState({});
  const [turnoSeleccionado, setTurnoSeleccionado] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [maxPersonasDisponibles, setMaxPersonasDisponibles] = useState(0);
  const [mostrarNoHayMas, setMostrarNoHayMas] = useState(false);
  const lastViewChangeRef = useRef(0);
  const [turneraHabilitada, setTurneraHabilitada] = useState(false);
  const [diaHabilitada, setDiaHabilitada] = useState(null);
  const [inicioHabilitada, setInicioHabilitada] = useState(null);
  const [finHabilitada, setFinHabilitada] = useState(null);
  const minDate = dayjs().day(5).startOf("day").toDate();
  const maxDate = dayjs().day(7).endOf("day").toDate();

  useEffect(() => {
    const esHorarioHabilitado = async () => {
      try {
        const docRef = doc(APERTURA_REF, "horarios");
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          console.log("El documento de horarios no existe");
          return;
        }
        const { dia, inicio, fin } = docSnap.data();
        setDiaHabilitada(dia);
        setInicioHabilitada(inicio);
        setFinHabilitada(fin);
        const zonaHoraria = "America/Argentina/Buenos_Aires";
        const ahora = dayjs().tz(zonaHoraria);
        const nombreDiaActual = ahora.format("dddd");
        const diaActualCapitalizado =
          nombreDiaActual.charAt(0).toUpperCase() + nombreDiaActual.slice(1);
        if (diaActualCapitalizado === dia) {
          const [horaInicio, minInicio] = inicio.split(":").map(Number);
          const [horaFin, minFin] = fin.split(":").map(Number);
          const momentoInicio = ahora
            .hour(horaInicio)
            .minute(minInicio)
            .second(0);
          const momentoFin = ahora.hour(horaFin).minute(minFin).second(0);
          if (ahora.isAfter(momentoInicio) && ahora.isBefore(momentoFin)) {
            setTurneraHabilitada(true);
            return;
          }
        }
      } catch {
      } finally {
      }
    };
    esHorarioHabilitado();
  }, []);

  useEffect(() => {
    if (turneraHabilitada) {
      const fecha = diaSeleccionado || new Date();
      if (view === "month") {
        fetchItems(fecha);
      } else if (view === "day") {
        fetchItemsForDay(fecha);
      }
    }
  }, [diaSeleccionado, view]);

  //busca los TURNOS PUBLICOS entre la fecha de hoy y el ultimo dia del mes
  const fetchItems = async (date) => {
    setLoading(true);
    setError(null);
    const startOfToday = dayjs().startOf("day").toDate();
    const endOfMonth = dayjs(date).endOf("month").toDate();
    const q = query(
      TURNOS_PUBLICOS_REF,
      where("start", ">=", startOfToday),
      where("start", "<=", endOfMonth),
    );
    try {
      const snapshot = await getDocs(q);
      const turnosList = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          cantidadPersonas: parseInt(data.cantidadPersonas) || 1,
          fechaParseada: dayjs(data.start.toDate()),
        };
      });
      //cuenta turnos ocupados por dia y por hora
      const countsByDay = turnosList.reduce((acc, t) => {
        const dayKey = t.fechaParseada.format("YYYY-MM-DD");
        acc[dayKey] = (acc[dayKey] || 0) + t.cantidadPersonas;
        return acc;
      }, {});
      const countsByHour = turnosList.reduce((acc, t) => {
        const hourKey = t.fechaParseada.format("YYYY-MM-DD HH:mm");
        acc[hourKey] = (acc[hourKey] || 0) + t.cantidadPersonas;
        return acc;
      }, {});
      setEventCountByDay(countsByDay);
      setEventCountByHour(countsByHour);
      //(estan contando turnos que sobrepasan los 6 turnos por franja)
      const turnosFormateadosParaCalendario = turnosList.map((t) => ({
        ...t,
        start: t.fechaParseada.toDate(),
        end: t.fechaParseada.add(20, "minute").toDate(),
      }));
      setTurnos(turnosFormateadosParaCalendario);
    } catch (e) {
      console.error("Error al obtener turnos:", e);
      setError("Error al cargar los turnos.");
    } finally {
      setLoading(false);
    }
  };

  //busca los TURNOS CONFIRMADOS y las RESERVAS PENDIENTES entre el horario de inicio y de fin del dia
  const fetchItemsForDay = async (selectedDay) => {
    setLoading(true);
    setError(null);
    const startOfDay = dayjs(selectedDay).startOf("day").toDate();
    const endOfDay = dayjs(selectedDay).endOf("day").toDate();
    const turnosQuery = query(
      TURNOS_CONFIRMADOS_REF,
      where("start", ">=", startOfDay),
      where("start", "<=", endOfDay),
    );
    const pendientesQuery = query(
      RESERVAS_PENDIENTES_REF,
      where("start", ">=", startOfDay),
      where("start", "<=", endOfDay),
    );
    try {
      const [turnosSnapshot, pendientesSnapshot] = await Promise.all([
        getDocs(turnosQuery),
        getDocs(pendientesQuery),
      ]);
      const turnosConfirmados = turnosSnapshot.docs.map((doc) => ({
        ...doc.data(),
        cantidadPersonas: Number(doc.data().cantidadPersonas || 1),
      }));
      const turnosPendientes = pendientesSnapshot.docs.map((doc) => ({
        ...doc.data(),
        cantidadPersonas: Number(doc.data().cantidadPersonas || 1),
      }));
      const turnosList = [...turnosConfirmados, ...turnosPendientes];
      const turnosFormated = turnosList.map((t) => ({
        start: dayjs(t.start).toDate(),
        end: dayjs(t.end).toDate(),
        title: t.title, //?
      }));
      setTurnos(turnosFormated);
    } catch (e) {
      console.error("Error al obtener turnos para el día:", e);
      setError("Error al cargar los turnos para este día.");
    } finally {
      setLoading(false);
    }
  };

  //maneja la vista dia y mes y saltea los dias no laborables y los anteriores a la fecha actual
  const handlerViewChange = (newView) => {
    lastViewChangeRef.current = Date.now(); //guarda el instante en timestamp en que la vista cambió para evitar clics pegados
    setView(newView);
    if (newView === "day") {
      let fechaBusqueda = dayjs(diaSeleccionado);
      while (
        esDiaNoLaborable(fechaBusqueda.toDate()) &&
        fechaBusqueda.isBefore(dayjs(maxDate))
      ) {
        fechaBusqueda = fechaBusqueda.add(1, "day");
      }
      setDiaSeleccionado(fechaBusqueda.toDate());
    }
    if (newView === "month") {
      setTurnoSeleccionado("");
      setTurnos([]);
    }
  };

  const handleSelectSlot = ({ start, end }) => {
    //el clic de seleccion tiene que ser 500ms después del clic de cambio de vista
    if (Date.now() - lastViewChangeRef.current < 500) {
      return;
    }
    const fueraDeRango =
      dayjs(start).isBefore(dayjs(minDate), "day") ||
      dayjs(start).isAfter(dayjs(maxDate), "day");
    if (
      fueraDeRango ||
      esDiaNoLaborable(start) ||
      (esDiaPasado(start) && !dayjs(start).isSame(dayjs(), "day"))
    ) {
      return;
    }
    if (mostrarFormulario && dayjs(start).isSame(dayjs(turnoSeleccionado)))
      return;
    if (
      esDiaNoLaborable(start) ||
      (esDiaPasado(start) && !dayjs(start).isSame(dayjs(), "day"))
    ) {
      return;
    }
    const turnosDisponibles = obtenerTurnosDisponiblesPorDia(start);
    if (view === "month") {
      if (turnosDisponibles === 0) {
        return;
      }
      setDiaSeleccionado(start);
      setView("day");
      lastViewChangeRef.current = Date.now();
    } else if (view === "day" && !estaTotalmenteLlenoPorPersonas(start)) {
      setTurnoSeleccionado(start);
      const maxDisponibles = obtenerEspaciosRestantes(start);
      setMaxPersonasDisponibles(maxDisponibles);
      setMostrarFormulario(true);
    }
  };

  const obtenerPersonasReservadas = (value) => {
    const hourFormated = dayjs(value).format("YYYY-MM-DD HH:mm");
    return eventCountByHour[hourFormated] || 0;
  };

  const estaTotalmenteLlenoPorPersonas = (value) => {
    const personasReservadas = obtenerPersonasReservadas(value);
    return personasReservadas >= turnosMaxBySlot;
  };

  const obtenerEspaciosRestantes = (value) => {
    const personasReservadas = obtenerPersonasReservadas(value);
    return turnosMaxBySlot - personasReservadas;
  };

  const estaSeleccionado = (value) => {
    return dayjs(value).isSame(dayjs(turnoSeleccionado), "minute");
  };

  const esDiaPasado = (value) => {
    return dayjs(value).isBefore(dayjs(), "day");
  };

  const esDiaNoLaborable = (date) => {
    const dayjsDate = dayjs(date);
    const dayOfWeek = dayjsDate.day();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      return true;
    }
    const dateKey = dayjsDate.format("YYYY-MM-DD");
    if (FERIADOS_EVENTUALES.includes(dateKey)) {
      return true;
    }
    return false;
  };

  const obtenerTurnosDisponiblesPorDia = (date) => {
    const dayKey = dayjs(date).format("YYYY-MM-DD");
    const eventosReservados = eventCountByDay[dayKey] || 0;
    return Math.max(0, turnosMaxByDay - eventosReservados);
  };

  //celdas en la vista mes. la funcion es llamada una vez por cada celda
  const CustomDateCellWrapper = ({ value, children }) => {
    const dayKey = dayjs(value).format("YYYY-MM-DD");
    const eventosReservados = eventCountByDay[dayKey] || 0;
    const turnosDisponibles = obtenerTurnosDisponiblesPorDia(value);
    const currentMonth = dayjs(diaSeleccionado).month();
    const cellMonth = dayjs(value).month();
    const esNoLaborable = esDiaNoLaborable(value);

    const fueraDeRango =
      dayjs(value).isBefore(dayjs(minDate), "day") ||
      dayjs(value).isAfter(dayjs(maxDate), "day");

    const ocupacionDiaria = eventosReservados / turnosMaxByDay; // Ej: 1/3 = 0.3333
    const porcentajeOcupacionDiaria = ocupacionDiaria * 100; // Ej: 33.33%

    if (currentMonth !== cellMonth) {
      return <div className="rbc-day-bg">{children}</div>;
    }
    let displayText = "";
    let statusClass = "";

    if (fueraDeRango) {
      displayText = "No disponible";
      statusClass = "disabled-day"; // Reutilizamos la clase o creamos una nueva
    } else if (esDiaPasado(value)) {
      displayText = "";
      statusClass = "past-day";
    } else if (esNoLaborable) {
      displayText = "Día No Laborable";
      statusClass = "disabled-day";
    } else if (turnosDisponibles === 0) {
      displayText = "COMPLETO";
      statusClass = "full";
    } else {
      displayText = `${turnosDisponibles} turnos`;
      statusClass = "available";
    }

    const handleCellClick = (e) => {
      e.stopPropagation();
      if (fueraDeRango) return;
      handleSelectSlot({ start: value, end: value });
    };

    return (
      <div
        className={`rbc-day-bg custom-date-cell-wrapper ${statusClass}`}
        onClick={handleCellClick}
        style={fueraDeRango ? { pointerEvents: "none", opacity: 0.5 } : {}} // Opcional: refuerzo visual
      >
        {children}
        {view === "month" && (
          <div className="event-count-indicator">
            {!fueraDeRango &&
              eventosReservados > 0 &&
              turnosDisponibles > 0 && (
                <div
                  className="daily-occupancy-bar"
                  style={{
                    width: `${porcentajeOcupacionDiaria}%`,
                  }}
                />
              )}
            <p
              className="daily-text-indicator"
              dangerouslySetInnerHTML={{ __html: displayText }}
            />
          </div>
        )}
      </div>
    );
  };

  //celdas en la vista dia
  const CustomTimeSlotWrapper = ({ value, children }) => {
    estaSeleccionado(value);
    const isDayViewSlot = view === "day";
    const isGutterSlot =
      !children || (Array.isArray(children) && children.length === 0);
    const personasReservadas = obtenerPersonasReservadas(value);
    const personasRestantes = obtenerEspaciosRestantes(value);
    const estaLleno = estaTotalmenteLlenoPorPersonas(value);
    const porcentajeOcupacion = (personasReservadas / turnosMaxBySlot) * 100;
    const formattedStart = dayjs(value).format("HH:mm");

    const handleTouchSelect = (e) => {
      e.stopPropagation();
      handleSelectSlot({
        start: value,
        end: dayjs(value).add(20, "minutes").toDate(),
      });
    };

    let contentText = "";
    if (estaSeleccionado(value)) {
      contentText = `${formattedStart} Seleccionado`;
    } else if (estaLleno) {
      contentText = "Completo";
    } else {
      contentText = `${formattedStart} (${personasRestantes} lugares disponibles)`;
    }

    const hour = dayjs(value).hour();
    if (hour < horaMin || hour >= horaMax) {
      return children;
    }

    let className = "";
    if (esDiaNoLaborable(value)) {
      className += " disabled-slot";
    }
    className = estaSeleccionado(value)
      ? "selected"
      : estaLleno
        ? "full"
        : "available";

    return (
      <>
        {children}
        {isDayViewSlot && !isGutterSlot && (
          <div
            className={`time-slot-content-wrapper ${className}`}
            onClick={handleTouchSelect}
          >
            {personasReservadas > 0 && !estaLleno && (
              <div
                className="occupancy-bar"
                style={{
                  width: `${porcentajeOcupacion}%`,
                  backgroundColor: "crimson",
                  opacity: 1,
                }}
              ></div>
            )}
            <span>{contentText}</span>
          </div>
        )}
      </>
    );
  };

  const cerrarFormulario = (debeRecargar) => {
    setMostrarFormulario(false);
    setTurnoSeleccionado("");
    setView("day");
    if (debeRecargar) {
      console.log("Refrescando calendario...");
      // Llamamos a las funciones que traen los datos actualizados
      fetchItems(diaSeleccionado);
      if (view === "day") {
        fetchItemsForDay(diaSeleccionado);
      }
    }
  };

  const isPreviousDisabled = diaSeleccionado
    ? dayjs(diaSeleccionado).isSameOrBefore(dayjs(minDate), "month")
    : false;
  const isNextDisabled = diaSeleccionado
    ? dayjs(diaSeleccionado).isSameOrAfter(dayjs(maxDate), "month")
    : false;

  return (
    <>
      {mostrarFormulario && (
        <Formulario
          turnoSeleccionado={turnoSeleccionado}
          onClose={cerrarFormulario}
          maxPersonasDisponibles={maxPersonasDisponibles}
        />
      )}
      {mostrarNoHayMas && <NoHayMasHabilitados />}
      <div className="InstructivoYCalendar__container">
        <Instructivo />
        {!turneraHabilitada && (
          <HabilitadaBanner
            diaHabilitada={diaHabilitada}
            inicioHabilitada={inicioHabilitada}
            finHabilitada={finHabilitada}
          ></HabilitadaBanner>
        )}
        {turneraHabilitada && (
          <div className={`Calendar__container view-${view}`}>
            {loading && (
              <div className="Calendar__spinner-overlay">
                <Spinner />
              </div>
            )}
            {/* <Anuncio/> */}
            {!loading && (
              <Calendar
                localizer={localizer}
                events={turnos}
                views={["month", "day"]}
                view={view}
                date={diaSeleccionado}
                onSelectSlot={handleSelectSlot}
                onView={handlerViewChange}
                onNavigate={(newDate) => {
                  if (
                    dayjs(newDate).isBefore(minDate, "month") ||
                    dayjs(newDate).isAfter(maxDate, "month")
                  )
                    return;
                  setDiaSeleccionado(newDate);
                }}
                selectable
                longPressThreshold={1}
                drilldownView={null}
                components={{
                  dateCellWrapper: CustomDateCellWrapper,
                  timeSlotWrapper: CustomTimeSlotWrapper,
                  toolbar: (props) => (
                    <CustomToolbar
                      {...props}
                      esDiaNoLaborable={esDiaNoLaborable}
                      minDate={minDate}
                      maxDate={maxDate}
                      setDiaSeleccionado={setDiaSeleccionado}
                    />
                  ),
                }}
                min={
                  view === "day"
                    ? dayjs().hour(horaMin).minute(0).toDate()
                    : minDate
                }
                max={
                  view === "day"
                    ? dayjs().hour(horaMax).minute(0).toDate()
                    : maxDate
                }
                timeslots={3}
                step={20}
                showMultiDayTimes={false}
                messages={{
                  next: "Siguiente",
                  previous: "Anterior",
                  today: "Hoy",
                  month: "Mes",
                  day: "Dia",
                }}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
