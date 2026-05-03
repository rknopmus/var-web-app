export function calcularVaR(precios, posiciones, alpha = 0.95, method = "historical_original") {
  const activos = Object.keys(posiciones).filter(
    a => posiciones[a] !== null && posiciones[a] !== undefined && posiciones[a] !== "" && !isNaN(posiciones[a])
  );

  if (!precios || precios.length < 2) {
    throw new Error("La hoja Precios debe tener al menos dos filas de datos.");
  }

  if (activos.length === 0) {
    throw new Error("La hoja Posiciones debe contener al menos un activo.");
  }

  const resultadosPorActivo = {};
  const resultados_total = [];

  activos.forEach(a => {
    resultadosPorActivo[a] = [];
  });

  for (let i = 1; i < precios.length; i++) {
    let total = 0;
    let validRow = true;
    let resultadosFila = {};

    activos.forEach(a => {
      const precioAnterior = Number(precios[i - 1][a]);
      const precioActualFila = Number(precios[i][a]);
      const priceNow = Number(precios[precios.length - 1][a]);
      const posicion = Number(posiciones[a]);

      if (
        !isFinite(precioAnterior) ||
        !isFinite(precioActualFila) ||
        !isFinite(priceNow) ||
        !isFinite(posicion) ||
        precioAnterior <= 0 ||
        precioActualFila <= 0
      ) {
        validRow = false;
        return;
      }

      const tasa = Math.log(precioActualFila / precioAnterior);

      // Replicando tu código Python original:
      // simulacion = exp(tasa) * price_now
      // valoracion = simulacion * posicion
      // resultado = valoracion - nominal
      const simulacion = Math.exp(tasa) * priceNow;
      const valoracion = simulacion * posicion;
      const nominal = priceNow * posicion;
      const resultado = valoracion - nominal;

      resultadosFila[a] = resultado;
      total += resultado;
    });

    if (validRow) {
      activos.forEach(a => resultadosPorActivo[a].push(resultadosFila[a]));
      resultados_total.push(total);
    }
  }

  function quantile(values, q) {
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }

    return sorted[base];
  }

  const dict_var = {};

  activos.forEach(a => {
    dict_var[a] = quantile(resultadosPorActivo[a], 1 - alpha);
  });

  const TotalVaR = quantile(resultados_total, 1 - alpha);
  const TotalEaR = quantile(resultados_total, alpha);

  let limiteESF;

  if (method === "historical_original") {
    const ultimoActivo = activos[activos.length - 1];
    limiteESF = dict_var[ultimoActivo];
  } else {
    limiteESF = TotalVaR;
  }

  const cola = resultados_total.filter(x => x < limiteESF);

  const TotalESF =
    cola.length > 0
      ? cola.reduce((acc, x) => acc + x, 0) / cola.length
      : null;

  return {
    activos,
    dict_var,
    TotalVaR,
    TotalEaR,
    TotalESF,
    resultados_total,
    alpha,
    method
  };
}
