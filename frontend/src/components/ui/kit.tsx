import React from 'react';
import { ChevronRight, Search } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────
   Open Church UI kit — the shared design language used by every
   department screen (mobile floating tab bar + web sidebar).
   ────────────────────────────────────────────────────────────── */

const TONES: [string, string][] = [
  ['#E3F1D4', '#2F5D10'],
  ['#DDEBF7', '#1D4E7A'],
  ['#F7E7D2', '#7A4A12'],
  ['#ECE3F6', '#55307F'],
  ['#F7DEDF', '#8A2B33'],
  ['#D7EFEA', '#1B5E54'],
  ['#E4E6F7', '#33397F'],
  ['#F3F0D0', '#65580E'],
];

export const toneFor = (name: string): [string, string] => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
};

export const initials = (name: string) =>
  name
    .replace(/^(Dr\.|Pastor|Apostle|Rev\.|Sis\.|Bro\.|Elder)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 40 }) => {
  const [bg, fg] = toneFor(name);
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-full flex items-center justify-center font-display font-bold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size >= 40 ? 13 : 12 }}
    >
      {initials(name)}
    </span>
  );
};

export type TileTone = 'lime' | 'blue' | 'amber' | 'violet' | 'rose' | 'teal' | 'indigo' | 'neutral' | 'red' | 'green';
const TILE: Record<TileTone, [string, string]> = {
  lime: ['#E3F1D4', '#2F5D10'],
  blue: ['#DDEBF7', '#1D4E7A'],
  amber: ['#FCEFD9', '#7A4300'],
  violet: ['#ECE3F6', '#55307F'],
  rose: ['#F7DEDF', '#8A2B33'],
  teal: ['#D7EFEA', '#1B5E54'],
  indigo: ['#E4E6F7', '#33397F'],
  neutral: ['#F2F3EF', '#18231C'],
  red: ['#FBE1DF', '#8F1D14'],
  green: ['#DDF1E4', '#0E5A37'],
};

export const Tile: React.FC<{ icon: React.ElementType; tone?: TileTone; size?: number }> = ({
  icon: Icon,
  tone = 'neutral',
  size = 40,
}) => {
  const [bg, fg] = TILE[tone];
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-[12px] flex items-center justify-center"
      style={{ width: size, height: size, background: bg, color: fg }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} />
    </span>
  );
};

/** Page title block: big display heading, one-line subtitle, actions on the right. */
export const PageHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, eyebrow, actions }) => (
  <div className="flex items-start md:items-end md:flex-wrap justify-between gap-3">
    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
      {eyebrow && <span className="text-sm text-church-muted">{eyebrow}</span>}
      <h1 className="oc-h1">{title}</h1>
      {subtitle && <p className="text-[15px] md:text-base text-church-muted leading-snug">{subtitle}</p>}
    </div>
    {actions && <div className="oc-hdr-actions flex shrink-0 gap-2 md:gap-2.5 md:flex-wrap">{actions}</div>}
  </div>
);

export const SectionTitle: React.FC<{ title: React.ReactNode; aside?: React.ReactNode }> = ({ title, aside }) => (
  <div className="flex items-baseline justify-between gap-3">
    <h2 className="oc-h2">{title}</h2>
    {aside && <span className="oc-sub">{aside}</span>}
  </div>
);

export const Card: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'form' }> = ({
  className = '',
  as = 'section',
  ...rest
}) => {
  const Tag = as as any;
  return <Tag className={`oc-card ${className}`} {...rest} />;
};

/** White card holding a list of rows separated by hairlines. */
export const ListCard: React.FC<{ title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  aside,
  children,
}) => (
  <section className="bg-white rounded-card px-4">
    {title && (
      <div className="pt-3.5 pb-1 flex items-baseline justify-between gap-3">
        <h2 className="oc-h2">{title}</h2>
        {aside && <span className="oc-sub">{aside}</span>}
      </div>
    )}
    <div className="divide-y divide-church-line [&>*:first-child]:border-t-0">{children}</div>
  </section>
);

