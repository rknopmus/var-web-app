import * as XLSX from "xlsx";
import { calcularVaR } from "../../lib/var";
import { validateAccess } from "../../lib/auth";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  try {
    const code = req.headers["x-access-code"];
    const alpha = Number(req.headers["x-alpha"] || 0.95);
    const method = req.headers["x-method"] || "historical_original";

    if (!validateAccess(code)) {
      return res.status(401).json({ error: "Código inválido o expirado" });
    }

    let buffers = [];
    for await (const chunk of req) buffers.push(chunk);

    const buffer = Buffer.concat(buffers);
    const workbook = XLSX.read(buffer);

    if (!workbook.Sheets["Precios"] || !workbook.Sheets["Posiciones"]) {
      return res.status(400).json({
        error: "El Excel debe contener las hojas Precios y Posiciones."
      });
    }

    const precios = XLSX.utils.sheet_to_json(workbook.Sheets["Precios"]);
    const posicionesRaw = XLSX.utils.sheet_to_json(workbook.Sheets["Posiciones"]);

let posiciones = {};

posicionesRaw.forEach(p => {
  const activo =
    p.Activo ??
    p.ACTIVO ??
    p.activo ??
    p["Activo"] ??
    p["ACTIVO"];

  const posicion =
    p.Posicion ??
    p.POSICION ??
    p.posicion ??
    p["Posición"] ??
    p["POSICIÓN"];

  if (activo !== undefined && posicion !== undefined) {
    posiciones[String(activo).trim()] = Number(posicion);
  }
});
    if (Object.keys(posiciones).length === 0) {
  return res.status(400).json({
    error: "No se han encontrado posiciones. Revisa que la hoja Posiciones tenga columnas Activo y Posicion."
  });
}

    const result = calcularVaR(precios, posiciones, alpha, method);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
