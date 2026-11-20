import React from 'react';
import { X } from 'lucide-react';

interface BaseInputProps {
  label: string;
  name?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const TextInput: React.FC<
  BaseInputProps & {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    type?: 'text' | 'email' | 'search';
  }
> = ({ label, value, onChange, placeholder, type = 'text', error, helperText, required }) => (
  <label className="flex flex-col gap-1.5 min-w-0">
    <span className="oc-label">
      {label} {required && <span className="text-church-neg">*</span>}
    </span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={`oc-field ${error ? '!border-church-neg focus:!ring-church-negSoft' : ''}`}
    />
    {error && <p className="text-[13px] font-medium text-church-neg">{error}</p>}
    {!error && helperText && <p className="oc-sub">{helperText}</p>}
  </label>
);

export const PhoneInput: React.FC<
  BaseInputProps & {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }
> = ({ label, value, onChange, placeholder = '+256 772 000000', error, required }) => (
  <label className="flex flex-col gap-1.5 min-w-0">
    <span className="oc-label">
      {label} {required && <span className="text-church-neg">*</span>}
    </span>
    <input
      type="tel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={`oc-field tabular-nums ${error ? '!border-church-neg focus:!ring-church-negSoft' : ''}`}
    />
    {error && <p className="text-[13px] font-medium text-church-neg">{error}</p>}
  </label>
);

const formatRawWithCommas = (raw: string): { display: string; numeric: number } => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return { display: '', numeric: 0 };

  const [rawInt = '', ...decParts] = cleaned.split('.');
  const normalizedInt = rawInt.replace(/^0+(?=\d)/, '');
  const formattedInt = (normalizedInt || (decParts.length > 0 ? '0' : '')).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ','
  );

  const hasDot = decParts.length > 0;
  const dec = decParts.join('').slice(0, 2);
  const display = hasDot ? `${formattedInt}.${dec}` : formattedInt;
  const numeric = Number(hasDot ? `${normalizedInt || '0'}.${dec}` : normalizedInt || '0');

  return {
    display,
    numeric: Number.isFinite(numeric) ? numeric : 0,
  };
};

const numberToCommaString = (val: number | string, blankWhenZero = false): string => {
  if (val === '' || val === null || val === undefined) return '';
  const n = typeof val === 'number' ? val : Number(String(val).replace(/,/g, ''));
  if (!Number.isFinite(n)) return '';
  if (n === 0 && blankWhenZero) return '';
  const [intPart, decPart] = String(n).split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
};

const cursorAfterDigits = (formatted: string, digitCount: number): number => {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[0-9.]/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
};

export const NumberInput: React.FC<
  BaseInputProps & {
    value: number | string;
    onChange: (val: number) => void;
    min?: number;
    placeholder?: string;
    prefix?: string;
  }
> = ({ label, value, onChange, min = 0, placeholder = '0', prefix, error, required }) => {
  const blankZero = Boolean(prefix) || min > 0;
  const toDisplay = (v: number | string) => {
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '') || 0);
    return numberToCommaString(n, blankZero);
  };
  const [display, setDisplay] = React.useState<string>(() => toDisplay(value));
  const inputRef = React.useRef<HTMLInputElement>(null);
  const nextCursorRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const incomingNum =
      typeof value === 'number' ? value : Number(String(value).replace(/,/g, '') || 0);
    const currentNum = formatRawWithCommas(display).numeric;
    if (incomingNum !== currentNum) {
      setDisplay(numberToCommaString(incomingNum, blankZero));
    }
  }, [value, blankZero]);

  React.useLayoutEffect(() => {
    if (nextCursorRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(nextCursorRef.current, nextCursorRef.current);
      nextCursorRef.current = null;
    }
  }, [display]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sel = e.target.selectionStart ?? raw.length;
    const digitsBefore = (raw.slice(0, sel).match(/[0-9.]/g) || []).length;
    const { display: nextDisplay, numeric } = formatRawWithCommas(raw);
    nextCursorRef.current = cursorAfterDigits(nextDisplay, digitsBefore);
    setDisplay(nextDisplay);
    onChange(numeric);
  };

  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="oc-label">
        {label} {required && <span className="text-church-neg">*</span>}
      </span>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3.5 text-xs font-bold text-church-muted pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          className={`oc-field tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${prefix ? '!pl-14' : ''} ${
            error ? '!border-church-neg focus:!ring-church-negSoft' : ''
          }`}
        />
      </div>
      {error && <p className="text-[13px] font-medium text-church-neg">{error}</p>}
    </label>
  );
};

