import { useState } from "react";
import { APERTURA_REF } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./SelectorApertura.css";

const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export default function SelectorApertura() {
  const [diaSeleccionado, setDiaSeleccionado] = useState();
  const [horaInicio, setHoraInicio] = useState();
  const [horaFin, setHoraFin] = useState();

  const escribirApertura = async () => {
    try {
      if (diaSeleccionado && horaInicio && horaFin) {
        const docRef = doc(APERTURA_REF, "horarios");
        await setDoc(docRef, {
          dia: diaSeleccionado,
          inicio: horaInicio.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          fin: horaFin.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
        alert("Configuración guardada");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="SelectorApertura__container">
      <h3>Configurar horario de habilitacion de la turnera</h3>

      <div className="campo">
        <label>Día de la semana: todos los </label>
        <select
          value={diaSeleccionado}
          onChange={(e) => setDiaSeleccionado(e.target.value)}
        >
          {DIAS_SEMANA.map((dia) => (
            <option key={dia} value={dia}>
              {dia}
            </option>
          ))}
        </select>
      </div>

      <div className="pickers-row">
        <div>
          <label>Desde: </label>
          <DatePicker
            selected={horaInicio}
            onChange={(date) => setHoraInicio(date)}
            showTimeSelect
            showTimeSelectOnly
            timeIntervals={15}
            timeCaption="Hora"
            dateFormat="HH:mm"
            portalId="root-portal"
          />
        </div>

        <div>
          <label>Hasta: </label>
          <DatePicker
            selected={horaFin}
            onChange={(date) => setHoraFin(date)}
            showTimeSelect
            showTimeSelectOnly
            timeIntervals={15}
            timeCaption="Hora"
            dateFormat="HH:mm"
            portalId="root-portal"
          />
        </div>
      </div>

      <button onClick={escribirApertura}>Guardar Configuración</button>
    </div>
  );
}
