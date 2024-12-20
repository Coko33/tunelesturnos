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
dayjs.locale("es");
const turnosRef = collection(db, "turnos");
const turnosMax = 2;

export default function Calendario() {
  const localizer = dayjsLocalizer(dayjs);
  const [turnos, setTurnos] = useState([]);
  const [view, setView] = useState("month");
  const [diaSeleccionado, setDiaSeleccionado] = useState();
  const [eventCountByDay, setEventCountByDay] = useState({});
  const [turnoSeleccionado, setTurnoSeleccionado] = useState("");

  useEffect(() => {
    if (view === "day") {
      fetchItemsForDay(diaSeleccionado);
    } else {
      fetchItems();
    }
  }, [diaSeleccionado, view]);

  const fetchItems = async () => {
    const querySnapshot = await getDocs(turnosRef);
    const turnosList = querySnapshot.docs.map((doc) => doc.data());
    const turnosFormated = turnosList.map((t) => ({
      start: dayjs(t.start).toDate(),
      end: dayjs(t.end).toDate(),
      title: t.title,
    }));
    setTurnos([]);
    // Agrupar eventos por día
    const counts = turnosFormated.reduce((acc, t) => {
      const dayKey = dayjs(t.start).format("YYYY-MM-DD");
      acc[dayKey] = (acc[dayKey] || 0) + 1;
      return acc;
    }, {});
    setEventCountByDay(counts);
  };

  const fetchItemsForDay = async (selectedDay) => {
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

    const querySnapshot = await getDocs(q);
    const turnosList = querySnapshot.docs.map((doc) => doc.data());
    const turnosFormated = turnosList.map((t) => ({
      start: dayjs(t.start).toDate(),
      end: dayjs(t.end).toDate(),
      title: t.title,
    }));
    setTurnos(turnosFormated);
  };

  const handlerViewChange = (newView) => {
    setView(newView);
    if (newView === "month") {
      setTurnoSeleccionado("");
      setTurnos([]);
    }
  };

  const handleSelectSlot = ({ start, end }) => {
    if (view === "month") {
      setDiaSeleccionado(start);
      setView("day");
    } else if (view === "day") {
      setTurnoSeleccionado(start);
    }
  };

  const handleNavigate = (date) => {
    if (view === "month") {
      setDiaSeleccionado(date);
    }
  };

  const CustomDateCellWrapper = ({ value, children }) => {
    const dayKey = dayjs(value).format("YYYY-MM-DD");
    const eventCount = eventCountByDay[dayKey] || 0;

    const currentMonth = dayjs(diaSeleccionado).month(); // 'date' viene del prop del calendario
    const cellMonth = dayjs(value).month();

    if (currentMonth !== cellMonth) {
      return <div className="rbc-day-bg">{children}</div>;
    }

    return (
      <div
        className="rbc-day-bg"
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        {children}
        {view === "month" && eventCount >= 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              backgroundColor: eventCount === turnosMax ? "red" : "limegreen",
              borderRadius: "7px 7px 0 0",
              color: "white",
              width: "100%",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              zIndex: 2000,
            }}
          >
            {eventCount === turnosMax ? "completo" : "disponible"}
          </div>
        )}
      </div>
    );
  };
  const CustomTimeSlotWrapper = ({ value, children }) => {
    const wrapperRef = useRef(null);
    const [isInsideDaySlot, setIsInsideDaySlot] = useState(false);

    useEffect(() => {
      if (wrapperRef.current) {
        const daySlotAncestor = wrapperRef.current.closest(".rbc-day-slot");
        setIsInsideDaySlot(daySlotAncestor !== null);
      }
    }, []);
    return (
      <div
        ref={wrapperRef}
        style={{
          position: "relative",
          width: "100%",
          height: "20px",
          overflow: "visible",
        }}
      >
        {children}
        {isInsideDaySlot && (
          <div
            style={{
              position: "relative",
              backgroundColor: "limegreen",
              borderRadius: "6px",
              color: "white",
              width: "50%",
              left: "25%",
              height: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              zIndex: 10,
              cursor: "pointer",
            }}
          >
            {"disponible"}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="Calendar__container">
      <div
        style={{
          height: "50vh",
          width: "50vw",
        }}
      >
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
          min={dayjs("2024-12-20T11:00:00").toDate()}
          max={dayjs("2024-12-23T18:00:00").toDate()}
          step={30}
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
      <Formulario turnoSeleccionado={turnoSeleccionado}></Formulario>
    </div>
  );
}