export const HeroAmountInput: React.FC<{
  label?: string;
  currency: string;
  value: number;
  onChange: (val: number) => void;
  error?: string;
  required?: boolean;
}> = ({ label = 'Amount', currency, value, onChange, error, required }) => {
  const [display, setDisplay] = React.useState<string>(() =>
    value === 0 ? '' : numberToCommaString(value, true)
  );
  const inputRef = React.useRef<HTMLInputElement>(null);
  const nextCursorRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const currentNum = formatRawWithCommas(display).numeric;
    if (value !== currentNum) {
      setDisplay(value === 0 ? '' : numberToCommaString(value, true));
    }
  }, [value]);

  React.useLayoutEffect(() => {
    if (nextCursorRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(nextCursorRef.current, nextCursorRef.current);
      nextCursorRef.current = null;
    }
  }, [display]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sel = e.target.selectionStart ?? raw.length;
    const digitsBefore = (raw.slice(0, sel).match(/[0-9.]/g) || []).length;
    const { display: nextDisplay, numeric } = formatRawWithCommas(raw);
    nextCursorRef.current = cursorAfterDigits(nextDisplay, digitsBefore);
    setDisplay(nextDisplay);
    onChange(numeric);
  };

  return (
    <label className="flex flex-col gap-1.5">
      <span className="oc-label">{label}</span>
      <span
        className={`flex items-center gap-2.5 h-16 px-4 rounded-[14px] border-[1.5px] bg-church-field transition focus-within:bg-white focus-within:border-church-lime focus-within:ring-4 focus-within:ring-[#EEF8DC] ${
          error ? 'border-church-neg' : 'border-church-border'
        }`}
      >
        <span className="text-sm font-bold text-church-muted select-none">{currency}</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          aria-label={label}
          required={required}
          value={display}
          placeholder="0"
          onChange={handleChange}
          className="flex-1 min-w-0 bg-transparent outline-none font-display text-[26px] font-bold tabular-nums text-church-text placeholder:text-church-faint [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </span>
      {error && <span className="text-[13px] font-medium text-church-neg">{error}</span>}
    </label>
  );
};

export const SelectInput: React.FC<
  BaseInputProps & {
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
  }
> = ({ label, value, onChange, options, error, required }) => (
  <label className="flex flex-col gap-1.5 min-w-0">
    <span className="oc-label">
      {label} {required && <span className="text-church-neg">*</span>}
    </span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="oc-field"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-[13px] font-medium text-church-neg">{error}</p>}
  </label>
);

export const DateInput: React.FC<
  BaseInputProps & {
    value: string;
    onChange: (val: string) => void;
  }
> = ({ label, value, onChange, error, required }) => (
  <label className="flex flex-col gap-1.5 min-w-0">
    <span className="oc-label">
      {label} {required && <span className="text-church-neg">*</span>}
    </span>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="oc-field"
    />
    {error && <p className="text-[13px] font-medium text-church-neg">{error}</p>}
  </label>
);

export const TextAreaInput: React.FC<
  BaseInputProps & {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    rows?: number;
  }
