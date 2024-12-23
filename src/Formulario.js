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
  useEffect(() => {
    if (turnoSeleccionado) {
      inputRef.current?.focus();
    }
  }, [turnoSeleccionado]);

  const isValidForm = (form) => {
    const errors = [];
    const nameRegex = /^[a-zA-ZÁÉÍÓÚáéíóúñÑ]{2,}$/;
    if (!nameRegex.test(form.nombre)) {
      errors.push("nombre");
    }
    if (!nameRegex.test(form.apellido)) {
      errors.push("apellido");
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(form.email)) {
      errors.push("email");
    }
    const ageRegex = /^(?:1[01][0-9]|120|[1-9][0-9]?)$/;
    if (!ageRegex.test(form.edad)) {
      errors.push("edad");
    }
    console.log(errors);
    return errors.length === 0 ? "formOk" : errors.join(", ");
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validMess = isValidForm(form);
    if (validMess === "formOk") {
      await addDoc(collection(db, "turnos"), form);
      setForm(formVacio);
      console.log("confirmado");
    } else {
      console.log("campos invalidos: " + validMess);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const start = dayjs(turnoSeleccionado).format("YYYY-MM-DDTHH:mm:ss");
    const end = dayjs(turnoSeleccionado)
      .add(30, "minute")
      .format("YYYY-MM-DDTHH:mm:ss");
    setForm((prevForm) => ({
      ...prevForm,
      [name]: value,
      turno: turnoSeleccionado,
      start,
      end,
    }));
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
        <label htmlFor="apellido">Apellido</label>
        <input
          type="text"
          value={form.apellido}
          onChange={handleChange}
          name="apellido"
        ></input>
        <label htmlFor="edad">Edad</label>
        <input
          type="text"
          value={form.edad}
          onChange={handleChange}
          name="edad"
        ></input>
        <label htmlFor="email">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={handleChange}
          name="email"
        ></input>
        <label htmlFor="turno">Turno</label>
        <input
          type="text"
          value={turnoSeleccionado}
          readOnly
          name="turno"
        ></input>
        <div className="Formulario__ctaContainer">
          <button type="submit">Reservar</button>
        </div>
      </form>
    </div>
  );
}
