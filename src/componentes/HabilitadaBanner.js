import Logos from "../img/logos_-01.png";
import "./HabilitadaBanner.css";
import { useEffect, useState } from "react";

export default function HabilitadaBanner({
  diaHabilitada,
  inicioHabilitada,
  finHabilitada,
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth <= 600);
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  return (
    <>
      <div className="Habilitada__container">
        <div className="Habilitada__texto">
          <h2>
            Apreciamos tu interés por los {isMobile && <br></br>}Misteriosos
            Túneles {!isMobile && <br></br>}
            Históricos {isMobile && <br></br>}de la Manzana de las Luces.
          </h2>
          {
            <h1>
              Esta turnera se habilita {isMobile && <br></br>}los dias{" "}
              {diaHabilitada}
              {!isMobile && <br></br>} entre{isMobile && <br></br>} las{" "}
              {inicioHabilitada} y las {finHabilitada}
            </h1>
          }
          <p>
            Atentamente, Complejo Histórico Cultural {isMobile && <br></br>}
            Manzana de las Luces
          </p>
          <img
            className={`Habilitada__img--logos ${isMobile ? "mobile" : ""}`}
            src={Logos}
            alt="logos"
          />
        </div>
      </div>
    </>
  );
}
