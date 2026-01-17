import "./Anuncio.css";
import Logos from "./img/logos_-01.png";
export default function Anuncio() {
  return (
    <>
      <div className="Anuncio__container">
        <div className="Anuncio__texto">
          <h2>
            Apreciamos tu interés por los Misteriosos Túneles<br></br>
            Históricos de la Manzana de las Luces.
          </h2>
          <h2>
            En la actualidad, no contamos con turnos disponibles para esta
            visita.
          </h2>
          <h2>
            Más adelante, habilitaremos nuevos cupos, lo que te va a permitir
            <br></br>
            descubrir la vida antigua y secreta de Buenos Aires.
          </h2>
          <p>Atentamente, Complejo Histórico Cultural Manzana de las Luces</p>
          <img className="Anuncio__img--logos" src={Logos} alt="logos" />
        </div>
      </div>
    </>
  );
}