export const Row: React.FC<{
  lead?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  trail?: React.ReactNode;
  onClick?: () => void;
  chevron?: boolean;
}> = ({ lead, title, sub, trail, onClick, chevron }) => {
  const inner = (
    <>
      {lead}
      <span className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
        <span className="text-[15px] font-semibold text-church-text truncate">{title}</span>
        {sub && <span className="oc-sub truncate">{sub}</span>}
      </span>
      {trail}
      {chevron && <ChevronRight className="w-[18px] h-[18px] text-church-faint shrink-0" />}
    </>
  );
  const cls = 'w-full flex items-center gap-3 py-3 min-h-[64px]';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} oc-press`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
};

/** Horizontal filter chips with counts. Scrolls sideways on phones. */
export function Chips<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onChange(it.value)}
            className={`oc-press shrink-0 h-10 px-4 rounded-full flex items-center gap-2 text-sm font-semibold transition ${
              on ? 'bg-church-forest text-white' : 'bg-white text-church-text'
            }`}
          >
            {it.label}
            {it.count !== undefined && (
              <span
                className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold leading-5 text-center ${
                  on ? 'bg-church-lime text-church-forest' : 'bg-church-canvas text-church-muted'
                }`}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const SearchField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}> = ({ value, onChange, placeholder = 'Search', label }) => (
  <label className="flex items-center gap-2.5 h-[52px] px-4 rounded-2xl bg-white text-church-muted focus-within:ring-4 focus-within:ring-[#EEF8DC]">
    <Search className="w-5 h-5 shrink-0" strokeWidth={1.8} />
    <input
      type="search"
      aria-label={label ?? placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 min-w-0 bg-transparent outline-none text-base text-church-text placeholder:text-church-faint"
    />
  </label>
);

/** The dark ink summary card with a lime eyebrow. */
export const DarkCard: React.FC<{
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  live?: boolean;
  className?: string;
  onClick?: () => void;
}> = ({ eyebrow, title, children, action, live, className = '', onClick }) => (
  <section
    onClick={onClick}
    className={`bg-church-forest text-[#EEF5E9] rounded-[24px] p-5 flex flex-col gap-3 ${onClick ? 'cursor-pointer oc-press' : ''} ${className}`}
  >
    {(eyebrow || action) && (
      <div className="flex items-center gap-2">
        {live ? (
          <span className="w-2.5 h-2.5 rounded-full bg-church-lime shadow-[0_0_0_4px_rgba(163,230,53,0.25)]" />
        ) : (
          <span className="w-7 h-[3px] rounded bg-church-lime" />
        )}
        <span className="flex-1 text-[13px] font-semibold text-church-gold">{eyebrow}</span>
        {action}
      </div>
    )}
    {title && <div className="font-display text-[26px] md:text-[28px] leading-[1.15] font-bold text-white">{title}</div>}
    {children}
  </section>
);

/** Three little stat boxes inside a DarkCard. */
export const DarkStats: React.FC<{ items: { label: string; value: React.ReactNode; accent?: boolean }[] }> = ({ items }) => (
  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map((it) => (
      <div key={it.label} className="rounded-[14px] bg-white/[0.07] px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
        <span className="text-xs text-church-mist truncate">{it.label}</span>
        <span className={`oc-num text-[22px] ${it.accent ? 'text-church-lime' : 'text-white'}`}>{it.value}</span>
      </div>
    ))}
  </div>
);

export type BadgeKind = 'warn' | 'ok' | 'bad' | 'neutral' | 'lime' | 'ink';
export const Badge: React.FC<{ kind?: BadgeKind; children: React.ReactNode }> = ({ kind = 'neutral', children }) => {
  const m: Record<BadgeKind, string> = {
    warn: 'bg-church-warnSoft text-[#7A4300]',
    ok: 'bg-church-posSoft text-[#0E5A37]',
    bad: 'bg-church-negSoft text-[#8F1D14]',
    neutral: 'bg-church-canvas text-church-text',
    lime: 'bg-church-lime text-church-forest',
    ink: 'bg-church-forest text-white',
  };
  return (
    <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-bold whitespace-nowrap ${m[kind]}`}>
      {children}
    </span>
  );
};

/** Row of label/value stats (inside a white card). */
export const Stats: React.FC<{ items: { label: string; value: React.ReactNode; color?: string }[] }> = ({ items }) => (
  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map((it) => (
      <div key={it.label} className="flex flex-col gap-0.5 min-w-0">
        <span className="oc-sub truncate">{it.label}</span>
        <span className="oc-num text-[22px] truncate" style={it.color ? { color: it.color } : undefined}>
          {it.value}
        </span>
      </div>
    ))}
  </div>
);

export const MiniBar: React.FC<{ pct: number; label?: boolean }> = ({ pct, label = true }) => {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const color = p >= 75 ? '#116B43' : p >= 50 ? '#A15C00' : '#B42318';
  return (
    <span className="flex items-center gap-2 min-w-[90px]">
      <span className="flex-1 h-1.5 rounded-full bg-church-line overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${p}%`, background: color }} />
      </span>
      {label && <span className="text-xs font-bold tabular-nums w-9 text-right" style={{ color }}>{p}%</span>}
    </span>
  );
};

