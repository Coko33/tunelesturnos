//click en espacios vacios -> https://jquense.github.io/react-big-calendar/examples/index.html?path=/docs/examples--example-2
import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { Calendar, dayjsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import dayjs from "dayjs";
import "dayjs/locale/es";
dayjs.locale("es");
export default function Calendario() {
  const localizer = dayjsLocalizer(dayjs);
  const [turnos, setTurnos] = useState([]);
  const [view, setView] = useState("month");
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const fetchItems = async () => {
    const querySnapshot = await getDocs(collection(db, "turnos"));
    const turnosList = querySnapshot.docs.map((doc) => doc.data());
    const turnosFormated = turnosList.map((t) => ({
      start: dayjs(t.start).toDate(),
      end: dayjs(t.end).toDate(),
      title: t.title,
    }));
    setTurnos(turnosFormated);
  };
  useEffect(() => {
    //fetchItems();
    if (view === "month") {
      console.log("vista de mes");
    } else {
      console.log("vista de dia");
    }
  }, [view]);
  const handlerViewChange = (newView) => {
    setView(newView);
  };
  const handleSelectSlot = ({ start }) => {
    if (view === "month") {
      handlerViewChange("day");
    }
    setDiaSeleccionado(start); // start= fecha de inicio de la celda seleccionada y otros datos
    console.log("Día seleccionado:", start);
  };
  const handleNavigate = (date, view) => {
    setDiaSeleccionado(date);
    console.log("Día seleccionado (navegar a vista día):", date);
    if (view === "day") {
    } else {
      handlerViewChange("day");
    }
    //setView(view);
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
