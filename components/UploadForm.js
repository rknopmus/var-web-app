import { useState } from "react";

export default function UploadForm({
  setData,
  setError,
  setSourceFile,
  lang = "es"
}) {
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
      varError: "Error calculando VaR.",
      selectFile: "Seleccionar archivo",
      noFile: "Ningún archivo seleccionado"
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
      varError: "Error calculating VaR.",
      selectFile: "Select file",
      noFile: "No file selected"
    }
  };

  const [file, setFile] = useState(null);
  const [code, setCode] = useState("");
  const [alpha, setAlpha] = useState("0.95");
  const [method, setMethod] = useState("historical");

  const handleFileChange = e => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    if (setSourceFile) setSourceFile(selected);
  };

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
        onChange={handleFileChange}
      />

      <label htmlFor="excel-upload" className="customFileButton">
        {txt[lang].selectFile}
      </label>

      <span className="fileName">
        {file ? file.name : txt[lang].noFile}
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
