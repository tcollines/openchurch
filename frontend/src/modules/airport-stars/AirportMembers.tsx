import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Check, ChevronRight, Phone, MessageCircle, Trash2, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import { AttendanceAndMemberService, FellowshipService, MemberDirectoryService, readStore } from '@/services/churchService';
import { FellowshipUnitType } from '@/shared/enums';
import { Member } from '@/shared/types';
import { getWhatsAppLink } from '@/shared/formatters';
import { Avatar, Badge, Card, Chips, ContactButtons, EmptyState, PageHeader, SearchField, Stats } from '@/components/ui/kit';
import { MobileSheet, PhoneInput, SelectInput, TextInput } from '@/components/ui/FormControls';
import { BackRow } from '@/modules/platform/CouncilPages';

const DAY = 864e5;
const fmt = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtLong = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type Info = { m: Member; tag: 'new' | 'away' | null; lastSeen: string | null; history: { title: string; date: string; present: boolean }[]; attended: number };

/** Member list with attendance facts for the last 5 services. */
const getDirectory = (tenantId: string) => {
  const db = readStore();
  const members = AttendanceAndMemberService.getMembers(tenantId);
  const services = db.services
    .filter((s) => s.tenantId === tenantId && new Date(s.serviceDate).getTime() <= Date.now())
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
  const last5 = services.slice(0, 5);
  const seen = new Map<string, Set<string>>();
  const lastSeen = new Map<string, string>();
  const dateOf = new Map(services.map((s) => [s.id, s.serviceDate]));
  for (const a of db.serviceAttendance) {
    if (a.tenantId !== tenantId) continue;
    if (!seen.has(a.memberId)) seen.set(a.memberId, new Set());
    seen.get(a.memberId)!.add(a.serviceId);
    const d = dateOf.get(a.serviceId);
    if (d && (!lastSeen.get(a.memberId) || d > lastSeen.get(a.memberId)!)) lastSeen.set(a.memberId, d);
  }
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const infos: Info[] = members.map((m) => {
    const s = seen.get(m.id) ?? new Set();
    const ls = lastSeen.get(m.id) ?? null;
    const joined = new Date(m.joinedAt || m.createdAt);
    const isNew = m.isFirstTimer && joined >= monthStart;
    const away = !isNew && Date.now() - joined.getTime() > 21 * DAY && (!ls || Date.now() - new Date(ls).getTime() > 21 * DAY);
    return {
      m,
      tag: isNew ? 'new' : away ? 'away' : null,
      lastSeen: ls,
      history: last5.map((sv) => ({ title: sv.title, date: sv.serviceDate, present: s.has(sv.id) })),
      attended: last5.filter((sv) => s.has(sv.id)).length,
    };
  });
  return { infos, services: last5.length };
};

const TagBadge: React.FC<{ tag: Info['tag'] }> = ({ tag }) =>
  tag === 'new' ? <Badge kind="lime">First timer</Badge> : tag === 'away' ? <Badge kind="warn">Not seen 3 wks</Badge> : null;

const Toast: React.FC<{ text: string; dark?: boolean; onUndo?: () => void }> = ({ text, dark, onUndo }) => (
  <div role="status" className={`flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-sm font-semibold ${dark ? 'bg-[#18231C] text-white' : 'bg-church-posSoft text-[#0E5A37]'}`}>
    <span className="w-7 h-7 shrink-0 rounded-full bg-white text-[#0E5A37] flex items-center justify-center">
      <Check className="w-4 h-4" />
    </span>
    <span className="flex-1">{text}</span>
    {onUndo && (
      <button type="button" onClick={onUndo} className="font-bold underline text-church-lime">
        Undo
      </button>
    )}
  </div>
);

/* ── Add a member ───────────────────────────────────────────────────────── */

