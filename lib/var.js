export function calcularVaR(precios, posiciones, alpha = 0.95) {
  const activos = Object.keys(posiciones).filter(a => posiciones[a] !== null && posiciones[a] !== undefined && posiciones[a] !== "");

  if (!precios || precios.length < 2) {
    throw new Error("La hoja Precios debe tener al menos dos filas de datos.");
  }

  if (activos.length === 0) {
    throw new Error("La hoja Posiciones debe contener al menos un activo.");
  }

  const returns = [];

  for (let i = 1; i < precios.length; i++) {
    const row = {};
    let validRow = true;

    activos.forEach(a => {
      const p0 = Number(precios[i - 1][a]);
      const p1 = Number(precios[i][a]);

      if (!isFinite(p0) || !isFinite(p1) || p0 <= 0 || p1 <= 0) {
        validRow = false;
      } else {
        row[a] = Math.log(p1 / p0);
      }
    });

    if (validRow) returns.push(row);
  }

  if (returns.length === 0) {
    throw new Error("No se pudieron calcular retornos válidos. Revisa precios y nombres de activos.");
  }

  const dict_var = {};
  const resultados_total = [];

  returns.forEach(r => {
    let total = 0;

    activos.forEach(a => {
      const posicion = Number(posiciones[a]);
      const precioActual = Number(precios[precios.length - 1][a]);
      const exposicion = posicion * precioActual;
      const pnl = exposicion * r[a];
      total += pnl;
    });

    resultados_total.push(total);
  });

  const sortedTotal = [...resultados_total].sort((a, b) => a - b);
  const index = Math.max(0, Math.floor((1 - alpha) * sortedTotal.length));
  const TotalVaR = Math.abs(sortedTotal[index]);

  activos.forEach(a => {
    const precioActual = Number(precios[precios.length - 1][a]);
    const exposicion = Number(posiciones[a]) * precioActual;
    const pnl = returns.map(r => exposicion * r[a]).sort((x, y) => x - y);
    dict_var[a] = Math.abs(pnl[index]);
  });

  const cola = sortedTotal.slice(0, index + 1);
  const TotalEaR = Math.abs(cola.reduce((a, b) => a + b, 0) / cola.length);
  const TotalESF = TotalEaR;

  return {
    activos,
    dict_var,
    TotalVaR,
    TotalEaR,
    TotalESF,
    resultados_total
  };
}
