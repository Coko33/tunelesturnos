import "./App.css";
import Admin from "./Admin";
import Login from "./Login";
import Calendario from "./Calendar";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";

const RutaProtegida = ({ element: Element }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <h1>Cargando Autenticación...</h1>;
  }
return user ? (
    <Element /> 
  ) : (
    <Navigate to="/login" replace />
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<RutaProtegida element={Admin} />} />
        <Route path="/" element={<Calendario/>} />
        <Route path="*" element={<h1>404: Página no encontrada</h1>} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
