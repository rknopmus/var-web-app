import { useState } from "react";

export default function UploadForm({ setData, setError, lang = "es" }) {
  const txt = {
    es: {
      code: "Código de acceso",
      file: "Archivo Excel",
      percentile: "Percentil",
      method: "Método",
      historical: "Simulación histórica",
      normal: "Paramétrico Normal",
      calculate: "Calcular VaR",
      fileError: "Debes subir un archivo Excel.",
      varError: "Error calculando VaR."
    },
    en: {
      code: "Access code",
      file: "Excel file",
      percentile: "Percentile",
      method: "Method",
      historical: "Historical simulation",
      normal: "Parametric Normal",
      calculate: "Calculate VaR",
      fileError: "You must upload an Excel file.",
      varError: "Error calculating VaR."
    }
  };

  const [file, setFile] = useState(null);
  const [code, setCode] = useState("");
  const [alpha, setAlpha] = useState("0.95");
  const [method, setMethod] = useState("historical");

  const handleSubmit = async () => {
    setError("");
    setData(null);

    if (!file) {
      setError(txt[lang].fileError);
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
      setError(data.error || txt[lang].varError);
      return;
    }

    setData(data);
  };

  return (
    <div className="card">
      <label>{txt[lang].code}</label>
      <input
        type="text"
        placeholder="CLIENTE2026"
        value={code}
        onChange={e => setCode(e.target.value)}
      />

      <label>{txt[lang].file}</label>
      <input
  id="excel-upload"
  type="file"
  accept=".xlsx,.xls"
  style={{ display: "none" }}
  onChange={e => setFile(e.target.files[0])}
/>

<label htmlFor="excel-upload" className="customFileButton">
  {lang === "es" ? "Seleccionar archivo" : "Select file"}
</label>

<span className="fileName">
  {file
    ? file.name
    : lang === "es"
    ? "Ningún archivo seleccionado"
    : "No file selected"}
</span>
      <label>{txt[lang].percentile}</label>
      <select value={alpha} onChange={e => setAlpha(e.target.value)}>
        <option value="0.90">90%</option>
        <option value="0.95">95%</option>
        <option value="0.975">97.5%</option>
        <option value="0.99">99%</option>
      </select>

      <label>{txt[lang].method}</label>
      <select value={method} onChange={e => setMethod(e.target.value)}>
        <option value="historical">{txt[lang].historical}</option>
        <option value="parametric_normal">{txt[lang].normal}</option>
      </select>

      <button onClick={handleSubmit}>{txt[lang].calculate}</button>
    </div>
  );
}
