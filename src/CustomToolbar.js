import dayjs from "dayjs";

export default function CustomToolbar(props) {
  const {
    label,
    onNavigate,
    onView,
    view,
    date,
    esDiaNoLaborable,
    minDate,
    maxDate,
  } = props;

  const navigateTo = (newDate) => {
    onNavigate("DATE", newDate);
  };

  const goToPrevious = () => {
    if (view === "day") {
      let prev = dayjs(date).subtract(1, "day");
      if (prev.isBefore(dayjs(minDate), "day")) return; //si el dia prev es anterior al minimo permitido, retorna.
      while (esDiaNoLaborable(prev.toDate())) {
        prev = prev.subtract(1, "day");
      }
      if (!esDiaNoLaborable(prev.toDate())) {
        navigateTo(prev.toDate());
      }
    } else {
      onNavigate("PREV");
    }
  };

  const goToNext = () => {
    if (view === "day") {
      let next = dayjs(date).add(1, "day");
      while (
        esDiaNoLaborable(next.toDate()) &&
        next.isBefore(dayjs(maxDate), "day")
      ) {
        next = next.add(1, "day");
      }
      if (!esDiaNoLaborable(next.toDate())) {
        navigateTo(next.toDate());
      }
    } else {
      onNavigate("NEXT");
    }
  };

  return (
    <div className="rbc-toolbar">
      <div className="rbc-btn-group">
        <button type="button" onClick={goToPrevious}>
          Anterior
        </button>
        <button type="button" onClick={goToNext}>
          Siguiente
        </button>
      </div>

      <span className="rbc-toolbar-label">
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </span>

      <div className="rbc-btn-group">
        <button
          type="button"
          className={view === "month" ? "rbc-active" : ""}
          onClick={() => onView("month")}
        >
          Mes
        </button>
        <button
          type="button"
          className={view === "day" ? "rbc-active" : ""}
          onClick={() => onView("day")}
        >
          Día
        </button>
      </div>
    </div>
  );
}
