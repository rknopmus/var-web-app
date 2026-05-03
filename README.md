# VaR Web App

Aplicación Next.js para calcular VaR por simulación histórica subiendo un Excel.

## Excel esperado

Hoja `Precios`:

| Fecha | IBE | TEF | ... |
|---|---:|---:|---:|
| 2024-01-01 | 10.5 | 3.8 | ... |

Hoja `Posiciones`:

| Activo | Posicion |
|---|---:|
| IBE | 1000 |
| TEF | 500 |

Los nombres de `Activo` deben coincidir exactamente con las columnas de `Precios`.

## Variable de entorno en Vercel

`ACCESS_CODES_JSON={"CLIENTE2026":"2026-12-31"}`

## Desarrollo local

```bash
npm install
npm run dev
```
