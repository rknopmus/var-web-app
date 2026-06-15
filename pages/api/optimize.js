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
    const activo =
      p.Activo ?? p.ACTIVO ?? p.activo ?? p["Activo"] ?? p["ACTIVO"];

    const posicion =
      p.Posicion ??
      p.POSICION ??
      p.posicion ??
      p["Posición"] ??
      p["POSICIÓN"];

    if (activo !== undefined && posicion !== undefined) {
      posiciones[String(activo).trim()] = toNumber(posicion);
    }
  });

  return { precios, posiciones };
}

function normalizeWeights(weights, minWeight, maxWeight) {
  let clipped = weights.map(w =>
    Math.max(minWeight, Math.min(maxWeight, w))
  );

  const sum = clipped.reduce((a, b) => a + b, 0);

  if (sum === 0) {
    return clipped.map(() => 1 / clipped.length);
  }

  return clipped.map(w => w / sum);
}

function randomWeights(n, minWeight, maxWeight) {
  const raw = Array.from({ length: n }, () => Math.random());
  const sum = raw.reduce((a, b) => a + b, 0);
  return normalizeWeights(raw.map(x => x / sum), minWeight, maxWeight);
}

function evaluatePortfolio({
  weights,
  returnsMatrix,
  riskFreeRate,
  alpha,
  currentTotalValue
}) {
  const portfolioReturns = returnsMatrix.map(row =>
    row.reduce((acc, r, i) => acc + weights[i] * r, 0)
  );

  const portfolioPnL = portfolioReturns.map(r => r * currentTotalValue);

  const VaR = quantile(portfolioPnL, 1 - alpha);
  const EaR = quantile(portfolioPnL, alpha);

  const negativeTail = portfolioPnL.filter(x => x < VaR);
  const positiveTail = portfolioPnL.filter(x => x > EaR);

  const ESFMinus = negativeTail.length > 0 ? mean(negativeTail) : null;
  const ESFPlus = positiveTail.length > 0 ? mean(positiveTail) : null;

  const annualReturn = mean(portfolioReturns) * 252;
  const annualVolatility = std(portfolioReturns) * Math.sqrt(252);

  const downsideReturns = portfolioReturns.filter(x => x < 0);
  const downsideVolatility =
    downsideReturns.length > 1 ? std(downsideReturns) * Math.sqrt(252) : null;

  const Sharpe =
    annualVolatility && annualVolatility !== 0
      ? (annualReturn - riskFreeRate) / annualVolatility
      : null;

  const Sortino =
    downsideVolatility && downsideVolatility !== 0
      ? (annualReturn - riskFreeRate) / downsideVolatility
      : null;

  const MaxDrawdown = maxDrawdown(portfolioReturns);

  const RatioEaRVaR =
    VaR !== 0 && VaR !== null ? Math.abs(EaR / VaR) : null;

  const RatioESF =
    ESFMinus !== 0 && ESFMinus !== null
      ? Math.abs(ESFPlus / ESFMinus)
      : null;

  const score =
    0.45 * (RatioEaRVaR || 0) +
    0.35 * (RatioESF || 0) +
    0.20 * (Sharpe || 0);

  return {
    portfolioReturns,
    portfolioPnL,
    VaR,
    EaR,
    ESFMinus,
    ESFPlus,
    RatioEaRVaR,
    RatioESF,
    annualReturn,
    annualVolatility,
    Sharpe,
    Sortino,
    MaxDrawdown,
    score
  };
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

    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);

    const workbook = XLSX.read(Buffer.concat(buffers));
    const { precios, posiciones } = parseWorkbook(workbook);

    const activos = Object.keys(posiciones).filter(a => isFinite(posiciones[a]));
    const columnas = Object.keys(precios[0] || {});

    function findColumn(asset) {
      return columnas.find(
        c => String(c).trim().toUpperCase() === String(asset).trim().toUpperCase()
      );
    }

    const validAssets = [];
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

      if (r.length > 2) {
        validAssets.push(a);
        returnsByAsset[a] = r;
        lastPrices[a] = toNumber(precios[precios.length - 1][col]);
        currentValues[a] = posiciones[a] * lastPrices[a];
      }
    });

    if (validAssets.length === 0) {
      return res.status(400).json({
        error: "No hay activos válidos para optimizar."
      });
    }

    const minLen = Math.min(...validAssets.map(a => returnsByAsset[a].length));

    const returnsMatrix = Array.from({ length: minLen }, (_, i) =>
      validAssets.map(a => returnsByAsset[a][returnsByAsset[a].length - minLen + i])
    );

    const currentTotalValue = validAssets.reduce(
      (acc, a) => acc + currentValues[a],
      0
    );

    const currentWeights = validAssets.map(a =>
      currentTotalValue !== 0 ? currentValues[a] / currentTotalValue : 0
    );

    const currentPortfolio = evaluatePortfolio({
      weights: currentWeights,
      returnsMatrix,
      riskFreeRate,
      alpha: 0.95,
      currentTotalValue
    });

    const iterations =
      profile === "conservative"
        ? 6000
        : profile === "aggressive"
        ? 9000
        : 7500;

    let bestWeights = currentWeights;
    let bestEvaluation = currentPortfolio;

    for (let i = 0; i < iterations; i++) {
      const candidateWeights = randomWeights(
        validAssets.length,
        minWeight || 0,
        maxWeight || 1
      );

      const evaluation = evaluatePortfolio({
        weights: candidateWeights,
        returnsMatrix,
        riskFreeRate,
        alpha: 0.95,
        currentTotalValue
      });

      if (evaluation.score > bestEvaluation.score) {
        bestWeights = candidateWeights;
        bestEvaluation = evaluation;
      }
    }

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

        benchmarkReturns = benchmarkReturns.slice(-minLen);
      }
    }

    const recommendations = validAssets.map((asset, i) => {
      const assetReturns = returnsByAsset[asset].slice(-minLen);
      const dailyMean = mean(assetReturns);
      const dailyStd = std(assetReturns);
      const annualReturn = dailyMean * 252;
      const annualVolatility = dailyStd * Math.sqrt(252);

      const downside = assetReturns.filter(x => x < 0);
      const downsideVol = downside.length > 1 ? std(downside) * Math.sqrt(252) : null;

      const Sharpe =
        annualVolatility && annualVolatility !== 0
          ? (annualReturn - riskFreeRate) / annualVolatility
          : null;

      const Sortino =
        downsideVol && downsideVol !== 0
          ? (annualReturn - riskFreeRate) / downsideVol
          : null;

      let InformationRatio = null;
      let Treynor = null;

      if (benchmarkReturns && benchmarkReturns.length === assetReturns.length) {
        const activeReturns = assetReturns.map((x, j) => x - benchmarkReturns[j]);
        const trackingError = std(activeReturns) * Math.sqrt(252);

        InformationRatio =
          trackingError && trackingError !== 0
            ? (mean(activeReturns) * 252) / trackingError
            : null;

        const beta =
          covariance(assetReturns, benchmarkReturns) /
          Math.pow(std(benchmarkReturns), 2);

        Treynor =
          beta && isFinite(beta) && beta !== 0
            ? (annualReturn - riskFreeRate) / beta
            : null;
      }

      const change = bestWeights[i] - currentWeights[i];

      let rationale = "Mantener";
      if (change < -0.01) {
        rationale =
          "Reducir: mejora el score de cartera al reducir asimetría negativa, VaR o drawdown.";
      } else if (change > 0.01) {
        rationale =
          "Aumentar: mejora el score conjunto EaR/VaR, ESF+/ESF- y Sharpe.";
      }

      return {
        asset,
        currentWeightPct: currentWeights[i] * 100,
        recommendedWeightPct: bestWeights[i] * 100,
        changePct: change * 100,
        MeanReturnAnnualPct: annualReturn * 100,
        VolatilityAnnualPct: annualVolatility * 100,
        Sharpe,
        Sortino,
        MaxDrawdownPct: maxDrawdown(assetReturns) * 100,
        InformationRatio,
        Treynor,
        VaRContributionPct: null,
        rationale
      };
    });

    return res.status(200).json({
      profile,
      objective:
        "Maximize 45% EaR/VaR + 35% ESF+/ESF- + 20% portfolio Sharpe",
      currentPortfolio: {
        RatioEaRVaR: currentPortfolio.RatioEaRVaR,
        RatioESF: currentPortfolio.RatioESF,
        Sharpe: currentPortfolio.Sharpe,
        VaR: currentPortfolio.VaR,
        EaR: currentPortfolio.EaR,
        ESFMinus: currentPortfolio.ESFMinus,
        ESFPlus: currentPortfolio.ESFPlus,
        MaxDrawdownPct: currentPortfolio.MaxDrawdown * 100,
        Score: currentPortfolio.score
      },
      optimizedPortfolio: {
        RatioEaRVaR: bestEvaluation.RatioEaRVaR,
        RatioESF: bestEvaluation.RatioESF,
        Sharpe: bestEvaluation.Sharpe,
        VaR: bestEvaluation.VaR,
        EaR: bestEvaluation.EaR,
        ESFMinus: bestEvaluation.ESFMinus,
        ESFPlus: bestEvaluation.ESFPlus,
        MaxDrawdownPct: bestEvaluation.MaxDrawdown * 100,
        Score: bestEvaluation.score
      },
      recommendations
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Error calculando optimización."
    });
  }
}
