import { useState, useEffect } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

// Configuración de plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);

const TZ_AR = "America/Argentina/Buenos_Aires";

export const useCotasProximos = () => {
  const [cotas, setCotas] = useState(null);

  const calcularCotas = () => {
    let ahora = dayjs().tz(TZ_AR);

    const encontrarInicioValido = (fecha) => {
      let aux = fecha;
      while (true) {
        const diaSemana = aux.day();
        const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

        const inicioRango = aux.hour(15).minute(0).second(0).millisecond(0);
        const finRango = aux.hour(18).minute(0).second(0).millisecond(0);

        if (esFinDeSemana) {
          // Caso 1: Es finde pero aún no son las 15:00
          if (aux.isBefore(inicioRango)) {
            return inicioRango;
          }
          // Caso 2: Estamos dentro del rango (el último turno empieza 17:40)
          if (
            aux.isBefore(finRango.subtract(20, "minute")) ||
            aux.isSame(finRango.subtract(20, "minute"))
          ) {
            const minutosDesde15 = aux.diff(inicioRango, "minute");
            const bloquesPasados = Math.floor(minutosDesde15 / 20);
            return inicioRango.add(bloquesPasados * 20, "minute");
          }
        }

        // Caso 3: Es día de semana o ya pasó de las 17:40 el domingo
        aux = aux.add(1, "day").hour(15).minute(0).second(0).millisecond(0);
      }
    };

    const inicioActual = encontrarInicioValido(ahora);
    const finActual = inicioActual.add(20, "minute");
    const finSiguiente = finActual.add(20, "minute");

    setCotas({
      inicioTurnoActual: inicioActual,
      finTurnoActual: finActual,
      inicioTurnoSiguiente: finActual,
      finTurnoSiguiente: finSiguiente,
      // Metadatos útiles
      esEnVivo:
        ahora.isAfter(inicioActual.subtract(1, "second")) &&
        ahora.isBefore(finActual),
    });
  };

  useEffect(() => {
    calcularCotas();

    // Checkear cada 30 segundos si el turno cambió
    const interval = setInterval(calcularCotas, 30000);
    return () => clearInterval(interval);
  }, []);

  return cotas;
};
