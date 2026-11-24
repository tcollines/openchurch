import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  HeartHandshake,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PastorVerificationInfo, PlatformService } from '@/services/churchService';
import { DepartmentCode } from '@/shared/enums';
import { Avatar, Badge, Card, DarkCard, Tile, TileTone, initials } from '@/components/ui/kit';

/* Country → currency + time zone defaults */
export const COUNTRIES: { name: string; currency: string; currencyName: string; tz: string }[] = [
  { name: 'Uganda', currency: 'UGX', currencyName: 'Uganda shilling', tz: 'East Africa (UTC+3)' },
  { name: 'Kenya', currency: 'KES', currencyName: 'Kenya shilling', tz: 'East Africa (UTC+3)' },
  { name: 'Tanzania', currency: 'TZS', currencyName: 'Tanzania shilling', tz: 'East Africa (UTC+3)' },
  { name: 'Rwanda', currency: 'RWF', currencyName: 'Rwanda franc', tz: 'Central Africa (UTC+2)' },
  { name: 'South Sudan', currency: 'SSP', currencyName: 'South Sudanese pound', tz: 'Central Africa (UTC+2)' },
  { name: 'DR Congo', currency: 'CDF', currencyName: 'Congolese franc', tz: 'Central Africa (UTC+2)' },
  { name: 'Nigeria', currency: 'NGN', currencyName: 'Naira', tz: 'West Africa (UTC+1)' },
  { name: 'Ghana', currency: 'GHS', currencyName: 'Ghana cedi', tz: 'Greenwich (UTC+0)' },
  { name: 'South Africa', currency: 'ZAR', currencyName: 'Rand', tz: 'South Africa (UTC+2)' },
  { name: 'United Kingdom', currency: 'GBP', currencyName: 'Pound sterling', tz: 'London (UTC+0)' },
  { name: 'United States', currency: 'USD', currencyName: 'US dollar', tz: 'Eastern (UTC−5)' },
];
export const TIMEZONES = Array.from(new Set(COUNTRIES.map((c) => c.tz)));

const HOD_DEPTS: { code: DepartmentCode; label: string }[] = [
  { code: DepartmentCode.FINANCE, label: 'Finance' },
  { code: DepartmentCode.BACENTA, label: 'Bacentas' },
  { code: DepartmentCode.AIRPORT_STARS, label: 'Airport Stars' },
  { code: DepartmentCode.TELE_PASTORING, label: 'Tele Pastoring' },
  { code: DepartmentCode.CHILDRENS_CHURCH, label: 'Children’s Church' },
  { code: DepartmentCode.CAMPUSES, label: 'Campuses' },
  { code: DepartmentCode.DISCIPLESHIP, label: 'Discipleship' },
];

type Person = { name: string; phone: string; email: string };
const emptyPerson: Person = { name: '', phone: '', email: '' };
export const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

const resizeChurchLogo = (file: File): Promise<string> =>
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

/* ── small form pieces ── */
export const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
  type?: string;
  error?: string;
}> = ({ label, value, onChange, placeholder, icon: Icon, type = 'text', error }) => (
  <label className="flex flex-col gap-1.5 min-w-0">
    <span className="oc-label">{label}</span>
    <span
      className={`flex items-center gap-2.5 h-[52px] px-3.5 rounded-[14px] border-[1.5px] bg-church-field text-church-muted transition focus-within:bg-white focus-within:border-church-lime focus-within:ring-4 focus-within:ring-[#EEF8DC] ${
        error ? 'border-church-neg' : 'border-church-border'
      }`}
    >
      {Icon && <Icon className="w-5 h-5 shrink-0" strokeWidth={1.8} />}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        className="flex-1 min-w-0 bg-transparent outline-none text-base font-medium text-church-text placeholder:text-church-faint"
      />
    </span>
    {error && <span className="text-[13px] font-medium text-church-neg">{error}</span>}
  </label>
);

