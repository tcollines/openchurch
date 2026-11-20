import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/services/apiClient';
import { getDefaultRouteForUser } from '@/shared/formatters';
import { Department, Tenant, User } from '@/shared/types';

/**
 * Open Church — Live Google Sign-In & New-Church Pastor Onboarding (/get-started -> /setup).
 */
export const LoginPage: React.FC = () => {
  const { completeSupabaseSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [verifyingInvite, setVerifyingInvite] = useState(false);
  const [error, setError] = useState('');

  const searchParams = new URLSearchParams(location.search);
  const invitedChurch = searchParams.get('church') || '';
  const invitedEmail = searchParams.get('email') || '';
  const isGetStarted = location.pathname === '/get-started' || Boolean(invitedChurch);

  // 1. Handle Supabase OAuth & Pastor Email Verification callback (#access_token=... or ?token_hash=...)
  useEffect(() => {
    const handleSupabaseCallback = async () => {
      const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(location.search);

      const errorDesc = hashParams.get('error_description') || queryParams.get('error_description');
      if (errorDesc) {
        setError(errorDesc.replace(/\+/g, ' '));
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      const accessToken = hashParams.get('access_token');
      const tokenHash = queryParams.get('token_hash');
      const verifyType = (queryParams.get('type') || hashParams.get('type') || 'invite') as
        | 'invite'
        | 'magiclink'
        | 'signup'
        | 'email';

      if (!accessToken && !tokenHash) return;

      setIsLoading(true);
      setVerifyingInvite(verifyType === 'invite' || Boolean(tokenHash) || isGetStarted);
      setError('');
      try {
        const res = await apiClient.post<{
          token: string;
          user: User;
          tenant?: Tenant | null;
          departments?: Department[];
          users?: User[];
        }>('/auth/supabase/callback', accessToken ? { accessToken } : { tokenHash, type: verifyType });

        if (res?.token && res?.user) {
          const syncedUser = completeSupabaseSession(res);
          window.history.replaceState(null, '', window.location.pathname);
          navigate(getDefaultRouteForUser(syncedUser, res.tenant), { replace: true });
        }
      } catch (err: unknown) {
        window.history.replaceState(null, '', window.location.pathname);
        setError(err instanceof Error ? err.message : 'Supabase Google sign-in failed.');
      } finally {
        setIsLoading(false);
        setVerifyingInvite(false);
      }
    };

    handleSupabaseCallback();
  }, [location.hash, location.search, isGetStarted, completeSupabaseSession, navigate]);

  // 2. Initiate live Google OAuth through Supabase via Backend
  const handleContinueWithGoogle = async () => {
    setIsLoading(true);
    setError('');
    try {
      const currentOrigin = window.location.origin;
      const nextParam = isGetStarted ? '&next=%2Fget-started' : '';
      const res = await apiClient.get<{ url: string }>(
        `/auth/supabase/google-url?origin=${encodeURIComponent(currentOrigin)}${nextParam}`
      );
      if (res?.url) {
        window.location.assign(res.url);
        return;
      }
      setError('Could not retrieve Supabase Google sign-in URL from backend.');
      setIsLoading(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reach Open Church backend to start Google sign-in.'
      );
      setIsLoading(false);
    }
  };

  const googleG = (
    <svg className="w-[22px] h-[22px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );

  return (
    <div className="min-h-[100dvh] bg-[#0F2418] md:bg-church-canvas flex flex-col md:flex-row">
      {/* Photo panel */}
      <div className="relative h-[56vh] min-h-[380px] shrink-0 md:h-auto md:min-h-screen md:flex-1 overflow-hidden">
        <img
          src="/signin-crowd.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-[50%_22%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(15,36,24,0.35) 0%, rgba(15,36,24,0.25) 30%, rgba(15,36,24,0.78) 72%, #0F2418 100%)',
          }}
        />
        <div className="relative h-full flex flex-col px-7 md:px-14 pt-[max(56px,env(safe-area-inset-top))] md:pt-12 pb-10 md:pb-14">
          <span className="self-start flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[rgba(15,36,24,0.45)] backdrop-blur-[14px] border border-white/20">
            <img src="/logo.jpg" alt="1000 Micro Church Network International" className="w-7 h-7 rounded-full object-cover" />
            <span className="text-[13px] font-semibold text-white">Open Church</span>
          </span>
          <div className="mt-auto flex flex-col gap-2.5 max-w-[560px]">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-church-gold">
              <MapPin className="w-4 h-4" /> 1000 Micro Church Network
            </span>
            <h1 className="font-display text-[36px] md:text-[52px] leading-[1.06] font-bold tracking-[-0.025em] text-white">
              {isGetStarted ? (
                <>
                  Welcome to Open Church.
                  <br />
                  Let’s set up {invitedChurch || 'your church'}.
                </>
              ) : (
                <>
                  Welcome back.
                  <br />
                  Let’s shepherd well today.
                </>
              )}
            </h1>
            <p className="hidden md:block text-[17px] leading-relaxed text-white/80">
              Attendance, giving, follow-up and reports for every department — on your phone at the door and at your
              desk in the office.
            </p>
          </div>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="relative flex-1 -mt-10 md:mt-0 bg-white rounded-t-[32px] md:rounded-none px-6 pt-[32px] pb-[max(48px,env(safe-area-inset-bottom))] md:w-[520px] md:shrink-0 md:flex md:flex-col md:justify-center md:px-16 min-h-[44vh]">
        <div className="flex flex-col gap-[18px] md:gap-[22px] md:max-w-[420px]">
          <img src="/logo.jpg" alt="" aria-hidden="true" className="hidden md:block w-14 h-14 rounded-full object-cover" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-church-emerald">
                {isGetStarted ? <Sparkles className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                {isGetStarted ? '7-Day Free Trial Ready' : 'Google Verified'}
              </span>
            </div>
            <h2 className="font-display text-2xl md:text-[34px] font-bold tracking-[-0.01em] md:tracking-[-0.02em] leading-tight">
              {isGetStarted ? 'Verify & get started' : 'Sign in with Google'}
            </h2>
            <p className="text-[15px] md:text-base leading-snug text-church-muted">
              {invitedEmail ? (
                <>
                  Continue with Google as <strong className="text-church-text">{invitedEmail}</strong> to check your church details and start your 7-day free trial.
                </>
              ) : (
                <>
                  Open Church authenticates securely using your Google or ministry account.
                  <span className="hidden md:inline"> Your role comes with your account.</span>
                </>
              )}
            </p>
          </div>

          {verifyingInvite && (
            <div className="flex gap-2.5 items-center px-3.5 py-3 rounded-[14px] bg-church-limeSoft text-sm font-medium text-[#2F6B0A]">
              <ShieldCheck className="w-[18px] h-[18px] shrink-0" />
              Verifying your church invite & opening setup…
            </div>
          )}

          {error && (
            <p role="alert" className="m-0 flex gap-2.5 items-start px-3.5 py-3 rounded-[14px] bg-church-negSoft text-sm leading-snug text-[#8F1D14]">
              <ShieldAlert className="w-[18px] h-[18px] shrink-0 mt-px" />
              <span>{error}</span>
            </p>
          )}

          <button
            type="button"
            disabled={isLoading}
            onClick={handleContinueWithGoogle}
            className="oc-press w-full h-14 rounded-2xl bg-white text-[#1F1F1F] border-[1.5px] border-[#DADCE0] hover:bg-[#F8F9FA] flex items-center justify-center gap-3 text-[17px] font-semibold disabled:opacity-60"
          >
            {googleG}
            {verifyingInvite
              ? 'Opening church setup…'
              : isLoading
                ? 'Redirecting to Google…'
                : 'Continue with Google'}
          </button>

          <p className="m-0 text-[13px] leading-relaxed text-church-muted">
            Signs in through Google & Supabase. Your church role and departmental permissions load automatically.
          </p>
        </div>
      </div>
    </div>
  );
};
