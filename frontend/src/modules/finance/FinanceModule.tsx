import React, { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  Coins,
  HeartHandshake,
  Plus,
  Receipt,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import {
  AttendanceAndMemberService,
  DepartmentService,
  FinanceService,
} from '@/services/churchService';
import {
  DepartmentCode,
  FinanceCategory,
  FinanceType,
  RequisitionStatus,
  UserRole,
} from '@/shared/enums';
import { formatCurrency, formatDate } from '@/shared/formatters';
import {
  DateInput,
  HeroAmountInput,
  KpiCard,
  MobileSheet,
  NumberInput,
  PhoneInput,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@/components/ui/FormControls';
import { HodMoreTab } from '@/components/hod-more/HodMoreTab';
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

const compact = (n: number) =>
  n >= 1_000_000 ? `${Math.round(n / 10_000) / 100}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${n}`;

type ServiceIncomeCat =
  | FinanceCategory.OFFERTORY
  | FinanceCategory.TITHE
  | FinanceCategory.PARTNERSHIP;

const ServiceCollectionsView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, tenant, activeTenantId } = useAuth();
  const currency = tenant?.currency || 'UGX';

  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const partners = FinanceService.getPartners(activeTenantId);
  const members = AttendanceAndMemberService.getMembers(activeTenantId);

  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [category, setCategory] = useState<ServiceIncomeCat>(
    FinanceCategory.OFFERTORY
  );
  const [amount, setAmount] = useState(0);
  const [partnerId, setPartnerId] = useState(partners[0]?.id || '');
  const [memberId, setMemberId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    'Cash' | 'Mobile Money' | 'Bank Transfer'
  >('Cash');
  const [referenceCode, setReferenceCode] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [quickPartnerOpen, setQuickPartnerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Quick Partner Form
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pTier, setPTier] = useState('Kingdom Partner');
  const [pPledge, setPPledge] = useState(500000);

  const activeServiceId = serviceId || services[0]?.id || '';
  const activeService = services.find((s) => s.id === activeServiceId) ?? null;

  const serviceTxs = FinanceService.getTransactions(
    activeTenantId,
    activeServiceId
  ).filter((tx) => tx.type === FinanceType.INCOME);

  const offertoryTotal = serviceTxs
    .filter((t) => t.category === FinanceCategory.OFFERTORY)
    .reduce((s, t) => s + t.amount, 0);
  const titheTotal = serviceTxs
    .filter((t) => t.category === FinanceCategory.TITHE)
    .reduce((s, t) => s + t.amount, 0);
  const partnershipTotal = serviceTxs
    .filter((t) => t.category === FinanceCategory.PARTNERSHIP)
    .reduce((s, t) => s + t.amount, 0);

  const handleRecordIncome = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user || !activeServiceId) return;
    if (amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (category === FinanceCategory.PARTNERSHIP && !partnerId) {
      setError('Partnership MUST be tied to a specific registered Partner.');
      return;
    }

    try {
      FinanceService.recordServiceIncome({
        tenantId: activeTenantId,
        serviceId: activeServiceId,
        category,
        partnerId: category === FinanceCategory.PARTNERSHIP ? partnerId : null,
        memberId: category === FinanceCategory.TITHE && memberId ? memberId : null,
        amount,
        paymentMethod,
        referenceCode,
        description: notes,
        transactionDate:
          activeService?.serviceDate || new Date().toISOString().slice(0, 10),
        recordedBy: user.id,
      });
      setAmount(0);
      setReferenceCode('');
      setNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save entry.');
    }
  };

  const handleQuickCreatePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim() || !pPhone.trim()) return;
    const created = FinanceService.createPartner({
      tenantId: activeTenantId,
      fullName: pName,
      phoneNumber: pPhone,
      email: '',
      tierOrPledge: pTier,
      monthlyPledge: pPledge,
      frequency: 'Monthly',
    });
    setPartnerId(created.id);
    setPName('');
    setPPhone('');
    setQuickPartnerOpen(false);
  };

  const grand = offertoryTotal + titheTotal + partnershipTotal;
  const pct = (v: number) => (grand ? `${Math.round((v / grand) * 100)}% of total` : '—');
  const partnersOnService = new Set(serviceTxs.filter((t) => t.partnerId).map((t) => t.partnerId)).size;
  const catIcon: Record<string, React.ElementType> = {
    [FinanceCategory.OFFERTORY]: Coins,
    [FinanceCategory.TITHE]: Wallet,
    [FinanceCategory.PARTNERSHIP]: HeartHandshake,
  };
  const catTone: Record<string, 'amber' | 'blue' | 'lime'> = {
    [FinanceCategory.OFFERTORY]: 'amber',
    [FinanceCategory.TITHE]: 'blue',
    [FinanceCategory.PARTNERSHIP]: 'lime',
  };

  const entryForm = (
    <Card as="form" onSubmit={handleRecordIncome} className="!gap-4">
      <SectionTitle title="Add a collection" aside={activeService ? formatDate(activeService.serviceDate) : undefined} />
      <Segment
        options={[
          { value: FinanceCategory.OFFERTORY, label: 'Offertory' },
          { value: FinanceCategory.TITHE, label: 'Tithe' },
          { value: FinanceCategory.PARTNERSHIP, label: 'Partnership' },
        ]}
        value={category}
        onChange={(v) => {
          setCategory(v as ServiceIncomeCat);
          setError('');
        }}
      />

      {category === FinanceCategory.PARTNERSHIP && (
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between">
            <span className="oc-label">Partner</span>
            <button type="button" onClick={() => setQuickPartnerOpen(true)} className="text-sm font-semibold text-church-emerald">
              + New partner
            </button>
          </span>
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required className="oc-field">
            <option value="">Choose a partner</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} — {p.tierOrPledge}
              </option>
            ))}
          </select>
        </label>
      )}

      {category === FinanceCategory.TITHE && (
        <SelectInput
          label="Who gave it? (optional)"
          value={memberId}
          onChange={setMemberId}
          options={[
            { value: '', label: 'General tithe basket' },
            ...members.map((m) => ({ value: m.id, label: m.fullName })),
          ]}
        />
      )}

      <HeroAmountInput
        label="Amount"
        currency={currency}
        value={amount}
        onChange={setAmount}
        error={error}
      />

      <div className="grid grid-cols-2 gap-3">
        <SelectInput
          label="Channel"
          value={paymentMethod}
          onChange={(v) => setPaymentMethod(v as 'Cash' | 'Mobile Money' | 'Bank Transfer')}
          options={[
            { value: 'Cash', label: 'Cash' },
            { value: 'Mobile Money', label: 'Mobile Money' },
            { value: 'Bank Transfer', label: 'Bank' },
          ]}
        />
        <TextInput label="Reference" value={referenceCode} onChange={setReferenceCode} placeholder="MM-88412" />
      </div>
      <TextInput label="Note (optional)" value={notes} onChange={setNotes} placeholder="e.g. 1st basket" />

      <button type="submit" className="oc-btn-primary w-full !h-14 !text-base">
        Save {category.toLowerCase()}
      </button>
    </Card>
  );

  return (
    <>
      <PageHeader title="Service collections" subtitle="Record offertory, tithe and partnership for each service." />
      <Columns
        main={
          <>
            {services.length > 0 && (
              <PickerRow
                icon={CalendarDays}
                label="Service"
                value={activeServiceId}
                onChange={setServiceId}
                options={services.map((s) => ({ value: s.id, label: `${s.title} · ${formatDate(s.serviceDate)}` }))}
              />
            )}
            <DarkCard eyebrow={`Total collected · ${currency}`} title={<span className="tabular-nums">{num(grand)}</span>}>
              <div className="flex flex-col gap-2 lg:gap-0 [&>div]:max-lg:rounded-[14px] [&>div]:max-lg:bg-white/[0.07] [&>div]:max-lg:px-3 [&>div]:max-lg:border-0">
                <DarkRow icon={Coins} title="Offertory" sub={pct(offertoryTotal)} value={num(offertoryTotal)} />
                <DarkRow icon={Wallet} title="Tithe" sub={pct(titheTotal)} value={num(titheTotal)} />
                <DarkRow
                  icon={HeartHandshake}
                  title="Partnership"
                  sub={`${partnersOnService} partner${partnersOnService === 1 ? '' : 's'}`}
                  value={num(partnershipTotal)}
                />
              </div>
              <button type="button" onClick={() => setAddOpen(true)} className="lg:hidden oc-btn-primary self-start !h-12">
                Add a collection
              </button>
            </DarkCard>
            {serviceTxs.length === 0 ? (
              <EmptyState icon={Coins} title="Nothing recorded yet" sub="Add the first collection for this service." />
            ) : (
              <ListCard title="Entries" aside={currency}>
                {serviceTxs.map((tx) => {
                  const partner = partners.find((p) => p.id === tx.partnerId);
                  return (
                    <Row
                      key={tx.id}
                      lead={<Tile icon={catIcon[tx.category] ?? Coins} tone={catTone[tx.category] ?? 'neutral'} />}
                      title={partner ? partner.fullName : tx.description || tx.category}
                      sub={`${tx.category.charAt(0) + tx.category.slice(1).toLowerCase()} · ${tx.paymentMethod}${
                        tx.referenceCode ? ` · ${tx.referenceCode}` : ''
                      }`}
                      trail={<span className="oc-num text-[15px] whitespace-nowrap">+{num(tx.amount)}</span>}
                    />
                  );
                })}
              </ListCard>
            )}
          </>
        }
        side={<div className="hidden lg:block">{entryForm}</div>}
      />
      <MobileSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add a collection" subtitle={activeService ? `${activeService.title} · ${formatDate(activeService.serviceDate)}` : undefined}>
        <div className="[&>form]:!p-0 [&>form>div:first-child]:hidden">{entryForm}</div>
      </MobileSheet>

      {/* Quick Register Partner Sheet */}
      <MobileSheet
        open={quickPartnerOpen}
        onClose={() => setQuickPartnerOpen(false)}
        title="Register New Partner"
        subtitle="Adds partner to the Partner Register immediately"
      >
        <form onSubmit={handleQuickCreatePartner} className="space-y-4">
          <TextInput label="Partner Full Name" value={pName} onChange={setPName} required />
          <PhoneInput label="Phone Number" value={pPhone} onChange={setPPhone} required />
          <TextInput label="Partnership Tier" value={pTier} onChange={setPTier} required />
          <NumberInput
            label="Monthly Pledge"
            value={pPledge}
            onChange={setPPledge}
            prefix={currency}
          />
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Register & Select Partner
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

const PartnerRegisterView: React.FC = () => {
  useChurchStoreRefresh();
  const { tenant, activeTenantId } = useAuth();
  const currency = tenant?.currency || 'UGX';

  const partners = FinanceService.getPartners(activeTenantId);
  const members = AttendanceAndMemberService.getMembers(activeTenantId);
  const allTxs = FinanceService.getTransactions(activeTenantId);

  const [addOpen, setAddOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [pSearch, setPSearch] = useState('');

  const [linkedMemberId, setLinkedMemberId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState('Kingdom Partner');
  const [pledge, setPledge] = useState(500000);
  const [frequency, setFrequency] = useState<
    'Weekly' | 'Monthly' | 'Quarterly' | 'One-Time'
  >('Monthly');

  const handleLinkMember = (mId: string) => {
    setLinkedMemberId(mId);
    const m = members.find((x) => x.id === mId);
    if (m) {
      setFullName(m.fullName);
      setPhone(m.phoneNumber);
    }
  };

  const handleCreatePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;
    FinanceService.createPartner({
      tenantId: activeTenantId,
      memberId: linkedMemberId || null,
      fullName,
      phoneNumber: phone,
      email,
      tierOrPledge: tier,
      monthlyPledge: pledge,
      frequency,
    });
    setFullName('');
    setPhone('');
    setEmail('');
    setLinkedMemberId('');
    setAddOpen(false);
  };

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId) ?? null;
  const partnerHistory = selectedPartner
    ? allTxs.filter((tx) => tx.partnerId === selectedPartner.id)
    : [];

  const pledgedMonthly = partners.reduce((t, p) => t + (p.frequency === 'Monthly' ? p.monthlyPledge : 0), 0);
  const givenAll = allTxs.filter((tx) => tx.partnerId).reduce((t, tx) => t + tx.amount, 0);
  return (
    <>
      <PageHeader
        title="Partners"
        subtitle="Pledges and what each partner has given."
        actions={
          <button type="button" onClick={() => setAddOpen(true)} className="oc-btn-dark">
            <Plus className="w-[18px] h-[18px] text-church-lime" /> Add partner
          </button>
        }
      />
      <Card>
        <Stats
          items={[
            { label: 'Partners', value: partners.length },
            { label: 'Pledged / mo', value: compact(pledgedMonthly) },
            { label: 'Given', value: compact(givenAll), color: '#116B43' },
          ]}
        />
      </Card>
      <SearchField value={pSearch} onChange={setPSearch} placeholder="Search partners" />
      {partners.length === 0 ? (
        <EmptyState icon={HeartHandshake} title="No partners yet" sub="Add a partner to record partnership giving." />
      ) : (
        <ListCard>
          {partners.filter((p) => !pSearch.trim() || p.fullName.toLowerCase().includes(pSearch.toLowerCase()) || p.phoneNumber.includes(pSearch)).map((p) => {
            const givenTotal = allTxs.filter((tx) => tx.partnerId === p.id).reduce((t, tx) => t + tx.amount, 0);
            const pctGiven = p.monthlyPledge ? (givenTotal / p.monthlyPledge) * 100 : 0;
            return (
              <Row
                key={p.id}
                onClick={() => setSelectedPartnerId(p.id)}
                lead={<Avatar name={p.fullName} />}
                title={p.fullName}
                sub={`${p.tierOrPledge} · ${compact(p.monthlyPledge)} ${p.frequency.toLowerCase()}`}
                trail={
                  <span className="flex w-[92px] sm:w-36 shrink-0">
                    <MiniBar pct={pctGiven} />
                  </span>
                }
              />
            );
          })}
        </ListCard>
      )}

      {/* Add Partner Sheet */}
      <MobileSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Register Ministry Partner"
        subtitle="Required for recording Partnership offerings"
      >
        <form onSubmit={handleCreatePartner} className="space-y-4">
          <SelectInput
            label="Link Existing Church Member (Optional)"
            value={linkedMemberId}
            onChange={handleLinkMember}
            options={[
              { value: '', label: '-- External / Manual Entry --' },
              ...members.map((m) => ({
                value: m.id,
                label: `${m.fullName} (${m.phoneNumber})`,
              })),
            ]}
          />
          <TextInput
            label="Partner Full Name"
            value={fullName}
            onChange={setFullName}
            required
          />
          <PhoneInput label="Phone Number" value={phone} onChange={setPhone} required />
          <TextInput
            label="Email Address (Optional)"
            type="email"
            value={email}
            onChange={setEmail}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Tier / Label" value={tier} onChange={setTier} required />
            <SelectInput
              label="Frequency"
              value={frequency}
              onChange={(v) =>
                setFrequency(v as 'Weekly' | 'Monthly' | 'Quarterly' | 'One-Time')
              }
              options={[
                { value: 'Monthly', label: 'Monthly' },
                { value: 'Weekly', label: 'Weekly' },
                { value: 'Quarterly', label: 'Quarterly' },
                { value: 'One-Time', label: 'One-Time' },
              ]}
            />
          </div>
          <NumberInput
            label="Committed Pledge Amount"
            value={pledge}
            onChange={setPledge}
            prefix={currency}
          />
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save Partner to Register
          </button>
        </form>
      </MobileSheet>

      {/* Partner Statement Sheet */}
      <MobileSheet
        open={Boolean(selectedPartner)}
        onClose={() => setSelectedPartnerId(null)}
        title={selectedPartner?.fullName ?? 'Partner Statement'}
        subtitle={`${selectedPartner?.tierOrPledge ?? ''} • ${selectedPartner?.phoneNumber ?? ''}`}
      >
        {selectedPartner && (
          <div className="flex items-center gap-3">
            <Avatar name={selectedPartner.fullName} size={56} />
            <span className="flex-1 min-w-0 flex flex-col gap-1">
              <Badge kind="lime">{selectedPartner.tierOrPledge}</Badge>
              <span className="oc-sub">{selectedPartner.phoneNumber}</span>
            </span>
            <ContactButtons phone={selectedPartner.phoneNumber} name={selectedPartner.fullName} />
          </div>
        )}
        <DarkCard eyebrow={`Given in total · ${currency}`} title={<span className="tabular-nums">{num(partnerHistory.reduce((t, x) => t + x.amount, 0))}</span>}>
          <span className="text-sm text-church-mist">
            {partnerHistory.length} contribution{partnerHistory.length === 1 ? '' : 's'} · pledge {num(selectedPartner?.monthlyPledge ?? 0)} {selectedPartner?.frequency.toLowerCase()}
          </span>
        </DarkCard>
        {partnerHistory.length === 0 ? (
          <p className="oc-sub text-center py-4">No partnership giving recorded yet.</p>
        ) : (
          <div className="divide-y divide-church-line">
            {partnerHistory.map((tx) => (
              <Row
                key={tx.id}
                lead={<Tile icon={HeartHandshake} tone="lime" />}
                title={tx.description}
                sub={`${formatDate(tx.transactionDate)} · ${tx.paymentMethod}`}
                trail={<span className="oc-num text-[15px] whitespace-nowrap">{num(tx.amount)}</span>}
              />
            ))}
          </div>
        )}
      </MobileSheet>
    </>
  );
};

const OutflowsAndRemittancesView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, tenant, activeTenantId } = useAuth();
  const currency = tenant?.currency || 'UGX';

  const allTxs = FinanceService.getTransactions(activeTenantId);
  const expenses = allTxs.filter((t) => t.type === FinanceType.EXPENSE);
  const approvedReqs = DepartmentService.getRequisitions(activeTenantId).filter(
    (r) => r.status === RequisitionStatus.APPROVED
  );
  const services = AttendanceAndMemberService.getServices(activeTenantId);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState(0);
  const [expServiceId, setExpServiceId] = useState('');
  const [expMethod, setExpMethod] = useState<'Cash' | 'Mobile Money' | 'Bank Transfer'>('Cash');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));

  const handleRecordExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim() || expAmount <= 0 || !user) return;
    FinanceService.recordExpense({
      tenantId: activeTenantId,
      serviceId: expServiceId || null,
      amount: expAmount,
      paymentMethod: expMethod,
      description: expDesc,
      transactionDate: expDate,
      recordedBy: user.id,
    });
    setExpDesc('');
    setExpAmount(0);
    setExpenseOpen(false);
  };

  const spent = expenses.reduce((t, x) => t + x.amount, 0);
  const income = allTxs.filter((t) => t.type === FinanceType.INCOME).reduce((t, x) => t + x.amount, 0);
  return (
    <>
      <PageHeader
        title="Expenses & payouts"
        subtitle="Pay approved requisitions and record church spending."
        actions={
          <button type="button" onClick={() => setExpenseOpen(true)} className="oc-btn-dark">
            <Plus className="w-[18px] h-[18px] text-church-lime" /> Record expense
          </button>
        }
      />
      <Columns
        main={
          <>
            {approvedReqs.map((req) => (
              <DarkCard key={req.id} eyebrow="Ready to pay out" title={req.title}>
                <div className="flex items-end justify-between gap-3">
                  <span className="text-[13px] text-church-mist leading-snug">
                    {req.requisitionNumber} · approved by Administration
                  </span>
                  <span className="oc-num text-[22px] text-church-lime whitespace-nowrap">{num(req.totalAmount - req.amountPaid)}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    user &&
                    FinanceService.recordExpense({
                      tenantId: activeTenantId,
                      serviceId: req.serviceId,
                      departmentId: req.departmentId,
                      requisitionId: req.id,
                      amount: req.totalAmount - req.amountPaid,
                      paymentMethod: 'Mobile Money',
                      description: `Payout ${req.requisitionNumber}: ${req.title}`,
                      transactionDate: new Date().toISOString().slice(0, 10),
                      recordedBy: user.id,
                    })
                  }
                  className="oc-btn-primary self-start !h-12"
                >
                  Disburse via Mobile Money
                </button>
              </DarkCard>
            ))}
            <Card className="lg:hidden">
              <Stats
                items={[
                  { label: `Spent in ${new Date().toLocaleDateString('en-GB', { month: 'short' })}`, value: num(spent), color: '#B42318' },
                  { label: 'Awaiting payout', value: num(approvedReqs.reduce((t, r) => t + r.totalAmount - r.amountPaid, 0)), color: '#A15C00' },
                ]}
              />
            </Card>
            {expenses.length === 0 ? (
              <EmptyState icon={Receipt} title="No expenses yet" />
            ) : (
              <ListCard title="Expense ledger" aside={currency}>
                {expenses.map((exp) => (
                  <Row
                    key={exp.id}
                    lead={<Tile icon={Receipt} tone="red" />}
                    title={exp.description}
                    sub={`${formatDate(exp.transactionDate)} · ${exp.paymentMethod}`}
                    trail={<span className="oc-num text-[15px] text-church-neg whitespace-nowrap">−{num(exp.amount)}</span>}
                  />
                ))}
              </ListCard>
            )}
          </>
        }
        side={
          <DarkCard className="hidden lg:flex" eyebrow={`This month · ${currency}`} title={<span className="tabular-nums">{num(income - spent)} net</span>}>
            <DarkStats
              items={[
                { label: 'Collected', value: num(income) },
                { label: 'Spent', value: num(spent) },
              ]}
            />
          </DarkCard>
        }
      />

      <MobileSheet
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Record Church Expense"
        subtitle="Tracks service or operational expenditure"
      >
        <form onSubmit={handleRecordExpense} className="space-y-4">
          <TextInput
            label="Expense Description"
            value={expDesc}
            onChange={setExpDesc}
            placeholder="e.g. Auditorium Generator Fuel"
            required
          />
          <NumberInput
            label="Amount Spent"
            value={expAmount}
            onChange={setExpAmount}
            prefix={currency}
            min={1}
            required
          />
          <SelectInput
            label="Tie to Specific Service (Optional)"
            value={expServiceId}
            onChange={setExpServiceId}
            options={[
              { value: '', label: 'General Operational Expense' },
              ...services.map((s) => ({
                value: s.id,
                label: `${s.title} (${s.serviceDate})`,
              })),
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectInput
              label="Method"
              value={expMethod}
              onChange={(v) =>
                setExpMethod(v as 'Cash' | 'Mobile Money' | 'Bank Transfer')
              }
              options={[
                { value: 'Cash', label: 'Cash' },
                { value: 'Mobile Money', label: 'Mobile Money' },
                { value: 'Bank Transfer', label: 'Bank Transfer' },
              ]}
            />
            <DateInput label="Date" value={expDate} onChange={setExpDate} required />
          </div>
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save Expense
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

export const FinanceModule: React.FC = () => {
  const { user } = useAuth();
  const canSeeMore =
    user?.role === UserRole.FINANCE_HOD ||
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.PLATFORM_ADMIN;

  return (
    <Routes>
      <Route path="collections" element={<ServiceCollectionsView />} />
      <Route path="partners" element={<PartnerRegisterView />} />
      <Route path="outflows" element={<OutflowsAndRemittancesView />} />
      <Route
        path="more"
        element={
          canSeeMore ? (
            <HodMoreTab departmentCode={DepartmentCode.FINANCE} />
          ) : (
            <Navigate to="/finance/collections" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="collections" replace />} />
    </Routes>
  );
};

