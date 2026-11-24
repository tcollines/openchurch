import React, { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
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
} from '@/components/ui/kit';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import {
  AttendanceAndMemberService,
  DepartmentService,
  FellowshipService,
} from '@/services/churchService';
import {
  DepartmentCode,
  FellowshipUnitType,
  ServiceCategory,
  UserRole,
} from '@/shared/enums';
import { formatDate } from '@/shared/formatters';
import {
  DateInput,
  KpiCard,
  MobileSheet,
  PhoneInput,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@/components/ui/FormControls';
import { HodMoreTab } from '@/components/hod-more/HodMoreTab';
import { AirportMemberPage, AirportMembersPage } from './AirportMembers';

const AirportServiceCheckInView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, activeTenantId } = useAuth();

  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const members = AttendanceAndMemberService.getMembers(activeTenantId);
  const bacentas = FellowshipService.getUnits(activeTenantId, FellowshipUnitType.BACENTA);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    services[0]?.id || ''
  );
  const [search, setSearch] = useState('');
  const [createServiceOpen, setCreateServiceOpen] = useState(false);
  const [registerMemberOpen, setRegisterMemberOpen] = useState(false);

  // Create Service Form
  const [srvTitle, setSrvTitle] = useState('');
  const [srvDate, setSrvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [srvCategory, setSrvCategory] = useState<ServiceCategory>(ServiceCategory.SUNDAY);

  // Register New Member Form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Female');
  const [newResidence, setNewResidence] = useState('');
  const [newBacentaId, setNewBacentaId] = useState('');
  const [newFirstTimer, setNewFirstTimer] = useState(true);

  const activeServiceId = selectedServiceId || services[0]?.id || '';
  const activeService = services.find((s) => s.id === activeServiceId) ?? null;
  const serviceAtt = AttendanceAndMemberService.getServiceAttendance(
    activeTenantId,
    activeServiceId
  );
  const checkedInSet = new Set(serviceAtt.map((a) => a.memberId));
  const firstTimersCount = serviceAtt.filter((a) => a.isFirstTimeVisit).length;

  const canUndo =
    user?.role === UserRole.AIRPORT_HOD ||
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.PLATFORM_ADMIN;

  const q = search.trim().toLowerCase();
  const filteredMembers = members.filter(
    (m) =>
      !q ||
      m.fullName.toLowerCase().includes(q) ||
      m.phoneNumber.toLowerCase().includes(q) ||
      m.residence.toLowerCase().includes(q)
  );

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvTitle.trim() || !user) return;
    const created = AttendanceAndMemberService.createService({
      tenantId: activeTenantId,
      title: srvTitle,
      serviceDate: srvDate,
      category: srvCategory,
      createdBy: user.id,
    });
    setSelectedServiceId(created.id);
    setSrvTitle('');
    setCreateServiceOpen(false);
  };

  const handleRegisterAndCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim() || !user) return;
    const member = AttendanceAndMemberService.registerMember({
      tenantId: activeTenantId,
      fullName: newName,
      phoneNumber: newPhone,
      gender: newGender,
      residence: newResidence,
      bacentaId: newBacentaId || null,
      isFirstTimer: newFirstTimer,
    });
    if (activeServiceId) {
      AttendanceAndMemberService.checkInMember({
        tenantId: activeTenantId,
        serviceId: activeServiceId,
        memberId: member.id,
        checkedInBy: user.id,
      });
    }
    setNewName('');
    setNewPhone('');
    setNewResidence('');
    setSearch('');
    setRegisterMemberOpen(false);
  };

  const isMemberOnly = user?.role === UserRole.AIRPORT_MEMBER;
  const [stage, setStage] = useState<'list' | 'checkin'>(isMemberOnly ? 'checkin' : 'list');
  const [filter, setFilter] = useState<'all' | 'pending' | 'in'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ServiceCategory>('all');

  const allAttendance = AttendanceAndMemberService.getServiceAttendance(activeTenantId);
  const countFor = (sid: string) => allAttendance.filter((a) => a.serviceId === sid).length;
  const liveService = services[0] ?? null;
  const pastServices = services.slice(1).filter((sv) => typeFilter === 'all' || sv.category === typeFilter);
  const pctOf = (n: number) => (members.length ? Math.round((n / members.length) * 100) : 0);
  const catLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase();

  const listMembers = filteredMembers.filter((m) =>
    filter === 'all' ? true : filter === 'in' ? checkedInSet.has(m.id) : !checkedInSet.has(m.id)
  );

  const openCheckIn = (sid: string) => {
    setSelectedServiceId(sid);
    setFilter('all');
    setSearch('');
    setStage('checkin');
  };

  const sheets = (
    <>
      {/* Create Service Sheet */}
      <MobileSheet
        open={createServiceOpen}
        onClose={() => setCreateServiceOpen(false)}
        title="Create Church Service"
        subtitle="Shared immediately with Children's Church, Finance & Administration"
      >
        <form onSubmit={handleCreateService} className="space-y-4">
          <TextInput
            label="Service Name"
            value={srvTitle}
            onChange={setSrvTitle}
            placeholder="e.g. Sunday Celebration Service"
            required
          />
          <div className="flex flex-col gap-1.5">
            <span className="oc-label">Type</span>
            <Segment
              options={[
                { value: ServiceCategory.SUNDAY, label: 'Sunday' },
                { value: ServiceCategory.MIDWEEK, label: 'Midweek' },
                { value: ServiceCategory.SPECIAL, label: 'Special' },
              ]}
              value={srvCategory}
              onChange={(v) => setSrvCategory(v as ServiceCategory)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <DateInput label="Service Date" value={srvDate} onChange={setSrvDate} required />
          </div>
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Create & Open Check-In
          </button>
        </form>
      </MobileSheet>

      {/* Register New Member & Check In Sheet */}
      <MobileSheet
        open={registerMemberOpen}
        onClose={() => setRegisterMemberOpen(false)}
        title="Register New Person & Check In"
        subtitle="Adds to central database and marks attendance immediately"
      >
        <form onSubmit={handleRegisterAndCheckIn} className="space-y-4">
          <TextInput
            label="Full Name"
            value={newName}
            onChange={setNewName}
            placeholder="e.g. Faith Namutebi"
            required
          />
          <PhoneInput
            label="Phone Number"
            value={newPhone}
            onChange={setNewPhone}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectInput
              label="Gender"
              value={newGender}
              onChange={(v) => setNewGender(v as 'Male' | 'Female')}
              options={[
                { value: 'Female', label: 'Female' },
                { value: 'Male', label: 'Male' },
              ]}
            />
            <TextInput
              label="Residence / Area"
              value={newResidence}
              onChange={setNewResidence}
              placeholder="e.g. Ntinda"
              required
            />
          </div>
          <SelectInput
            label="Assign to Bacenta (Optional)"
            value={newBacentaId}
            onChange={setNewBacentaId}
            options={[
              { value: '', label: 'Unassigned' },
              ...bacentas.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-church-warnSoft border border-transparent cursor-pointer">
            <input
              type="checkbox"
              checked={newFirstTimer}
              onChange={(e) => setNewFirstTimer(e.target.checked)}
              className="w-4 h-4 accent-church-emerald"
            />
            <span className="text-xs font-bold text-[#7A4300]">
              First-Time Visitor to the Church
            </span>
          </label>
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save to Database & Check In
          </button>
        </form>
      </MobileSheet>

    </>
  );

  if (stage === 'list') {
    const liveCount = liveService ? countFor(liveService.id) : 0;
    const liveFirst = liveService
      ? allAttendance.filter((a) => a.serviceId === liveService.id && a.isFirstTimeVisit).length
      : 0;
    return (
      <>
        <PageHeader
          title="Services"
          subtitle="Pick a service to check people in. New services are shared with every department."
          actions={
            <button type="button" onClick={() => setCreateServiceOpen(true)} className="oc-btn-dark">
              <Plus className="w-[18px] h-[18px] text-church-lime" /> New service
            </button>
          }
        />
        <Columns
          main={
            <>
              <Chips
                items={[
                  { value: 'all', label: 'All', count: services.length - (liveService ? 1 : 0) },
                  { value: ServiceCategory.SUNDAY, label: 'Sunday' },
                  { value: ServiceCategory.MIDWEEK, label: 'Midweek' },
                  { value: ServiceCategory.SPECIAL, label: 'Special' },
                ]}
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as 'all' | ServiceCategory)}
              />
              {pastServices.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No past services" sub="Services you create will appear here." />
              ) : (
                <ListCard title="Past services">
                  {pastServices.map((sv) => {
                    const n = countFor(sv.id);
                    return (
                      <Row
                        key={sv.id}
                        onClick={() => openCheckIn(sv.id)}
                        lead={<Tile icon={CalendarDays} />}
                        title={sv.title}
                        sub={`${formatDate(sv.serviceDate)} · ${catLabel(sv.category)}`}
                        trail={
                          <span className="flex items-center gap-4 shrink-0">
                            <span className="flex flex-col items-end">
                              <span className="oc-num text-base">{n}</span>
                              <span className="text-xs text-church-muted">checked in</span>
                            </span>
                            <span className="hidden sm:flex w-28">
                              <MiniBar pct={pctOf(n)} />
                            </span>
                          </span>
                        }
                        chevron
                      />
                    );
                  })}
                </ListCard>
              )}
              <button
                type="button"
                onClick={() => setCreateServiceOpen(true)}
                className="oc-press h-14 rounded-[18px] border-[1.5px] border-dashed border-church-border text-[15px] font-semibold text-church-text flex items-center justify-center gap-2"
              >
                <Plus className="w-[18px] h-[18px]" /> Create a new service
              </button>
            </>
          }
          sideFirst
          side={
            liveService ? (
              <DarkCard live eyebrow={`Latest · ${formatDate(liveService.serviceDate)}`} title={liveService.title}>
                <DarkStats
                  items={[
                    { label: 'Checked in', value: liveCount, accent: true },
                    { label: 'First timers', value: liveFirst },
                    { label: 'Of members', value: `${pctOf(liveCount)}%` },
                  ]}
                />
                <button type="button" onClick={() => openCheckIn(liveService.id)} className="oc-btn-primary self-start !h-12">
                  Continue check-in <ArrowRight className="w-[18px] h-[18px]" />
                </button>
              </DarkCard>
            ) : (
              <EmptyState
                icon={CalendarPlus}
                title="No services yet"
                sub="Create the first service to start checking people in."
                action={
                  <button type="button" onClick={() => setCreateServiceOpen(true)} className="oc-btn-primary">
                    New service
                  </button>
                }
              />
            )
          }
        />
        {sheets}
      </>
    );
  }

  const liveCard = (
    <DarkCard
      live
      eyebrow={activeService ? `Live check-in · ${formatDate(activeService.serviceDate)}` : 'No service'}
      action={
        !isMemberOnly && services.length > 1 ? (
          <button type="button" onClick={() => setStage('list')} className="text-[13px] font-semibold text-church-gold">
            Change service
          </button>
        ) : undefined
      }
      title={activeService ? activeService.title : 'Create a service to start'}
    >
      <DarkStats
        items={[
          { label: 'Checked in', value: serviceAtt.length, accent: true },
          { label: 'First timers', value: firstTimersCount },
          { label: 'Of members', value: `${pctOf(serviceAtt.length)}%` },
        ]}
      />
    </DarkCard>
  );

  return (
    <>
      <PageHeader
        eyebrow={
          !isMemberOnly ? (
            <button type="button" onClick={() => setStage('list')} className="inline-flex items-center gap-1 font-semibold text-church-emerald">
              <ChevronLeft className="w-4 h-4" /> Services
            </button>
          ) : undefined
        }
        title="Service check-in"
        subtitle={canUndo ? 'Search, tap, done. Undo is for the Head of Department only.' : 'Search, tap, done.'}
        actions={
          <button
            type="button"
            onClick={() => {
              if (search.trim()) setNewName(search.trim());
              setRegisterMemberOpen(true);
            }}
            className="oc-btn-dark"
          >
            <UserPlus className="w-[18px] h-[18px] text-church-lime" /> Register someone
          </button>
        }
      />
      <Columns
        main={
          <>
            <div className="lg:hidden">{liveCard}</div>
            <SearchField value={search} onChange={setSearch} placeholder="Search name, phone or area" />
            <Chips
              items={[
                { value: 'all', label: 'Everyone', count: filteredMembers.length },
                { value: 'pending', label: 'Not yet', count: filteredMembers.filter((m) => !checkedInSet.has(m.id)).length },
                { value: 'in', label: 'Checked in', count: filteredMembers.filter((m) => checkedInSet.has(m.id)).length },
              ]}
              value={filter}
              onChange={(v) => setFilter(v as 'all' | 'pending' | 'in')}
            />
            {listMembers.length === 0 ? (
              <EmptyState
                icon={Search}
                title={search ? `No one called “${search}”` : 'No one here'}
                sub={search ? 'Register them and they’ll be checked in straight away.' : undefined}
                action={
                  search ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNewName(search.trim());
                        setRegisterMemberOpen(true);
                      }}
                      className="oc-btn-primary"
                    >
                      <UserPlus className="w-[18px] h-[18px]" /> Register “{search.trim()}”
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <ListCard>
                {listMembers.map((member) => {
                  const isCheckedIn = checkedInSet.has(member.id);
                  return (
                    <Row
                      key={member.id}
                      lead={<Avatar name={member.fullName} />}
                      title={
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{member.fullName}</span>
                          {member.isFirstTimer && <Badge kind="warn">First timer</Badge>}
                        </span>
                      }
                      sub={`${member.phoneNumber} · ${member.residence}`}
                      trail={
                        isCheckedIn ? (
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className="h-10 px-3.5 rounded-2xl bg-church-posSoft text-[#0E5A37] text-sm font-bold flex items-center gap-1.5">
                              <Check className="w-4 h-4" /> In
                            </span>
                            {canUndo && activeServiceId && (
                              <button
                                type="button"
                                onClick={() => AttendanceAndMemberService.undoMemberCheckIn(activeServiceId, member.id)}
                                aria-label={`Undo check-in for ${member.fullName}`}
                                className="oc-press w-10 h-10 rounded-full text-church-muted hover:bg-church-negSoft hover:text-church-neg flex items-center justify-center"
                              >
                                <RotateCcw className="w-[18px] h-[18px]" />
                              </button>
                            )}
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!activeServiceId}
                            onClick={() =>
                              user &&
                              activeServiceId &&
                              AttendanceAndMemberService.checkInMember({
                                tenantId: activeTenantId,
                                serviceId: activeServiceId,
                                memberId: member.id,
                                checkedInBy: user.id,
                              })
                            }
                            className="oc-btn-dark !h-10 !px-4 !text-sm shrink-0"
                          >
                            Check in
                          </button>
                        )
                      }
                    />
                  );
                })}
              </ListCard>
            )}
          </>
        }
        side={<div className="hidden lg:flex flex-col gap-4">{liveCard}</div>}
      />
      {sheets}
    </>
  );
};


