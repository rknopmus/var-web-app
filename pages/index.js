import { useMemo, useState } from "react";
import UploadForm from "../components/UploadForm";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function formatEUR(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }).format(value);
}

function buildHistogram(values, bins = 50) {
  if (!values || values.length === 0) return { labels: [], data: [] };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const counts = Array(bins).fill(0);

  values.forEach(v => {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width));
    counts[idx] += 1;
  });

  const labels = counts.map((_, i) => {
    const start = min + i * width;
    const end = start + width;
    return `${start.toFixed(0)} / ${end.toFixed(0)}`;
  });

  return { labels, data: counts };
}

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const histogram = useMemo(() => buildHistogram(data?.resultados_total || [], 50), [data]);

  return (
    <main className="container">
      <h1>Aplicacion de VaR por SH (MV = precio x cantidad)</h1>
      <h2>Roberto Knop</h2>
      <p className="subtitle">Carga un Excel con hojas Precios y Posiciones para calcular VaR por simulación histórica.</p>

      <UploadForm setData={setData} setError={setError} />

      {error && <p className="error">{error}</p>}

      {data && (
        <section className="results">
          <h2>Resultados</h2>

          <div className="card">
            {Object.keys(data.dict_var).map(a => (
              <p key={a}>
                El VaR por simulación histórica <strong>{a}</strong> es <strong>{formatEUR(data.dict_var[a])}</strong>
              </p>
            ))}

            <hr />

            <p>El VaR correlacionado por simulación histórica es<strong>{formatEUR(data.TotalVaR)}</strong></p>
            <p>El EaR por simulación histórica <strong>{formatEUR(data.TotalEaR)}</strong></p>
            <p>El ESF por simulación histórica <strong>{formatEUR(data.TotalESF)}</strong></p>
          </div>

          <div className="card chart-card">
            <h3>Histograma Resultados_Total</h3>
            <Bar
              data={{
                labels: histogram.labels,
                datasets: [
                  {
                    label: "Frecuencia",
                    data: histogram.data
                  }
                ]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: { ticks: { maxRotation: 90, minRotation: 45 } }
                }
              }}
            />
          </div>
        </section>
      )}
    </main>
  );
}
