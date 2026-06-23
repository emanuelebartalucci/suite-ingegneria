/**
 * Formats a number to Italian locale (e.g., 1.234,56 instead of 1234.56).
 * Uses dot (.) as thousands separator and comma (,) as decimal separator.
 */
export const formatNumber = (val: number | string | undefined | null, decimals: number = 2): string => {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  return num.toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};
