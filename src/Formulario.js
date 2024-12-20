import { useState, useEffect } from "react";
import "./Formulario.css";
export default function Formulario({ turnoSeleccionado }) {
  const formVacio = {
    nombre: "",
    apellido: "",
    edad: "",
    email: "",
    turno: "",
  };
  const [form, setForm] = useState(formVacio);

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prevForm) => ({
      ...prevForm,
      [name]: value,
    }));
    console.log(form);
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
          type="text"
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
