import { useState } from "react";
import dynamic from "next/dynamic";
import UploadForm from "../components/UploadForm";

import {
  Chart as ChartJS,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

const Chart = dynamic(
  () => import("react-chartjs-2").then(mod => mod.Chart),
  { ssr: false }
);

function formatEUR(value) {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function buildHistogram(values, bins = 50, varValue, earValue) {
  if (!values || values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) return null;

  const width = (max - min) / bins;

  const labels = [];
  const counts = Array(bins).fill(0);
  const colors = Array(bins).fill("rgba(54, 162, 235, 0.6)");

  for (let i = 0; i < bins; i++) {
    labels.push(min + i * width + width / 2);
  }

  values.forEach(v => {
    let index = Math.floor((v - min) / width);
    if (index >= bins) index = bins - 1;
    if (index < 0) index = 0;
    counts[index]++;
  });

  function markValue(value, color) {
    if (value === null || value === undefined || isNaN(value)) return;
    const index = Math.floor((value - min) / width);
    if (index >= 0 && index < bins) {
      colors[index] = color;
    }
  }

  markValue(varValue, "rgba(255, 99, 132, 0.9)");
  markValue(earValue, "rgba(255, 206, 86, 0.95)");

  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  const std = Math.sqrt(
    values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      (values.length - 1)
  );

  const normalCurve = labels.map(x => {
    if (!std || !isFinite(std)) return 0;

    const density =
      (1 / (std * Math.sqrt(2 * Math.PI))) *
      Math.exp(-0.5 * Math.pow((x - mean) / std, 2));

    return density * values.length * width;
  });

  return {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Frecuencia",
        data: counts,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1
      },
      {
        type: "line",
        label: "Normal ajustada",
        data: normalCurve,
        borderColor: "rgba(220, 38, 38, 1)",
        borderWidth: 2,
        fill: false,
        pointRadius: 0,
        tension: 0.25
      }
    ]
  };
}

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const chartData =
    data && data.resultados_total
      ? buildHistogram(data.resultados_total, 50, data.TotalVaR, data.TotalEaR)
      : null;

  return (
    <main className="container">
      <h1>Calculadora de riesgos de mercado</h1>
      <h2>Roberto Knop</h2>
      <h3>(para modelos de valoracion = precio x cantidad)</h3>
      <p className="subtitle">
        Carga un Excel con hojas <strong>Precios</strong> y{" "}
        <strong>Posiciones</strong>.
      </p>

      <UploadForm setData={setData} setError={setError} />

      {error && <div className="error">{error}</div>}

      {data && (
        <section className="results">
          <h2>Resultados</h2>

          <div className="grid">
            <div className="metric">
              <span>Percentil</span>
              <strong>{(data.alpha * 100).toFixed(1)}%</strong>
            </div>

            <div className="metric">
              <span>Método</span>
              <strong>
                {data.method === "historical"
                  ? "Simulación histórica"
                  : "Paramétrico Normal"}
              </strong>
            </div>

            <div className="metric">
              <span>VaR total correlacionado</span>
              <strong>{formatEUR(data.TotalVaR)}</strong>
            </div>

            <div className="metric">
              <span>EaR total correlacionado</span>
              <strong>{formatEUR(data.TotalEaR)}</strong>
            </div>

            <div className="metric">
              <span>Ratio EaR / VaR</span>
              <strong>{data.RatioEaRVaRPct?.toFixed(2)}%</strong>
              <small>Valor absoluto: {data.RatioEaRVaRAbs?.toFixed(4)}</small>
            </div>

            <div className="metric">
              <span>ESF- total correlacionado</span>
              <strong>{formatEUR(data.TotalESFMinus)}</strong>
            </div>

            <div className="metric">
              <span>ESF+ total correlacionado</span>
              <strong>{formatEUR(data.TotalESFPlus)}</strong>
            </div>

            <div className="metric">
              <span>Ratio ESF+ / ESF-</span>
              <strong>{data.RatioESFPct?.toFixed(2)}%</strong>
              <small>Valor absoluto: {data.RatioESFAbs?.toFixed(4)}</small>
            </div>
          </div>

          <h3>Análisis por activo</h3>

          <table>
            <thead>
              <tr>
                <th>Activo</th>
                <th>VaR</th>
                <th>EaR</th>
                <th>ESF</th>
                <th>Ratio EaR / VaR</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(data.dict_activos).map(a => (
                <tr key={a}>
                  <td>{a}</td>
                  <td>{formatEUR(data.dict_activos[a].VaR)}</td>
                  <td>{formatEUR(data.dict_activos[a].EaR)}</td>
                  <td>{formatEUR(data.dict_activos[a].ESF)}</td>
                  <td>{data.dict_activos[a].RatioEaRVaRPct?.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
 <h3>Contribución al VaR por activo</h3>

          <table>
            <thead>
              <tr>
                <th>Activo</th>
                <th>VaR</th>
                <th>Contribución absoluta</th>
                <th>Contribución (%)</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(data.contribucionVaR || {}).map(a => (
                <tr key={a}>
                  <td>{a}</td>
                  <td>{formatEUR(data.contribucionVaR[a].VaR)}</td>
                  <td>{formatEUR(data.contribucionVaR[a].ContribucionAbs)}</td>
                  <td>{data.contribucionVaR[a].ContribucionPct?.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Distribución de resultados simulados</h3>

          <div className="legend">
            <span className="dot var"></span> Barra VaR
            <span className="dot ear"></span> Barra EaR
          </div>

          <div className="chart">
            {chartData ? (
              <Chart
                type="bar"
                data={chartData}
                options={{
                  responsive: true,
                  interaction: {
                    mode: "index",
                    intersect: false
                  },
                  plugins: {
                    legend: {
                      display: true
                    },
                    tooltip: {
                      callbacks: {
                        title: context =>
                          `Resultado: ${Number(context[0].label).toFixed(2)} €`,
                        label: context =>
                          `${context.dataset.label}: ${Number(context.raw).toFixed(2)}`
                      }
                    }
                  },
                  scales: {
                    x: {
                      ticks: {
                        maxRotation: 90,
                        minRotation: 90,
                        autoSkip: true,
                        maxTicksLimit: 15,
                        callback: function(value) {
                          return Number(this.getLabelForValue(value)).toFixed(2);
                        }
                      },
                      title: {
                        display: true,
                        text: "Resultado simulado (€)"
                      }
                    },
                    y: {
                      title: {
                        display: true,
                        text: "Frecuencia"
                      }
                    }
                  }
                }}
              />
            ) : (
              <p>No hay datos suficientes para construir el histograma.</p>
            )}
          </div>
        </section>
      )}
<footer className="footer">
  <p>
    Web:{" "}
    <a
      href="https://www.knop.es"
      target="_blank"
      rel="noopener noreferrer"
    >
      www.knop.es
    </a>
  </p>

  <p>
    Email:{" "}
    <a href="mailto:roberto@knop.es">
      roberto@knop.es
    </a>
  </p>
</footer>
    </main>
  );
}
