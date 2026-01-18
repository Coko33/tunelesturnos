import { useState, useEffect, useRef } from "react";
import { addDoc, getDoc, doc, setDoc } from "firebase/firestore";
import "./Formulario.css";
import dayjs from "dayjs";
import "dayjs/locale/es";
import CerrarIcon from "./CerrarIcon";
import {
  RESERVAS_PENDIENTES_REF,
  TURNOS_PUBLICOS_REF,
  MAPEO_EMAILS_REF,
} from "./firebase";
dayjs.locale("es");

export default function Formulario({
  turnoSeleccionado,
  onClose,
  maxPersonasDisponibles,
}) {
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
  const [esExitoso, setEsExitoso] = useState(false);

  useEffect(() => {
    if (turnoSeleccionado) {
      const startDateObject = dayjs(turnoSeleccionado).toDate();
      const endDateObject = dayjs(turnoSeleccionado).add(20, "minute").toDate();
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
    const nameRegex = /^[a-zA-ZÁÉÍÓÚáéíóúñÑ]{2,}\s[a-zA-ZÁÉÍÓÚáéíóúñÑ\s]{2,}$/;
    if (!nameRegex.test(form.nombreYApellido)) {
      newErrors.nombreYApellido =
        "Ingresa al menos un nombre y un apellido (mínimo 2 letras cada uno).";
    }
    const docRegex = /^(?=.*[0-9])[a-zA-Z0-9-]{6,20}$/;
    if (!docRegex.test(form.numeroDocumento)) {
      newErrors.numeroDocumento =
        "El documento debe tener entre 6 y 20 caracteres y contener al menos un número.";
    }
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
      newErrors.aceptaCondiciones =
        "Debes aceptar esta condición para reservar.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  //chequea si existe un turno confirmado con ese mismo mail con fecha posterior a la actual
  //devuelve la fecha de la reserva si existe o null
  const checkFutureReservation = async (email) => {
    const emailDocRef = doc(MAPEO_EMAILS_REF, email.toLowerCase());
    const docSnap = await getDoc(emailDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (!data.start) return null;
      const fechaProxima =
        typeof data.start.toDate === "function" //verifica que es un Timestamp
          ? data.start.toDate()
          : new Date(data.start);
      if (
        //verifica que sea una fecha valida y que sea posterior a la actual
        dayjs(fechaProxima).isValid() &&
        dayjs(fechaProxima).isAfter(dayjs())
      ) {
        return fechaProxima;
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmissionMessage("");
    if (isValidForm(form)) {
      setLoading(true);
      try {
        const existingFutureStart = await checkFutureReservation(form.email);
        if (existingFutureStart) {
          const dateObj = dayjs(existingFutureStart);
          if (dateObj.isValid()) {
            const futureDate = dateObj.format("dddd D [de] MMMM [a las] HH:mm");
            setSubmissionMessage(
              `Ya tenés un turno confirmado o pendiente para el día ${futureDate}. Podés volver a usar este email cuando el turno haya pasado, o despues de 1 hora si no lo confirmaste`,
            );
          } else {
            setSubmissionMessage("Ya tenés un turno agendado.");
          }
          setDeshabilitarBoton(true);
          emailInputRef.current?.focus();
          setLoading(false);
          return;
        }
        const datosPublicos = {
          start: form.start,
          end: form.end,
          cantidadPersonas: Number(form.cantidadPersonas),
          status: "pending",
        };
        const reservaRef = await addDoc(RESERVAS_PENDIENTES_REF, form);
        await addDoc(TURNOS_PUBLICOS_REF, {
          ...datosPublicos,
          reservaId: reservaRef.id,
        });
        const emailRef = doc(MAPEO_EMAILS_REF, form.email.toLowerCase());
        await setDoc(emailRef, {
          reservaId: reservaRef.id,
          status: "pending",
          start: form.start,
        });
        setForm(formVacio);
        setErrors({});
        setSubmissionMessage(
          "¡Casi listo! Revisa tu email para confirmar la reserva.",
        );
        setEsExitoso(true);
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
    if (name === "email" && deshabilitarBoton) {
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

  const manejarCierreManual = () => {
    // Si esExitoso es true, enviamos true al Calendario para que refresque
    // Si esExitoso es false, enviamos false para que no gaste lecturas de Firebase innecesarias
    onClose(esExitoso);
  };

  return (
    <div className="Formulario__canvas">
      <div className="Formulario__container">
        <div className="Formulario__button" onClick={manejarCierreManual}>
          <CerrarIcon />
        </div>
        {!submissionMessage.includes("¡Casi listo!") && (
          <form onSubmit={handleSubmit}>
            <div className="labelYError">
              <label htmlFor="nombreYApellido">Nombre y Apellido</label>
              {errors.nombreYApellido && (
                <p className="error-message">{errors.nombreYApellido}</p>
              )}
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
              {errors.numeroDocumento && (
                <p className="error-message">{errors.numeroDocumento}</p>
              )}
            </div>
            <input
              type="text"
              value={form.numeroDocumento}
              onChange={handleChange}
              name="numeroDocumento"
            ></input>
            <div className="labelYError">
              <label htmlFor="nacionalidad">Nacionalidad</label>
              {errors.nacionalidad && (
                <p className="error-message">{errors.nacionalidad}</p>
              )}
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
              {errors.cantidadPersonas && (
                <p className="error-message">{errors.cantidadPersonas}</p>
              )}
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
              style={{ resize: "none" }}
            ></textarea>
            <div className="Formulario__checkboxContainer">
              {errors.aceptaCondiciones && (
                <p className="error-message">{errors.aceptaCondiciones}</p>
              )}
              <input
                type="checkbox"
                id="aceptaCondiciones"
                name="aceptaCondiciones"
                checked={form.aceptaCondiciones}
                onChange={handleChange}
              />
              <label htmlFor="aceptaCondiciones">
                Acepto que no pueden ingresar a los túneles menores de 16 años
              </label>
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
            className={
              submissionMessage.includes("¡Casi listo!")
                ? "success-message"
                : "error-message"
            }
          >
            {submissionMessage}
          </p>
        )}
        {submissionMessage.includes("¡Casi listo!") && (
          <div className="Formulario__disclaimer">
            <p>
              <strong>Importante:</strong> Tienes 10 minutos para confirmar esta
              reserva desde el enlace que te enviamos a tu email. Pasado ese
              tiempo, la reserva se liberará.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
