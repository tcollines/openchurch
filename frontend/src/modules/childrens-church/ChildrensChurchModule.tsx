import React, { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  AlertTriangle,
  Baby,
  CalendarDays,
  Check,
  Heart,
  Home,
  MessageCircle,
  NotebookPen,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  Chips,
  Columns,
  ContactButtons,
  DarkCard,
  DarkRow,
  DarkStats,
  EmptyState,
  KpiGrid,
  ListCard,
  MiniBar,
  PageHeader,
  PickerRow,
  Row,
  SearchField,
  SectionTitle,
  Segment,
  Stats,
  Tile,
  num,
  firstName,
} from '@/components/ui/kit';
import { Highlight, SearchTakeover } from '@/components/ui/SearchTakeover';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import {
  AttendanceAndMemberService,
  TelePastoringService,
} from '@/services/churchService';
import {
  AbsenteeStatus,
  DepartmentCode,
  SoulSourceType,
  UserRole,
} from '@/shared/enums';
import { formatDate, getWhatsAppLink } from '@/shared/formatters';
import {
  DateInput,
  KpiCard,
  MobileSheet,
  NumberInput,
  PhoneInput,
  SelectInput,
  StatusBadge,
  TextAreaInput,
  TextInput,
} from '@/components/ui/FormControls';
import { HodMoreTab } from '@/components/hod-more/HodMoreTab';

