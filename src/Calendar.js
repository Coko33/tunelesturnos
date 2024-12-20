//click en espacios vacios -> https://jquense.github.io/react-big-calendar/examples/index.html?path=/docs/examples--example-2
import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Calendar, dayjsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "./Calendar.css";
dayjs.locale("es");
export default function Calendario() {
  const localizer = dayjsLocalizer(dayjs);
  const [turnos, setTurnos] = useState([]);
  const [view, setView] = useState("month");
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [eventCountByDay, setEventCountByDay] = useState({});

  const fetchItems = async () => {
    const querySnapshot = await getDocs(collection(db, "turnos"));
    const turnosList = querySnapshot.docs.map((doc) => doc.data());
    const turnosFormated = turnosList.map((t) => ({
      start: dayjs(t.start).toDate(),
      end: dayjs(t.end).toDate(),
      title: t.title,
    }));
    setTurnos(turnosFormated);
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

    const turnosRef = collection(db, "turnos");
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

  useEffect(() => {
    if (view === "day") {
      fetchItemsForDay(diaSeleccionado);
    } else {
      fetchItems();
    }
  }, [diaSeleccionado, view]);
  const handlerViewChange = (newView) => {
    setView(newView);
    if (newView === "month") {
      setTurnos([]);
    }
  };
  const handleSelectSlot = ({ start }) => {
    if (view === "month") {
      handlerViewChange("day");
    }
    setDiaSeleccionado(start); // start= fecha de inicio de la celda seleccionada y otros datos
  };
  const handleNavigate = (date, view) => {
    setDiaSeleccionado(date);
    if (view === "day") {
    } else {
      handlerViewChange("day");
    }
  };
  /* const events = [
    {
      start: dayjs("2024-12-19T12:00:00").toDate(),
      end: dayjs("2024-12-19T13:00:00").toDate(),
      title: "Evento1",
    },
    //si el evento no tiene hora definida aparece arriba de todo
    //tambien sin la T al final
    {
      start: dayjs("2024-12-20T").toDate(),
      end: dayjs("2024-12-20T").toDate(),
      title: "Evento1",
    },
  ]; */
  const CustomDateCellWrapper = ({ value, children }) => {
    const dayKey = dayjs(value).format("YYYY-MM-DD");
    const eventCount = eventCountByDay[dayKey] || 0;
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
        {view === "month" && eventCount > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 5,
              right: 5,
              backgroundColor: "blue",
              color: "white",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              zIndex: 2000000,
            }}
          >
            {eventCount}
          </div>
        )}
      </div>
    );
  };
  return (
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
        onView={handlerViewChange}
        onSelectSlot={handleSelectSlot}
        onNavigate={handleNavigate}
        selectable
        components={{
          dateCellWrapper: CustomDateCellWrapper,
        }}
        /* 
        startAccessor="start"
        endAccessor="end"
        min={dayjs("2024-12-20T13:00:00").toDate()}
        max={dayjs("2024-12-23T13:00:00").toDate()} */
        /* style={{
          height: 500,
          width: 500,
        }} */
        messages={{
          next: "Siguiente",
          previous: "Anterior",
          today: "Hoy",
          month: "Mes",
          day: "Dia",
        }}
      />
    </div>
  );
}
