import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface ItalianNumberInputProps {
  value: number | string | undefined | null;
  onChange: (raw: string, num: number) => void;
  placeholder?: string;
  unit?: string;
  className?: string;
  label?: string;
  allowNegative?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * Converte una stringa formattata all'italiana (con virgola decimale ed eventuali punti per migliaia)
 * in un numero JavaScript puro.
 */
export function parseItalianNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).trim();
  if (!s) return 0;
  // Rimuove i punti delle migliaia e converte la virgola in punto
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

/**
 * Rileva se nella stringa è presente un punto '.' usato erroneamente come separatore decimale
 * anziché come separatore delle migliaia all'italiana (es. "0.2" o "12.5" sono errati).
 */
export function hasDotDecimalError(str: string): boolean {
  if (!str || !str.includes('.')) return false;
  // Se ha un punto seguito da decimali (es. "0.2", "1.5", ".2")
  // oppure se ha un punto che non rispetta le 3 cifre delle migliaia (es. "10.50")
  const parts = str.split(',');
  const integerPart = parts[0];
  if (integerPart.includes('.')) {
    // Se c'è un punto nell'intero, verifichiamo se rispetta la regola delle migliaia:
    // cifre a blocchi di 3 (es. 1.000, 10.000, 1.000.000)
    const dotTokens = integerPart.split('.');
    for (let i = 1; i < dotTokens.length; i++) {
      if (dotTokens[i].length !== 3) {
        return true; // Errore: il punto è usato come decimale o con formattazione errata
      }
    }
  }
  return false;
}

/**
 * Input numerico controllato in convenzione italiana:
 * - Virgola (,) per i decimali.
 * - Punto (.) riservato alle migliaia.
 * - Se viene inserito un punto come separatore decimale, segnala errore visivo esplicito.
 * - Risolve il bug dello zero iniziale: permette di digitare '0', '0,', '0,2' senza cancellazioni o blocchi.
 */
export const ItalianNumberInput: React.FC<ItalianNumberInputProps> = ({
  value,
  onChange,
  placeholder = '',
  unit,
  className = '',
  label,
  disabled = false,
  id,
}) => {
  const displayValue = value === undefined || value === null ? '' : String(value);
  const isError = hasDotDecimalError(displayValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = parseItalianNumber(raw);
    onChange(raw, num);
  };

  const baseInputCls = "w-full bg-white border rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none transition-all";
  const borderCls = isError
    ? "border-red-500 ring-2 ring-red-200 text-red-700 bg-red-50/20"
    : "border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-400/20";

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={`${baseInputCls} ${borderCls} ${unit ? 'pr-12' : ''} ${className}`}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none select-none">
            {unit}
          </span>
        )}
      </div>
      {isError && (
        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-600 animate-fadeIn">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>Usa la virgola (,) per i decimali. Il punto (.) è per le migliaia.</span>
        </div>
      )}
    </div>
  );
};

export default ItalianNumberInput;
