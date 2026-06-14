import * as XLSX from "xlsx";

export const config = {
  api: {
    bodyParser: false
  }
};

function toNumber(v) {
  if (v === null || v === undefined || v === "") return NaN;
  return Number(String(v).replace(",", "."));
}

function mean(values) {
  if (!values || values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values) {
  if (!values || values.length < 2) return null;
  const m = mean(values);
  return Math.sqrt(
    values.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) /
      (values.length - 1)
  );
}

function maxDrawdown(returns) {
  let wealth = 1;
  let peak = 1;
  let maxDD = 0;

  returns.forEach(r => {
    wealth *= 1 + r;
    peak = Math.max(peak, wealth);
    maxDD = Math.min(maxDD, wealth / peak - 1);
  });

  return maxDD;
}

function covariance(a, b) {
  if (!a || !b || a.length !== b.length || a.length < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  return (
    a.reduce((acc, x, i) => acc + (x - ma) * (b[i] - mb), 0) /
    (a.length - 1)
  );
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

function normalize(value, min, max, reverse = false) {
  if (value === null || value === undefined || !isFinite(value)) return 0.5;
  if (max === min) return 0.5;
  const z = (value - min) / (max - min);
  const clipped = Math.max(0, Math.min(1, z));
  return reverse ? 1 - clipped : clipped;
}

function parseWorkbook(workbook) {
  if (!workbook.Sheets["Precios"] || !workbook.Sheets["Posiciones"]) {
    throw new Error("El Excel debe contener las hojas Precios y Posiciones.");
  }

  let precios = XLSX.utils.sheet_to_json(workbook.Sheets["Precios"], {
    defval: null
  });

  precios = precios.map(row => {
    const cleanRow = {};
    Object.keys(row).forEach(key => {
      cleanRow[String(key).trim()] = row[key];
    });
    return cleanRow;
  });

  precios = precios.filter(row =>
    Object.keys(row).some(k => {
      const key = String(k).trim().toLowerCase();
      if (key === "dates" || key === "fecha" || key === "date") return false;
      const n = toNumber(row[k]);
      return isFinite(n) && n > 0;
    })
  );

  const posicionesRaw = XLSX.utils.sheet_to_json(workbook.Sheets["Posiciones"], {
    defval: null
  });

  const posiciones = {};

  posicionesRaw.forEach(p => {
    const activo = p.Activo ?? p.ACTIVO ?? p.activo ?? p["Activo"] ?? p["ACTIVO"];
    const posicion =
      p.Posicion ?? p.POSICION ?? p.posicion ?? p["Posición"] ?? p["POSICIÓN"];

    if (activo !== undefined && posicion !== undefined) {
      posiciones[String(activo).trim()] = toNumber(posicion);
    }
  });

  return { precios, posiciones };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido." });
    }

    const password = req.headers["x-optimization-password"];

    if (!process.env.OPTIMIZATION_PASSWORD) {
      return res.status(500).json({
        error: "Falta configurar OPTIMIZATION_PASSWORD en Vercel."
      });
    }

    if (password !== process.env.OPTIMIZATION_PASSWORD) {
      return res.status(401).json({
        error: "Password de optimización incorrecto."
      });
    }

    const profile = String(req.headers["x-profile"] || "moderate");
    const minWeight = toNumber(req.headers["x-min-weight"]) / 100;
    const maxWeight = toNumber(req.headers["x-max-weight"]) / 100;
    const riskFreeRate = toNumber(req.headers["x-risk-free-rate"]) / 100;
    const benchmarkName = String(req.headers["x-benchmark"] || "").trim();
    const allowCash = String(req.headers["x-allow-cash"] || "yes") === "yes";

    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);

    const workbook = XLSX.read(Buffer.concat(buffers));
    const { precios, posiciones } = parseWorkbook(workbook);

    const activos = Object.keys(posiciones).filter(a => isFinite(posiciones[a]));

    if (precios.length < 3 || activos.length === 0) {
      return res.status(400).json({
        error: "No hay datos suficientes para optimizar."
      });
    }

    const columnas = Object.keys(precios[0] || {});

    function findColumn(asset) {
      return columnas.find(
        c => String(c).trim().toUpperCase() === String(asset).trim().toUpperCase()
      );
    }

    const returnsByAsset = {};
    const lastPrices = {};
    const currentValues = {};

    activos.forEach(a => {
      const col = findColumn(a);
      if (!col) return;

      const r = [];

      for (let i = 1; i < precios.length; i++) {
        const p0 = toNumber(precios[i - 1][col]);
        const p1 = toNumber(precios[i][col]);

        if (isFinite(p0) && isFinite(p1) && p0 > 0 && p1 > 0) {
          r.push(Math.log(p1 / p0));
        }
      }

      returnsByAsset[a] = r;
      lastPrices[a] = toNumber(precios[precios.length - 1][col]);
      currentValues[a] = posiciones[a] * lastPrices[a];
    });

    const validAssets = activos.filter(a => returnsByAsset[a]?.length > 2);
    const totalValue = validAssets.reduce((acc, a) => acc + currentValues[a], 0);

    let benchmarkReturns = null;

    if (benchmarkName) {
      const bCol = findColumn(benchmarkName);
      if (bCol) {
        benchmarkReturns = [];
        for (let i = 1; i < precios.length; i++) {
          const p0 = toNumber(precios[i - 1][bCol]);
          const p1 = toNumber(precios[i][bCol]);
          if (isFinite(p0) && isFinite(p1) && p0 > 0 && p1 > 0) {
            benchmarkReturns.push(Math.log(p1 / p0));
          }
        }
      }
    }

    const metrics = validAssets.map(a => {
      const r = returnsByAsset[a];
      const dailyMean = mean(r);
      const dailyStd = std(r);
      const downside = r.filter(x => x < 0);
      const downsideStd = std(downside);

      const annualReturn = dailyMean * 252;
      const annualVol = dailyStd * Math.sqrt(252);
      const annualDownside = downsideStd ? downsideStd * Math.sqrt(252) : null;

      const sharpe =
        annualVol && annualVol !== 0 ? (annualReturn - riskFreeRate) / annualVol : null;

      const sortino =
        annualDownside && annualDownside !== 0
          ? (annualReturn - riskFreeRate) / annualDownside
          : null;

      const mdd = maxDrawdown(r);

      let informationRatio = null;
      let treynor = null;

      if (benchmarkReturns && benchmarkReturns.length === r.length) {
        const activeReturns = r.map((x, i) => x - benchmarkReturns[i]);
        const trackingError = std(activeReturns) * Math.sqrt(252);
        informationRatio =
          trackingError && trackingError !== 0
            ? (mean(activeReturns) * 252) / trackingError
            : null;

        const beta =
          covariance(r, benchmarkReturns) / Math.pow(std(benchmarkReturns), 2);

        treynor =
          beta && isFinite(beta) && beta !== 0
            ? (annualReturn - riskFreeRate) / beta
            : null;
      }

      const currentWeight = totalValue !== 0 ? currentValues[a] / totalValue : 0;

      const pnl = r.map(x => currentValues[a] * x);
      const varAsset = quantile(pnl, 0.05);

      return {
        asset: a,
        currentWeight,
        MeanReturnAnnual: annualReturn,
        VolatilityAnnual: annualVol,
        Sharpe: sharpe,
        Sortino: sortino,
        MaxDrawdown: mdd,
        InformationRatio: informationRatio,
        Treynor: treynor,
        VaRContributionProxy: Math.abs(varAsset || 0)
      };
    });

    const ranges = {
      sharpe: [Math.min(...metrics.map(x => x.Sharpe ?? 0)), Math.max(...metrics.map(x => x.Sharpe ?? 0))],
      sortino: [Math.min(...metrics.map(x => x.Sortino ?? 0)), Math.max(...metrics.map(x => x.Sortino ?? 0))],
      vol: [Math.min(...metrics.map(x => x.VolatilityAnnual ?? 0)), Math.max(...metrics.map(x => x.VolatilityAnnual ?? 0))],
      dd: [Math.min(...metrics.map(x => x.MaxDrawdown ?? 0)), Math.max(...metrics.map(x => x.MaxDrawdown ?? 0))],
      varc: [Math.min(...metrics.map(x => x.VaRContributionProxy ?? 0)), Math.max(...metrics.map(x => x.VaRContributionProxy ?? 0))]
    };

    const weights =
      profile === "conservative"
        ? { ret: 0.2, risk: 0.8 }
        : profile === "aggressive"
        ? { ret: 0.7, risk: 0.3 }
        : { ret: 0.5, risk: 0.5 };

    const scored = metrics.map(m => {
      const returnScore =
        0.65 * normalize(m.Sharpe, ranges.sharpe[0], ranges.sharpe[1]) +
        0.35 * normalize(m.Sortino, ranges.sortino[0], ranges.sortino[1]);

      const riskScore =
        0.35 * normalize(m.VolatilityAnnual, ranges.vol[0], ranges.vol[1], true) +
        0.35 * normalize(Math.abs(m.MaxDrawdown), 0, Math.max(...metrics.map(x => Math.abs(x.MaxDrawdown || 0))), true) +
        0.30 * normalize(m.VaRContributionProxy, ranges.varc[0], ranges.varc[1], true);

      return {
        ...m,
        score: weights.ret * returnScore + weights.risk * riskScore
      };
    });

    let scoreSum = scored.reduce((acc, x) => acc + Math.max(0.0001, x.score), 0);

    let rawWeights = scored.map(x => ({
      asset: x.asset,
      weight: Math.max(0.0001, x.score) / scoreSum
    }));

    rawWeights = rawWeights.map(x => ({
      ...x,
      weight: Math.max(minWeight || 0, Math.min(maxWeight || 1, x.weight))
    }));

    const adjustedSum = rawWeights.reduce((acc, x) => acc + x.weight, 0);

    let finalWeights = rawWeights.map(x => ({
      ...x,
      weight: x.weight / adjustedSum
    }));

    if (!allowCash) {
      const sum = finalWeights.reduce((acc, x) => acc + x.weight, 0);
      finalWeights = finalWeights.map(x => ({ ...x, weight: x.weight / sum }));
    }

    const totalVarProxy = scored.reduce((acc, x) => acc + x.VaRContributionProxy, 0);

    const recommendations = scored.map(m => {
      const rec = finalWeights.find(x => x.asset === m.asset);
      const recommendedWeight = rec ? rec.weight : m.currentWeight;
      const change = recommendedWeight - m.currentWeight;

      let rationale = "Mantener";
      if (change < -0.01) {
        rationale =
          "Reducir: elevada contribución al riesgo o menor eficiencia riesgo-rentabilidad.";
      } else if (change > 0.01) {
        rationale =
          "Aumentar: mejor combinación de rentabilidad, riesgo y drawdown.";
      }

      return {
        asset: m.asset,
        currentWeightPct: m.currentWeight * 100,
        recommendedWeightPct: recommendedWeight * 100,
        changePct: change * 100,
        MeanReturnAnnualPct: m.MeanReturnAnnual * 100,
        VolatilityAnnualPct: m.VolatilityAnnual * 100,
        Sharpe: m.Sharpe,
        Sortino: m.Sortino,
        MaxDrawdownPct: m.MaxDrawdown * 100,
        InformationRatio: m.InformationRatio,
        Treynor: m.Treynor,
        VaRContributionPct:
          totalVarProxy !== 0 ? (m.VaRContributionProxy / totalVarProxy) * 100 : null,
        rationale
      };
    });

    return res.status(200).json({
      profile,
      recommendations
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Error calculando optimización."
    });
  }
}
