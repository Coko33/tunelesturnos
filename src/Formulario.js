import { useState, useEffect, useRef } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "./firebase";
import "./Formulario.css";
import dayjs from "dayjs";
import CerrarIcon from "./CerrarIcon";
export default function Formulario({ turnoSeleccionado, onClose }) {
  const formVacio = {
    nombre: "",
    apellido: "",
    edad: "",
    email: "",
    turno: "",
    start: "",
    end: "",
  };
  const inputRef = useRef(null);
  const [form, setForm] = useState(formVacio);
  const [errors, setErrors] = useState({}); // Estado para manejar errores de validación
  const [loading, setLoading] = useState(false); // Estado para manejar el estado de carga
  const [submissionMessage, setSubmissionMessage] = useState(""); // Mensaje de éxito/error de envío

  useEffect(() => {
    if (turnoSeleccionado) {
      inputRef.current?.focus();
      // Actualizar 'turno', 'start' y 'end' cuando 'turnoSeleccionado' cambia
      const start = dayjs(turnoSeleccionado).format("YYYY-MM-DDTHH:mm:ss");
      const end = dayjs(turnoSeleccionado)
        .add(30, "minute")
        .format("YYYY-MM-DDTHH:mm:ss");
      setForm((prevForm) => ({
        ...prevForm,
        turno: turnoSeleccionado,
        start,
        end,
      }));
    }
  }, [turnoSeleccionado]);

  const isValidForm = (form) => {
    const newErrors = {};
    const nameRegex = /^[a-zA-ZÁÉÍÓÚáéíóúñÑ]{2,}$/;
    if (!nameRegex.test(form.nombre)) {
      newErrors.nombre = "El nombre debe tener al menos 2 letras y solo caracteres alfabéticos.";
    }
    if (!nameRegex.test(form.apellido)) {
      newErrors.apellido = "El apellido debe tener al menos 2 letras y solo caracteres alfabéticos.";
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmissionMessage(""); // Limpiar mensajes anteriores
    if (isValidForm(form)) {
      setLoading(true);
      try {
        //await addDoc(collection(db, "turnos"), form);
        await addDoc(collection(db, "reservas_pendientes"), form);
        setForm(formVacio);
        setErrors({}); 
        //setSubmissionMessage("Turno reservado con éxito");
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
    const { name, value } = e.target;
    setForm((prevForm) => ({
      ...prevForm,
      [name]: value,
    }));
    // Limpiar el error específico del campo si el usuario empieza a corregirlo
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
        <form onSubmit={handleSubmit}>
        <div className="labelYError">
          <label htmlFor="nombre">Nombre</label>
          {errors.nombre && <p className="error-message">{errors.nombre}</p>}
        </div>
        <input
          type="text"
          value={form.nombre}
          onChange={handleChange}
          name="nombre"
          ref={inputRef}
          placeholder={turnoSeleccionado ? "Escribe tu nombre" : ""}
        ></input>
        <div className="labelYError">
          <label htmlFor="apellido">Apellido</label>
          {errors.apellido && <p className="error-message">{errors.apellido}</p>}
        </div>
        <input
          type="text"
          value={form.apellido}
          onChange={handleChange}
          name="apellido"
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
        ></input>
        
        <label htmlFor="turno">Turno seleccionado</label>
        <input
          type="text"
          value={turnoDisplay}
          readOnly
          name="turno"
          tabIndex="-1"
        ></input>
        <div className="Formulario__ctaContainer">
          <button type="submit" disabled={loading}>
            {loading ? "Reservando..." : "Reservar turno"}
          </button>
        </div>
      </form>
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
