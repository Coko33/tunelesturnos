export default function NoHayMasHabilitados() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>
          <span role="img" aria-label="check mark">
            ✅
          </span>
        </div>
        <h1 style={styles.title}>No hay mas turnos habilitados</h1>
        <p style={styles.message}>...</p>
        <p style={styles.message}>...</p>
        <a href="/" style={styles.button}>
          Cerrar
        </a>
        <p style={styles.footer}>
          Gracias por visitar la Manzana de las Luces.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "absolute",
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#f4f7f65e",
    padding: "20px",
    zIndex: "1000",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: "40px",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    textAlign: "center",
    maxWidth: "450px",
    width: "100%",
  },
  icon: {
    fontSize: "4rem",
    marginBottom: "20px",
  },
  title: {
    color: "#1e3a8a",
    marginBottom: "10px",
  },
  message: {
    color: "#4b5563",
    marginBottom: "30px",
    lineHeight: "1.5",
  },
  button: {
    display: "inline-block",
    backgroundColor: "#007bff",
    color: "white",
    padding: "12px 25px",
    borderRadius: "5px",
    textDecoration: "none",
    fontWeight: "bold",
    transition: "background-color 0.3s",
    marginTop: "15px",
  },
  footer: {
    marginTop: "30px",
    fontSize: "0.8rem",
    color: "#9ca3af",
  },
};
