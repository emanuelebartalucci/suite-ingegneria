/**
 * Formats a number to Italian locale (e.g., 1.234,56 instead of 1234.56).
 * Uses dot (.) as thousands separator and comma (,) as decimal separator.
 * Uses manual formatting to guarantee correct output regardless of browser locale settings.
 */
export const formatNumber = (val: number | string | undefined | null, decimals: number = 2): string => {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';

  // Round to the required number of decimals
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(num * factor) / factor;

  // Split into integer and decimal parts
  const [intPart, decPart] = rounded.toFixed(decimals).split('.');

  // Add thousands separator (dot) to integer part
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Combine with comma as decimal separator
  if (decimals === 0) {
    return intFormatted;
  }
  return `${intFormatted},${decPart}`;
};
