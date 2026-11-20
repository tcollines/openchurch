import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { MapPin, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/services/apiClient';
import { PlatformService } from '@/services/churchService';
import { churchShortName } from '@/shared/billing';
import { getDefaultRouteForUser } from '@/shared/formatters';
import { Department, Tenant, User } from '@/shared/types';

interface WelcomeChurchContext {
  church: {
    id: string;
    name: string;
    shortName?: string | null;
    slug: string;
    logoUrl?: string;
    city?: string;
    country?: string;
  };
  pastorName: string;
  pastorEmail: string;
  userRole?: string;
}

const INVITE_SESSION_FLAG = 'oc_from_pastor_invite';

/**
 * Open Church Login Page
 * - Default (/login): Standard Open Church sign-in screen for all members, HODs & Network Council.
 * - Custom Pastor Link (/get-started/:slug or email invite link): Personalized church login screen
 *   displaying the pastor's church name & logo. Signing in with their invited Google email takes
 *   them straight into the 3-step Get Started screen (/setup).
 */
export const LoginPage: React.FC = () => {
  const { completeSupabaseSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug: routeSlug } = useParams<{ slug?: string }>();

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [welcomeCtx, setWelcomeCtx] = useState<WelcomeChurchContext | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const queryChurch = searchParams.get('church') || '';
  const queryEmail = searchParams.get('email') || '';

  const isCustomChurchLogin =
    location.pathname.startsWith('/get-started') || Boolean(routeSlug) || Boolean(welcomeCtx);

  // 1. Load church name & pastor details if opened via /get-started/:slug
  useEffect(() => {
    if (!routeSlug) return;
    let cancelled = false;

    const loadChurchWelcome = async () => {
      try {
        const res = await apiClient.get<WelcomeChurchContext>(
          `/public/welcome/${encodeURIComponent(routeSlug)}`
        );
        if (!cancelled && res?.church) {
          setWelcomeCtx(res);
          return;
        }
      } catch {
        // Fallback to local store if offline
        const localTenant = PlatformService.getTenants().find(
          (t) => t.slug === routeSlug || t.id === routeSlug
        );
        if (!cancelled && localTenant) {
          const localAdmin = PlatformService.getUsersForTenant(localTenant.id).find(
            (u) => u.role === 'ADMIN'
          );
          setWelcomeCtx({
            church: {
              id: localTenant.id,
              name: localTenant.name,
              shortName: localTenant.shortName,
              slug: localTenant.slug,
              logoUrl: localTenant.logoUrl,
              city: localTenant.city,
              country: localTenant.country,
            },
            pastorName: localAdmin?.fullName || '',
            pastorEmail: localAdmin?.email || '',
          });
        }
      }
    };

    void loadChurchWelcome();
    return () => {
      cancelled = true;
    };
  }, [routeSlug]);

  // 2. Handle Supabase callbacks:
  //    a) Email invite tap (type=invite): Verify invite & present the Custom Church Login Page (do NOT skip login!)
  //    b) Google OAuth completion: Exchange session token -> take invited pastor to /setup, others to their dashboard
  useEffect(() => {
    const handleSupabaseCallback = async () => {
      const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(location.search);

      const errorCode = hashParams.get('error_code') || queryParams.get('error_code');
      const errorDesc = hashParams.get('error_description') || queryParams.get('error_description');
      if (errorDesc) {
        window.history.replaceState(null, '', window.location.pathname);
        // If an invite link was clicked a second time on /get-started/:slug, the church page still loads cleanly for Google sign-in
        if (errorCode === 'otp_expired' && routeSlug) {
          return;
        }
        setError(errorDesc.replace(/\+/g, ' '));
        return;
      }

      const accessToken = hashParams.get('access_token');
      const tokenHash = queryParams.get('token_hash');
      const callbackType = (queryParams.get('type') || hashParams.get('type') || '') as
        | 'invite'
        | 'magiclink'
        | 'signup'
        | 'email'
        | '';

      if (!accessToken && !tokenHash) return;

      const cameFromGoogleButton = sessionStorage.getItem(INVITE_SESSION_FLAG) === '1';

      // Case A: Pastor just tapped the link in their welcome email (type=invite or token_hash) ->
      // Verify the invite link and show their Custom Church Login Page so they sign in with Google!
      if ((callbackType === 'invite' || Boolean(tokenHash)) && !cameFromGoogleButton) {
        setIsLoading(true);
        setStatusMessage('Preparing your church sign-in page…');
        setError('');
        try {
          const ctx = await apiClient.post<WelcomeChurchContext>(
            '/auth/supabase/invite-context',
            accessToken ? { accessToken, type: 'invite' } : { tokenHash, type: callbackType || 'invite' }
          );
          if (ctx?.church && (!ctx.userRole || ctx.userRole === 'ADMIN')) {
            // Lead Pastor -> show their Custom Church Login Page (/get-started/:slug)
            setWelcomeCtx(ctx);
            window.history.replaceState(
              null,
              '',
              `/get-started/${encodeURIComponent(ctx.church.slug)}`
            );
          } else {
            // Department Head / Team Leader -> stay on the default Login Screen (/login)
            const emailQuery = ctx?.pastorEmail
              ? `?email=${encodeURIComponent(ctx.pastorEmail)}`
              : '';
            window.history.replaceState(null, '', `/login${emailQuery}`);
            navigate(`/login${emailQuery}`, { replace: true });
          }
        } catch (err: unknown) {
          window.history.replaceState(null, '', location.pathname);
          setError(err instanceof Error ? err.message : 'This invite link is invalid or has expired.');
        } finally {
          setIsLoading(false);
          setStatusMessage('');
        }
        return;
      }

      // Case B: Completed Google OAuth sign-in -> exchange token for Open Church JWT
      setIsLoading(true);
      setStatusMessage(
        cameFromGoogleButton || isCustomChurchLogin
          ? 'Signing you in & opening Get Started…'
          : 'Signing you in…'
      );
      setError('');
      try {
        const res = await apiClient.post<{
          token: string;
          user: User;
          tenant?: Tenant | null;
          departments?: Department[];
          users?: User[];
        }>('/auth/supabase/callback', { accessToken });

        if (res?.token && res?.user) {
          sessionStorage.removeItem(INVITE_SESSION_FLAG);
          const syncedUser = completeSupabaseSession(res);
          window.history.replaceState(null, '', window.location.pathname);

          // If logging in from the Pastor's custom church link (or church setup not finished yet), go to Get Started (/setup)
          if (
            syncedUser.role === 'ADMIN' &&
            (cameFromGoogleButton || isCustomChurchLogin || (res.tenant && !res.tenant.setupCompletedAt))
          ) {
            navigate('/setup', { replace: true });
            return;
          }

          navigate(getDefaultRouteForUser(syncedUser, res.tenant), { replace: true });
        }
      } catch (err: unknown) {
        sessionStorage.removeItem(INVITE_SESSION_FLAG);
        window.history.replaceState(null, '', window.location.pathname);
        setError(err instanceof Error ? err.message : 'Supabase Google sign-in failed.');
      } finally {
        setIsLoading(false);
        setStatusMessage('');
      }
    };

    void handleSupabaseCallback();
  }, [location.hash, location.search, location.pathname, isCustomChurchLogin, completeSupabaseSession, navigate]);

  // 3. Initiate live Google OAuth through Supabase via Backend
  const handleContinueWithGoogle = async () => {
    setIsLoading(true);
    setError('');
    try {
      const currentOrigin = window.location.origin;
      const targetEmail = welcomeCtx?.pastorEmail || queryEmail;
      const returnPath = welcomeCtx?.church?.slug
        ? `/get-started/${encodeURIComponent(welcomeCtx.church.slug)}`
        : isCustomChurchLogin
          ? '/get-started'
          : '/login';

      if (isCustomChurchLogin) {
        sessionStorage.setItem(INVITE_SESSION_FLAG, '1');
      } else {
        sessionStorage.removeItem(INVITE_SESSION_FLAG);
      }

      const params = new URLSearchParams({
        origin: currentOrigin,
        next: returnPath,
      });
      if (targetEmail) {
        params.set('loginHint', targetEmail);
      }

      const res = await apiClient.get<{ url: string }>(`/auth/supabase/google-url?${params.toString()}`);
      if (res?.url) {
        window.location.assign(res.url);
        return;
      }
      setError('Could not retrieve Supabase Google sign-in URL from backend.');
      setIsLoading(false);
    } catch (err: unknown) {
      sessionStorage.removeItem(INVITE_SESSION_FLAG);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reach Open Church backend to start Google sign-in.'
      );
      setIsLoading(false);
    }
  };

  const fullChurchName = welcomeCtx?.church?.name || queryChurch || '';
  const shortChurch = welcomeCtx?.church?.shortName?.trim()
    ? welcomeCtx.church.shortName.trim()
    : fullChurchName
      ? churchShortName(fullChurchName, welcomeCtx?.church?.shortName)
      : '';
  const displayLogo = welcomeCtx?.church?.logoUrl || '/logo.jpg';
  const displayEmail = welcomeCtx?.pastorEmail || queryEmail;

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
          {!isCustomChurchLogin && (
            <span className="self-start flex items-center gap-2 pl-1 pr-3.5 py-1 rounded-full bg-[rgba(15,36,24,0.45)] backdrop-blur-[14px] border border-white/20 max-w-full">
              <img
                src="/logo.jpg"
                alt="Open Church"
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
              <span className="text-[13px] font-semibold text-white truncate">Open Church</span>
            </span>
          )}
          <div className="mt-auto flex flex-col gap-2.5 max-w-[560px]">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-church-gold">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {isCustomChurchLogin ? 'Invited by the Network Council' : '1000 Micro Church Network'}
              </span>
            </span>
            <h1 className="font-display text-[36px] md:text-[52px] leading-[1.06] font-bold tracking-[-0.025em] text-white">
              {isCustomChurchLogin ? (
                <>
                  {shortChurch || 'Your church'} is ready.
                  <br />
                  Let’s get you started.
                </>
              ) : (
                <>
                  Welcome back.
                  <br />
                  Let’s shepherd well today.
                </>
              )}
            </h1>
            <p
              className={
                isCustomChurchLogin
                  ? 'text-[15px] md:text-[17px] leading-relaxed text-white/80'
                  : 'hidden md:block text-[17px] leading-relaxed text-white/80'
              }
            >
              Attendance, giving, follow-up and reports for every department — on your phone at the door and at your desk in the office.
            </p>
          </div>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="relative flex-1 -mt-10 md:mt-0 bg-white rounded-t-[32px] md:rounded-none px-6 pt-[32px] pb-[max(48px,env(safe-area-inset-bottom))] md:w-[520px] md:shrink-0 md:flex md:flex-col md:justify-center md:px-16 min-h-[44vh]">
        <div className="flex flex-col gap-[18px] md:gap-[22px] md:max-w-[420px]">
          <img
            src={isCustomChurchLogin ? displayLogo : '/logo.jpg'}
            alt=""
            aria-hidden="true"
            className="hidden md:block w-14 h-14 rounded-full object-cover"
          />
          <div className="flex flex-col gap-1.5">
            {!isCustomChurchLogin && (
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-church-limeSoft text-[12px] font-semibold text-church-emerald">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Google Verified
                </span>
              </div>
            )}
            <h2 className="font-display text-2xl md:text-[34px] font-bold tracking-[-0.01em] md:tracking-[-0.02em] leading-tight">
              {isCustomChurchLogin ? 'Sign in to get started' : 'Sign in with Google'}
            </h2>
            <p className="text-[15px] md:text-base leading-snug text-church-muted">
              {isCustomChurchLogin ? (
                displayEmail ? (
                  <>
                    Use <strong className="font-semibold text-church-text break-all">{displayEmail}</strong> — the Google account the Network Council registered for you.
                  </>
                ) : (
                  <>Use the Google account the Network Council registered for you.</>
                )
              ) : (
                <>
                  Open Church authenticates securely using your Google or ministry account.
                  <span className="hidden md:inline"> Your role comes with your account.</span>
                </>
              )}
            </p>
          </div>

          {statusMessage && (
            <div className="flex gap-2.5 items-center px-3.5 py-3 rounded-[14px] bg-church-limeSoft text-sm font-medium text-[#2F6B0A]">
              <ShieldCheck className="w-[18px] h-[18px] shrink-0" />
              {statusMessage}
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
            {statusMessage
              ? statusMessage
              : isLoading
                ? 'Redirecting to Google…'
                : 'Continue with Google'}
          </button>

          {isCustomChurchLogin ? (
            <p className="m-0 flex items-start gap-2 text-[13px] leading-relaxed text-church-muted">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-church-emerald" />
              <span>Setting up takes about 5 minutes. Your 7-day free trial starts when you finish.</span>
            </p>
          ) : (
            <p className="m-0 text-[13px] leading-relaxed text-church-muted">
              Signs in through Google &amp; Supabase. Your church role and departmental permissions load automatically.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
