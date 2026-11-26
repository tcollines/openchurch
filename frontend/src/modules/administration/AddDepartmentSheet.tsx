import React, { useState } from 'react';
import { Check, LayoutGrid, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DepartmentService, PlatformService } from '@/services/churchService';
import { UserRole } from '@/shared/enums';
import { Department } from '@/shared/types';
import { DEPT_COLORS, DEPT_ICONS } from '@/shared/deptLook';
import { MobileSheet, PhoneInput, TextInput } from '@/components/ui/FormControls';

const ICON_CHOICES = ['music', 'users', 'megaphone', 'camera', 'heart', 'mic', 'care', 'food'];

/** Administration adds one of the church's own departments (Choir, Ushering, Media…), with its head. */
export const AddDepartmentSheet: React.FC<{ open: boolean; onClose: () => void; onAdded: (d: Department) => void }> = ({ open, onClose, onAdded }) => {
  const { activeTenantId } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [color, setColor] = useState(DEPT_COLORS[0][0]);
  const [headName, setHeadName] = useState('');
  const [headEmail, setHeadEmail] = useState('');
  const [headPhone, setHeadPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fg = DEPT_COLORS.find(([bg]) => bg === color)?.[1] ?? '#18231C';

  const reset = () => {
    setName('');
    setDescription('');
    setIcon(ICON_CHOICES[0]);
    setColor(DEPT_COLORS[0][0]);
    setHeadName('');
    setHeadEmail('');
    setHeadPhone('');
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = headEmail.trim().toLowerCase();
    if (email && !headName.trim()) return setError('Add the head’s name, or leave the email empty for now.');
    if (email && PlatformService.getUsersForTenant(activeTenantId).some((u) => u.email.toLowerCase() === email)) {
      return setError(`${email} already has a login. Use a different email for the head.`);
    }
    setBusy(true);
    setError('');
    try {
      const dept = await DepartmentService.createDepartment({ tenantId: activeTenantId, name, description, icon, color });
      if (email) {
        PlatformService.createUser({
          tenantId: activeTenantId,
          fullName: headName.trim(),
          email,
          phoneNumber: headPhone,
          role: UserRole.DEPT_HOD,
          departmentId: dept.id,
        });
      }
      reset();
      onAdded(dept);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the department. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileSheet open={open} onClose={onClose} title="Add a department" subtitle="For any ministry beyond the core departments.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextInput label="Department name" value={name} onChange={setName} placeholder="e.g. Choir, Ushering, Media" required />
        <TextInput label="What they do (optional)" value={description} onChange={setDescription} placeholder="One line" />
        <div className="flex flex-col gap-2">
          <span className="oc-label">Icon</span>
          <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-2">
            {ICON_CHOICES.map((k) => {
              const Icon = DEPT_ICONS[k];
              const on = icon === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={k}
                  onClick={() => setIcon(k)}
                  className={`oc-press w-12 h-12 rounded-[14px] border-2 flex items-center justify-center ${on ? 'border-church-forest' : 'border-transparent'}`}
                  style={{ background: on ? color : '#F6F7F3', color: on ? fg : '#18231C' }}
                >
                  <Icon className="w-[22px] h-[22px]" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="oc-label">Colour</span>
          <div role="radiogroup" aria-label="Colour" className="flex gap-2.5">
            {DEPT_COLORS.map(([bg, f], i) => (
              <button
                key={bg}
                type="button"
                role="radio"
                aria-checked={color === bg}
                aria-label={`Colour ${i + 1}`}
                onClick={() => setColor(bg)}
                className="oc-press w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: bg, color: f, boxShadow: color === bg ? `inset 0 0 0 3px ${f}` : undefined }}
              >
                {color === bg && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 p-3.5 rounded-[18px] bg-[#F6F7F3]">
          <span className="text-[15px] font-bold">Head of department</span>
          <TextInput label="Full name" value={headName} onChange={setHeadName} placeholder="e.g. Sharon Achieng" />
          <TextInput label="Email for their login" type="email" value={headEmail} onChange={setHeadEmail} placeholder="name@gmail.com" />
          <PhoneInput label="Phone (optional)" value={headPhone} onChange={setHeadPhone} />
          <span className="oc-sub">They get an invite and land on the department’s Overview. You can also add the head later.</span>
        </div>
        <div className="flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-church-limeSoft text-sm leading-[1.45] text-[#3E4741]">
          <LayoutGrid className="w-5 h-5 text-church-emerald shrink-0 mt-0.5" />
          Comes with Overview, Team and More: attendance, money, workplans, requisitions and discipleship.
        </div>
        {error && (
          <p role="alert" className="m-0 px-3.5 py-2.5 rounded-xl bg-church-negSoft text-sm text-[#8F1D14]">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="oc-btn-primary w-full">
          <Plus className="w-5 h-5" /> {busy ? 'Adding…' : 'Add department'}
        </button>
      </form>
    </MobileSheet>
  );
};