const AddMemberSheet: React.FC<{ open: boolean; onClose: () => void; onAdded: (m: Member) => void }> = ({ open, onClose, onAdded }) => {
  const { tenant } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Female');
  const [area, setArea] = useState('');
  const [bacenta, setBacenta] = useState('');
  const [first, setFirst] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bacentas = tenant ? FellowshipService.getUnits(tenant.id, FellowshipUnitType.BACENTA) : [];
  useEffect(() => {
    if (open) {
      setName('');
      setPhone('');
      setArea('');
      setBacenta('');
      setFirst(true);
      setError('');
    }
  }, [open]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !name.trim() || !phone.trim()) return;
    setBusy(true);
    setError('');
    try {
      const m = await MemberDirectoryService.addMember({ tenantId: tenant.id, fullName: name, phoneNumber: phone, gender, residence: area, bacentaId: bacenta || null, isFirstTimer: first });
      onAdded(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t add this member. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <MobileSheet open={open} onClose={onClose} title="Add a member" subtitle="Name and phone are enough to start.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextInput label="Full name" value={name} onChange={setName} placeholder="e.g. Faith Namutebi" required />
        <PhoneInput label="Phone" value={phone} onChange={setPhone} placeholder="+256 7…" required />
        <div className="grid grid-cols-2 gap-3">
          <SelectInput label="Gender" value={gender} onChange={(v) => setGender(v as 'Male' | 'Female')} options={[{ value: 'Female', label: 'Female' }, { value: 'Male', label: 'Male' }]} />
          <TextInput label="Area" value={area} onChange={setArea} placeholder="e.g. Ntinda" />
        </div>
        <SelectInput label="Bacenta (optional)" value={bacenta} onChange={setBacenta} options={[{ value: '', label: 'Unassigned' }, ...bacentas.map((b) => ({ value: b.id, label: b.name }))]} />
        <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#F1F9E6] cursor-pointer">
          <input type="checkbox" checked={first} onChange={(e) => setFirst(e.target.checked)} className="w-5 h-5 accent-church-forest" />
          <span className="flex-1 flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">First time at church</span>
            <span className="oc-sub">Tele Pastoring will follow them up</span>
          </span>
        </label>
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[#F6F7F3]">
          <Users className="w-5 h-5 text-[#2F6B0A] shrink-0" />
          <span className="text-sm leading-[1.45] text-[#3E4741]">Every department will see this member straight away.</span>
        </div>
        {error && <p role="alert" className="m-0 text-sm font-medium text-church-neg">{error}</p>}
        <button type="submit" disabled={busy} className="oc-btn-primary w-full">
          <UserPlus className="w-5 h-5" /> {busy ? 'Adding…' : 'Add member'}
        </button>
      </form>
    </MobileSheet>
  );
};

/* ── Remove a member ────────────────────────────────────────────────────── */

const REASONS = ['Moved away', 'Joined another church', 'Added twice by mistake', 'Other'];

const RemoveMemberSheet: React.FC<{ member: Member | null; onClose: () => void; onRemoved: (m: Member) => void }> = ({ member, onClose, onRemoved }) => {
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setReason(REASONS[0]);
    setError('');
  }, [member?.id]);
  if (!member) return null;
  const first = member.fullName.split(' ')[0];
  const pronoun = member.gender === 'Male' ? 'He' : 'She';
  const pos = member.gender === 'Male' ? 'His' : 'Her';
  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await MemberDirectoryService.setActive(member.id, false, reason);
      onRemoved(member);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t remove this member. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <MobileSheet open onClose={onClose} title={`Remove ${first} from members?`} subtitle="You can undo this right after.">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[#F6F7F3]">
          <Avatar name={member.fullName} size={44} />
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-semibold truncate">{member.fullName}</span>
            <span className="oc-sub truncate">
              {member.phoneNumber} · {member.residence}
            </span>
          </span>
        </div>
        <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
          <legend className="oc-label mb-2">Why are they leaving?</legend>
          {REASONS.map((r) => {
            const on = r === reason;
            return (
              <label key={r} className={`flex items-center gap-3 min-h-[50px] px-3.5 rounded-[14px] border-[1.5px] cursor-pointer text-[15px] font-semibold ${on ? 'border-church-forest bg-[#F6F7F3]' : 'border-[#E2E5DF] bg-white'}`}>
                <input type="radio" name="remove-reason" checked={on} onChange={() => setReason(r)} className="w-5 h-5 accent-church-forest" />
                {r}
              </label>
            );
          })}
        </fieldset>
        <div className="flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-church-warnSoft">
          <AlertTriangle className="w-5 h-5 text-[#A15C00] shrink-0 mt-px" />
          <span className="text-sm leading-[1.45] text-[#5A3500]">
            {pronoun}’ll come off the member list for every department. {pos} past attendance and giving stay in the records.
          </span>
        </div>
        {error && <p role="alert" className="m-0 text-sm font-medium text-church-neg">{error}</p>}
        <button type="button" onClick={remove} disabled={busy} className="oc-btn w-full bg-church-neg text-white">
          <Trash2 className="w-5 h-5" /> {busy ? 'Removing…' : 'Remove member'}
        </button>
        <button type="button" onClick={onClose} className="oc-btn-ghost w-full">
          Keep member
        </button>
      </div>
    </MobileSheet>
  );
};

