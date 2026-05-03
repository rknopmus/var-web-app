import * as XLSX from "xlsx";
import { calcularVaR } from "../../lib/var";
import { validateAccess } from "../../lib/auth";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const code = req.headers["x-access-code"];

  if (!validateAccess(code)) {
    return res.status(401).json({ error: "Código inválido o expirado" });
  }

  try {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);

    const buffer = Buffer.concat(buffers);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    if (!workbook.Sheets["Precios"] || !workbook.Sheets["Posiciones"]) {
      return res.status(400).json({ error: "El Excel debe tener las hojas Precios y Posiciones." });
    }

    const precios = XLSX.utils.sheet_to_json(workbook.Sheets["Precios"]);
    const posicionesRaw = XLSX.utils.sheet_to_json(workbook.Sheets["Posiciones"]);

    const posiciones = {};
    posicionesRaw.forEach(p => {
      posiciones[String(p.Activo).trim()] = Number(p.Posicion);
    });

    const result = calcularVaR(precios, posiciones);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Error calculando VaR" });
  }
}
