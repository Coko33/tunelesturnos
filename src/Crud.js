import React, { useState, useEffect } from "react";
import { db } from "./firebase"; // Importa la configuración de Firebase
import { collection, getDocs, addDoc } from "firebase/firestore";

function Crud() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");

  // Leer los documentos de Firestore
  const fetchItems = async () => {
    const querySnapshot = await getDocs(collection(db, "items"));
    const itemsList = querySnapshot.docs.map((doc) => doc.data());
    setItems(itemsList);
  };

  // Escribir un nuevo documento en Firestore
  const addItem = async () => {
    if (newItem) {
      await addDoc(collection(db, "items"), {
        name: newItem,
      });
      setNewItem("");
      fetchItems(); // Refresca la lista de items
    }
  };

  useEffect(() => {
    fetchItems(); // Cargar los items cuando el componente se monta
  }, []);

  return (
    <div className="App">
      <h1>Items en Firestore</h1>
      <input
        type="text"
        value={newItem}
        onChange={(e) => setNewItem(e.target.value)}
        placeholder="Nuevo item"
      />
      <button onClick={addItem}>Agregar</button>

      <ul>
        {items.map((item, index) => (
          <li key={index}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default Crud;
