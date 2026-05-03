import { useState } from "react";

export default function UploadForm({ setData, setError }) {
  const [file, setFile] = useState(null);
  const [code, setCode] = useState("");
  const [alpha, setAlpha] = useState("0.95");
  const [method, setMethod] = useState("historical_original");

  const handleSubmit = async () => {
    setError("");
    setData(null);

    if (!file) {
      setError("Debes subir un archivo Excel.");
      return;
    }

    const res = await fetch("/api/var", {
      method: "POST",
      headers: {
        "x-access-code": code,
        "x-alpha": alpha,
        "x-method": method
      },
      body: file
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Error calculando VaR.");
      return;
    }

    setData(data);
  };

  return (
    <div className="card">
      <label>Código de acceso</label>
      <input
        type="text"
        placeholder="CLIENTE2026"
        onChange={e => setCode(e.target.value)}
      />

      <label>Archivo Excel</label>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={e => setFile(e.target.files[0])}
      />

      <label>Percentil</label>
      <select value={alpha} onChange={e => setAlpha(e.target.value)}>
        <option value="0.90">90%</option>
        <option value="0.95">95%</option>
        <option value="0.975">97,5%</option>
        <option value="0.99">99%</option>
      </select>

<label>Método</label>
<select value={method} onChange={e => setMethod(e.target.value)}>
  <option value="historical">Simulación histórica</option>
  <option value="parametric_normal">Paramétrico Normal</option>
</select>

      <button onClick={handleSubmit}>Calcular VaR</button>
    </div>
  );
}
