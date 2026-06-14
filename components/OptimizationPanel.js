import { useState } from "react";

function formatPct(value) {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return `${Number(value).toFixed(2)}%`;
}

function formatNum(value) {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return Number(value).toFixed(4);
}

export default function OptimizationPanel({ sourceFile, lang = "es" }) {
  const txt = {
    es: {
      title: "Optimización de cartera",
      note:
        "Este análisis es opcional y utiliza el mismo Excel cargado en la pestaña VaR.",
      password: "Password de optimización",
      profile: "Perfil",
      conservative: "Conservador",
      moderate: "Moderado",
      aggressive: "Agresivo",
      minWeight: "Peso mínimo por activo (%)",
      maxWeight: "Peso máximo por activo (%)",
      riskFree: "Tipo libre de riesgo anual (%)",
      benchmark: "Benchmark opcional",
      benchmarkPlaceholder: "Nombre de columna en Precios, ej. IBEX",
      cash: "Permitir efectivo",
      yes: "Sí",
      no: "No",
      run: "Generar recomendación",
      noFile:
        "Primero carga un Excel en la pestaña de Cálculo VaR. Después vuelve aquí.",
      error: "No se pudo calcular la optimización.",
      results: "Recomendación de pesos",
      asset: "Activo",
      currentWeight: "Peso actual",
      recommendedWeight: "Peso recomendado",
      change: "Cambio",
      meanReturn: "Rent. media anual",
      volatility: "Volatilidad anual",
      sharpe: "Sharpe",
      sortino: "Sortino",
      maxDrawdown: "Max Drawdown",
      informationRatio: "Information Ratio",
      treynor: "Treynor",
      varContribution: "Contribución VaR",
      rationale: "Motivo"
    },
    en: {
      title: "Portfolio optimization",
      note:
        "This optional analysis uses the same Excel file uploaded in the VaR tab.",
      password: "Optimization password",
      profile: "Profile",
      conservative: "Conservative",
      moderate: "Moderate",
      aggressive: "Aggressive",
      minWeight: "Minimum weight per asset (%)",
      maxWeight: "Maximum weight per asset (%)",
      riskFree: "Annual risk-free rate (%)",
      benchmark: "Optional benchmark",
      benchmarkPlaceholder: "Column name in Prices, e.g. IBEX",
      cash: "Allow cash",
      yes: "Yes",
      no: "No",
      run: "Generate recommendation",
      noFile:
        "First upload an Excel file in the VaR calculation tab. Then return here.",
      error: "Optimization could not be calculated.",
      results: "Weight recommendation",
      asset: "Asset",
      currentWeight: "Current weight",
      recommendedWeight: "Recommended weight",
      change: "Change",
      meanReturn: "Annual mean return",
      volatility: "Annual volatility",
      sharpe: "Sharpe",
      sortino: "Sortino",
      maxDrawdown: "Max Drawdown",
      informationRatio: "Information Ratio",
      treynor: "Treynor",
      varContribution: "VaR contribution",
      rationale: "Rationale"
    }
  };

  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState("moderate");
  const [minWeight, setMinWeight] = useState("0");
  const [maxWeight, setMaxWeight] = useState("40");
  const [riskFreeRate, setRiskFreeRate] = useState("2");
  const [benchmark, setBenchmark] = useState("");
  const [allowCash, setAllowCash] = useState("yes");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const runOptimization = async () => {
    setError("");
    setResult(null);

    if (!sourceFile) {
      setError(txt[lang].noFile);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: {
          "x-optimization-password": password,
          "x-profile": profile,
          "x-min-weight": minWeight,
          "x-max-weight": maxWeight,
          "x-risk-free-rate": riskFreeRate,
          "x-benchmark": benchmark,
          "x-allow-cash": allowCash
        },
        body: sourceFile
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || txt[lang].error);
        return;
      }

      setResult(data);
    } catch (e) {
      setError(txt[lang].error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="results">
      <h2>{txt[lang].title}</h2>
      <p className="subtitle">{txt[lang].note}</p>

      <div className="card optimizationForm">
        <label>{txt[lang].password}</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <label>{txt[lang].profile}</label>
        <select value={profile} onChange={e => setProfile(e.target.value)}>
          <option value="conservative">{txt[lang].conservative}</option>
          <option value="moderate">{txt[lang].moderate}</option>
          <option value="aggressive">{txt[lang].aggressive}</option>
        </select>

        <label>{txt[lang].minWeight}</label>
        <input
          type="number"
          value={minWeight}
          onChange={e => setMinWeight(e.target.value)}
        />

        <label>{txt[lang].maxWeight}</label>
        <input
          type="number"
          value={maxWeight}
          onChange={e => setMaxWeight(e.target.value)}
        />

        <label>{txt[lang].riskFree}</label>
        <input
          type="number"
          value={riskFreeRate}
          onChange={e => setRiskFreeRate(e.target.value)}
        />

        <label>{txt[lang].benchmark}</label>
        <input
          type="text"
          placeholder={txt[lang].benchmarkPlaceholder}
          value={benchmark}
          onChange={e => setBenchmark(e.target.value)}
        />

        <label>{txt[lang].cash}</label>
        <select value={allowCash} onChange={e => setAllowCash(e.target.value)}>
          <option value="yes">{txt[lang].yes}</option>
          <option value="no">{txt[lang].no}</option>
        </select>

        <button onClick={runOptimization} disabled={loading}>
          {loading ? "..." : txt[lang].run}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <>
          <h3>{txt[lang].results}</h3>

          <table>
            <thead>
              <tr>
                <th>{txt[lang].asset}</th>
                <th>{txt[lang].currentWeight}</th>
                <th>{txt[lang].recommendedWeight}</th>
                <th>{txt[lang].change}</th>
                <th>{txt[lang].sharpe}</th>
                <th>{txt[lang].sortino}</th>
                <th>{txt[lang].maxDrawdown}</th>
                <th>{txt[lang].varContribution}</th>
                <th>{txt[lang].rationale}</th>
              </tr>
            </thead>
            <tbody>
              {result.recommendations.map(row => (
                <tr key={row.asset}>
                  <td>{row.asset}</td>
                  <td>{formatPct(row.currentWeightPct)}</td>
                  <td>{formatPct(row.recommendedWeightPct)}</td>
                  <td>{formatPct(row.changePct)}</td>
                  <td>{formatNum(row.Sharpe)}</td>
                  <td>{formatNum(row.Sortino)}</td>
                  <td>{formatPct(row.MaxDrawdownPct)}</td>
                  <td>{formatPct(row.VaRContributionPct)}</td>
                  <td>{row.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Indicadores / Metrics</h3>

          <table>
            <thead>
              <tr>
                <th>{txt[lang].asset}</th>
                <th>{txt[lang].meanReturn}</th>
                <th>{txt[lang].volatility}</th>
                <th>{txt[lang].informationRatio}</th>
                <th>{txt[lang].treynor}</th>
              </tr>
            </thead>
            <tbody>
              {result.recommendations.map(row => (
                <tr key={row.asset}>
                  <td>{row.asset}</td>
                  <td>{formatPct(row.MeanReturnAnnualPct)}</td>
                  <td>{formatPct(row.VolatilityAnnualPct)}</td>
                  <td>{formatNum(row.InformationRatio)}</td>
                  <td>{formatNum(row.Treynor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
