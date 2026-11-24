import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Heart, RotateCcw, Sparkles, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AttendanceAndMemberService, readStore, TelePastoringService } from '@/services/churchService';
import { SoulSourceType, SoulStatus } from '@/shared/enums';
import { SoulWon } from '@/shared/types';
import { formatDate } from '@/shared/formatters';
import { Avatar, Badge, Card, DarkCard, EmptyState, SearchField, Stats } from '@/components/ui/kit';
import { MobileSheet, PhoneInput, TextInput } from '@/components/ui/FormControls';

const sameNumber = (a: string, b: string) => a.replace(/\D/g, '').slice(-9) === b.replace(/\D/g, '').slice(-9);

/** Step 1 of Souls: mark who gave their life to Christ at the current service. */
export const SoulWonTab: React.FC = () => {
  const { activeTenantId } = useAuth();
  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const today = new Date().toISOString().slice(0, 10);
  const current = [...services].filter((s) => s.serviceDate <= today).sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))[0] ?? services[0];
  const [serviceId, setServiceId] = useState('');
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const svc = services.find((s) => s.id === serviceId) ?? current;

  if (!svc) {
    return <EmptyState icon={Heart} title="No services yet" sub="Souls are marked at a service. Create one from Check-in first." />;
  }

  const souls = TelePastoringService.getSoulsWon(activeTenantId);
  const wonHere = souls.filter((s) => s.serviceId === svc.id);
  const members = AttendanceAndMemberService.getMembers(activeTenantId);
  const attendance = AttendanceAndMemberService.getServiceAttendance(activeTenantId, svc.id);
  const present = new Set(attendance.map((a) => a.memberId));
  const term = q.trim().toLowerCase();
  const people = members
    .filter((m) => (term ? m.fullName.toLowerCase().includes(term) || m.phoneNumber.includes(term) : present.has(m.id)))
    .sort((a, b) => Number(present.has(b.id)) - Number(present.has(a.id)) || a.fullName.localeCompare(b.fullName))
    .slice(0, 80);
  const soulFor = (name: string, phone: string): SoulWon | undefined =>
    wonHere.find((s) => s.fullName.toLowerCase() === name.toLowerCase() && (!s.phoneNumber || !phone || sameNumber(s.phoneNumber, phone)));

  const mark = (fullName: string, phoneNumber: string) =>
    TelePastoringService.addSoulWon({
      tenantId: activeTenantId,
      fullName,
      phoneNumber,
      isChild: false,
      sourceType: SoulSourceType.SERVICE,
      sourceLabel: svc.title,
      serviceId: svc.id,
      wonDate: svc.serviceDate,
    });
  const weeksFor = (id: string) => readStore().soulFollowupWeeks.some((w) => w.soulId === id);

  return (
    <>
      <DarkCard
        live
        eyebrow={`Current service · ${formatDate(svc.serviceDate)}`}
        action={
          services.length > 1 ? (
            <button type="button" onClick={() => setPicking(true)} className="text-[13px] font-semibold text-church-gold flex items-center gap-0.5">
              Change <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : undefined
        }
        title={svc.title}
      >
        <span className="flex items-center gap-2.5">
          <Heart className="w-5 h-5 text-church-lime" />
          <span className="font-display text-xl font-bold text-white">
            {wonHere.length === 1 ? '1 soul won' : `${wonHere.length} souls won`} at this service
          </span>
        </span>
      </DarkCard>
      <SearchField value={q} onChange={setQ} placeholder="Search the person’s name" />
      <div className="flex justify-between items-baseline">
        <span className="oc-h2">{term ? 'Matching members' : 'At this service'}</span>
        <span className="oc-sub">{term ? `${people.length} found` : `${present.size} checked in`}</span>
      </div>
      {people.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={term ? `No one called “${q.trim()}”` : 'No one checked in yet'}
          sub={term ? 'Add them as a new soul below.' : 'Search for the person’s name, or add a new soul.'}
        />
      ) : (
        <section className="bg-white rounded-[20px] px-4 py-1">
          <div className="divide-y divide-church-line">
            {people.map((m) => {
              const soul = soulFor(m.fullName, m.phoneNumber);
              return (
                <div key={m.id} className={`flex items-center gap-3 min-h-[66px] py-2.5 px-3 -mx-3 rounded-2xl ${soul ? 'bg-[#F1F9E6]' : ''}`}>
                  <Avatar name={m.fullName} />
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold truncate">{m.fullName}</span>
                    <span className="oc-sub truncate">
                      {m.isFirstTimer ? 'First timer' : 'Member'} · {m.residence}
                      {!present.has(m.id) ? ' · not checked in' : ''}
                    </span>
                  </span>
                  {soul ? (
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="h-10 px-3 rounded-xl bg-church-lime text-church-forest text-sm font-bold flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Won
                      </span>
                      {soul.status === SoulStatus.NEW && !weeksFor(soul.id) && (
                        <button
                          type="button"
                          onClick={() => TelePastoringService.removeSoul(soul.id)}
                          aria-label={`Undo soul won for ${m.fullName}`}
                          className="oc-press w-10 h-10 rounded-xl bg-white text-church-muted flex items-center justify-center"
                        >
                          <RotateCcw className="w-[18px] h-[18px]" />
                        </button>
                      )}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => mark(m.fullName, m.phoneNumber)}
                      className="oc-press shrink-0 h-10 px-3.5 rounded-xl border-[1.5px] border-church-forest bg-white text-church-forest text-sm font-bold flex items-center gap-1.5"
                    >
                      <Heart className="w-4 h-4" /> Soul won
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-white">
        <Sparkles className="w-5 h-5 text-[#2F6B0A] shrink-0 mt-px" />
        <span className="text-sm leading-[1.45] text-[#3E4741]">
          Everyone marked here moves to <b>In progress</b> for 4 weeks of follow-up, then <b>Integrated</b>.
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          setNewName(q.trim());
          setNewPhone('');
          setAdding(true);
        }}
        className="oc-press h-[52px] rounded-2xl border-[1.5px] border-dashed border-[#C9CEC6] flex items-center justify-center gap-2 font-semibold text-[15px]"
      >
        <UserPlus className="w-[18px] h-[18px]" /> Not at this service? Add a new soul
      </button>

      <MobileSheet open={picking} onClose={() => setPicking(false)} title="Pick a service" subtitle="Souls are recorded against the service they were won at.">
        <div className="flex flex-col divide-y divide-church-line">
          {[...services].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate)).slice(0, 20).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setServiceId(s.id);
                setPicking(false);
              }}
              className="oc-press flex items-center gap-3 py-3 text-left"
            >
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-[15px] font-semibold truncate">{s.title}</span>
                <span className="oc-sub">{formatDate(s.serviceDate)}</span>
              </span>
              {s.id === svc.id && <Badge kind="lime">Current</Badge>}
            </button>
          ))}
        </div>
      </MobileSheet>

      <MobileSheet open={adding} onClose={() => setAdding(false)} title="Add a new soul" subtitle={`Won at ${svc.title}`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            mark(newName.trim(), newPhone);
            setAdding(false);
            setQ('');
          }}
          className="flex flex-col gap-4"
        >
          <TextInput label="Full name" value={newName} onChange={setNewName} placeholder="e.g. Ronald Mugerwa" required />
          <PhoneInput label="Phone" value={newPhone} onChange={setNewPhone} placeholder="+256 7…" />
          <button type="submit" className="oc-btn-primary w-full">
            <Heart className="w-5 h-5" /> Mark as soul won
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

