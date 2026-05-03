import { useState } from "react";

export default function UploadForm({ setData, setError }) {
  const [file, setFile] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setData(null);

    if (!code.trim()) {
      setError("Introduce un código de acceso.");
      return;
    }

    if (!file) {
      setError("Sube un archivo Excel.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/var", {
        method: "POST",
        headers: {
          "x-access-code": code.trim()
        },
        body: file
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error calculando VaR.");
        return;
      }

      setData(data);
    } catch (error) {
      setError("No se pudo procesar el archivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <label>Código de acceso</label>
      <input
        type="password"
        placeholder="Ej. CLIENTE2026"
        value={code}
        onChange={e => setCode(e.target.value)}
      />

      <label>Archivo Excel</label>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={e => setFile(e.target.files?.[0] || null)}
      />

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Calculando..." : "Calcular VaR"}
      </button>
    </div>
  );
}
