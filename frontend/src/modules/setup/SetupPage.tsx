import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Baby,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  GraduationCap,
  Home,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  Plane,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import {
  DepartmentInviteResult,
  DepartmentService,
  HEAD_ROLE_BY_DEPT,
  PlatformService,
  SetupService,
} from '@/services/churchService';
import { DepartmentCode, UserRole } from '@/shared/enums';
import { Tenant, User } from '@/shared/types';
import { churchShortName } from '@/shared/billing';
import { Card, ListCard, Row, Tile, TileTone } from '@/components/ui/kit';
import { COUNTRIES, Field, Section, Select, TIMEZONES, emailOk } from '@/modules/platform/NewChurchPage';

/* ─────────────────────────────────────────────────────────────────────────────
 * Get started — a newly enrolled church's pastor (opened from the welcome email):
 *   1 Church info (check / edit) → 2 Department heads → 3 Start the 7-day trial → Welcome
 * ──────────────────────────────────────────────────────────────────────────── */

type Step = 'church' | 'edit' | 'heads' | 'trial' | 'done';
const STEPS = ['Church', 'Dept heads', 'Free trial'];
const STEP_INDEX: Record<Step, number> = { church: 0, edit: 0, heads: 1, trial: 2, done: 3 };

const DEPTS: { code: DepartmentCode; label: string; icon: React.ElementType; tone: TileTone }[] = [
  { code: DepartmentCode.ADMIN, label: 'Administration', icon: ShieldCheck, tone: 'lime' },
  { code: DepartmentCode.FINANCE, label: 'Finance', icon: Wallet, tone: 'amber' },
  { code: DepartmentCode.AIRPORT_STARS, label: 'Airport Stars', icon: Plane, tone: 'blue' },
  { code: DepartmentCode.BACENTA, label: 'Bacentas', icon: Home, tone: 'violet' },
  { code: DepartmentCode.TELE_PASTORING, label: 'Tele Pastoring', icon: PhoneCall, tone: 'rose' },
  { code: DepartmentCode.CHILDRENS_CHURCH, label: 'Children’s Church', icon: Baby, tone: 'amber' },
  { code: DepartmentCode.CAMPUSES, label: 'Campuses', icon: GraduationCap, tone: 'teal' },
];

const TITLES = ['pastor', 'ps', 'ps.', 'rev', 'rev.', 'reverend', 'apostle', 'bishop', 'prophet', 'evangelist', 'dr', 'dr.'];
const HONORIFICS = [...TITLES, 'brother', 'bro', 'bro.', 'sister', 'sis', 'sis.', 'elder', 'deacon', 'deaconess', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.'];
/** "Pastor Samuel Okot" → "Pastor Samuel"; "Samuel Okot" → "Samuel" */
const greetName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return TITLES.includes((parts[0] || '').toLowerCase()) ? parts.slice(0, 2).join(' ') : parts[0] || 'there';
};

const DAY = 24 * 60 * 60 * 1000;
const fmtDay = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', opts);
const fmtLaunch = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : fmtDay(d, { day: 'numeric', month: 'short', year: 'numeric' });
};
const hasLogo = (t: Tenant) => !!t.logoUrl && t.logoUrl !== '/logo.jpg';

/** Shrinks an uploaded logo to a 256 px square JPEG so it saves quickly. */
const resizeLogo = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('Could not read the image'));
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Could not read the image'));
    img.src = url;
  });

/* ── shared bits ─────────────────────────────────────────────────────────── */

const Stepper: React.FC<{ n: number }> = ({ n }) => (
  <div aria-label={`Step ${n + 1} of 3`} className="flex gap-2 lg:hidden">
    {STEPS.map((l, i) => (
      <div key={l} className="flex-1 flex flex-col gap-1.5">
        <span className={`h-1 rounded-sm ${i <= n ? 'bg-church-lime' : 'bg-[#E2E5DF]'}`} />
        <span className={`text-xs font-semibold ${i === n ? 'text-church-text' : 'text-church-muted'}`}>
          {i + 1}. {l}
        </span>
      </div>
    ))}
  </div>
);

const PageTitle: React.FC<{ title: string; sub: string }> = ({ title, sub }) => (
  <div className="flex flex-col gap-1 lg:gap-1.5">
    <h1 className="font-display text-[28px] lg:text-[34px] leading-[1.1] font-bold tracking-[-0.02em] lg:tracking-[-0.025em]">
      {title}
    </h1>
    <p className="text-[15px] lg:text-base leading-normal text-church-muted">{sub}</p>
  </div>
);

