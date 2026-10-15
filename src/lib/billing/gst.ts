// GSTIN format check (India): 2-digit state code, 10-char PAN,
// entity number, 'Z', checksum. Format only — the checksum digit is
// validated too so a typo is caught before it lands on an invoice.

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function isValidGstin(value: string): boolean {
  const gstin = value.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(gstin)) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = CHARSET.indexOf(gstin[i]);
    const product = code * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const check = CHARSET[(36 - (sum % 36)) % 36];
  return check === gstin[14];
}