const AirportDeptAttendanceView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, activeTenantId } = useAuth();
  const dept = DepartmentService.getDepartmentByCode(
    activeTenantId,
    DepartmentCode.AIRPORT_STARS
  );
  const serving = DepartmentService.getServingMembers(activeTenantId, dept?.id);
  const members = AttendanceAndMemberService.getMembers(activeTenantId);
  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const allAtt = AttendanceAndMemberService.getServiceAttendance(activeTenantId);
  const [serviceId, setServiceId] = useState(services[0]?.id || '');

  const presentCount = serving.filter((sm) => allAtt.some((a) => a.serviceId === serviceId && a.memberId === sm.memberId)).length;
  return (
    <>
      <PageHeader title="Team & duty" subtitle="Who’s on duty at the door this service." />
      {services.length > 0 && (
        <PickerRow
          icon={CalendarDays}
          label="Duty for"
          value={serviceId}
          onChange={setServiceId}
          options={services.map((sv) => ({ value: sv.id, label: `${sv.title} · ${formatDate(sv.serviceDate)}` }))}
        />
      )}
      <KpiGrid>
        <KpiCard label="Team" value={serving.length} subtitle="Greeters & check-in" icon={<Users className="w-[18px] h-[18px]" />} />
        <KpiCard label="On duty" value={`${presentCount} of ${serving.length}`} subtitle="This service" tone="emerald" />
      </KpiGrid>
      {serving.length === 0 ? (
        <EmptyState icon={Users} title="No team members yet" sub="Add people to the team from the More tab." />
      ) : (
        <ListCard>
          {serving.map((sm) => {
            const member = members.find((m) => m.id === sm.memberId);
            if (!member) return null;
            const totalAttended = allAtt.filter((a) => a.memberId === member.id).length;
            const presentToday = allAtt.some((a) => a.serviceId === serviceId && a.memberId === member.id);
            return (
              <Row
                key={sm.id}
                lead={<Avatar name={member.fullName} />}
                title={member.fullName}
                sub={`${sm.servingRole} · attended ${totalAttended} of ${services.length}`}
                trail={
                  serviceId && user ? (
                    presentToday ? (
                      <span className="h-10 px-3.5 rounded-2xl bg-church-posSoft text-[#0E5A37] text-sm font-bold flex items-center gap-1.5 shrink-0">
                        <Check className="w-4 h-4" /> On duty
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          AttendanceAndMemberService.checkInMember({
                            tenantId: activeTenantId,
                            serviceId,
                            memberId: member.id,
                            checkedInBy: user.id,
                            isServingCheckin: true,
                            servingDepartmentId: dept?.id,
                          })
                        }
                        className="oc-btn-dark !h-10 !px-4 !text-sm shrink-0"
                      >
                        Mark present
                      </button>
                    )
                  ) : undefined
                }
              />
            );
          })}
        </ListCard>
      )}
    </>
  );
};

export const AirportStarsModule: React.FC = () => {
  const { user } = useAuth();
  const isMemberLocked = user?.role === UserRole.AIRPORT_MEMBER;

  return (
    <Routes>
      <Route path="checkin" element={<AirportServiceCheckInView />} />
      <Route
        path="attendance"
        element={
          isMemberLocked ? (
            <Navigate to="/airport-stars/checkin" replace />
          ) : (
            <AirportDeptAttendanceView />
          )
        }
      />
      <Route
        path="more"
        element={
          isMemberLocked ? (
            <Navigate to="/airport-stars/checkin" replace />
          ) : (
            <HodMoreTab departmentCode={DepartmentCode.AIRPORT_STARS} />
          )
        }
      />
      <Route path="members" element={isMemberLocked ? <Navigate to="/airport-stars/checkin" replace /> : <AirportMembersPage />} />
      <Route path="members/:id" element={isMemberLocked ? <Navigate to="/airport-stars/checkin" replace /> : <AirportMemberPage />} />
      <Route path="*" element={<Navigate to="checkin" replace />} />
    </Routes>
  );
};

