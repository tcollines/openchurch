import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  ExternalLink,
  Plus,
  Power,
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
  PlatformService,
} from '@/services/churchService';
import { formatDate } from '@/shared/formatters';
import {
  KpiCard,
  MobileSheet,
  PhoneInput,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@/components/ui/FormControls';

export const PlatformTenantsPage: React.FC = () => {
  useChurchStoreRefresh();
  const { switchSupervisedTenant } = useAuth();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Uganda');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  const tenants = PlatformService.getTenants();
  const allUsers = PlatformService.getAllUsers();

  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminName.trim() || !adminEmail.trim()) return;
    await PlatformService.provisionTenantRemote({
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      currency,
      city,
      country,
      adminName,
      adminEmail,
      adminPhone,
    });
    setName('');
    setSlug('');
    setCity('');
    setAdminName('');
    setAdminEmail('');
    setAdminPhone('');
    setCreateOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Churches"
        subtitle="Every church in the network, each with its own data and all seven departments."
        actions={
          <button type="button" onClick={() => navigate('/platform/tenants/new')} className="oc-btn-dark">
            <Plus className="w-[18px] h-[18px] text-church-lime" /> New church
          </button>
        }
      />
      <Card>
        <Stats
          items={[
            { label: 'Churches', value: tenants.length },
            { label: 'Active', value: tenants.filter((t) => t.status === 'ACTIVE').length, color: '#116B43' },
            { label: 'Users', value: allUsers.length },
          ]}
        />
      </Card>
      {tenants.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No churches onboarded yet"
          sub="Add your first church to the network. It starts on a 7-day free trial and sends the pastor a verification & welcome link."
          action={
            <button type="button" onClick={() => navigate('/platform/tenants/new')} className="oc-btn-primary">
              <Plus className="w-[18px] h-[18px]" /> Add first church
            </button>
          }
        />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {tenants.map((t) => {
          const tMembers = AttendanceAndMemberService.getMembers(t.id);
          const tServices = AttendanceAndMemberService.getServices(t.id);
          const tDepts = DepartmentService.getDepartments(t.id);
          const tUsers = PlatformService.getUsersForTenant(t.id);
          const active = t.status === 'ACTIVE';
          return (
            <Card key={t.id} className="!gap-3.5">
              <div className="flex items-center gap-3">
                <img src={t.logoUrl || '/logo.jpg'} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="font-display text-lg font-semibold truncate">{t.name.replace(/^1000 Micro Church\s*[—-]\s*/, '')}</span>
                  <span className="oc-sub truncate">
                    {t.city}, {t.country} · {t.currency}
                  </span>
                </span>
                <Badge kind={active ? 'ok' : 'bad'}>{active ? 'Active' : 'Suspended'}</Badge>
              </div>
              <div className="pt-3 border-t border-church-line">
                <Stats
                  items={[
                    { label: 'Depts', value: tDepts.length },
                    { label: 'Members', value: tMembers.length },
                    { label: 'Services', value: tServices.length },
                    { label: 'Logins', value: tUsers.length },
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => PlatformService.toggleTenantStatus(t.id)}
                  className={active ? 'oc-btn !h-12 bg-white text-church-neg border-[1.5px] border-[#F4C7C3]' : 'oc-btn-ghost !h-12'}
                >
                  <Power className="w-[18px] h-[18px]" /> {active ? 'Suspend' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    switchSupervisedTenant(t.id);
                    navigate('/admin/overview');
                  }}
                  className="oc-btn-dark !h-12"
                >
                  Inspect <ArrowRight className="w-[18px] h-[18px] text-church-lime" />
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      )}

      <MobileSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Provision New Church Tenant"
        subtitle="Automatically creates all 7 core departments and primary Admin account"
      >
        <form onSubmit={handleProvisionTenant} className="space-y-4">
          <TextInput
            label="Church / Branch Name"
            value={name}
            onChange={setName}
            placeholder="e.g. 1000 Micro Church — Entebbe"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Tenant Slug"
              value={slug}
              onChange={setSlug}
              placeholder="entebbe-branch"
            />
            <SelectInput
              label="Currency"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: 'UGX', label: 'UGX (Ugandan Shilling)' },
                { value: 'KES', label: 'KES (Kenyan Shilling)' },
                { value: 'USD', label: 'USD (US Dollar)' },
                { value: 'GHS', label: 'GHS (Ghana Cedi)' },
                { value: 'ZAR', label: 'ZAR (South African Rand)' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="City" value={city} onChange={setCity} placeholder="Entebbe" required />
            <TextInput label="Country" value={country} onChange={setCountry} placeholder="Uganda" required />
          </div>
          <div className="pt-2 border-t border-church-line space-y-3">
            <p className="text-xs font-semibold text-church-forest">
              Primary Church Administrator
            </p>
            <TextInput
              label="Administrator Full Name"
              value={adminName}
              onChange={setAdminName}
              placeholder="Pastor John Mukasa"
              required
            />
            <TextInput
              label="Administrator Email"
              type="email"
              value={adminEmail}
              onChange={setAdminEmail}
              placeholder="admin@entebbe.openchurch.org"
              required
            />
            <PhoneInput
              label="Administrator Phone"
              value={adminPhone}
              onChange={setAdminPhone}
              required
            />
          </div>
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Create Tenant & Seed 7 Departments
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

