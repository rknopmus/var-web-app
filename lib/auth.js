export function validateAccess(code) {
  if (!process.env.ACCESS_CODES_JSON) return false;

  try {
    const codes = JSON.parse(process.env.ACCESS_CODES_JSON);
    if (!codes[code]) return false;

    const expiry = new Date(codes[code]);
    const today = new Date();

    return today <= expiry;
  } catch (error) {
    return false;
  }
}
