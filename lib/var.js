export function calcularVaR(precios, posiciones, alpha = 0.95, method = "historical") {
  const activos = Object.keys(posiciones).filter(
    a =>
      posiciones[a] !== null &&
      posiciones[a] !== undefined &&
      posiciones[a] !== "" &&
      !isNaN(posiciones[a])
  );

  const resultadosPorActivo = {};
  const resultados_total = [];

  if (resultados_total.length === 0) {
  throw new Error(
    "No se pudieron calcular retornos válidos. Revisa que los activos de Posiciones coincidan con las columnas de Precios y que los precios sean positivos."
  );
}
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

  function mean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function std(values) {
    const m = mean(values);
    const variance =
      values.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) /
      (values.length - 1);

    return Math.sqrt(variance);
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

  function inverseNormal(p) {
    const a = [
      -39.69683028665376,
      220.9460984245205,
      -275.9285104469687,
      138.357751867269,
      -30.66479806614716,
      2.506628277459239
    ];

    const b = [
      -54.47609879822406,
      161.5858368580409,
      -155.6989798598866,
      66.80131188771972,
      -13.28068155288572
    ];

    const c = [
      -0.007784894002430293,
      -0.3223964580411365,
      -2.400758277161838,
      -2.549732539343734,
      4.374664141464968,
      2.938163982698783
    ];

    const d = [
      0.007784695709041462,
      0.3224671290700398,
      2.445134137142996,
      3.754408661907416
    ];

    const plow = 0.02425;
    const phigh = 1 - plow;
    let q, r;

    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }

    if (p <= phigh) {
      q = p - 0.5;
      r = q * q;
      return (
        (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
      );
    }

    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  const dict_var = {};
  const dict_activos = {};

  let TotalVaR;
  let TotalEaR;

  if (method === "historical") {
    activos.forEach(a => {
      const varActivo = quantile(resultadosPorActivo[a], 1 - alpha);
      const earActivo = quantile(resultadosPorActivo[a], alpha);
      const colaActivo = resultadosPorActivo[a].filter(x => x < varActivo);
      const esfActivo = colaActivo.length > 0 ? mean(colaActivo) : null;

      dict_var[a] = varActivo;

      dict_activos[a] = {
        VaR: varActivo,
        EaR: earActivo,
        ESF: esfActivo,
        RatioEaRVaRAbs: varActivo !== 0 ? Math.abs(earActivo / varActivo) : null,
        RatioEaRVaRPct: varActivo !== 0 ? Math.abs(earActivo / varActivo) * 100 : null
      };
    });

    TotalVaR = quantile(resultados_total, 1 - alpha);
    TotalEaR = quantile(resultados_total, alpha);
  }

  if (method === "parametric_normal") {
    const zLeft = inverseNormal(1 - alpha);
    const zRight = inverseNormal(alpha);

    activos.forEach(a => {
      const mu = mean(resultadosPorActivo[a]);
      const sigma = std(resultadosPorActivo[a]);

      const varActivo = mu + zLeft * sigma;
      const earActivo = mu + zRight * sigma;
      const colaActivo = resultadosPorActivo[a].filter(x => x < varActivo);
      const esfActivo = colaActivo.length > 0 ? mean(colaActivo) : null;

      dict_var[a] = varActivo;

      dict_activos[a] = {
        VaR: varActivo,
        EaR: earActivo,
        ESF: esfActivo,
        RatioEaRVaRAbs: varActivo !== 0 ? Math.abs(earActivo / varActivo) : null,
        RatioEaRVaRPct: varActivo !== 0 ? Math.abs(earActivo / varActivo) * 100 : null
      };
    });

    const muTotal = mean(resultados_total);
    const sigmaTotal = std(resultados_total);

    TotalVaR = muTotal + zLeft * sigmaTotal;
    TotalEaR = muTotal + zRight * sigmaTotal;
  }

  if (method !== "historical" && method !== "parametric_normal") {
    throw new Error("Método no reconocido.");
  }

  const colaNegativa = resultados_total.filter(x => x < TotalVaR);
  const colaPositiva = resultados_total.filter(x => x > TotalEaR);

  const TotalESFMinus =
    colaNegativa.length > 0 ? mean(colaNegativa) : null;

  const TotalESFPlus =
    colaPositiva.length > 0 ? mean(colaPositiva) : null;

  const RatioEaRVaRAbs =
    TotalVaR !== 0 ? Math.abs(TotalEaR / TotalVaR) : null;

  const RatioEaRVaRPct =
    RatioEaRVaRAbs !== null ? RatioEaRVaRAbs * 100 : null;

  const RatioESFAbs =
    TotalESFMinus !== 0 && TotalESFMinus !== null
      ? Math.abs(TotalESFPlus / TotalESFMinus)
      : null;

  const RatioESFPct =
    RatioESFAbs !== null ? RatioESFAbs * 100 : null;

  return {
    activos,
    dict_var,
    dict_activos,
    TotalVaR,
    TotalEaR,
    TotalESF: TotalESFMinus,
    TotalESFMinus,
    TotalESFPlus,
    RatioEaRVaRAbs,
    RatioEaRVaRPct,
    RatioESFAbs,
    RatioESFPct,
    resultados_total,
    alpha,
    method
  };
}
