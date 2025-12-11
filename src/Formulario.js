import { useState, useEffect, useRef } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "./firebase";
import "./Formulario.css";
import dayjs from "dayjs";
export default function Formulario({ turnoSeleccionado }) {
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
      newErrors.edad = "La edad debe ser un número entre 1 y 120.";
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
        await addDoc(collection(db, "turnos"), form);
        setForm(formVacio);
        setErrors({}); // Limpiar errores después de un envío exitoso
        setSubmissionMessage("¡Turno confirmado con éxito!");
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

  return (
    <div className="Formulario__container">
      <form onSubmit={handleSubmit}>
        <label htmlFor="nombre">Nombre</label>
        <input
          type="text"
          value={form.nombre}
          onChange={handleChange}
          name="nombre"
          ref={inputRef}
          placeholder={turnoSeleccionado ? "Escribe tu nombre" : ""}
        ></input>
        {errors.nombre && <p className="error-message">{errors.nombre}</p>}
        <label htmlFor="apellido">Apellido</label>
        <input
          type="text"
          value={form.apellido}
          onChange={handleChange}
          name="apellido"
        ></input>
        {errors.apellido && <p className="error-message">{errors.apellido}</p>}
        <label htmlFor="edad">Edad</label>
        <input
          type="text"
          value={form.edad}
          onChange={handleChange}
          name="edad"
        ></input>
        {errors.edad && <p className="error-message">{errors.edad}</p>}
        <label htmlFor="email">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={handleChange}
          name="email"
        ></input>
        {errors.email && <p className="error-message">{errors.email}</p>}
        <label htmlFor="turno">Turno</label>
        <input
          type="text"
          value={turnoSeleccionado}
          readOnly
          name="turno"
        ></input>
        <div className="Formulario__ctaContainer">
          <button type="submit" disabled={loading}>
            {loading ? "Reservando..." : "Reservar"}
          </button>
        </div>
      </form>
      {submissionMessage && (
        <p
          className={submissionMessage.includes("éxito") ? "success-message" : "error-message"}
        >
          {submissionMessage}
        </p>
      )}
    </div>
  );
}