/* ── Profile (shared by the phone page and the desktop side panel) ──────── */

const Profile: React.FC<{ info: Info; services: number; compact?: boolean; onRemove: () => void }> = ({ info, services, compact, onRemove }) => {
  const { m } = info;
  const pct = services ? Math.round((info.attended / services) * 100) : 0;
  const bacenta = m.bacentaId ? readStore().fellowshipUnits.find((u) => u.id === m.bacentaId)?.name : null;
  const details: [string, string][] = [
    ['Gender', m.gender],
    ['Area', m.residence],
    ['Bacenta', bacenta || 'Unassigned'],
    ['Member since', fmtLong(m.joinedAt || m.createdAt)],
  ];
  const head = (
    <>
      <div className="flex items-center gap-3.5">
        <Avatar name={m.fullName} size={56} />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="font-display text-[22px] md:text-2xl leading-[1.15] font-bold tracking-[-0.01em] truncate">{m.fullName}</span>
          <span className="oc-sub truncate">
            {m.phoneNumber} · {m.residence}
          </span>
        </div>
        {compact && <ContactButtons phone={m.phoneNumber} name={m.fullName} />}
      </div>
      {!compact && (
        <div className="flex gap-2.5">
          <a href={`tel:${m.phoneNumber}`} className="oc-press flex-1 h-[46px] rounded-[14px] bg-church-canvas text-church-text flex items-center justify-center gap-2 font-bold text-[15px]">
            <Phone className="w-[18px] h-[18px]" /> Call
          </a>
          <a href={getWhatsAppLink(m.phoneNumber, '')} target="_blank" rel="noreferrer" className="oc-press flex-1 h-[46px] rounded-[14px] bg-[#E3F1D4] text-[#2F5D10] flex items-center justify-center gap-2 font-bold text-[15px]">
            <MessageCircle className="w-[18px] h-[18px]" /> WhatsApp
          </a>
        </div>
      )}
      <div className="pt-3 border-t border-church-line">
        <Stats
          items={[
            { label: 'Attendance', value: services ? `${pct}%` : '—', color: !services ? undefined : pct >= 75 ? '#116B43' : pct >= 50 ? '#A15C00' : '#B42318' },
            { label: 'Services', value: `${info.attended} of ${services}` },
            { label: 'Last seen', value: info.lastSeen ? fmt(info.lastSeen) : '—' },
          ]}
        />
      </div>
    </>
  );
  const detailRows = (
    <div>
      {details.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-[11px] border-t border-church-line text-[15px]">
          <span className="text-church-muted">{k}</span>
          <span className="font-semibold text-right">{v}</span>
        </div>
      ))}
    </div>
  );
  const remove = (
    <button type="button" onClick={onRemove} className="oc-btn w-full bg-white text-church-neg border-[1.5px] border-[#F4C7C3]">
      <Trash2 className="w-5 h-5" /> Remove from members
    </button>
  );
  if (compact) {
    return (
      <Card>
        {head}
        {info.history.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="oc-sub">Last {info.history.length} services</span>
            <div className="flex gap-1.5">
              {[...info.history].reverse().map((h, i) => (
                <span
                  key={i}
                  title={`${h.title} · ${fmt(h.date)}`}
                  className={`flex-1 h-9 rounded-[10px] flex items-center justify-center text-xs font-semibold ${h.present ? 'bg-[#116B43] text-white' : 'bg-church-line text-church-muted'}`}
                >
                  {fmt(h.date)}
                </span>
              ))}
            </div>
          </div>
        )}
        {detailRows}
        {remove}
      </Card>
    );
  }
  return (
    <>
      <Card>{head}</Card>
      <Card>
        <span className="oc-h2">Details</span>
        <div className="-mt-3">{detailRows}</div>
      </Card>
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <span className="oc-h2">Service history</span>
          <span className="oc-sub">Last {info.history.length} services</span>
        </div>
        <div className="-mt-3">
          {info.history.length ? (
            info.history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 min-h-[52px] border-t border-church-line">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${h.present ? 'bg-[#116B43]' : 'bg-[#C9CEC6]'}`} />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[15px] font-semibold truncate">{h.title}</span>
                  <span className="oc-sub">{fmtLong(h.date)}</span>
                </span>
                <Badge kind={h.present ? 'ok' : 'bad'}>{h.present ? 'Present' : 'Absent'}</Badge>
              </div>
            ))
          ) : (
            <p className="pt-3 oc-sub border-t border-church-line">No services yet.</p>
          )}
        </div>
      </Card>
      {remove}
    </>
  );
};

