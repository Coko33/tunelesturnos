import { useState, useEffect, useRef } from "react";
import { addDoc, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import "./Formulario.css";
import dayjs from "dayjs";
import CerrarIcon from "./CerrarIcon";

const RESERVAS_PENDIENTES_REF = collection(db, "reservas_pendientes");
const TURNOS_CONFIRMADOS_REF = collection(db, "turnos"); 

export default function Formulario({ turnoSeleccionado, onClose, maxPersonasDisponibles}) {
  const formVacio = {
    nombreYApellido: "",
    numeroDocumento: "",
    nacionalidad: "",
    observaciones: "",
    edad: "",
    email: "",
    cantidadPersonas: 1,
    turno: "",
    start: "",
    end: "",
    aceptaCondiciones: false,
  };
  
  const inputRef = useRef(null);
  const emailInputRef = useRef(null);
  const [form, setForm] = useState(formVacio);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [deshabilitarBoton, setDeshabilitarBoton] = useState(false);

  useEffect(() => {
    console.log("personas displibles " + maxPersonasDisponibles)
    if (turnoSeleccionado) {
      const startDateObject = dayjs(turnoSeleccionado).toDate(); 
      const endDateObject = dayjs(turnoSeleccionado).add(20, "minute").toDate();
      const startDisplayString = dayjs(turnoSeleccionado).format("YYYY-MM-DDTHH:mm:ss");
      const endDisplayString = dayjs(turnoSeleccionado).add(20, "minute").format("YYYY-MM-DDTHH:mm:ss");
      setForm((prevForm) => ({
        ...prevForm,
        turno: turnoSeleccionado,
        start: startDateObject, 
        end: endDateObject,
      }));
    }
  }, [turnoSeleccionado]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isValidForm = (form) => {
    const newErrors = {};
    const nameRegex = /^[a-zA-ZÁÉÍÓÚáéíóúñÑ\s]{3,}$/;
    if (!nameRegex.test(form.nombreYApellido)) {
      newErrors.nombreYApellido = "El nombre y apellido debe tener al menos 3 letras y solo caracteres alfabéticos.";
    }
    const docRegex = /^[a-zA-Z0-9-]{6,20}$/;
    if (!docRegex.test(form.numeroDocumento)) {
      newErrors.numeroDocumento =
        "El número de documento no es válido. Debe tener entre 6 y 20 caracteres (letras, números y guiones).";
    }
    // Regex para nacionalidad que permite letras y espacios
    const nationalityRegex = /^[a-zA-ZÁÉÍÓÚáéíóúñÑ\s]{3,}$/;
    if (!nationalityRegex.test(form.nacionalidad)) {
      newErrors.nacionalidad =
        "La nacionalidad no es válida. Debe tener al menos 3 letras.";
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(form.email)) {
      newErrors.email = "El email no es válido.";
    }
    const ageRegex = /^(?:1[01][0-9]|120|[1-9][0-9]?)$/;
    if (!ageRegex.test(form.edad)) {
      newErrors.edad = "Debes ingresar tu edad para reservar";
    } else if (Number(form.edad) < 18) {
      newErrors.edad = "Debes ser mayor de 18 para reservar";
    }
    const numPeople = Number(form.cantidadPersonas);
    if (isNaN(numPeople) || numPeople < 1) {
      newErrors.cantidadPersonas = "Debe ser al menos 1 persona.";
    } else if (numPeople > maxPersonasDisponibles) { 
      newErrors.cantidadPersonas = `El límite de personas para este turno es ${maxPersonasDisponibles}.`;
    }
    if (!form.aceptaCondiciones) {
      newErrors.aceptaCondiciones = "Debes aceptar esta condición para reservar.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkFutureReservation = async (email, currentStartTime) => {
      const currentStartDate = dayjs(currentStartTime).toDate();
      // Buscar en reservas confirmadas
      let qConfirmed = query(
          TURNOS_CONFIRMADOS_REF,
          where("email", "==", email),
          where("start", ">", currentStartDate),
          orderBy("start", "asc")
      );
      const confirmedSnapshot = await getDocs(qConfirmed);
      if (!confirmedSnapshot.empty) {
          const timestamp = confirmedSnapshot.docs[0].data().start;
          return dayjs(timestamp.toDate()).format("YYYY-MM-DDTHH:mm:ss");
      }
      // Buscar en reservas pendientes
      let qPending = query(
          RESERVAS_PENDIENTES_REF,
          where("email", "==", email),
          where("start", ">", currentStartDate),
          orderBy("start", "asc")
      );
      const pendingSnapshot = await getDocs(qPending);
      if (!pendingSnapshot.empty) {
          const timestamp = pendingSnapshot.docs[0].data().start;
          return dayjs(timestamp.toDate()).format("YYYY-MM-DDTHH:mm:ss"); 
      }
      return null;
  };

  const handleSubmit = async (e) => {
    console.log("toca boton")
    e.preventDefault();
    setSubmissionMessage("");
    if (isValidForm(form)) {
      console.log(form)
      setLoading(true);
      try {
        const existingFutureStart = await checkFutureReservation(form.email, form.start);
        if (existingFutureStart) {
            setLoading(false);
            const futureDate = dayjs(existingFutureStart).format("dddd D [de] MMMM [a las] HH:mm");
            setSubmissionMessage(
                `Ya tenés un turno confirmado o pendiente con este email para el día ${futureDate}. Podés volver a usar este email cuando el turno haya pasado, o despues de 1 hora si no lo confirmaste`
            );
            setDeshabilitarBoton(true);
            emailInputRef.current?.focus();
            return;
        }
        await addDoc(RESERVAS_PENDIENTES_REF, form);
        setForm(formVacio);
        setErrors({}); 
        setSubmissionMessage("¡Casi listo! Revisa tu email para confirmar la reserva.");
      } catch (error) {
        console.error("Error al reservar turno:", error);
        setSubmissionMessage("Error al reservar el turno. Inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
    } else {
      setSubmissionMessage("Por favor, corrige los campos inválidos.");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prevForm) => ({
      ...prevForm,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Si el usuario cambia el email, habilitamos el botón de nuevo.
    if (name === 'email' && deshabilitarBoton) {
      setDeshabilitarBoton(false);
    }
    if (errors[name]) {
      setErrors((prevErrors) => {
        const newErrors = { ...prevErrors };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const turnoDisplay = turnoSeleccionado
    ? dayjs(turnoSeleccionado).format("dddd D [de] MMMM [a las] HH:mm")
    : "";

  return (
    <div className="Formulario__canvas">
      <div className="Formulario__container">
        <div className="Formulario__button" onClick={onClose}>
            <CerrarIcon />
        </div>
        {!submissionMessage.includes("¡Casi listo!") && (
          <form onSubmit={handleSubmit}>
          <div className="labelYError">
            <label htmlFor="nombreYApellido">Nombre y Apellido</label>
            {errors.nombreYApellido && <p className="error-message">{errors.nombreYApellido}</p>}
          </div>
          <input
            type="text"
            value={form.nombreYApellido}
            onChange={handleChange}
            name="nombreYApellido"
            ref={inputRef}
            placeholder={turnoSeleccionado ? "Escribe tu nombre" : ""}
          ></input>
          <div className="labelYError">
            <label htmlFor="numeroDocumento">Número de Documento</label>
            {errors.numeroDocumento && <p className="error-message">{errors.numeroDocumento}</p>}
          </div>
          <input
            type="text"
            value={form.numeroDocumento}
            onChange={handleChange}
            name="numeroDocumento"
          ></input>
          <div className="labelYError">
            <label htmlFor="nacionalidad">Nacionalidad</label>
            {errors.nacionalidad && <p className="error-message">{errors.nacionalidad}</p>}
          </div>
          <input
            type="text"
            value={form.nacionalidad}
            onChange={handleChange}
            name="nacionalidad"
          ></input>

          <div className="labelYError">
            <label htmlFor="edad">Edad</label>
            {errors.edad && <p className="error-message">{errors.edad}</p>}
          </div>
          <input
            type="number"
            value={form.edad}
            onChange={handleChange}
            name="edad"
          ></input>
          <div className="labelYError">
            <label htmlFor="email">Email</label>
            {errors.email && <p className="error-message">{errors.email}</p>}
          </div>
          <input
            type="email"
            value={form.email}
            onChange={handleChange}
            name="email"
            ref={emailInputRef}
          ></input>
          <div className="labelYError">
            <label htmlFor="cantidadPersonas">Cantidad de visitantes</label>
            {errors.cantidadPersonas && <p className="error-message">{errors.cantidadPersonas}</p>}
          </div>
          <input
            type="number"
            value={form.cantidadPersonas}
            onChange={handleChange}
            name="cantidadPersonas"
            min="1"
            max={maxPersonasDisponibles}
            required
          ></input>
          
          <label htmlFor="turno">Turno seleccionado</label>
          <input
            type="text"
            value={turnoDisplay}
            readOnly
            name="turno"
            tabIndex="-1"
          ></input>
          <div className="labelYError">
            <label htmlFor="observaciones">Observaciones (opcional)</label>
          </div>
          <textarea
            name="observaciones"
            value={form.observaciones}
            onChange={handleChange}
            rows="1"
            style={{ resize: 'none' }}
          ></textarea>
          <div className="Formulario__checkboxContainer">
            {errors.aceptaCondiciones && <p className="error-message">{errors.aceptaCondiciones}</p>}
            <input 
              type="checkbox"
              id="aceptaCondiciones"
              name="aceptaCondiciones"
              checked={form.aceptaCondiciones}
              onChange={handleChange}
            />
            <label htmlFor="aceptaCondiciones">Acepto que no pueden ingresar a los túneles menores de 16 años</label>
          </div>

          <div className="Formulario__ctaContainer">
            <button type="submit" disabled={loading || deshabilitarBoton}>
              {loading ? "Comprobando..." : "Reservar turno"}
            </button>
          </div>
        </form>
        )}
      {submissionMessage && (
        <p
          className={submissionMessage.includes("¡Casi listo!") ? "success-message" : "error-message"}
        >
          {submissionMessage}
        </p>
      )}
      {submissionMessage.includes("¡Casi listo!") && (
        <div className="Formulario__disclaimer">
          <p><strong>Importante:</strong> Tienes 10 minutos para confirmar esta reserva desde el enlace que te enviamos a tu email. Pasado ese tiempo, la reserva se liberará.</p>
        </div>)}
      </div>
    </div>
  );
}
