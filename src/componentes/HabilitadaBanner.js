import Logos from "../img/logos_-01.png";
import "./HabilitadaBanner.css";
export default function HabilitadaBanner({
  diaHabilitada,
  inicioHabilitada,
  finHabilitada,
}) {
  return (
    <>
      <div className="Habilitada__container">
        <div className="Habilitada__texto">
          <h2>
            Apreciamos tu interés por los Misteriosos Túneles<br></br>
            Históricos de la Manzana de las Luces.
          </h2>
          {
            <h1>
              Esta turnera se habilita los dias {diaHabilitada}
              <br></br>entre las {inicioHabilitada} y las {finHabilitada}
            </h1>
          }
          <p>Atentamente, Complejo Histórico Cultural Manzana de las Luces</p>
          <img className="Habilitada__img--logos" src={Logos} alt="logos" />
        </div>
      </div>
    </>
  );
}