const DarkPanel: React.FC<{ eyebrow: string; children: React.ReactNode }> = ({ eyebrow, children }) => (
  <section className="bg-church-forest text-[#EEF5E9] rounded-[24px] p-5 flex flex-col gap-3">
    <span className="flex items-center gap-2">
      <span className="w-7 h-[3px] rounded-sm bg-church-lime" />
      <span className="text-[13px] font-semibold text-[#C9F08A]">{eyebrow}</span>
    </span>
    {children}
  </section>
);

const PrimaryBtn: React.FC<{
  onClick?: () => void;
  icon?: React.ElementType;
  children: React.ReactNode;
  disabled?: boolean;
  busy?: boolean;
}> = ({ onClick, icon: Icon, children, disabled, busy }) => (
  <button type="button" onClick={onClick} disabled={disabled || busy} className="oc-btn-primary w-full disabled:opacity-50">
    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : Icon ? <Icon className="w-5 h-5" strokeWidth={2} /> : null}
    {children}
  </button>
);

/* ── page ────────────────────────────────────────────────────────────────── */

export const SetupPage: React.FC = () => {
  useChurchStoreRefresh();
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('church');
  const [headsAdded, setHeadsAdded] = useState<string[]>([]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== UserRole.ADMIN || !tenant) return <Navigate to="/" replace />;

  const short = churchShortName(tenant.name, tenant.shortName);
  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0 });
  };
  const exit = () => navigate('/admin/overview', { replace: true });
  const n = STEP_INDEX[step];
  const back: Record<Step, Step | null> = { church: null, edit: 'church', heads: 'church', trial: 'heads', done: null };

  const content =
    step === 'church' ? (
      <ChurchStep tenant={tenant} user={user} onEdit={() => go('edit')} onNext={() => go('heads')} />
    ) : step === 'edit' ? (
      <EditStep tenant={tenant} onSaved={() => go('heads')} />
    ) : step === 'heads' ? (
      <HeadsStep tenant={tenant} user={user} onAdded={(names) => setHeadsAdded((p) => [...p, ...names])} onNext={() => go('trial')} />
    ) : step === 'trial' ? (
      <TrialStep tenant={tenant} onStarted={() => go('done')} />
    ) : (
      <DoneStep tenant={tenant} user={user} headsAdded={headsAdded} onOpen={exit} navigate={navigate} />
    );

  if (step === 'done') {
    return (
      <div className="min-h-[100dvh] bg-church-canvas text-church-text px-5 lg:px-10 pt-[max(24px,env(safe-area-inset-top))] lg:pt-14 pb-[max(28px,env(safe-area-inset-bottom))] lg:pb-14">
        <div className="w-full max-w-[520px] lg:max-w-[900px] mx-auto flex flex-col gap-4 lg:gap-6">{content}</div>
      </div>
    );
  }

  const prev = back[step];
  return (
    <div className="min-h-[100dvh] bg-church-canvas text-church-text lg:flex">
      {/* Desktop: dark steps rail */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen w-[300px] shrink-0 bg-church-forest text-[#EEF5E9] px-[22px] py-7 flex-col gap-7">
        <div className="flex items-center gap-2.5">
          <img src={hasLogo(tenant) ? tenant.logoUrl : '/logo.jpg'} alt="" className="w-[38px] h-[38px] rounded-full object-cover" />
          <span className="flex flex-col min-w-0">
            <span className="font-display text-base font-bold text-white">Open Church</span>
            <span className="text-xs text-church-mist truncate">Setting up {short}</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-[0.06em] uppercase text-[#6F8274] px-3 pb-1.5">3 quick steps</span>
          {STEPS.map((l, i) => (
            <div key={l} className={`flex items-center gap-3 px-3 py-2.5 rounded-[14px] ${i === n ? 'bg-white/[0.08]' : ''}`}>
              <span
                className={`w-[30px] h-[30px] shrink-0 rounded-full flex items-center justify-center font-display text-[13px] font-bold ${
                  i <= n ? 'bg-church-lime text-church-forest' : 'border-[1.5px] border-[#3D5446] text-church-mist'
                }`}
              >
                {i < n ? <Check className="w-[15px] h-[15px]" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-[15px] font-semibold ${i <= n ? 'text-white' : 'text-church-mist'}`}>{l}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto p-3.5 rounded-2xl bg-white/[0.06] text-[13px] leading-normal text-church-mist">
          Signed in as <b className="text-white break-all">{user.email}</b>
          <br />
          Lead pastor
          <button type="button" onClick={exit} className="block mt-2 font-semibold text-white/80 hover:text-white">
            Save &amp; exit
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-5 lg:px-14 pt-[max(16px,env(safe-area-inset-top))] lg:pt-10 pb-[max(28px,env(safe-area-inset-bottom))] lg:pb-14">
        <div className="w-full max-w-[520px] lg:max-w-[980px] mx-auto lg:mx-0 flex flex-col gap-4 lg:gap-[22px]">
          {/* Phone: top bar */}
          <div className="lg:hidden flex items-center gap-2.5">
            {prev ? (
              <button
                type="button"
                onClick={() => go(prev)}
                aria-label="Back"
                className="w-11 h-11 shrink-0 rounded-[14px] bg-white flex items-center justify-center oc-press"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <img src={hasLogo(tenant) ? tenant.logoUrl : '/logo.jpg'} alt="" className="w-10 h-10 rounded-full object-cover" />
            )}
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-sm font-semibold truncate">Set up {short}</span>
              <span className="oc-sub">Step {n + 1} of 3</span>
            </span>
            <button type="button" onClick={exit} className="text-sm font-semibold text-church-muted">
              Save &amp; exit
            </button>
          </div>
          {/* Desktop: back link */}
          {prev && (
            <button type="button" onClick={() => go(prev)} className="hidden lg:flex items-center gap-1 self-start text-sm font-semibold text-church-muted hover:text-church-text">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step !== 'edit' && <Stepper n={n} />}
          {content}
        </div>
      </main>
    </div>
  );
};

/* ── 1. Welcome + church info ────────────────────────────────────────────── */

const ChurchInfoCard: React.FC<{ tenant: Tenant; onEdit: () => void }> = ({ tenant, onEdit }) => {
  const loc = [tenant.city, tenant.country].filter(Boolean).join(', ');
  const rows: [string, string][] = [
    ['Church name', tenant.name],
    ['Short name', tenant.shortName || ''],
    ['Location', loc],
    ['Address', tenant.address || ''],
    ['Phone', tenant.phone || ''],
    ['Email', tenant.email || ''],
    ['Currency · time', [tenant.currency, tenant.timezone].filter(Boolean).join(' · ')],
    ['Launch date', fmtLaunch(tenant.launchDate)],
  ];
  const missing = [!tenant.address && 'address', !tenant.phone && 'phone'].filter(Boolean) as string[];
  const list = missing.join(' and ');
  const note = !hasLogo(tenant)
    ? missing.length
      ? `No logo yet, and please add the ${list} — members see these on receipts.`
      : 'No logo yet — add one so members recognise your church.'
    : missing.length
      ? `Please add the ${list} — members see these on receipts.`
      : '';
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="w-14 h-14 shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-church-canvas border-[1.5px] border-dashed border-[#C9CEC6] text-church-muted">
          {hasLogo(tenant) ? <img src={tenant.logoUrl} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6" strokeWidth={1.8} />}
        </span>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="oc-h2">Your church info</span>
          <span className="oc-sub">Filled in by the Network Council</span>
        </span>
        <button type="button" onClick={onEdit} className="oc-btn !h-10 !px-3.5 !text-sm bg-church-canvas text-church-text shrink-0">
          <MessageSquare className="w-4 h-4" strokeWidth={1.8} /> Edit
        </button>
      </div>
      <div>
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex justify-between gap-3 py-[11px] ${i < rows.length - 1 ? 'border-b border-church-line' : ''}`}>
            <span className="oc-sub !text-sm shrink-0">{k}</span>
            <span className={`text-sm text-right break-words min-w-0 ${v ? 'font-semibold' : 'text-church-faint font-medium'}`}>{v || 'Not added'}</span>
          </div>
        ))}
      </div>
      {note && (
        <div className="flex gap-2.5 items-start px-3.5 py-3 rounded-[14px] bg-[#FCEFD9] text-[#7A4300] text-sm leading-snug">
          <AlertTriangle className="w-[18px] h-[18px] shrink-0 mt-px" strokeWidth={1.8} />
          {note}
        </div>
      )}
    </Card>
  );
};

const ChurchStep: React.FC<{ tenant: Tenant; user: User; onEdit: () => void; onNext: () => void }> = ({ tenant, user, onEdit, onNext }) => {
  const short = churchShortName(tenant.name, tenant.shortName);
  const hello = (
    <DarkPanel eyebrow="Welcome to Open Church">
      <span className="font-display text-[28px] leading-[1.12] font-bold text-white tracking-[-0.02em]">Hello, {greetName(user.fullName)}</span>
      <span className="text-[15px] leading-normal text-[#C4D0C6]">
        Let’s get {short} ready in 3 quick steps: check your church info, add your department heads, then start your free trial.
      </span>
    </DarkPanel>
  );
  const buttons = (
    <div className="flex flex-col gap-2.5">
      <PrimaryBtn icon={ArrowRight} onClick={onNext}>
        Looks right — continue
      </PrimaryBtn>
      <button type="button" onClick={onEdit} className="oc-btn-ghost w-full">
        <MessageSquare className="w-5 h-5" strokeWidth={1.8} /> Edit church info
      </button>
    </div>
  );
  return (
    <>
      {/* Phone */}
      <div className="lg:hidden flex flex-col gap-4">
        {hello}
        <ChurchInfoCard tenant={tenant} onEdit={onEdit} />
        {buttons}
      </div>
      {/* Desktop */}
      <div className="hidden lg:flex gap-5 items-start">
        <div className="flex-[3] min-w-0 flex flex-col gap-5">
          {hello}
          <ChurchInfoCard tenant={tenant} onEdit={onEdit} />
        </div>
        <div className="flex-[2] min-w-0 sticky top-10">
          <Card>
            <span className="oc-h2">Is this right?</span>
            <span className="oc-sub !text-sm leading-normal">
              The Network Council filled this in when they added your church. Fix anything that’s wrong — members see it on receipts.
            </span>
            {buttons}
          </Card>
        </div>
      </div>
    </>
  );
};

/* ── 1b. Edit church info ────────────────────────────────────────────────── */

const toDateInput = (v?: string | null) => {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

export const EditStep: React.FC<{ tenant: Tenant; onSaved: () => void; title?: string; sub?: string; saveLabel?: string; hideTitle?: boolean }> = ({
  tenant,
  onSaved,
  title = 'Edit church info',
  sub = 'Fix anything that’s wrong. You can change this later in Administration → More.',
  saveLabel = 'Save & continue',
  hideTitle,
}) => {
  const [logo, setLogo] = useState(hasLogo(tenant) ? tenant.logoUrl : '');
  const [name, setName] = useState(tenant.name);
  const [shortName, setShortName] = useState(tenant.shortName || '');
  const [launchDate, setLaunchDate] = useState(toDateInput(tenant.launchDate));
  const [phone, setPhone] = useState(tenant.phone || '');
  const [email, setEmail] = useState(tenant.email || '');
  const [country, setCountry] = useState(tenant.country || 'Uganda');
  const [city, setCity] = useState(tenant.city || '');
  const [address, setAddress] = useState(tenant.address || '');
  const known = COUNTRIES.find((c) => c.name === country);
  const [currency, setCurrency] = useState(tenant.currency || known?.currency || 'UGX');
  const [timezone, setTimezone] = useState(tenant.timezone || known?.tz || TIMEZONES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);

  const errors = {
    name: !name.trim() ? 'Enter the church name' : '',
    email: email.trim() && !emailOk(email) ? 'Enter a valid email' : '',
  };

  const currencyOptions = useMemo(() => {
    const opts = COUNTRIES.map((c) => ({ value: c.currency, label: `${c.currency} — ${c.currencyName}` }));
    if (!opts.some((o) => o.value === currency)) opts.unshift({ value: currency, label: currency });
    return opts;
  }, [currency]);

  const save = async () => {
    setTried(true);
    if (errors.name || errors.email) return;
    setBusy(true);
    setError('');
    try {
      await SetupService.saveChurch(tenant.id, {
        name,
        shortName,
        logoUrl: logo || undefined,
        city,
        country,
        currency,
        timezone,
        address,
        phone,
        email,
        launchDate,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!hideTitle && <PageTitle title={title} sub={sub} />}
      <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-5 lg:items-start">
        <div className="flex flex-col gap-4 lg:gap-5">
          <Section icon={Building2} tone="lime" title="Church details" sub="How the church appears across Open Church">
            <div className="flex items-center gap-3.5">
              <span className="w-16 h-16 rounded-full border-[1.5px] border-dashed border-[#C9CEC6] bg-church-field flex items-center justify-center text-church-muted overflow-hidden shrink-0">
                {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : <Plus className="w-6 h-6" />}
              </span>
              <span className="flex-1 flex flex-col">
                <span className="text-[15px] font-semibold">Church logo</span>
                <span className="oc-sub">Square image, at least 256 px. Optional.</span>
              </span>
              <label className="oc-btn !h-10 !px-3.5 !text-sm bg-church-canvas text-church-text cursor-pointer">
                {logo ? 'Change' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      setLogo(await resizeLogo(f));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Could not read the image');
                    }
                  }}
                />
              </label>
            </div>
            <Field label="Church name" value={name} onChange={setName} placeholder="1000 Micro Church — Gulu City" error={tried ? errors.name : ''} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Short name" value={shortName} onChange={setShortName} placeholder="Gulu City" />
              <Field label="Launch date" type="date" value={launchDate} onChange={setLaunchDate} />
            </div>
          </Section>
          <Section icon={Phone} tone="amber" title="Church contact" sub="Shown to members and on receipts">
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-3">
              <Field label="Phone" type="tel" icon={Phone} value={phone} onChange={setPhone} placeholder="+256 772 900 400" />
              <Field label="Email" type="email" icon={Mail} value={email} onChange={setEmail} placeholder="gulu@openchurch.org" error={tried ? errors.email : ''} />
            </div>
          </Section>
        </div>
        <Section icon={MapPin} tone="blue" title="Location & money" sub="Sets the currency and time used for services and finance">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Country"
              value={country}
              onChange={(v) => {
                setCountry(v);
                const c = COUNTRIES.find((x) => x.name === v);
                if (c) {
                  setCurrency(c.currency);
                  setTimezone(c.tz);
                }
              }}
              options={(COUNTRIES.some((c) => c.name === country) ? [] : [{ value: country, label: country }]).concat(
                COUNTRIES.map((c) => ({ value: c.name, label: c.name }))
              )}
            />
            <Field label="City / town" value={city} onChange={setCity} placeholder="Gulu" />
          </div>
          <Field label="Physical address" icon={MapPin} value={address} onChange={setAddress} placeholder="e.g. Plot 14, Awich Road, Laroo" />
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-3">
            <Select label="Currency" value={currency} onChange={setCurrency} options={currencyOptions} />
            <Select
              label="Time zone"
              value={timezone}
              onChange={setTimezone}
              options={(TIMEZONES.includes(timezone) ? [] : [timezone]).concat(TIMEZONES).map((t) => ({ value: t, label: t }))}
            />
          </div>
        </Section>
      </div>
      {error && (
        <p role="alert" className="m-0 px-3.5 py-3 rounded-[14px] bg-church-negSoft text-sm text-[#8F1D14]">
          {error}
        </p>
      )}
      <div className="lg:max-w-[360px]">
        <PrimaryBtn icon={Check} onClick={save} busy={busy}>
          {saveLabel}
        </PrimaryBtn>
      </div>
    </>
  );
};

/* ── 2. Department heads ─────────────────────────────────────────────────── */

const HeadsStep: React.FC<{ tenant: Tenant; user: User; onAdded: (names: string[]) => void; onNext: () => void }> = ({
  tenant,
  user,
  onAdded,
  onNext,
}) => {
  const users = PlatformService.getUsersForTenant(tenant.id);
  const headFor = (code: DepartmentCode): User | undefined => {
    const dept = DepartmentService.getDepartmentByCode(tenant.id, code);
    const role = HEAD_ROLE_BY_DEPT[code];
    return users.find(
      (u) =>
        u.isActive &&
        u.role === role &&
        u.id !== user.id &&
        (code === DepartmentCode.ADMIN || !dept || u.departmentId === dept.id)
    );
  };
  const firstOpen = DEPTS.find((d) => !headFor(d.code))?.code ?? null;
  const [open, setOpen] = useState<DepartmentCode | null>(firstOpen);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteStatusByEmail, setInviteStatusByEmail] = useState<Record<string, DepartmentInviteResult>>({});
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const added = DEPTS.filter((d) => headFor(d.code)).length;
  const taken = new Set(users.map((u) => u.email.toLowerCase()));
  const errs = {
    name: !form.name.trim() ? 'Enter their full name' : '',
    email: !emailOk(form.email)
      ? 'Enter their Google email'
      : taken.has(form.email.trim().toLowerCase())
        ? 'This email already has a login'
        : '',
  };

  const openFor = (code: DepartmentCode) => {
    setOpen(code);
    setForm({ name: '', phone: '', email: '' });
    setTried(false);
    setError('');
  };

  const add = async (code: DepartmentCode) => {
    setTried(true);
    if (errs.name || errs.email) return;
    setBusy(true);
    setError('');
    try {
      const res = await SetupService.addDepartmentHeads(tenant.id, [
        { code, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
      ]);
      if (res.invites.length > 0) {
        setInviteStatusByEmail((prev) => {
          const nextMap = { ...prev };
          for (const inv of res.invites) {
            nextMap[inv.recipientEmail.toLowerCase()] = inv;
          }
          return nextMap;
        });
      }
      onAdded([form.name.trim()]);
      const next = DEPTS.find((d) => d.code !== code && !headFor(d.code))?.code ?? null;
      setOpen(null);
      setForm({ name: '', phone: '', email: '' });
      setTried(false);
      if (next) setOpen(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this head. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResendInvite = async (head: User) => {
    setResendingId(head.id);
    try {
      const inv = await SetupService.resendDepartmentHeadInvite(head.id);
      setInviteStatusByEmail((prev) => ({
        ...prev,
        [head.email.toLowerCase()]: inv,
      }));
    } catch (err) {
      setInviteStatusByEmail((prev) => ({
        ...prev,
        [head.email.toLowerCase()]: {
          sent: false,
          recipientEmail: head.email,
          signInUrl: `${window.location.origin}/login?email=${encodeURIComponent(head.email)}`,
          message: err instanceof Error ? err.message : 'Could not resend invite email.',
        },
      }));
    } finally {
      setResendingId(null);
    }
  };

  const handleCopySignInLink = async (head: User) => {
    const inv = inviteStatusByEmail[head.email.toLowerCase()];
    const url = inv?.signInUrl || `${window.location.origin}/login?email=${encodeURIComponent(head.email)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(head.id);
      setTimeout(() => setCopiedId((prev) => (prev === head.id ? null : prev)), 2500);
    } catch {
      window.prompt('Copy department head sign-in link:', url);
    }
  };

  const list = (
    <Card>
      <div className="flex justify-between items-baseline">
        <span className="oc-h2">7 departments</span>
        <span className="oc-sub">{added} of 7 added</span>
      </div>
      <div role="img" aria-label={`${added} of 7 added`} className="h-2.5 rounded-[5px] bg-church-line">
        <div className="h-2.5 rounded-[5px] bg-church-lime transition-all" style={{ width: `${Math.round((added / 7) * 100)}%` }} />
      </div>
      <div className="-mt-1 divide-y divide-church-line">
        {DEPTS.map((d) => {
          const head = headFor(d.code);
          if (head) {
            const inv = inviteStatusByEmail[head.email.toLowerCase()];
            const isResending = resendingId === head.id;
            const isCopied = copiedId === head.id;
            return (
              <div key={d.code} className="py-3 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Tile icon={d.icon} tone={d.tone} />
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-[15px] font-semibold truncate">{d.label}</span>
                    <span className="oc-sub truncate">{head.fullName} · {head.email}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-church-pos shrink-0">
                    <Check className="w-4 h-4" strokeWidth={2.5} /> {inv?.sent ? 'Email sent' : 'Added'}
                  </span>
                </div>
                {inv && !inv.sent && (
                  <div className="flex gap-2 items-start px-3 py-2 rounded-xl bg-[#FCEFD9] text-[#7A4300] text-xs leading-relaxed">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{inv.message}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 pl-[52px] text-xs font-semibold">
                  <button
                    type="button"
                    disabled={isResending}
                    onClick={() => void handleResendInvite(head)}
                    className="inline-flex items-center gap-1 text-church-emerald hover:underline disabled:opacity-60"
                  >
                    {isResending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {isResending ? 'Sending email…' : 'Resend email'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopySignInLink(head)}
                    className="inline-flex items-center gap-1 text-church-muted hover:text-church-text"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {isCopied ? 'Link copied!' : 'Copy sign-in link'}
                  </button>
                </div>
              </div>
            );
          }
          if (open === d.code)
            return (
              <div key={d.code} className="py-3.5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Tile icon={d.icon} tone={d.tone} />
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-[15px] font-semibold">Head of {d.label}</span>
                    <span className="oc-sub">Gets the {d.label} dashboard</span>
                  </span>
                  <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="text-church-muted p-1">
                    <X className="w-[18px] h-[18px]" />
                  </button>
                </div>
                <Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Brother Denis Okello" error={tried ? errs.name : ''} />
                <Field label="Phone" type="tel" icon={Phone} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+256 7…" />
                <Field
                  label="Google email"
                  type="email"
                  icon={Mail}
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  placeholder="name@gmail.com"
                  error={tried ? errs.email : ''}
                />
                {error && <span className="text-[13px] font-medium text-church-neg">{error}</span>}
                <button type="button" onClick={() => add(d.code)} disabled={busy} className="oc-btn-dark w-full !h-[46px] disabled:opacity-60">
                  {busy ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <UserPlus className="w-[18px] h-[18px] text-church-lime" />}
                  Add head of {d.label}
                </button>
              </div>
            );
          return (
            <Row
              key={d.code}
              lead={<Tile icon={d.icon} tone={d.tone} />}
              title={d.label}
              sub="No head yet"
              trail={
                <button type="button" onClick={() => openFor(d.code)} className="oc-btn !h-10 !px-3.5 !text-sm bg-church-canvas text-church-text shrink-0">
                  <Plus className="w-4 h-4" /> Add
                </button>
              }
            />
          );
        })}
      </div>
    </Card>
  );
  const actions = (
    <div className="flex flex-col gap-2.5">
      <PrimaryBtn icon={ArrowRight} onClick={onNext}>
        Continue
      </PrimaryBtn>
      {added < 7 && (
        <button type="button" onClick={onNext} className="self-center text-[15px] font-semibold text-church-muted py-1.5">
          I’ll add the rest later
        </button>
      )}
    </div>
  );
  return (
    <>
      <PageTitle
        title="Your department heads"
        sub="Add each head’s name, phone and Google email. They sign in with that Google account to reach their own department."
      />
      <div className="lg:hidden flex flex-col gap-4">
        {list}
        {actions}
      </div>
      <div className="hidden lg:flex gap-5 items-start">
        <div className="flex-[3] min-w-0">{list}</div>
        <div className="flex-[2] min-w-0 sticky top-10">
          <Card>
            <span className="oc-h2">How sign-in works</span>
            <span className="oc-sub !text-sm leading-normal">
              Each head signs in with Google using the email you add here. They land straight in their own department — they can’t see other
              departments’ money or members.
            </span>
            {actions}
          </Card>
        </div>
      </div>
    </>
  );
};

/* ── 3. Start the free trial ─────────────────────────────────────────────── */

const TrialStep: React.FC<{ tenant: Tenant; onStarted: () => void }> = ({ tenant, onStarted }) => {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fee = (tenant.monthlyFee || 50000).toLocaleString('en-US');
  const today = new Date();
  const ends = new Date(today.getTime() + 7 * DAY);
  const terms = [
    `Free for 7 days — until ${fmtDay(ends, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}.`,
    'Every department and feature is open. No payment needed to start.',
    `Then UGX ${fee} a month for the whole church — not per user.`,
    'Pay with MTN MoMo, Airtel Money or bank from Administration.',
    'Miss a payment and the app pauses — your data is never deleted.',
    'Stop any time. No contract.',
  ];
  const start = async () => {
    if (!agree) {
      setError('Tick the box to agree to the free trial terms.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await SetupService.startTrial(tenant.id);
      onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the trial. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const price = (
    <DarkPanel eyebrow="Your plan">
      <span className="font-display text-[44px] leading-none font-bold text-white tracking-[-0.03em]">7 days free</span>
      <span className="text-[15px] text-[#C4D0C6]">
        then <b className="text-church-lime">UGX {fee} / month</b> · whole church · all 7 departments · unlimited users
      </span>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[14px] bg-white/[0.07] px-3 py-2.5 flex flex-col gap-0.5">
          <span className="text-xs text-church-mist">Trial starts</span>
          <span className="font-display text-[17px] font-bold text-white">Today, {fmtDay(today, { day: 'numeric', month: 'short' })}</span>
        </div>
        <div className="rounded-[14px] bg-white/[0.07] px-3 py-2.5 flex flex-col gap-0.5">
          <span className="text-xs text-church-mist">First payment</span>
          <span className="font-display text-[17px] font-bold text-white">{fmtDay(ends, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
      </div>
    </DarkPanel>
  );
  const termsCard = (
    <Card>
      <span className="oc-h2">Free trial — terms &amp; conditions</span>
      <div className="flex flex-col gap-2.5">
        {terms.map((t) => (
          <div key={t} className="flex gap-2.5 items-start text-sm leading-normal text-[#2B352E]">
            <span className="w-5 h-5 shrink-0 mt-px rounded-full bg-church-lime text-church-forest flex items-center justify-center">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            {t}
          </div>
        ))}
      </div>
    </Card>
  );
  const agreeBox = (
    <label className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-white text-sm leading-snug cursor-pointer">
      <input
        type="checkbox"
        checked={agree}
        onChange={(e) => {
          setAgree(e.target.checked);
          if (e.target.checked) setError('');
        }}
        className="sr-only peer"
      />
      <span
        aria-hidden="true"
        className={`w-6 h-6 shrink-0 rounded-[7px] flex items-center justify-center peer-focus-visible:ring-4 peer-focus-visible:ring-[#EEF8DC] ${
          agree ? 'bg-church-lime text-church-forest' : 'border-2 border-[#DADDD6]'
        }`}
      >
        {agree && <Check className="w-4 h-4" strokeWidth={3} />}
      </span>
      <span>
        I agree to the free trial terms and the{' '}
        <a href="/terms" target="_blank" rel="noreferrer" className="text-church-emerald font-bold underline" onClick={(e) => e.stopPropagation()}>
          Open Church terms
        </a>
        .
      </span>
    </label>
  );
  const err = error && (
    <p role="alert" className="m-0 px-3.5 py-3 rounded-[14px] bg-church-negSoft text-sm text-[#8F1D14]">
      {error}
    </p>
  );
  const button = (
    <PrimaryBtn icon={Sparkles} onClick={start} busy={busy}>
      Start my 7-day free trial
    </PrimaryBtn>
  );
  return (
    <>
      <PageTitle title="Start your free trial" sub="Everything is ready. Here’s how the trial works." />
      <div className="lg:hidden flex flex-col gap-4">
        {price}
        {termsCard}
        {agreeBox}
        {err}
        {button}
      </div>
      <div className="hidden lg:flex gap-5 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          {price}
          {agreeBox}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          {termsCard}
          {err}
          {button}
        </div>
      </div>
    </>
  );
};

/* ── 4. Welcome — enjoy the app ──────────────────────────────────────────── */

const DoneStep: React.FC<{
  tenant: Tenant;
  user: User;
  headsAdded: string[];
  onOpen: () => void;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ tenant, user, headsAdded, onOpen, navigate }) => {
  const short = churchShortName(tenant.name, tenant.shortName);
  const users = PlatformService.getUsersForTenant(tenant.id);
  const heads = DEPTS.filter((d) => users.some((u) => u.isActive && u.role === HEAD_ROLE_BY_DEPT[d.code] && u.id !== user.id)).length;
  const firstNames = headsAdded.map((n) => n.split(/\s+/).find((w) => !HONORIFICS.includes(w.toLowerCase())) || n);
  const nameList =
    firstNames.length === 0
      ? 'They sign in with Google'
      : firstNames.length === 1
        ? `${firstNames[0]} can sign in with Google now`
        : `${firstNames.slice(0, -1).join(', ')} and ${firstNames[firstNames.length - 1]} can sign in with Google now`;
  const ends = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : new Date(Date.now() + 7 * DAY);
  const fee = (tenant.monthlyFee || 50000).toLocaleString('en-US');

  const ready = (
    <ListCard title="What’s ready">
      <Row lead={<Tile icon={CheckCircle2} tone="lime" />} title="Church info saved" sub={tenant.name} />
      <Row
        lead={<Tile icon={Users} tone="blue" />}
        title={`${heads} department head${heads === 1 ? '' : 's'} added`}
        sub={headsAdded.length ? nameList : heads ? 'They sign in with Google' : 'Add them any time from Team'}
      />
      <Row
        lead={<Tile icon={Sparkles} tone="amber" />}
        title="Free trial running"
        sub={`Until ${fmtDay(ends, { weekday: 'short', day: 'numeric', month: 'short' })} · then UGX ${fee}/month`}
      />
    </ListCard>
  );
  const missingHeads = 7 - heads;
  const next = (
    <ListCard title="Good first steps">
      <Row lead={<Tile icon={Users} tone="neutral" />} title="Add your members" sub="Import or add them one by one" chevron onClick={() => navigate('/admin/members')} />
      <Row
        lead={<Tile icon={CalendarDays} tone="neutral" />}
        title="Create your first service"
        sub="So departments can check people in"
        chevron
        onClick={() => navigate('/admin/overview')}
      />
      {missingHeads > 0 && (
        <Row
          lead={<Tile icon={UserPlus} tone="neutral" />}
          title="Finish department heads"
          sub={`${missingHeads} department${missingHeads === 1 ? '' : 's'} still need${missingHeads === 1 ? 's' : ''} a head`}
          chevron
          onClick={() => navigate('/admin/tools?view=team')}
        />
      )}
    </ListCard>
  );
  return (
    <>
      <div className="flex flex-col items-center text-center gap-3.5 pt-2">
        <span className="relative w-24 h-24">
          <img src={hasLogo(tenant) ? tenant.logoUrl : '/logo.jpg'} alt="" className="w-24 h-24 rounded-full object-cover" />
          <span className="absolute -right-1 -bottom-1 w-[38px] h-[38px] rounded-full bg-church-lime text-church-forest border-4 border-church-canvas flex items-center justify-center">
            <Check className="w-5 h-5" strokeWidth={3} />
          </span>
        </span>
        <h1 className="font-display text-[30px] leading-[1.1] font-bold tracking-[-0.02em]">You’re all set, {greetName(user.fullName)}</h1>
        <p className="text-base leading-normal text-church-muted">Welcome to Open Church. {short} is live — enjoy shepherding with everything in one place.</p>
      </div>
      <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-5 lg:items-start">
        {ready}
        {next}
      </div>
      <div className="w-full lg:w-[360px] lg:self-center">
        <PrimaryBtn icon={ArrowRight} onClick={onOpen}>
          Open my dashboard
        </PrimaryBtn>
      </div>
    </>
  );
};
