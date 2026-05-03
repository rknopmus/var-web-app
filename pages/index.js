import { useState } from "react";
import UploadForm from "../components/UploadForm";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

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
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins;

  const labels = [];
  const counts = Array(bins).fill(0);
  const colors = Array(bins).fill("rgba(54, 162, 235, 0.65)");

  for (let i = 0; i < bins; i++) {
    const start = min + i * width;
    const end = start + width;
    labels.push(`${start.toFixed(0)} / ${end.toFixed(0)}`);
  }

  values.forEach(v => {
    let index = Math.floor((v - min) / width);
    if (index >= bins) index = bins - 1;
    if (index < 0) index = 0;
    counts[index]++;
  });

  function markValue(value, color) {
    const index = Math.floor((value - min) / width);
    if (index >= 0 && index < bins) {
      colors[index] = color;
    }
  }

  markValue(varValue, "rgba(255, 99, 132, 0.9)");
  markValue(earValue, "rgba(255, 206, 86, 0.95)");

  return {
    labels,
    datasets: [
      {
        label: "Frecuencia de escenarios",
        data: counts,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1
      }
    ]
  };
}

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const chartData = data
    ? buildHistogram(data.resultados_total, 50, data.TotalVaR, data.TotalEaR)
    : null;

  return (
    <main className="container">
      <h1>Aplicación profesional de VaR por Simulación Histórica</h1>
      <h2>Roberto Knop</h2>

      <p className="subtitle">
        Carga un Excel con hojas <strong>Precios</strong> y <strong>Posiciones</strong>.
        La aplicación calcula VaR individual, VaR total correlacionado, EaR y ESF.
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
              <span>ESF total correlacionado</span>
              <strong>{formatEUR(data.TotalESF)}</strong>
            </div>
          </div>

          <h3>VaR individual por activo</h3>

          <table>
            <thead>
              <tr>
                <th>Activo</th>
                <th>VaR</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(data.dict_var).map(a => (
                <tr key={a}>
                  <td>{a}</td>
                  <td>{formatEUR(data.dict_var[a])}</td>
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
            <Bar
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  },
                  tooltip: {
                    callbacks: {
                      title: context => `Rango: ${context[0].label}`,
                      label: context => `Frecuencia: ${context.raw}`
                    }
                  }
                },
                scales: {
                  x: {
                    ticks: {
                      maxRotation: 90,
                      minRotation: 90,
                      autoSkip: true,
                      maxTicksLimit: 15
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
          </div>
        </section>
      )}
    </main>
  );
}