/** Segmented control (two to four options). */
export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" className="grid gap-1 p-1 rounded-2xl bg-church-canvas" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`h-11 rounded-[12px] text-[15px] font-semibold transition ${
              on ? 'bg-white text-church-text shadow-[0_1px_3px_rgba(15,36,24,0.12)]' : 'text-church-muted'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const EmptyState: React.FC<{ icon?: React.ElementType; title: string; sub?: string; action?: React.ReactNode }> = ({
  icon,
  title,
  sub,
  action,
}) => (
  <section className="bg-white rounded-card p-6 flex flex-col items-center text-center gap-2">
    {icon && <Tile icon={icon} tone="lime" size={48} />}
    <p className="font-display text-[17px] font-semibold mt-1">{title}</p>
    {sub && <p className="oc-sub max-w-sm">{sub}</p>}
    {action && <div className="mt-2">{action}</div>}
  </section>
);

/** Two-column layout on web, stacked on phones. */
export const Columns: React.FC<{ main: React.ReactNode; side: React.ReactNode; sideFirst?: boolean }> = ({
  main,
  side,
  sideFirst,
}) => (
  <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-stretch lg:items-start">
    <div className="flex-[3] min-w-0 flex flex-col gap-4">{main}</div>
    <div className={`flex-[2] min-w-0 flex flex-col gap-4 lg:sticky lg:top-6 ${sideFirst ? 'order-first lg:order-none' : ''}`}>{side}</div>
  </div>
);

/** Row of KPI cards on web; one compact white stats card on phones (as in the design). */
export const KpiGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="oc-kpis grid md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 md:gap-4">{children}</div>
);

export const firstName = (name: string) =>
  name.replace(/^(Dr\.|Pastor|Apostle|Rev\.|Sis\.|Bro\.|Elder|Mr\.|Mrs\.|Ms\.)\s+/i, '').split(/\s+/)[0] ?? name;

export const num = (n: number) => Math.round(n).toLocaleString('en-US');

/** Service (or any) picker styled as a tappable row with a calendar tile. */
export const PickerRow: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ icon, label, value, onChange, options }) => (
  <label className="relative flex items-center gap-3 px-4 py-3.5 rounded-[18px] bg-white cursor-pointer">
    <Tile icon={icon} tone="neutral" />
    <span className="flex-1 min-w-0 flex flex-col">
      <span className="oc-sub">{label}</span>
      <span className="text-[15px] font-semibold truncate">{options.find((o) => o.value === value)?.label ?? '—'}</span>
    </span>
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-church-muted shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="absolute inset-0 opacity-0 cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

/** Call + WhatsApp round buttons. */
export const ContactButtons: React.FC<{ phone: string; name?: string }> = ({ phone, name }) => {
  const digits = phone.replace(/[^\d+]/g, '');
  const wa = `https://wa.me/${digits.replace(/^\+/, '')}`;
  return (
    <span className="flex gap-2 shrink-0">
      <a
        href={`tel:${digits}`}
        aria-label={`Call ${name ?? phone}`}
        className="oc-press w-10 h-10 rounded-full bg-church-canvas text-church-text flex items-center justify-center"
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
        </svg>
      </a>
      <a
        href={wa}
        target="_blank"
        rel="noreferrer"
        aria-label={`WhatsApp ${name ?? phone}`}
        className="oc-press w-10 h-10 rounded-full bg-church-posSoft text-[#0E5A37] flex items-center justify-center"
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      </a>
    </span>
  );
};

/** Row of money inside a DarkCard. */
export const DarkRow: React.FC<{ icon: React.ElementType; title: string; sub?: string; value: string }> = ({
  icon: Icon,
  title,
  sub,
  value,
}) => (
  <div className="flex items-center gap-3 py-2.5 border-t border-white/10 first:border-t-0">
    <span className="w-9 h-9 rounded-[11px] bg-white/[0.08] text-church-lime flex items-center justify-center shrink-0">
      <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
    </span>
    <span className="flex-1 min-w-0 flex flex-col">
      <span className="text-[15px] font-semibold text-white">{title}</span>
      {sub && <span className="text-xs text-church-mist">{sub}</span>}
    </span>
    <span className="oc-num text-base text-white">{value}</span>
  </div>
);
