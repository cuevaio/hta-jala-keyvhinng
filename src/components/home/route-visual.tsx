import { CarFront } from "lucide-react";

/**
 * Brand illustration: one meeting point, three people each going to their own door.
 * It is a drawing, not a map, and shows no invented prices or live data.
 */
export function RouteVisual() {
  return (
    <div className="hero-visual">
      <svg
        className="city-art"
        viewBox="0 0 560 500"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <rect width="560" height="500" className="city-land" />
        <path
          className="city-sea"
          d="M0 0h118c-6 58 10 104-14 160-22 52-10 102-36 152-20 40-18 108-34 188H0z"
        />
        <g className="city-streets">
          <path d="M150 40 520 120M130 150l410 70M110 270l440 40M96 380l450 10M170 0l40 500M300 0l-10 500M420 0l30 500" />
          <path
            className="city-avenue"
            d="M104 470C200 380 250 330 330 240S470 90 560 40"
          />
          <path className="city-avenue" d="M120 205c140 18 290 8 440-30" />
        </g>
        <g className="city-routes">
          <path
            className="route-line route-1"
            d="M250 300c20-50 40-90 90-120s80-40 100-85"
          />
          <path
            className="route-line route-2"
            d="M250 300c40-10 90-10 140-22s80-14 110-18"
          />
          <path
            className="route-line route-3"
            d="M250 300c-30-20-50-40-80-50s-40-30-60-50"
          />
        </g>
        <g className="city-stops">
          <circle cx="440" cy="95" r="15" />
          <text x="440" y="100">
            1
          </text>
          <circle cx="500" cy="260" r="15" />
          <text x="500" y="265">
            2
          </text>
          <circle cx="110" cy="200" r="15" />
          <text x="110" y="205">
            3
          </text>
        </g>
        <circle className="city-origin-halo" cx="250" cy="300" r="30" />
        <circle className="city-origin" cx="250" cy="300" r="17" />
        <text className="city-origin-text" x="250" y="306">
          J
        </text>
      </svg>
      <div className="map-place">
        Punto de encuentro
        <span>Todos salen de aquí</span>
      </div>
      <div className="people-float">
        <div className="avatar-stack" aria-hidden="true">
          <i>A</i>
          <i>D</i>
          <i>L</i>
        </div>
        <div>
          <strong>Grupos de 2 o 3 personas</strong>
          <small>Que salen cerca y van hacia tu zona</small>
        </div>
      </div>
      <div className="fare-float">
        <span className="car-icon">
          <CarFront size={22} aria-hidden="true" />
        </span>
        <div>
          <small>Un taxi, cada quien a su puerta</small>
          <strong>Pagas tu tramo</strong>
        </div>
        <span className="save-badge">Según distancia</span>
      </div>
    </div>
  );
}
