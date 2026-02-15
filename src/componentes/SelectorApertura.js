import { useEffect, useState } from "react";
import { APERTURA_REF } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

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
  const [diaSeleccionado, setDiaSeleccionado] = useState("Lunes");
  const [horaInicio, setHoraInicio] = useState(new Date());
  const [horaFin, setHoraFin] = useState(new Date());

  const escribirApertura = async () => {
    try {
      const docRef = doc(APERTURA_REF, "horarios");
      await setDoc(docRef, {
        dia: diaSeleccionado,
        // Guardamos solo el string de la hora para facilitar la lógica
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
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="SelectorApertura__container">
      <h3>Configurar Horarios Semanales</h3>

      {/* Selector de Día */}
      <div className="campo">
        <label>Día de la semana:</label>
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

      {/* Selectores de Hora */}
      <div className="pickers-row">
        <div>
          <label>Desde:</label>
          <DatePicker
            selected={horaInicio}
            onChange={(date) => setHoraInicio(date)}
            showTimeSelect
            showTimeSelectOnly
            timeIntervals={15}
            timeCaption="Hora"
            dateFormat="HH:mm"
          />
        </div>

        <div>
          <label>Hasta:</label>
          <DatePicker
            selected={horaFin}
            onChange={(date) => setHoraFin(date)}
            showTimeSelect
            showTimeSelectOnly
            timeIntervals={15}
            timeCaption="Hora"
            dateFormat="HH:mm"
          />
        </div>
      </div>

      <button onClick={escribirApertura}>Guardar Configuración</button>
    </div>
  );
}
