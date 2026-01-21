import { useState, useEffect, useRef } from "react";
//import { getFunctions, httpsCallable } from "firebase/functions";
import { httpsCallable } from "firebase/functions";
import "./Formulario.css";
import dayjs from "dayjs";
import "dayjs/locale/es";
import CerrarIcon from "./CerrarIcon";
import { functions } from "./firebase";
dayjs.locale("es");

// La lógica de negocio y las transacciones ahora se manejan en una Cloud Function.

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

  //const functions = getFunctions();
  const crearReserva = httpsCallable(functions, "crearReserva");

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmissionMessage("");
    if (isValidForm(form)) {
      setLoading(true);
      try {
        // Llamamos a la Cloud Function con los datos del formulario.
        // Los objetos Date en `form.start` y `form.end` se serializan a strings.
        await crearReserva(form);

        setForm(formVacio);
        setErrors({});
        setSubmissionMessage(
          "¡Casi listo! Revisa tu email para confirmar la reserva.",
        );
        setEsExitoso(true);
      } catch (error) {
        console.error("Error al reservar turno:", error);
        // Manejar errores específicos de la Cloud Function
        if (
          error.code === "functions/resource-exhausted" &&
          error.message === "CAPACITY_FULL"
        ) {
          setSubmissionMessage(
            "El turno se acaba de ocupar por otro usuario. Por favor intenta con otro horario.",
          );
        } else if (
          error.code === "functions/already-exists" &&
          error.message.startsWith("EMAIL_RESERVED")
        ) {
          const dateStr = error.message.split(":")[1];
          const dateObj = dayjs(dateStr);
          const futureDate = dateObj.format("dddd D [de] MMMM [a las] HH:mm");
          setSubmissionMessage(
            `Ya tenés un turno confirmado o pendiente para el día ${futureDate}. Podés volver a usar este email cuando el turno haya pasado, o despues de 1 hora si no lo confirmaste`,
          );
          setDeshabilitarBoton(true);
          emailInputRef.current?.focus();
        } else {
          setSubmissionMessage(
            "Error al reservar el turno. Inténtalo de nuevo.",
          );
        }
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