export const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({
  label,
  value,
  onChange,
  options,
}) => (
  <label className="flex flex-col gap-1.5 min-w-0">
    <span className="oc-label">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="oc-field">
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

export const Section: React.FC<{ icon: React.ElementType; tone: TileTone; title: string; sub: string; children: React.ReactNode }> = ({
  icon,
  tone,
  title,
  sub,
  children,
}) => (
  <Card className="!gap-4">
    <div className="flex items-center gap-3">
      <Tile icon={icon} tone={tone} size={36} />
      <span className="flex flex-col">
        <span className="oc-h2">{title}</span>
        <span className="oc-sub">{sub}</span>
      </span>
    </div>
    {children}
  </Card>
);

const STEPS = ['Church', 'Leaders', 'Review'];

export const NewChurchPage: React.FC = () => {
  const navigate = useNavigate();
  const { switchSupervisedTenant } = useAuth();

  const [step, setStep] = useState(0);
  const [tried, setTried] = useState<Record<number, boolean>>({});

  // Church
  const [logo, setLogo] = useState<string>('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [launchDate, setLaunchDate] = useState('');
  const [country, setCountry] = useState('Uganda');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [timezone, setTimezone] = useState('East Africa (UTC+3)');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Leaders
  const [pastor, setPastor] = useState<Person>(emptyPerson);
  const [admin, setAdmin] = useState<Person>(emptyPerson);
  const [pastorIsAdmin, setPastorIsAdmin] = useState(false);
  const [heads, setHeads] = useState<(Person & { code: DepartmentCode })[]>([]);

  const [created, setCreated] = useState<{
    tenantId: string;
    slug: string;
    name: string;
    invited: number;
    verification: PastorVerificationInfo;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const takenEmails = new Set(PlatformService.getAllUsers().map((u) => u.email.toLowerCase()));
  const realAdmin = pastorIsAdmin ? pastor : admin;

  const churchErrors = {
    name: !name.trim() ? 'Enter the church name.' : '',
    city: !city.trim() ? 'Enter the city or town.' : '',
    email: email && !emailOk(email) ? 'That email doesn’t look right.' : '',
  };
  const personErrors = (p: Person) => ({
    name: !p.name.trim() ? 'Enter their full name.' : '',
    email: !emailOk(p.email)
      ? 'Enter the Google email they’ll sign in with.'
      : takenEmails.has(p.email.trim().toLowerCase())
        ? 'This email already has a login.'
        : '',
  });
  const pastorErr = personErrors(pastor);
  const adminErr = pastorIsAdmin ? { name: '', email: '' } : personErrors(admin);
  const sameEmail =
    !pastorIsAdmin && pastor.email.trim() && pastor.email.trim().toLowerCase() === admin.email.trim().toLowerCase();
  const churchOk = !churchErrors.name && !churchErrors.city && !churchErrors.email;
  const leadersOk = !pastorErr.name && !pastorErr.email && !adminErr.name && !adminErr.email && !sameEmail;
  const show = (i: number) => (tried[i] ? true : false);

  const pickCountry = (n: string) => {
    setCountry(n);
    const c = COUNTRIES.find((x) => x.name === n);
    if (c) {
      setCurrency(c.currency);
      setTimezone(c.tz);
    }
  };

  const goNext = () => {
    setTried((t) => ({ ...t, [step]: true }));
    if (step === 0 && !churchOk) return;
    if (step === 1 && !leadersOk) return;
    setStep((s) => Math.min(2, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const create = async () => {
    setTried({ 0: true, 1: true });
    if (!churchOk) {
      setStep(0);
      return;
    }
    if (!leadersOk) {
      setStep(1);
      return;
    }
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const res = await PlatformService.provisionTenantRemote({
        name,
        slug: shortName || name,
        currency,
        city,
        country,
        adminName: realAdmin.name,
        adminEmail: realAdmin.email,
        adminPhone: realAdmin.phone,
        logoUrl: logo || undefined,
        shortName,
        address,
        phone,
        email,
        timezone,
        launchDate,
        leadPastor: pastorIsAdmin ? null : pastor,
        departmentHeads: heads.filter((h) => h.name.trim() && emailOk(h.email)),
      });
      setCreated({
        tenantId: res.tenant.id,
        slug: res.tenant.slug,
        name: shortName || name,
        invited: res.users.length,
        verification: res.verification,
      });
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'The church couldn’t be created. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvite = async () => {
    if (!created) return;
    setIsResending(true);
    try {
      const verification = await PlatformService.resendPastorInvite(
        created.tenantId,
        created.verification.recipientEmail
      );
      setCreated({ ...created, verification });
    } catch (e) {
      setCreated({
        ...created,
        verification: {
          ...created.verification,
          sent: false,
          status: 'FAILED',
          message: e instanceof Error ? e.message : 'Could not resend verification email.',
        },
      });
    } finally {
      setIsResending(false);
    }
  };

  /* ── Done ── */
  if (created) {
    const v = created.verification;
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center gap-5 max-w-md mx-auto w-full py-8">
        <span className="w-[84px] h-[84px] rounded-full bg-church-lime text-church-forest flex items-center justify-center">
          <Check className="w-10 h-10" strokeWidth={2.2} />
        </span>
        <h1 className="oc-h1">{created.name} is live</h1>
        <p className="m-0 text-base leading-relaxed text-church-muted">
          {created.invited} leader{created.invited === 1 ? '' : 's'} registered with 7-day free trial access across all seven departments.
        </p>

        <div
          className={`self-stretch flex flex-col gap-2.5 px-4 py-3.5 rounded-[18px] text-left ${
            v.sent ? 'bg-church-limeSoft text-[#1F4A08]' : 'bg-church-warnSoft text-[#7A4300]'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <Mail className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="m-0 text-sm font-bold">
                {v.sent ? 'Pastor verification link sent' : 'Verification email pending'}
              </p>
              <p className="m-0 text-[13px] leading-snug mt-0.5 opacity-90">{v.message}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-0.5">
            <button
              type="button"
              disabled={isResending}
              onClick={handleResendInvite}
              className="inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              {isResending ? 'Sending…' : `Resend link to ${v.recipientEmail}`}
            </button>
            <button
              type="button"
              onClick={() => {
                const link =
                  v.welcomeUrl ||
                  `${window.location.origin}/get-started/${encodeURIComponent(created.slug)}`;
                void navigator.clipboard?.writeText(link);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2500);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-2"
            >
              {copiedLink ? 'Copied pastor login link!' : 'Copy pastor login link'}
            </button>
          </div>
        </div>

        <Card className="self-stretch items-center text-center !gap-2.5 !py-5">
          <Tile icon={Building2} tone="neutral" size={48} />
          <span className="font-display text-[17px] font-semibold">{name}</span>
          <span className="oc-sub -mt-1">
            {city}, {country} · {currency} · 7 departments
          </span>
        </Card>
        <div className="self-stretch flex flex-col gap-2.5">
          <button
            type="button"
            className="oc-btn-primary w-full !h-14"
            onClick={() => {
              switchSupervisedTenant(created.tenantId);
              navigate('/admin/overview');
            }}
          >
            <ArrowRight className="w-5 h-5" /> Inspect {created.name}
          </button>
          <button type="button" className="oc-btn-ghost w-full !h-14" onClick={() => navigate('/platform/tenants')}>
            Back to churches
          </button>
        </div>
      </div>
    );
  }

  /* ── Step 1: church ── */
  const churchStep = (
    <>
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
                  setLogo(await resizeChurchLogo(f));
                } catch {
                  const r = new FileReader();
                  r.onload = () => setLogo(String(r.result));
                  r.readAsDataURL(f);
                }
              }}
            />
          </label>
        </div>
        <Field label="Church name" value={name} onChange={setName} placeholder="1000 Micro Church — Gulu City" error={show(0) ? churchErrors.name : ''} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Short name" value={shortName} onChange={setShortName} placeholder="Gulu City" />
          <Field label="Launch date" type="date" value={launchDate} onChange={setLaunchDate} />
        </div>
      </Section>

      <Section icon={MapPin} tone="blue" title="Location & money" sub="Sets the currency and time used for services and finance">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Country" value={country} onChange={pickCountry} options={COUNTRIES.map((c) => ({ value: c.name, label: c.name }))} />
          <Field label="City / town" value={city} onChange={setCity} placeholder="Gulu" error={show(0) ? churchErrors.city : ''} />
        </div>
        <Field label="Physical address" value={address} onChange={setAddress} placeholder="e.g. Plot 14, Awich Road, Laroo" icon={MapPin} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={COUNTRIES.map((c) => ({ value: c.currency, label: `${c.currency} — ${c.currencyName}` }))}
          />
          <Select label="Time zone" value={timezone} onChange={setTimezone} options={TIMEZONES.map((t) => ({ value: t, label: t }))} />
        </div>
      </Section>

      <Section icon={Phone} tone="amber" title="Church contact" sub="Shown to members and on receipts">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Phone" type="tel" value={phone} onChange={setPhone} placeholder="+256 772 900 400" icon={Phone} />
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="gulu@openchurch.org" icon={Mail} error={show(0) ? churchErrors.email : ''} />
        </div>
      </Section>

      <div className="flex items-center gap-3 px-4 py-3.5 rounded-[18px] bg-church-limeSoft">
        <CheckCircle2 className="w-[22px] h-[22px] text-church-emerald shrink-0" />
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">All 7 departments are set up</span>
          <span className="oc-sub !text-[#3E5B2A]">
            Administration, Finance, Bacentas, Airport Stars, Tele Pastoring, Children’s Church, Campuses
          </span>
        </span>
      </div>
    </>
  );

  /* ── Step 2: leaders ── */
  const personCard = (
    title: string,
    sub: string,
    icon: React.ElementType,
    tone: TileTone,
    p: Person,
    set: (p: Person) => void,
    err: { name: string; email: string },
    gets: string,
    extraEmailErr?: string
  ) => (
    <Section icon={icon} tone={tone} title={title} sub={sub}>
      <Field label="Full name" value={p.name} onChange={(v) => set({ ...p, name: v })} error={show(1) ? err.name : ''} />
      <Field label="Phone" type="tel" value={p.phone} onChange={(v) => set({ ...p, phone: v })} placeholder="+256 7…" icon={Phone} />
      <Field
        label="Google email"
        type="email"
        value={p.email}
        onChange={(v) => set({ ...p, email: v })}
        placeholder="name@gmail.com"
        icon={Mail}
        error={show(1) ? err.email || extraEmailErr || '' : ''}
      />
      <div className="flex gap-2 items-start px-3 py-2.5 rounded-xl bg-church-soft text-[13px] leading-snug text-[#3E4741]">
        <KeyRound className="w-4 h-4 shrink-0 mt-px text-church-emerald" />
        {gets}
      </div>
    </Section>
  );

  const leadersStep = (
    <>
      {personCard(
        'Lead pastor',
        'Oversees the church; sees every department',
        HeartHandshake,
        'violet',
        pastor,
        setPastor,
        pastorErr,
        'Signs in with this Google account and gets full church oversight.'
      )}
      <label className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white text-[15px] font-semibold cursor-pointer">
        <input
          type="checkbox"
          checked={pastorIsAdmin}
          onChange={(e) => setPastorIsAdmin(e.target.checked)}
          className="w-5 h-5 accent-[#A3E635]"
        />
        The lead pastor is also the administrator
      </label>
      {!pastorIsAdmin &&
        personCard(
          'Church administrator',
          'Runs day-to-day: members, services, approvals',
          ShieldCheck,
          'lime',
          admin,
          setAdmin,
          adminErr,
          'Gets the Administration dashboard and assigns every other role.',
          sameEmail ? 'Use a different email from the lead pastor, or tick the box above.' : ''
        )}
      <Card>
        <div className="flex items-baseline justify-between">
          <span className="oc-h2">Department heads</span>
          <span className="oc-sub">Optional</span>
        </div>
        <span className="oc-sub -mt-1.5">Add now or let the administrator assign them later.</span>
        {heads.map((h, i) => (
          <div key={i} className="flex flex-col gap-3 p-3 rounded-2xl bg-church-soft">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  label="Department"
                  value={h.code}
                  onChange={(v) => setHeads(heads.map((x, j) => (j === i ? { ...x, code: v as DepartmentCode } : x)))}
                  options={HOD_DEPTS.map((d) => ({ value: d.code, label: `Head of ${d.label}` }))}
                />
              </div>
              <button
                type="button"
                aria-label="Remove department head"
                onClick={() => setHeads(heads.filter((_, j) => j !== i))}
                className="w-11 h-[52px] rounded-[14px] flex items-center justify-center text-church-muted hover:bg-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Field label="Full name" value={h.name} onChange={(v) => setHeads(heads.map((x, j) => (j === i ? { ...x, name: v } : x)))} />
            <Field
              label="Google email"
              type="email"
              icon={Mail}
              value={h.email}
              onChange={(v) => setHeads(heads.map((x, j) => (j === i ? { ...x, email: v } : x)))}
              placeholder="name@gmail.com"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setHeads([...heads, { ...emptyPerson, code: HOD_DEPTS[heads.length % HOD_DEPTS.length].code }])}
          className="oc-press h-12 rounded-[14px] border-[1.5px] border-dashed border-church-border text-[15px] font-semibold flex items-center justify-center gap-2"
        >
          <UserPlus className="w-[18px] h-[18px]" /> Add a department head
        </button>
      </Card>
    </>
  );

  /* ── Step 3: review ── */
  const kv = (k: string, v: string) => (
    <div key={k} className="flex justify-between gap-3 py-2.5 border-t border-church-line text-sm">
      <span className="text-church-muted">{k}</span>
      <span className="font-semibold text-right">{v || '—'}</span>
    </div>
  );
  const leaderRows = [
    ...(pastorIsAdmin
      ? [{ n: pastor.name, s: `Lead pastor & administrator · ${pastor.email}`, b: <Badge kind="lime">Admin</Badge> }]
      : [
          { n: pastor.name, s: `Lead pastor · ${pastor.email}`, b: <Badge kind="ink">Oversight</Badge> },
          { n: admin.name, s: `Administrator · ${admin.email}`, b: <Badge kind="lime">Admin</Badge> },
        ]),
    ...heads
      .filter((h) => h.name.trim())
      .map((h) => ({ n: h.name, s: `Head of ${HOD_DEPTS.find((d) => d.code === h.code)?.label}`, b: <Badge>HOD</Badge> })),
  ].filter((r) => r.n.trim());

  const reviewChurch = (
    <Card>
      <div className="flex items-center gap-3">
        {logo ? (
          <img src={logo} alt="" className="w-[52px] h-[52px] rounded-full object-cover" />
        ) : (
          <span className="w-[52px] h-[52px] rounded-full bg-church-forest text-church-lime flex items-center justify-center font-display text-[17px] font-bold">
            {initials(shortName || name || 'New church') || 'NC'}
          </span>
        )}
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="font-display text-lg font-semibold truncate">{name || 'New church'}</span>
          <span className="oc-sub">
            {[city, country].filter(Boolean).join(', ')} · {currency} · {timezone.replace(/^.*\((.*)\)$/, '$1')}
          </span>
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="oc-h2">Church</span>
        <button type="button" onClick={() => setStep(0)} className="lg:hidden text-sm font-semibold text-church-emerald">
          Edit
        </button>
      </div>
      <div>
        {kv('Address', address)}
        {kv('Contact', phone)}
        {kv('Email', email)}
        {kv('Departments', 'All 7')}
      </div>
    </Card>
  );
  const reviewLeaders = (
    <section className="bg-white rounded-card px-4">
      <div className="pt-3.5 pb-1 flex items-baseline justify-between">
        <h2 className="oc-h2">Leaders</h2>
        <button type="button" onClick={() => setStep(1)} className="lg:hidden text-sm font-semibold text-church-emerald">
          Edit
        </button>
      </div>
      {leaderRows.length === 0 ? (
        <p className="oc-sub py-3 m-0">No leaders added yet.</p>
      ) : (
        <div className="divide-y divide-church-line">
          {leaderRows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Avatar name={r.n} />
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-[15px] font-semibold truncate">{r.n}</span>
                <span className="oc-sub truncate">{r.s}</span>
              </span>
              {r.b}
            </div>
          ))}
        </div>
      )}
    </section>
  );
  const nextCard = (
    <DarkCard eyebrow="What happens next" title={<span className="text-xl">The church goes live straight away</span>}>
      {[
        { i: Mail, t: 'Pastor receives a verification email', s: 'Welcome link & 7-day trial terms sent via Supabase' },
        { i: KeyRound, t: 'Logins are tied to roles', s: 'Each leader only sees their own department' },
        { i: Building2, t: 'Shows on your dashboard', s: '7-day free trial, then UGX 50,000 / month' },
      ].map(({ i: I, t, s }) => (
        <div key={t} className="flex items-center gap-2.5 px-3 py-2.5 rounded-[14px] bg-white/[0.07]">
          <I className="w-[18px] h-[18px] text-church-gold shrink-0" />
          <span className="flex flex-col">
            <span className="text-sm font-semibold">{t}</span>
            <span className="text-xs text-church-mist">{s}</span>
          </span>
        </div>
      ))}
    </DarkCard>
  );
  const createBtn = (
    <button
      type="button"
      disabled={isSubmitting}
      onClick={create}
      className="oc-btn-primary w-full !h-14 !text-base disabled:opacity-60"
    >
      <Check className="w-5 h-5" /> {isSubmitting ? 'Creating church & sending invite…' : 'Create church'}
    </button>
  );

  const vis = (i: number) => (step === i ? '' : 'max-lg:hidden');

  return (
    <>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => (step > 0 && window.innerWidth < 1024 ? setStep(step - 1) : navigate('/platform/tenants'))}
          className="inline-flex items-center gap-2.5 text-sm text-church-muted flex-1"
        >
          <span className="oc-press w-11 h-11 rounded-[14px] bg-white flex items-center justify-center text-church-text">
            <ChevronLeft className="w-5 h-5" />
          </span>
          Churches
        </button>
        <span className="lg:hidden text-[13px] font-semibold text-church-muted">Step {step + 1} of 3</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 className="oc-h1">{['New church', 'Leaders', 'Review'][step]}<span className="max-lg:hidden">{step > 0 ? '' : ''}</span></h1>
        <p className="m-0 text-[15px] md:text-base text-church-muted">
          {step === 0 && 'Add a church to the network. It gets its own data, all seven departments, and logins for its leaders.'}
          {step === 1 && 'Who leads this church? They’ll sign in with Google.'}
          {step === 2 && 'Check everything before the church goes live.'}
        </p>
      </div>

      {/* Step bar (phones) */}
      <div className="lg:hidden flex gap-2" aria-label={`Step ${step + 1} of 3`}>
        {STEPS.map((l, i) => (
          <div key={l} className="flex-1 flex flex-col gap-1.5">
            <span className={`h-1 rounded ${i <= step ? 'bg-church-lime' : 'bg-church-border'}`} />
            <span className={`text-xs font-semibold ${i === step ? 'text-church-text' : 'text-church-muted'}`}>
              {i + 1}. {l}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-stretch lg:items-start">
        <div className="flex-[3] min-w-0 flex flex-col gap-4">
          <div className={`flex flex-col gap-4 ${vis(0)}`}>
            <h2 className="max-lg:hidden oc-h2 !text-xl">1 · Church</h2>
            {churchStep}
          </div>
          <div className={`flex flex-col gap-4 ${vis(1)}`}>
            <h2 className="max-lg:hidden oc-h2 !text-xl lg:mt-2">2 · Leaders</h2>
            {leadersStep}
          </div>
          <div className={`lg:hidden flex flex-col gap-4 ${vis(2)}`}>
            {reviewChurch}
            {reviewLeaders}
            {nextCard}
          </div>
          {submitError && (
            <p role="alert" className="m-0 px-3.5 py-3 rounded-[14px] bg-church-negSoft text-sm text-[#8F1D14]">
              {submitError}
            </p>
          )}
          {/* Phone step buttons */}
          <div className="lg:hidden">
            {step === 0 && (
              <button type="button" onClick={goNext} className="oc-btn-primary w-full !h-14 !text-base">
                Next: leaders <ArrowRight className="w-5 h-5" />
              </button>
            )}
            {step === 1 && (
              <div className="grid grid-cols-[1fr_2fr] gap-2.5">
                <button type="button" onClick={() => setStep(0)} className="oc-btn-ghost !h-14">
                  Back
                </button>
                <button type="button" onClick={goNext} className="oc-btn-primary !h-14 !text-base">
                  Next: review <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
            {step === 2 && createBtn}
          </div>
        </div>

        {/* Web: live review column */}
        <div className="hidden lg:flex flex-[2] min-w-0 flex-col gap-4 lg:sticky lg:top-6">
          <h2 className="oc-h2 !text-xl">3 · Review</h2>
          {reviewChurch}
          {reviewLeaders}
          {nextCard}
          <div className="flex gap-2.5">
            <button type="button" onClick={() => navigate('/platform/tenants')} className="oc-btn-ghost">
              Cancel
            </button>
            <div className="flex-1">{createBtn}</div>
          </div>
          {(tried[0] || tried[1]) && (!churchOk || !leadersOk) && (
            <p role="alert" className="m-0 px-3.5 py-3 rounded-[14px] bg-church-warnSoft text-sm text-[#7A4300]">
              Some details are missing — check the highlighted fields.
            </p>
          )}
        </div>
      </div>
    </>
  );
};
