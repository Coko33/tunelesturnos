import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";

function Crud() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");

  // Leer 
  const fetchItems = async () => {
    const querySnapshot = await getDocs(collection(db, "items"));
    const itemsList = querySnapshot.docs.map((doc) => doc.data());
    setItems(itemsList);
  };

  // Escribir 
  const addItem = async () => {
    if (newItem) {
      await addDoc(collection(db, "items"), {
        name: newItem,
      });
      setNewItem("");
      fetchItems(); // Actualiza
    }
  };

  useEffect(() => {
    fetchItems(); 
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