/* ── Members list ───────────────────────────────────────────────────────── */

type Filter = 'all' | 'new' | 'away';
type Notice = { text: string; undoId?: string } | null;

export const AirportMembersPage: React.FC = () => {
  useChurchStoreRefresh();
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [notice, setNotice] = useState<Notice>((location.state as { notice?: Notice } | null)?.notice ?? null);
  useEffect(() => {
    if ((location.state as { notice?: Notice } | null)?.notice) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!tenant) return null;
  const { infos, services } = getDirectory(tenant.id);
  const counts = { all: infos.length, new: infos.filter((i) => i.tag === 'new').length, away: infos.filter((i) => i.tag === 'away').length };
  const term = q.trim().toLowerCase();
  const shown = infos
    .filter((i) => filter === 'all' || i.tag === filter)
    .filter((i) => !term || i.m.fullName.toLowerCase().includes(term) || i.m.phoneNumber.toLowerCase().includes(term) || i.m.residence.toLowerCase().includes(term));
  const sel = infos.find((i) => i.m.id === selected) ?? shown[0] ?? null;
  const undo = async (id: string) => {
    await MemberDirectoryService.setActive(id, true);
    setNotice(null);
  };
  const open = (i: Info) => {
    if (window.matchMedia('(min-width: 768px)').matches) setSelected(i.m.id);
    else navigate(`/airport-stars/members/${i.m.id}`);
  };

  const list = shown.length ? (
    <section className="bg-white rounded-[20px] px-4 md:px-3 py-1 md:py-2">
      <div className="divide-y divide-church-line md:divide-y-0">
        {shown.map((i) => {
          const on = sel?.m.id === i.m.id;
          return (
            <button
              key={i.m.id}
              type="button"
              onClick={() => open(i)}
              aria-current={on ? 'true' : undefined}
              className={`oc-press w-full flex items-center gap-3 min-h-[64px] py-2.5 md:px-3 md:rounded-[14px] text-left ${on ? 'md:bg-church-canvas' : ''}`}
            >
              <Avatar name={i.m.fullName} />
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold truncate">{i.m.fullName}</span>
                <span className="oc-sub truncate">
                  {i.m.phoneNumber} · {i.m.residence}
                </span>
              </span>
              <TagBadge tag={i.tag} />
              <ChevronRight className="w-[18px] h-[18px] text-church-faint shrink-0" />
            </button>
          );
        })}
      </div>
    </section>
  ) : (
    <EmptyState icon={Users} title={infos.length ? 'No one matches' : 'No members yet'} sub={infos.length ? 'Try another name, phone or area.' : 'Add the first member to get started.'} />
  );

  const addBtn = (
    <button type="button" onClick={() => setAdding(true)} aria-label="Add a member" className="oc-press w-11 h-11 md:w-auto md:h-[46px] md:px-[18px] rounded-[14px] bg-church-forest text-white flex items-center justify-center gap-2 font-bold text-[15px]">
      <UserPlus className="w-5 h-5 text-church-lime" /> <span className="hidden md:inline">Add a member</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Members" subtitle="The church’s member list. Add new people, or remove someone who has left." actions={addBtn} />
      {notice && <Toast text={notice.text} dark={!!notice.undoId} onUndo={notice.undoId ? () => undo(notice.undoId!) : undefined} />}
      <Card className="md:hidden">
        <Stats
          items={[
            { label: 'Members', value: counts.all },
            { label: 'First timers', value: counts.new, color: '#116B43' },
            { label: 'Not seen 3 wks', value: counts.away, color: '#A15C00' },
          ]}
        />
      </Card>
      <div className="hidden md:grid grid-cols-3 gap-4 max-w-[720px]">
        {[
          ['Members', counts.all, 'Across the whole church', undefined],
          ['First timers', counts.new, 'This month', '#116B43'],
          ['Not seen 3 wks', counts.away, 'Worth a call', '#A15C00'],
        ].map(([l, v, s, c]) => (
          <section key={String(l)} className="bg-white rounded-[20px] p-[18px] flex flex-col gap-2.5">
            <span className="oc-sub !text-sm font-semibold">{l}</span>
            <span className="font-display text-[30px] font-bold tracking-[-0.02em] tabular-nums" style={{ color: c as string | undefined }}>
              {v}
            </span>
            <span className="oc-sub">{s}</span>
          </section>
        ))}
      </div>
      <div className="flex gap-5 items-start">
        <div className="flex-[3] min-w-0 flex flex-col gap-4">
          <Chips<Filter>
            items={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'new', label: 'First timers', count: counts.new },
              { value: 'away', label: 'Not seen 3 wks', count: counts.away },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <SearchField value={q} onChange={setQ} placeholder="Search name, phone or area" />
          {list}
          <button type="button" onClick={() => setAdding(true)} className="md:hidden oc-press h-[52px] rounded-2xl border-[1.5px] border-dashed border-[#C9CEC6] flex items-center justify-center gap-2 font-semibold text-[15px]">
            <UserPlus className="w-[18px] h-[18px]" /> Add a member
          </button>
        </div>
        {sel && (
          <div className="hidden md:block flex-[2] min-w-0 sticky top-6">
            <Profile info={sel} services={services} compact onRemove={() => setRemoving(sel.m)} />
          </div>
        )}
      </div>
      <AddMemberSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(m) => {
          setAdding(false);
          setSelected(m.id);
          setNotice({ text: `${m.fullName} was added to members.` });
        }}
      />
      <RemoveMemberSheet
        member={removing}
        onClose={() => setRemoving(null)}
        onRemoved={(m) => {
          setRemoving(null);
          setSelected('');
          setNotice({ text: `${m.fullName} was removed from members.`, undoId: m.id });
        }}
      />
    </>
  );
};

/* ── Phone: member profile page ─────────────────────────────────────────── */

export const AirportMemberPage: React.FC = () => {
  useChurchStoreRefresh();
  const { id = '' } = useParams();
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const [removing, setRemoving] = useState(false);
  if (!tenant) return null;
  const { infos, services } = getDirectory(tenant.id);
  const info = infos.find((i) => i.m.id === id);
  const back = <BackRow label="Members" onClick={() => navigate('/airport-stars/members')} />;
  if (!info) {
    return (
      <>
        {back}
        <EmptyState icon={Users} title="This member isn’t on the list" sub="They may have been removed." />
      </>
    );
  }
  return (
    <>
      {back}
      <Profile info={info} services={services} onRemove={() => setRemoving(true)} />
      <RemoveMemberSheet
        member={removing ? info.m : null}
        onClose={() => setRemoving(false)}
        onRemoved={(m) => navigate('/airport-stars/members', { state: { notice: { text: `${m.fullName} was removed from members.`, undoId: m.id } } })}
      />
    </>
  );
};
