import http from "k6/http";
import { check } from "k6";
import execution from "k6/execution";

// simulacion de 10 usuarios que eligen el mismo turno a la vez
export const options = {
  scenarios: {
    race_condition: {
      executor: "per-vu-iterations",
      vus: 10,
      iterations: 1,
      maxDuration: "30s",
    },
  },
};

const targetDate = new Date();
targetDate.setDate(targetDate.getDate() + 6);
targetDate.setHours(16, 0, 0, 0);
const startIso = targetDate.toISOString();
const endIso = new Date(targetDate.getTime() + 20 * 60000).toISOString();

export default function stressTest() {
  const vuId = execution.vu.idInTest;
  const url = "http://127.0.0.1:5001/tunelesturnos/us-central1/crearReserva";

  const payload = JSON.stringify({
    data: {
      email: `race_user_${vuId}_${Date.now()}@test.com`,
      start: startIso,
      end: endIso,
      cantidadPersonas: 6,
      nombreYApellido: `Tester ${vuId}`,
      numeroDocumento: "12345678",
      nacionalidad: "Test",
      edad: "25",
      aceptaCondiciones: true,
    },
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      "X-Firebase-AppCheck": process.env.REACT_APP_APPCHECK_DEBUG_TOKEN,
    },
  };

  const res = http.post(url, payload, params);

  // Verificaciones
  check(res, {
    // Solo 1 debería dar true aca
    "Reserva Exitosa (200)": (r) =>
      r.status === 200 && r.body && r.body.includes("success"),
    // y 9 recibir error
    "Rechazado por Capacidad (Error)": (r) => {
      // Firebase Functions puede devolver el error en el body incluso con status 200 en algunos casos,
      // o status 4xx/5xx. Buscamos el mensaje específico del backend.
      const bodyString = r.body ? r.body.toString() : "";
      return (
        bodyString.includes("CAPACITY_FULL") ||
        bodyString.includes("resource-exhausted")
      );
    },
  });
}
