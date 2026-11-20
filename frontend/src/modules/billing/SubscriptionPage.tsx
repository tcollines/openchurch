import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import { SubscriptionService } from '@/services/churchService';
import { SubscriptionPayment } from '@/shared/types';
import { churchShortName } from '@/shared/billing';
import { Columns, num, PageHeader } from '@/components/ui/kit';
import { BillingHistory, DueBanner, ManualPayCard, PaidView, PayCard, PlanCard } from './BillingParts';

/** Admin → More → Subscription. Shows the trial / due state and how to pay. */
export const SubscriptionPage: React.FC = () => {
  useChurchStoreRefresh();
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const [paid, setPaid] = useState<SubscriptionPayment | null>(null);
  const state = SubscriptionService.getState(tenant);
  if (!tenant || !state) return null;

  if (paid) {
    return <PaidView payment={paid} tenant={tenant} onDone={() => navigate('/admin/overview')} />;
  }

  const pay = (
    <PayCard
      tenant={tenant}
      state={state}
      defaultPhone={user?.phoneNumber}
      userId={user?.id}
      cta={state.phase === 'active' || state.phase === 'trial' ? `Pay UGX ${num(state.fee)} now` : undefined}
      onPaid={setPaid}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow={
          <button type="button" onClick={() => navigate('/admin/more')} className="hover:underline">
            More › Subscription
          </button>
        }
        title="Subscription"
        subtitle={`Open Church for ${churchShortName(tenant.name, tenant.shortName)} · UGX ${num(state.fee)} a month.`}
      />
      {state.phase === 'due' && <DueBanner state={state} />}
      <Columns
        main={
          <>
            <PlanCard state={state} />
            <div className="lg:hidden">{pay}</div>
            <ManualPayCard tenant={tenant} />
            <BillingHistory tenant={tenant} />
          </>
        }
        side={<div className="hidden lg:flex flex-col gap-4">{pay}</div>}
      />
    </>
  );
};
