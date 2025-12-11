//2024-12-19T12:00:00 - si el evento no tiene hora definida aparece arriba de todo
import React, { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Calendar, dayjsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "./Calendar.css";
import Formulario from "./Formulario";
import { useEsMovil } from "./useEsMovil";
dayjs.locale("es");
const turnosRef = collection(db, "turnos");
const turnosMax = 3;
const turnosMaxByHour = 3;
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
  const [diaSeleccionado, setDiaSeleccionado] = useState();
  const [eventCountByDay, setEventCountByDay] = useState({});
  const [eventCountByHour, setEventCountByHour] = useState({});
  const [turnoSeleccionado, setTurnoSeleccionado] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const esMovil = useEsMovil();

  useEffect(() => {
    // Si diaSeleccionado no está definido (ej. al cargar por primera vez),
    // se puede establecer a la fecha actual para la vista de mes.
    if (view === "day") {
      fetchItemsForDay(diaSeleccionado);
    } else {
      fetchItems();
    }
  }, [diaSeleccionado, view]);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      // Considerar filtrar por un rango de fechas (ej. mes actual) para evitar cargar todos los turnos
      const querySnapshot = await getDocs(turnosRef);
      const turnosList = querySnapshot.docs.map((doc) => doc.data());
      const turnosFormated = turnosList.map((t) => ({
        start: dayjs(t.start).toDate(),
        end: dayjs(t.end).toDate(),
        title: t.title,
      }));
      // No limpiar setTurnos([]) antes de asignar los nuevos, para evitar un parpadeo
      setTurnos(turnosFormated);

      // Contar eventos por día
      const countsByDay = turnosFormated.reduce((acc, t) => {
        const dayKey = dayjs(t.start).format("YYYY-MM-DD");
        acc[dayKey] = (acc[dayKey] || 0) + 1;
        return acc;
      }, {});
      setEventCountByDay(countsByDay);

      // Contar eventos por hora
      const countsByHour = turnosFormated.reduce((acc, t) => {
        const HourKey = dayjs(t.start).format("YYYY-MM-DD HH:mm");
        acc[HourKey] = (acc[HourKey] || 0) + 1;
        return acc;
      }, {});
      setEventCountByHour(countsByHour);
    } catch (e) {
      console.error("Error al obtener turnos:", e);
      setError("Error al cargar los turnos.");
    } finally {
      setLoading(false);
    }
  };

  const fetchItemsForDay = async (selectedDay) => {
    setLoading(true);
    setError(null);
    const startOfDay = dayjs(selectedDay)
      .startOf("day")
      .format("YYYY-MM-DDTHH:mm:ss");
    const endOfDay = dayjs(selectedDay)
      .endOf("day")
      .format("YYYY-MM-DDTHH:mm:ss");
    const q = query(
      turnosRef,
      where("start", ">=", startOfDay),
      where("start", "<=", endOfDay)
    );
    try {
      const querySnapshot = await getDocs(q);
      const turnosList = querySnapshot.docs.map((doc) => doc.data());
      const turnosFormated = turnosList.map((t) => ({
        start: dayjs(t.start).toDate(),
        end: dayjs(t.end).toDate(),
        title: t.title,
      }));
      setTurnos(turnosFormated);
    } catch (e) {
      console.error("Error al obtener turnos para el día:", e);
      setError("Error al cargar los turnos para este día.");
    } finally {
      setLoading(false);
    }
  };

  const handlerViewChange = (newView) => {
    setView(newView);
    if (newView === "month") {
      setTurnoSeleccionado("");
      setTurnos([]);
    }
  };

  const handleSelectSlot = ({ start, end }) => {
    if (esDiaNoLaborable(start)) {
      return; 
    }

    const turnosDisponibles = obtenerTurnosDisponiblesPorDia(start);
    if (view === "month" && turnosDisponibles === 0) {
        return;
    }
     
    if (view === "month" && !esDiaPasado(start)) {
      setDiaSeleccionado(start);
      setView("day");
    } else if (view === "day" && !estaOcupado(start)) {
      setTurnoSeleccionado(start);
    }
  };

  const handleNavigate = (date) => {
    /* if (view === "month") {
      setDiaSeleccionado(date);
    } */
    setDiaSeleccionado(date);
  };

  const estaOcupado = (value) => {
    const hourFormated = dayjs(value).format("YYYY-MM-DD HH:mm");
    if (turnos.length === 0) {
      return false;
    }
    return eventCountByHour[hourFormated] >= turnosMaxByHour;
  };

  const estaSeleccionado = (value) => {
    return dayjs(value).isSame(dayjs(turnoSeleccionado), "minute");
  };

  const esDiaPasado = (value) => {
    return dayjs(value).isBefore(dayjs(), "day");
  };

  const esDiaNoLaborable = (date) => {
    const dayjsDate = dayjs(date);
    const dayOfWeek = dayjsDate.day(); // 0 = Domingo, 1 = Lunes, 2 = Martes

    // Chequea Lunes (1) o Martes (2)
    if (dayOfWeek === 1 || dayOfWeek === 2) {
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

    return Math.max(0, turnosMax - eventosReservados);
  };

  const CustomDateCellWrapper = ({ value, children }) => {
    const dayKey = dayjs(value).format("YYYY-MM-DD");
    const eventosReservados = eventCountByDay[dayKey] || 0;
    const turnosDisponibles = obtenerTurnosDisponiblesPorDia(value);
    const currentMonth = dayjs(diaSeleccionado).month(); 
    const cellMonth = dayjs(value).month();
    const esNoLaborable = esDiaNoLaborable(value);

    if (currentMonth !== cellMonth) {
      return <div className="rbc-day-bg">{children}</div>;
    }

    let displayText = "";
    let statusClass = "";
    
    if (esDiaPasado(value)) {
      displayText = ""; 
      statusClass = "past-day";
    } else if (esNoLaborable) {
      displayText = "Día No Laborable";
      statusClass = "disabled-day";
    } else if (turnosDisponibles === 0) {
      displayText = "COMPLETO";
      statusClass = "full";
    } else {
      displayText = `Turnos<br />disponibles: ${turnosDisponibles}`;
      statusClass = "available";
    }
    return (
      <div className="rbc-day-bg custom-date-cell-wrapper">
        {view === "month" && (
          <div className={`event-count-indicator ${statusClass}`}>
            <p dangerouslySetInnerHTML={{ __html: displayText }}></p>
          </div>
        )}
      </div>
    );
  };

  //celdas en la vista dia
  const CustomTimeSlotWrapper = ({ value, children }) => {
    estaSeleccionado(value);
    const isDayViewSlot = view === "day";
    const isGutterSlot = !children || (Array.isArray(children) && children.length === 0);

    const startTime = dayjs(value);
    const endTime = startTime.add(20, 'minute'); 
    const formattedStart = startTime.format('HH:mm');
    const formattedEnd = endTime.format('HH:mm');
    const timeRange = ` de ${formattedStart} a ${formattedEnd}`;
    let status = estaSeleccionado(value) ? "seleccionado" : estaOcupado(value) ? "ocupado " + eventCountByHour[dayjs(value).format("YYYY-MM-DD HH:mm")] : "disponible";
    let className = estaSeleccionado(value) ? 'selected' : (estaOcupado(value) ? 'full' : 'available');

    const newContent = `${status}${timeRange}`;
    return (
      <>
        {children}
        {isDayViewSlot && !isGutterSlot && (
          <div className = {className}>
            {newContent}
          </div>
        )}
      </>
    );
  };
  
  return (
    <>
      <Formulario turnoSeleccionado={turnoSeleccionado}></Formulario>
      <div className={`Calendar__container view-${view}`}>
        <Calendar
          localizer={localizer}
          events={turnos}
          views={["month", "day"]}
          view={view}
          date={diaSeleccionado}
          onView={handlerViewChange}
          onSelectSlot={handleSelectSlot}
          onNavigate={handleNavigate}
          selectable
          components={{
            dateCellWrapper: CustomDateCellWrapper,
            timeSlotWrapper: CustomTimeSlotWrapper,
          }}
          min={dayjs().hour(horaMin).minute(0).second(0).toDate()}
          max={dayjs().hour(horaMax).minute(0).second(0).toDate()}
          timeslots={3}
          step={20}
          showMultiDayTimes={false}
          /* 
          startAccessor="start"
          endAccessor="end"
          */
          messages={{
            next: "Siguiente",
            previous: "Anterior",
            today: "Hoy",
            month: "Mes",
            day: "Dia",
          }}
        />
      </div>
    </>
  );
}