/* ── Church Administrator: souls won so far ─────────────────────────── */

const SOURCE_GROUPS: { label: string; match: (t: SoulSourceType) => boolean }[] = [
  { label: 'Services', match: (t) => t === SoulSourceType.SERVICE },
  { label: 'Bacentas', match: (t) => String(t).startsWith('BACENTA') },
  { label: 'Campuses', match: (t) => String(t).startsWith('CAMPUS') },
  { label: 'Children’s Church', match: (t) => t === SoulSourceType.CHILDRENS_CHURCH },
];

export const SoulsSummaryCard: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const navigate = useNavigate();
  const souls = TelePastoringService.getSoulsWon(tenantId);
  const now = new Date();
  const year = String(now.getFullYear());
  const month = now.toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);
  const thisYear = souls.filter((s) => (s.wonDate || s.createdAt).startsWith(year));
  const groups = SOURCE_GROUPS.map((g) => ({ ...g, n: thisYear.filter((s) => g.match(s.sourceType)).length }));
  const max = Math.max(1, ...groups.map((g) => g.n));
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <span className="oc-h2">Souls won</span>
        <button type="button" onClick={() => navigate('/admin/inspect/tele-pastoring')} className="text-sm font-semibold text-[#2F6B0A] flex items-center gap-0.5">
          Tele Pastoring <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-baseline gap-2 -mt-1">
        <span className="oc-num text-[24px]">{thisYear.length}</span>
        <span className="oc-sub !text-sm">so far this year</span>
        <span className="ml-auto text-[13px] font-semibold text-church-pos">
          {souls.filter((s) => (s.wonDate || s.createdAt).startsWith(month)).length} this month
        </span>
      </div>
      <Stats
        items={[
          { label: 'In follow-up', value: souls.filter((s) => s.status !== SoulStatus.INTEGRATED).length, color: '#A15C00' },
          { label: 'Integrated', value: souls.filter((s) => s.status === SoulStatus.INTEGRATED).length, color: '#116B43' },
          { label: 'Won today', value: souls.filter((s) => s.wonDate === today).length },
        ]}
      />
      <div className="flex flex-col gap-3 pt-3 border-t border-church-line">
        {groups.map((g, i) => (
          <div key={g.label} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">{g.label}</span>
              <span className="font-display font-bold tabular-nums">{g.n}</span>
            </div>
            <div className="h-1.5 rounded bg-church-line">
              <div className={`h-1.5 rounded ${i === 0 ? 'bg-church-lime' : 'bg-church-forest'}`} style={{ width: `${Math.round((g.n / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