const KidsCheckInView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, activeTenantId } = useAuth();

  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const children = AttendanceAndMemberService.getChildren(activeTenantId);

  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || '');
  const [search, setSearch] = useState('');
  const [addChildOpen, setAddChildOpen] = useState(false);

  // Add Child Form
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState(7);
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  const activeServiceId = selectedServiceId || services[0]?.id || '';
  const activeService = services.find((s) => s.id === activeServiceId) ?? null;
  const kidsAtt = AttendanceAndMemberService.getChildAttendance(
    activeTenantId,
    activeServiceId
  );

  const checkedInCount = kidsAtt.length;
  const checkedOutCount = kidsAtt.filter((c) => Boolean(c.checkedOutAt)).length;
  const soulsTodayCount = kidsAtt.filter((c) => c.soulWon).length;
  const allCheckedOutSafely = checkedInCount > 0 && checkedInCount === checkedOutCount;

  const q = search.trim().toLowerCase();
  const filteredKids = children.filter(
    (c) =>
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.guardianName.toLowerCase().includes(q) ||
      c.guardianPhone.toLowerCase().includes(q)
  );

  const handleRegisterChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim() || !guardianName.trim() || !user) return;
    const child = AttendanceAndMemberService.registerChild({
      tenantId: activeTenantId,
      fullName: childName,
      age: childAge,
      guardianName,
      guardianPhone,
    });
    if (activeServiceId) {
      AttendanceAndMemberService.checkInChild({
        tenantId: activeTenantId,
        serviceId: activeServiceId,
        childId: child.id,
        checkedInBy: user.id,
      });
    }
    setChildName('');
    setGuardianName('');
    setGuardianPhone('');
    setAddChildOpen(false);
  };

  const inClass = checkedInCount - checkedOutCount;
  const [kidFilter, setKidFilter] = useState<'all' | 'pending' | 'in' | 'home'>('all');
  const stateOf = (cid: string) => {
    const att = kidsAtt.find((x) => x.childId === cid);
    return !att ? 'pending' : att.checkedOutAt ? 'home' : 'in';
  };
  const shownKids = filteredKids.filter((c) => kidFilter === 'all' || stateOf(c.id) === kidFilter);
  const childRow = (child: (typeof shownKids)[number], highlight = '') => {
      const att = kidsAtt.find((x) => x.childId === child.id);
      return (
        <div key={child.id} className="flex flex-wrap items-center gap-3 py-3">
          <Avatar name={child.fullName} />
          <span className="flex-1 min-w-[150px] flex flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-[15px] font-semibold truncate"><Highlight text={child.fullName} query={highlight} /></span>
              {att?.soulWon && <Badge kind="lime">Saved</Badge>}
            </span>
            <span className="oc-sub truncate">
              {child.age} yrs · {child.guardianName}
            </span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            {!att ? (
              <button
                type="button"
                disabled={!activeServiceId}
                onClick={() =>
                  user &&
                  activeServiceId &&
                  AttendanceAndMemberService.checkInChild({
                    tenantId: activeTenantId,
                    serviceId: activeServiceId,
                    childId: child.id,
                    checkedInBy: user.id,
                  })
                }
                className="oc-btn-dark !h-10 !px-4 !text-sm"
              >
                Check in
              </button>
            ) : att.checkedOutAt ? (
              <span className="h-10 px-3.5 rounded-2xl bg-church-posSoft text-[#0E5A37] text-sm font-bold flex items-center gap-1.5">
                <Home className="w-4 h-4" /> Gone home
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    activeService &&
                    !att.soulWon &&
                    AttendanceAndMemberService.markChildSoulWon({
                      tenantId: activeTenantId,
                      serviceId: activeService.id,
                      child,
                      serviceTitle: activeService.title,
                    })
                  }
                  aria-label={att.soulWon ? `${child.fullName} gave their life to Christ` : `Mark ${child.fullName} as saved`}
                  aria-pressed={att.soulWon}
                  className={`oc-press w-10 h-10 rounded-full flex items-center justify-center ${
                    att.soulWon ? 'bg-church-lime text-church-forest' : 'bg-church-canvas text-church-muted'
                  }`}
                >
                  <Heart className="w-[18px] h-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={() => AttendanceAndMemberService.checkOutChild(activeServiceId, child.id)}
                  className="oc-btn !h-10 !px-4 !text-sm bg-church-warnSoft text-[#7A4300]"
                >
                  Check out to {firstName(child.guardianName)}
                </button>
              </>
            )}
          </span>
        </div>
      );
  };

  return (
    <>
      <PageHeader
        title="Kids check-in"
        subtitle="Every child checked in must go home with their guardian."
        actions={
          <button type="button" onClick={() => setAddChildOpen(true)} className="oc-btn-dark">
            <Plus className="w-[18px] h-[18px] text-church-lime" /> Register a child
          </button>
        }
      />
      <Columns
        main={
          <>
            {checkedInCount > 0 &&
              (allCheckedOutSafely ? (
                <section className="flex items-center gap-3.5 p-4 rounded-[22px] bg-church-posSoft text-[#0E5A37]">
                  <span className="w-12 h-12 rounded-[14px] bg-white flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </span>
                  <span className="font-display text-[17px] font-bold">Every child is safely home with a guardian.</span>
                </section>
              ) : (
                <section className="flex items-center gap-3.5 p-4 rounded-[22px] bg-church-forest text-[#EEF5E9]">
                  <span className="w-12 h-12 rounded-[14px] bg-church-warnSoft text-[#7A4300] flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-6 h-6" />
                  </span>
                  <span className="flex-1 flex flex-col gap-0.5">
                    <span className="font-display text-xl font-bold">{inClass} still in class</span>
                    <span className="text-sm text-church-mist">Check each child out to their guardian.</span>
                  </span>
                </section>
              ))}
            <Card>
              <Stats
                items={[
                  { label: 'Checked in', value: checkedInCount },
                  { label: 'In class', value: inClass, color: '#A15C00' },
                  { label: 'Gone home', value: checkedOutCount, color: '#116B43' },
                ]}
              />
            </Card>
            <SearchTakeover
              value={search}
              onChange={setSearch}
              placeholder="Search child or guardian"
              context={activeService ? `${activeService.title} · ${checkedInCount} checked in` : undefined}
              count={search.trim() ? filteredKids.length : undefined}
            >
              {search.trim() ? (
                filteredKids.length ? (
                  <section className="bg-white rounded-[20px] px-4">
                    <div className="divide-y divide-church-line">{filteredKids.slice(0, 60).map((c) => childRow(c, search))}</div>
                  </section>
                ) : (
                  <p className="m-0 oc-sub">No child or guardian matches “{search.trim()}”.</p>
                )
              ) : (
                <p className="m-0 oc-sub">Type a few letters to find a child or guardian.</p>
              )}
            </SearchTakeover>
            <Chips
              items={[
                { value: 'all', label: 'Everyone', count: filteredKids.length },
                { value: 'pending', label: 'Not yet', count: filteredKids.filter((c) => stateOf(c.id) === 'pending').length },
                { value: 'in', label: 'In class', count: filteredKids.filter((c) => stateOf(c.id) === 'in').length },
                { value: 'home', label: 'Gone home', count: filteredKids.filter((c) => stateOf(c.id) === 'home').length },
              ]}
              value={kidFilter}
              onChange={(v) => setKidFilter(v as 'all' | 'pending' | 'in' | 'home')}
            />
            {shownKids.length === 0 ? (
              <EmptyState icon={Search} title="No children here" />
            ) : (
              <ListCard>
                {shownKids.map((child) => childRow(child))}
              </ListCard>
            )}
          </>
        }
        sideFirst
        side={
          <>
            {services.length > 0 ? (
              <PickerRow
                icon={CalendarDays}
                label="Service · from Airport Stars"
                value={activeServiceId}
                onChange={setSelectedServiceId}
                options={services.map((sv) => ({ value: sv.id, label: `${sv.title} · ${formatDate(sv.serviceDate)}` }))}
              />
            ) : (
              <EmptyState icon={CalendarDays} title="No service yet" sub="Airport Stars creates the service — it will show up here." />
            )}
            <Card className="hidden lg:flex">
              <SectionTitle title="Safe check-out" aside="Always on" />
              {[
                'Children go home only with the registered guardian.',
                'A child can’t be checked out before being checked in.',
                'You’ll see a warning while any child is still in class.',
              ].map((t) => (
                <div key={t} className="flex gap-2.5 items-start text-sm leading-snug text-[#3E4741]">
                  <Check className="w-[18px] h-[18px] text-church-emerald shrink-0" />
                  {t}
                </div>
              ))}
            </Card>
          </>
        }
      />

      <MobileSheet
        open={addChildOpen}
        onClose={() => setAddChildOpen(false)}
        title="Register Child & Check In"
        subtitle="Links child to parent/guardian contact for safety & follow-up"
      >
        <form onSubmit={handleRegisterChild} className="space-y-4">
          <TextInput
            label="Child's Full Name"
            value={childName}
            onChange={setChildName}
            placeholder="e.g. Noah Mukasa"
            required
          />
          <NumberInput
            label="Age (Years)"
            value={childAge}
            min={1}
            onChange={setChildAge}
            required
          />
          <TextInput
            label="Parent / Guardian Name"
            value={guardianName}
            onChange={setGuardianName}
            placeholder="e.g. Grace Mukasa"
            required
          />
          <PhoneInput
            label="Parent / Guardian Phone"
            value={guardianPhone}
            onChange={setGuardianPhone}
            required
          />
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save Child & Check In
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

const KidsSoulsWonView: React.FC = () => {
  useChurchStoreRefresh();
  const { activeTenantId } = useAuth();
  const childSouls = TelePastoringService.getSoulsWon(activeTenantId, {
    onlyChildren: true,
  });
  const services = AttendanceAndMemberService.getServices(activeTenantId);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [wonDate, setWonDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const handleAddChildSoul = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !guardianPhone.trim()) return;
    TelePastoringService.addSoulWon({
      tenantId: activeTenantId,
      fullName: name,
      phoneNumber: guardianPhone,
      guardianName,
      guardianPhone,
      isChild: true,
      sourceType: SoulSourceType.CHILDRENS_CHURCH,
      sourceLabel: services[0]?.title || "Children's Church",
      serviceId: services[0]?.id || null,
      wonDate,
      notes,
    });
    setName('');
    setGuardianName('');
    setGuardianPhone('');
    setNotes('');
    setAddOpen(false);
  };

  const integrated = childSouls.filter((x) => String(x.status) === 'INTEGRATED').length;
  return (
    <>
      <PageHeader
        title="Souls won"
        subtitle="Children who gave their lives to Christ, with guardians to follow up."
        actions={
          <button type="button" onClick={() => setAddOpen(true)} className="oc-btn-dark">
            <Plus className="w-[18px] h-[18px] text-church-lime" /> Log a salvation
          </button>
        }
      />
      <Card>
        <Stats
          items={[
            { label: 'Children saved', value: childSouls.length },
            { label: 'In follow-up', value: childSouls.length - integrated, color: '#A15C00' },
            { label: 'Integrated', value: integrated, color: '#116B43' },
          ]}
        />
      </Card>
      {childSouls.length === 0 ? (
        <EmptyState icon={Sparkles} title="No salvations recorded yet" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {childSouls.map((soul) => (
            <Card key={soul.id}>
              <div className="flex items-center gap-3">
                <Avatar name={soul.fullName} />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-semibold truncate">{soul.fullName}</span>
                    <StatusBadge status={soul.status} />
                  </span>
                  <span className="oc-sub truncate">
                    Guardian {soul.guardianName || 'parent'} · {formatDate(soul.wonDate)}
                  </span>
                </span>
                <ContactButtons phone={soul.guardianPhone || soul.phoneNumber} name={soul.guardianName || soul.fullName} />
              </div>
              {soul.notes && <p className="m-0 px-3.5 py-3 rounded-[14px] bg-church-soft text-sm leading-relaxed text-[#3E4741]">{soul.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      <MobileSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Record Child Salvation"
        subtitle="Logs child decision and notifies follow-up team"
      >
        <form onSubmit={handleAddChildSoul} className="space-y-4">
          <TextInput label="Child Name" value={name} onChange={setName} required />
          <TextInput
            label="Parent / Guardian Name"
            value={guardianName}
            onChange={setGuardianName}
            required
          />
          <PhoneInput
            label="Guardian Phone"
            value={guardianPhone}
            onChange={setGuardianPhone}
            required
          />
          <DateInput label="Date" value={wonDate} onChange={setWonDate} required />
          <TextAreaInput
            label="Testimony / Notes"
            value={notes}
            onChange={setNotes}
            placeholder="Class teacher notes or prayer request..."
          />
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save Child Soul
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

const KidsThreeMissFollowUpView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, activeTenantId } = useAuth();
  const absentees = TelePastoringService.getThreeServiceAbsentees(
    activeTenantId,
    'CHILD'
  );

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [status, setStatus] = useState<AbsenteeStatus>(AbsenteeStatus.CONTACTED);
  const [comment, setComment] = useState('');

  const selectedChild = absentees.find((a) => a.personId === selectedChildId) ?? null;

  const handleSaveComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild || !comment.trim() || !user) return;
    TelePastoringService.saveAbsenteeFollowup({
      tenantId: activeTenantId,
      personType: 'CHILD',
      personId: selectedChild.personId,
      status,
      comment,
      followedBy: user.id,
    });
    setSelectedChildId(null);
    setComment('');
  };

  return (
    <>
      <PageHeader title="Follow-up" subtitle="Children who missed the last 3 services. Check in with their guardians." />
      {absentees.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Everyone’s coming" sub="No child has missed 3 services in a row." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {absentees.map((item) => (
            <Card key={item.personId}>
              <div className="flex items-center gap-3">
                <Avatar name={item.fullName} />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-semibold truncate">{item.fullName}</span>
                    {item.followup ? <StatusBadge status={item.followup.status} /> : <Badge kind="warn">Missed 3</Badge>}
                  </span>
                  <span className="oc-sub truncate">
                    {item.secondaryLabel} · last seen {item.lastAttendedDate ? formatDate(item.lastAttendedDate) : 'never'}
                  </span>
                </span>
                <ContactButtons phone={item.phoneNumber} name={item.fullName} />
              </div>
              {item.followup?.comment && (
                <p className="m-0 px-3.5 py-3 rounded-[14px] bg-church-soft text-sm leading-relaxed text-[#3E4741]">{item.followup.comment}</p>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedChildId(item.personId);
                  setStatus(item.followup?.status || AbsenteeStatus.CONTACTED);
                  setComment(item.followup?.comment || '');
                }}
                className={item.followup ? 'oc-btn-ghost w-full !h-12' : 'oc-btn-dark w-full !h-12'}
              >
                <NotebookPen className={`w-[18px] h-[18px] ${item.followup ? '' : 'text-church-lime'}`} />
                {item.followup ? 'Edit guardian note' : 'Log guardian note'}
              </button>
            </Card>
          ))}
        </div>
      )}

      <MobileSheet
        open={Boolean(selectedChild)}
        onClose={() => setSelectedChildId(null)}
        title={`Follow Up: ${selectedChild?.fullName ?? ''}`}
        subtitle={selectedChild?.secondaryLabel}
      >
        <form onSubmit={handleSaveComment} className="space-y-4">
          <SelectInput
            label="Follow-Up Status"
            value={status}
            onChange={(v) => setStatus(v as AbsenteeStatus)}
            options={[
              { value: AbsenteeStatus.CONTACTED, label: 'Contacted Guardian' },
              { value: AbsenteeStatus.RESOLVED, label: 'Resolved / Returning' },
              { value: AbsenteeStatus.PENDING, label: 'No Answer — Retry' },
            ]}
          />
          <TextAreaInput
            label="Guardian Feedback / Comment"
            value={comment}
            onChange={setComment}
            placeholder="e.g. Spoke with mum — child was away for school holidays, returning Sunday."
            required
          />
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save Follow-Up Comment
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

export const ChildrensChurchModule: React.FC = () => {
  const { user } = useAuth();
  const canSeeMore =
    user?.role === UserRole.CHILDREN_HOD ||
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.PLATFORM_ADMIN;

  return (
    <Routes>
      <Route path="checkin" element={<KidsCheckInView />} />
      <Route path="souls" element={<KidsSoulsWonView />} />
      <Route path="followup" element={<KidsThreeMissFollowUpView />} />
      <Route
        path="more"
        element={
          canSeeMore ? (
            <HodMoreTab departmentCode={DepartmentCode.CHILDRENS_CHURCH} />
          ) : (
            <Navigate to="/children/checkin" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="checkin" replace />} />
    </Routes>
  );
};

