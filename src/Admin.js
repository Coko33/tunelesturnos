import { useAuth } from "./AuthContext";

export default function Admin() {
  const { logout } = useAuth();
  return (
    <>
      <h1>Admin</h1>
      <button onClick={logout}>Salir</button>
    </>
  );
}
