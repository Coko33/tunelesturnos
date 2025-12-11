import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";

function Crud() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Leer 
  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(collection(db, "items"));
      // Incluye el ID del documento para usarlo como 'key' y para futuras operaciones
      const itemsList = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setItems(itemsList);
    } catch (e) {
      console.error("Error al obtener items: ", e);
      setError("Error al cargar los items.");
    } finally {
      setLoading(false);
    }
  };

  // Escribir 
  const addItem = async () => {
    if (newItem) {
      setLoading(true);
      setError(null);
      try {
        await addDoc(collection(db, "items"), { name: newItem });
        setNewItem("");
        fetchItems(); // Actualiza la lista después de añadir
      } catch (e) {
        console.error("Error al añadir item: ", e);
        setError("Error al añadir el item.");
      } finally {
        setLoading(false);
      }
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
        disabled={loading} // Deshabilita el input mientras se carga
      />
      <button onClick={addItem} disabled={loading}>
        {loading ? "Agregando..." : "Agregar"}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading && items.length === 0 && <p>Cargando items...</p>}
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li> /* Usar item.id como key */
        ))}
      </ul>
    </div>
  );
}

export default Crud;