> = ({ label, value, onChange, placeholder, rows = 3, error, required }) => (
  <label className="flex flex-col gap-1.5 min-w-0">
    <span className="oc-label">
      {label} {required && <span className="text-church-neg">*</span>}
    </span>
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="oc-field !h-auto py-3 resize-none leading-relaxed"
    />
    {error && <p className="text-[13px] font-medium text-church-neg">{error}</p>}
  </label>
);

export const KpiCard: React.FC<{
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'forest' | 'emerald' | 'amber' | 'rose';
  onClick?: () => void;
}> = ({ label, value, subtitle, icon, tone = 'default', onClick }) => {
  const dark = tone === 'forest';
  const valueColor: Record<string, string> = {
    default: 'text-church-text',
    forest: 'text-white',
    emerald: 'text-church-pos',
    amber: 'text-church-warn',
    rose: 'text-church-neg',
  };
  const iconTone: Record<string, string> = {
    default: 'bg-church-canvas text-church-text',
    forest: 'bg-white/10 text-church-lime',
    emerald: 'bg-church-limeSoft text-church-emerald',
    amber: 'bg-church-warnSoft text-[#7A4300]',
    rose: 'bg-church-negSoft text-[#8F1D14]',
  };
  const Tag = onClick ? 'button' : 'section';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`oc-kpi text-left rounded-card p-4 md:p-[18px] flex flex-col gap-2 min-w-0 ${
        dark ? 'bg-church-forest' : 'bg-white'
      } ${onClick ? 'oc-press cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`oc-kpi-label text-[13px] md:text-sm font-semibold truncate ${dark ? 'text-church-gold' : 'text-church-muted'}`}>
          {label}
        </span>
        {icon && (
          <span className={`oc-kpi-icon w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 ${iconTone[tone]}`}>{icon}</span>
        )}
      </div>
      <span className={`oc-kpi-value oc-num text-[24px] md:text-[30px] leading-tight break-words ${valueColor[tone]}`}>{value}</span>
      {subtitle && (
        <span className={`oc-kpi-sub text-[13px] leading-snug ${dark ? 'text-church-mist' : 'text-church-muted'}`}>{subtitle}</span>
      )}
    </Tag>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const upper = status.toUpperCase();
  let cls = 'bg-church-canvas text-church-text';
  if (['APPROVED', 'PAID', 'ACTIVE', 'OPEN', 'INTEGRATED', 'RESOLVED', 'CHECKED_IN', 'COMPLETED'].includes(upper)) {
    cls = 'bg-church-posSoft text-[#0E5A37]';
  } else if (
    ['PENDING', 'PENDING_ADMIN', 'SUBMITTED', 'NEW', 'WEEK_1', 'WEEK_2', 'WEEK_3', 'WEEK_4', 'CONTACTED'].includes(upper)
  ) {
    cls = 'bg-church-warnSoft text-[#7A4300]';
  } else if (['REJECTED', 'SUSPENDED'].includes(upper)) {
    cls = 'bg-church-negSoft text-[#8F1D14]';
  }
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return (
    <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-bold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

/** Bottom sheet on phones, centred dialog on web. */
export const MobileSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-start sm:pt-[8vh] justify-center bg-[rgba(15,36,24,0.5)] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[600px] max-h-[92vh] sm:max-h-[84vh] overflow-y-auto bg-white rounded-t-[32px] sm:rounded-[28px] shadow-[0_30px_80px_-20px_rgba(15,36,24,0.45)] flex flex-col"
      >
        <div className="sm:hidden flex justify-center pt-2.5">
          <span className="w-10 h-[5px] rounded-full bg-church-border" />
        </div>
        <div className="sticky top-0 z-10 bg-white px-6 pt-4 sm:pt-7 pb-2 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-[22px] sm:text-2xl font-bold leading-tight tracking-[-0.01em]">{title}</h3>
            {subtitle && <p className="oc-sub text-sm mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="oc-press w-10 h-10 rounded-full bg-church-canvas text-church-text flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pt-2 pb-7 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
};
