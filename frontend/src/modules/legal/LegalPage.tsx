import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/kit';

export const LegalPage: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isPrivacy = pathname === '/privacy';

  return (
    <div className="min-h-[100dvh] bg-church-canvas text-church-text px-5 py-8 md:py-14">
      <div className="max-w-[680px] mx-auto flex flex-col gap-5">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/login'))}
          className="self-start inline-flex items-center gap-2 text-sm font-semibold text-church-muted hover:text-church-text"
        >
          <span className="w-10 h-10 rounded-[12px] bg-white flex items-center justify-center text-church-text">
            <ChevronLeft className="w-5 h-5" />
          </span>
          Back
        </button>

        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Open Church" className="w-11 h-11 rounded-full object-cover" />
          <div className="flex flex-col">
            <span className="font-display text-2xl font-bold leading-tight">
              {isPrivacy ? 'Open Church Privacy Policy' : 'Open Church Terms & Subscription'}
            </span>
            <span className="oc-sub">1000 Micro Church Network International</span>
          </div>
        </div>

        {isPrivacy ? (
          <Card>
            <div className="flex items-center gap-2 text-church-emerald text-sm font-bold">
              <ShieldCheck className="w-5 h-5" /> Data Isolation & Privacy
            </div>
            <p className="m-0 text-sm leading-relaxed text-[#2B352E]">
              Every church enrolled on Open Church operates inside an isolated tenant boundary. Your members, children,
              attendance records, requisitions, partners and financial entries belong exclusively to your church.
            </p>
            <p className="m-0 text-sm leading-relaxed text-[#2B352E]">
              All sign-ins use verified Google accounts through Supabase Auth over encrypted connections, and database
              queries are enforced strictly through backend tenant-scoped authorization.
            </p>
          </Card>
        ) : (
          <Card>
            <span className="oc-h2">7-Day Free Trial & Monthly Subscription</span>
            <div className="flex flex-col gap-3">
              {[
                'Every newly onboarded church receives a full 7-day free trial across all 7 departments with unlimited users.',
                'No card or upfront payment is required to start your 7-day trial.',
                'After the 7-day trial, Open Church costs UGX 50,000 per month for the entire church (not per user).',
                'Payments can be completed via MTN Mobile Money, Airtel Money, or bank transfer from Administration → Subscription.',
                'If a monthly payment becomes overdue, dashboard access pauses temporarily until payment is recorded — your church records, members, and finances are never deleted.',
                'There is no lock-in contract; your church may pause or stop using Open Church at any time.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#2B352E]">
                  <span className="w-5 h-5 shrink-0 mt-0.5 rounded-full bg-church-lime text-church-forest flex items-center justify-center">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
