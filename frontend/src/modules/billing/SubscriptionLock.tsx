import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, MessageCircle, Phone, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PlatformService, SubscriptionService } from '@/services/churchService';
import { UserRole } from '@/shared/enums';
import { SubscriptionPayment } from '@/shared/types';
import { churchShortName } from '@/shared/billing';
import { getWhatsAppLink, ROLE_LABELS } from '@/shared/formatters';
import { Avatar, Card, num } from '@/components/ui/kit';
import { ManualPayCard, PaidView, PayCard, PlanCard } from './BillingParts';

const LockIcon: React.FC<{ size?: number }> = ({ size = 84 }) => (
  <span
    className="shrink-0 rounded-full bg-[#FCEFD9] text-[#7A4300] flex items-center justify-center"
    style={{ width: size, height: size }}
  >
    <Lock style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={1.8} />
  </span>
);

/**
 * Full-screen lock shown instead of the app once the church's subscription has expired.
 * Admins see how to pay; everyone else is asked to contact their church administrator.
 */
export const SubscriptionLock: React.FC<{ onHold?: (hold: boolean) => void }> = ({ onHold }) => {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const [paid, setPaid] = useState<SubscriptionPayment | null>(null);
  const [checking, setChecking] = useState(false);
  const state = SubscriptionService.getState(tenant);
  if (!user || !tenant || !state) return null;

  const isAdmin = user.role === UserRole.ADMIN;
  const church = churchShortName(tenant.name, tenant.shortName);
  const signOut = () => {
    logout();
    navigate('/login');
  };

  const header = (
    <header className="w-full max-w-[1100px] mx-auto flex items-center gap-2.5 px-5 md:px-10 pt-[max(20px,env(safe-area-inset-top))] pb-2">
      <img src={tenant.logoUrl || '/logo.jpg'} alt="" className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover" />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-sm md:text-base font-semibold md:font-display md:font-bold truncate">
          {isAdmin ? 'Open Church' : user.fullName}
        </span>
        <span className="oc-sub truncate">{isAdmin ? church : ROLE_LABELS[user.role]}</span>
      </span>
      <button type="button" onClick={signOut} className="text-sm font-semibold text-church-muted hover:text-church-text">
        Sign out
      </button>
    </header>
  );

  // ── After paying ──
  if (paid) {
    return (
      <div className="min-h-[100dvh] bg-church-canvas text-church-text flex flex-col px-5 pb-10">
        <PaidView
          payment={paid}
          tenant={tenant}
          onDone={() => {
            onHold?.(false);
            navigate('/admin/overview', { replace: true });
          }}
        />
      </div>
    );
  }

  // ── Admin: pay to unlock ──
  if (isAdmin) {
    const pay = (
      <PayCard
        tenant={tenant}
        state={state}
        defaultPhone={user.phoneNumber}
        userId={user.id}
        cta="Pay & unlock"
        onStart={() => onHold?.(true)}
        onPaid={setPaid}
      />
    );
    return (
      <div className="min-h-[100dvh] bg-church-canvas text-church-text flex flex-col">
        {header}
        <main className="w-full max-w-[1100px] mx-auto px-5 md:px-10 pb-12 pt-2 flex flex-col gap-5 md:gap-6">
          <div className="flex flex-col items-center text-center md:flex-row md:text-left gap-3 md:gap-[18px] pt-2">
            <LockIcon size={72} />
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-[28px] md:text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">
                Your subscription has expired
              </h1>
              <p className="text-[15px] md:text-base leading-normal text-church-muted">
                Pay UGX {num(state.fee)} to unlock Open Church for every department. Nothing has been deleted — all your
                members, services and money records are safe.
              </p>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-stretch lg:items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <PlanCard state={state} />
              <div className="lg:hidden">{pay}</div>
              <ManualPayCard tenant={tenant} />
            </div>
            <div className="hidden lg:flex flex-1 min-w-0 flex-col gap-4 lg:sticky lg:top-6">{pay}</div>
          </div>
        </main>
      </div>
    );
  }

  // ── Department: contact admin ──
  const admins = PlatformService.getUsersForTenant(tenant.id)
    .filter((u) => u.role === UserRole.ADMIN && u.isActive)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const admin = admins[0];
  const recheck = () => {
    setChecking(true);
    window.setTimeout(() => {
      setChecking(false);
      window.location.reload();
    }, 600);
  };

  return (
    <div className="min-h-[100dvh] bg-church-canvas text-church-text flex flex-col">
      {header}
      <main className="flex-1 w-full max-w-[520px] mx-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3.5 py-8 md:py-12">
          <LockIcon size={84} />
          <h1 className="font-display text-[28px] md:text-[36px] leading-[1.12] font-bold tracking-[-0.02em]">
            Open Church is paused for {church}
          </h1>
          <p className="text-base md:text-[17px] leading-normal text-church-muted">
            The church subscription needs to be renewed. Please contact your church administrator — your work is saved and
            will be here when it’s back.
          </p>
          {admin && (
            <Card className="self-stretch text-left mt-1.5">
              <span className="oc-sub">Your church administrator</span>
              <div className="flex items-center gap-3">
                <Avatar name={admin.fullName} size={48} />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-base font-semibold truncate">{admin.fullName}</span>
                  <span className="oc-sub truncate">{admin.email}</span>
                </span>
              </div>
              {admin.phoneNumber && (
                <div className="grid grid-cols-2 gap-2.5">
                  <a href={`tel:${admin.phoneNumber}`} className="oc-btn bg-church-canvas text-church-text">
                    <Phone className="w-[18px] h-[18px]" strokeWidth={1.8} /> Call
                  </a>
                  <a
                    href={getWhatsAppLink(
                      admin.phoneNumber,
                      `Hello ${admin.fullName.split(' ')[0]}, Open Church is paused for ${church}. Could you renew the subscription when you can? Thank you.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="oc-btn bg-[#DDF1E4] text-[#0E5A37]"
                  >
                    <MessageCircle className="w-[18px] h-[18px]" strokeWidth={1.8} /> WhatsApp
                  </a>
                </div>
              )}
            </Card>
          )}
        </div>
        <button type="button" onClick={recheck} className="oc-btn-ghost w-full mb-2">
          <RefreshCw className={`w-[18px] h-[18px] ${checking ? 'animate-spin' : ''}`} strokeWidth={1.8} /> Check again
        </button>
      </main>
    </div>
  );
};
