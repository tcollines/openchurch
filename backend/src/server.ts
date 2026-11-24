import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { DepartmentCode, SoulStatus, UserRole } from '@prisma/client';
import { prisma } from './lib/prisma';
import {
  requireTenantAuth,
  resolveTargetTenantId,
  signAuthToken,
  TenantRequest,
} from './middleware/tenantAuth';
import {
  checkMarzPayCollectionStatus,
  initiateMarzPayCollection,
  isMarzPayConfigured,
  MarzPayStatusResult,
  normalizeMarzPayTarget,
  parseMarzPayWebhookPayload,
  resolveMarzPayCallbackUrl,
  verifyMarzPayWebhookSignature,
} from './services/marzpayService';

dotenv.config();

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
  .filter((o) => o && o !== '*');

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }
      const normalized = requestOrigin.replace(/\/+$/, '').toLowerCase();
      if (
        allowedOrigins.includes(normalized) ||
        normalized.endsWith('.vercel.app') ||
        normalized.startsWith('http://localhost:')
      ) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(
  express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  })
);

const cleanEnv = (v?: string): string =>
  (v || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, '');

const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL) || 'https://myntqhkgeyxkmxypezvu.supabase.co';
const SUPABASE_ANON_KEY = cleanEnv(process.env.SUPABASE_ANON_KEY);
const SUPABASE_SERVICE_ROLE_KEY = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
const APP_URL = (cleanEnv(process.env.APP_URL) || cleanEnv(process.env.FRONTEND_ORIGIN) || 'http://localhost:5173').replace(/\/$/, '');
const SUPPORT_WHATSAPP = (process.env.SUPPORT_WHATSAPP || '').trim().replace(/^["']+|["']+$/g, '');

function formatSupabaseKeyError(rawMessage: string, key: string): string {
  if (!/invalid api key|not allowed|jwt/i.test(rawMessage)) {
    return rawMessage;
  }
  if (!key || /^your-|^replace-/i.test(key)) {
    return 'SUPABASE_SERVICE_ROLE_KEY on Render still has a placeholder value. Paste your real service_role / sb_secret_ key from Supabase → Project Settings → API Keys.';
  }
  if (key.startsWith('sb_publishable_')) {
    return 'SUPABASE_SERVICE_ROLE_KEY on Render has your public publishable key (sb_publishable_...). Replace it with your Secret key (sb_secret_... or service_role) from Supabase → Project Settings → API Keys.';
  }
  if (/^(re_|SG\.|xkeysib-)/i.test(key)) {
    return 'SUPABASE_SERVICE_ROLE_KEY on Render has an SMTP key instead of your Supabase key. Paste your Supabase Secret / service_role key from Supabase → Project Settings → API Keys.';
  }
  if (key.startsWith('eyJ')) {
    const decoded = jwt.decode(key) as { role?: string; ref?: string } | null;
    if (decoded?.role === 'anon') {
      return 'SUPABASE_SERVICE_ROLE_KEY on Render has the anon public key instead of the service_role secret key. Copy the service_role secret key from Supabase → Project Settings → API Keys.';
    }
    if (decoded?.ref && !SUPABASE_URL.includes(decoded.ref)) {
      return `SUPABASE_SERVICE_ROLE_KEY belongs to project "${decoded.ref}", which does not match SUPABASE_URL.`;
    }
  } else if (!key.startsWith('sb_secret_')) {
    return 'SUPABASE_SERVICE_ROLE_KEY on Render is not a valid Supabase secret key (must start with sb_secret_... or eyJ...). Re-copy it without quotes from Supabase → Project Settings → API Keys.';
  }
  return `${rawMessage} — Re-copy SUPABASE_SERVICE_ROLE_KEY (Secret / service_role key, without quotes) from Supabase → Project Settings → API Keys into Render → Environment.`;
}

function formatSupabaseInviteError(rawMessage: string, recipientEmail: string, key: string): string {
  if (/invalid api key|not allowed|jwt/i.test(rawMessage)) {
    return formatSupabaseKeyError(rawMessage, key);
  }
  if (/rate limit|over_email_send_rate_limit|too many requests/i.test(rawMessage)) {
    return 'Supabase email rate limit reached (default built-in SMTP only sends 2 emails/hour). Enable Custom SMTP in Supabase → Authentication → SMTP Settings to email all department heads.';
  }
  if (/not authorized|email_address_not_authorized/i.test(rawMessage)) {
    return `Supabase default SMTP only delivers emails to members of your Supabase organization (${recipientEmail} is an external address). Enable Custom SMTP in Supabase → Authentication → SMTP Settings.`;
  }
  return rawMessage;
}

function resolveFrontendOrigin(req: express.Request): string {
  const refererOrigin = (() => {
    const ref = typeof req.headers.referer === 'string' ? req.headers.referer.trim() : '';
    if (!ref) return '';
    try {
      return new URL(ref).origin;
    } catch {
      return '';
    }
  })();

  const candidates = [
    typeof req.headers.origin === 'string' ? req.headers.origin : '',
    refererOrigin,
    cleanEnv(process.env.APP_URL),
    cleanEnv(process.env.FRONTEND_ORIGIN),
    'https://openchurchms.vercel.app',
  ];

  for (const c of candidates) {
    const normalized = c.trim().replace(/\/+$/, '');
    if (
      normalized &&
      !normalized.includes('onrender.com') &&
      !normalized.includes('localhost:')
    ) {
      return normalized;
    }
  }

  for (const c of candidates) {
    const normalized = c.trim().replace(/\/+$/, '');
    if (normalized && !normalized.includes('onrender.com')) {
      return normalized;
    }
  }

  return 'https://openchurchms.vercel.app';
}

async function clearUnconfirmedSupabaseAuthUser(email: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const rows = await prisma.$queryRawUnsafe<
      { id: string; email_confirmed_at: Date | null; last_sign_in_at: Date | null }[]
    >(
      'SELECT id, email_confirmed_at, last_sign_in_at FROM auth.users WHERE lower(email) = $1 LIMIT 1',
      email.trim().toLowerCase()
    );
    const existingAuth = rows?.[0];
    if (existingAuth && !existingAuth.email_confirmed_at && !existingAuth.last_sign_in_at) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(existingAuth.id);
      return !error;
    }
  } catch (err) {
    console.warn('[Invite] Could not inspect auth.users for re-invite:', err);
  }
  return false;
}

const supabase = SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export interface PastorInviteResult {
  sent: boolean;
  status: 'INVITE_SENT' | 'MAGIC_LINK_SENT' | 'MISSING_SERVICE_KEY' | 'FAILED';
  recipientEmail: string;
  welcomeUrl: string;
  message: string;
}

async function sendPastorVerificationInvite(params: {
  pastorName: string;
  pastorEmail: string;
  churchName: string;
  tenantId: string;
  tenantSlug: string;
  trialEndsAt: Date;
  appOrigin?: string;
}): Promise<PastorInviteResult> {
  const recipientEmail = params.pastorEmail.trim().toLowerCase();
  const baseAppUrl = (params.appOrigin?.trim() || APP_URL).replace(/\/+$/, '');
  const redirectTo = `${baseAppUrl}/get-started/${encodeURIComponent(params.tenantSlug)}`;

  if (!supabaseAdmin) {
    return {
      sent: false,
      status: 'MISSING_SERVICE_KEY',
      recipientEmail,
      welcomeUrl: redirectTo,
      message:
        'SUPABASE_SERVICE_ROLE_KEY is not set in backend/.env yet. Add your Supabase service_role key to send verification emails.',
    };
  }

  const trialEndsFormatted = params.trialEndsAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const metadata: Record<string, string> = {
    invite_type: 'PASTOR',
    full_name: params.pastorName.trim(),
    church_name: params.churchName.trim(),
    trial_ends: trialEndsFormatted,
    tenant_id: params.tenantId,
    tenant_slug: params.tenantSlug,
    welcome_url: redirectTo,
    role: 'ADMIN',
  };
  if (SUPPORT_WHATSAPP.trim()) {
    metadata.support_whatsapp = SUPPORT_WHATSAPP.trim();
  }

  let { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(recipientEmail, {
    redirectTo,
    data: metadata,
  });

  if (inviteErr && /already|registered|exists/i.test(inviteErr.message)) {
    const cleared = await clearUnconfirmedSupabaseAuthUser(recipientEmail);
    if (cleared) {
      const retry = await supabaseAdmin.auth.admin.inviteUserByEmail(recipientEmail, {
        redirectTo,
        data: metadata,
      });
      inviteErr = retry.error;
    }
  }

  if (!inviteErr) {
    return {
      sent: true,
      status: 'INVITE_SENT',
      recipientEmail,
      welcomeUrl: redirectTo,
      message: `Verification & welcome link sent to ${recipientEmail}.`,
    };
  }

  // If the pastor already confirmed & signed in before, send an OTP / sign-in verification link instead
  if (/already|registered|exists/i.test(inviteErr.message)) {
    const authClient = supabase || supabaseAdmin;
    const { error: otpErr } = await authClient.auth.signInWithOtp({
      email: recipientEmail,
      options: {
        emailRedirectTo: redirectTo,
        data: metadata,
      },
    });
    if (!otpErr) {
      return {
        sent: true,
        status: 'MAGIC_LINK_SENT',
        recipientEmail,
        welcomeUrl: redirectTo,
        message: `${recipientEmail} is already verified in Supabase Auth — sent a fresh sign-in link.`,
      };
    }
    return {
      sent: false,
      status: 'FAILED',
      recipientEmail,
      welcomeUrl: redirectTo,
      message: formatSupabaseInviteError(otpErr.message, recipientEmail, SUPABASE_SERVICE_ROLE_KEY),
    };
  }

  return {
    sent: false,
    status: 'FAILED',
    recipientEmail,
    welcomeUrl: redirectTo,
    message: formatSupabaseInviteError(inviteErr.message, recipientEmail, SUPABASE_SERVICE_ROLE_KEY),
  };
}

const ROLE_TITLES: Record<UserRole, string> = {
  PLATFORM_ADMIN: 'Network Council',
  ADMIN: 'Church Administrator',
  FINANCE_HOD: 'Head of Finance',
  FINANCE_OFFICER: 'Finance Officer',
  BACENTA_HOD: 'Head of Bacentas',
  BACENTA_LEADER: 'Bacenta Leader',
  AIRPORT_HOD: 'Head of Airport Stars',
  AIRPORT_MEMBER: 'Airport Stars Check-In',
  TELE_HOD: 'Head of Tele Pastoring',
  TELE_PASTOR: 'Tele Pastor',
  CHILDREN_HOD: "Head of Children's Church",
  CHILDREN_WORKER: "Children's Church Team",
  CAMPUS_HOD: 'Head of Campuses',
  CAMPUS_LEADER: 'Campus Leader',
};

async function sendDepartmentLeaderInvite(params: {
  fullName: string;
  email: string;
  churchName: string;
  departmentName?: string;
  role: UserRole;
  tenantId: string;
  appOrigin?: string;
}): Promise<{ sent: boolean; recipientEmail: string; signInUrl: string; message: string }> {
  const recipientEmail = params.email.trim().toLowerCase();
  const baseAppUrl = (params.appOrigin?.trim() || APP_URL).replace(/\/+$/, '');
  // Clean path without query params so Supabase Redirect URL allowlist always matches
  const redirectTo = `${baseAppUrl}/login`;
  const signInUrl = `${baseAppUrl}/login?email=${encodeURIComponent(recipientEmail)}`;

  if (!supabaseAdmin) {
    return {
      sent: false,
      recipientEmail,
      signInUrl,
      message: 'SUPABASE_SERVICE_ROLE_KEY not configured on backend server.',
    };
  }

  const metadata: Record<string, string> = {
    invite_type: 'HOD',
    full_name: params.fullName.trim(),
    church_name: params.churchName.trim(),
    role_label: ROLE_TITLES[params.role] || 'Department Head',
    tenant_id: params.tenantId,
    role: params.role,
  };
  if (params.departmentName) {
    metadata.department_name = params.departmentName;
  }
  if (SUPPORT_WHATSAPP.trim()) {
    metadata.support_whatsapp = SUPPORT_WHATSAPP.trim();
  }

  let { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(recipientEmail, {
    redirectTo,
    data: metadata,
  });

  if (inviteErr && /already|registered|exists/i.test(inviteErr.message)) {
    const cleared = await clearUnconfirmedSupabaseAuthUser(recipientEmail);
    if (cleared) {
      const retry = await supabaseAdmin.auth.admin.inviteUserByEmail(recipientEmail, {
        redirectTo,
        data: metadata,
      });
      inviteErr = retry.error;
    }
  }

  if (!inviteErr) {
    console.log(`[Invite] Department head invite dispatched to ${recipientEmail} (${metadata.role_label})`);
    return {
      sent: true,
      recipientEmail,
      signInUrl,
      message: `Invite email sent to ${recipientEmail}`,
    };
  }

  if (/already|registered|exists/i.test(inviteErr.message)) {
    const authClient = supabase || supabaseAdmin;
    const { error: otpErr } = await authClient.auth.signInWithOtp({
      email: recipientEmail,
      options: { emailRedirectTo: redirectTo, data: metadata },
    });
    if (!otpErr) {
      console.log(`[Invite] Department head sign-in link dispatched to ${recipientEmail}`);
      return {
        sent: true,
        recipientEmail,
        signInUrl,
        message: `Sign-in link sent to ${recipientEmail}`,
      };
    }
    const formattedOtpErr = formatSupabaseInviteError(
      otpErr.message,
      recipientEmail,
      SUPABASE_SERVICE_ROLE_KEY
    );
    console.warn(`[Invite] OTP failed for ${recipientEmail}: ${otpErr.message}`);
    return { sent: false, recipientEmail, signInUrl, message: formattedOtpErr };
  }

  const formattedErr = formatSupabaseInviteError(
    inviteErr.message,
    recipientEmail,
    SUPABASE_SERVICE_ROLE_KEY
  );
  console.warn(`[Invite] Invite failed for ${recipientEmail}: ${inviteErr.message}`);
  return { sent: false, recipientEmail, signInUrl, message: formattedErr };
}

const CORE_DEPARTMENTS: { code: DepartmentCode; name: string; description: string }[] = [
  {
    code: 'ADMIN',
    name: 'Administration',
    description: 'Overall church oversight, attendance %, budgets, finance & serving members',
  },
  {
    code: 'FINANCE',
    name: 'Finance Department',
    description: 'Per-service Offertory, Tithe, Partner-linked Partnership & payouts',
  },
  {
    code: 'BACENTA',
    name: 'Bacenta Ministry',
    description: 'Micro-church home fellowships, outreach reports, attendance & meeting offerings',
  },
  {
    code: 'AIRPORT_STARS',
    name: 'Airport Stars',
    description: 'Service creation, rapid member check-in & first-timer registration',
  },
  {
    code: 'TELE_PASTORING',
    name: 'Tele Pastoring',
    description: '3-missed-services retention, physical/phone reachouts & 4-week soul care',
  },
  {
    code: 'CHILDRENS_CHURCH',
    name: "Children's Church",
    description: 'Service check-in, child salvations & 3-missed-services guardian follow-up',
  },
  {
    code: 'CAMPUSES',
    name: 'Campuses Ministry',
    description: 'University & school campus fellowships, outreach reports & offerings',
  },
];

// ─── 1. HEALTH CHECK (PRISMA <-> SUPABASE POSTGRESQL) ─────────────────────────

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      orm: 'Prisma',
      database: 'Supabase PostgreSQL Connected',
    });
  } catch (err: unknown) {
    res.status(503).json({
      status: 'degraded',
      orm: 'Prisma',
      error: err instanceof Error ? err.message : 'Database connection failed',
    });
  }
});

// ─── 2. AUTHENTICATION (BACKEND-ONLY JWT + PRISMA + SUPABASE GOOGLE OAUTH) ───

// Verify Supabase-issued JWT via /auth/v1/user (if API key present) or Supabase public JWKS (ES256)
async function verifySupabaseAccessToken(accessToken: string): Promise<{
  email: string;
  avatarUrl: string;
  fullName: string;
} | null> {
  const apiKey = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
  if (apiKey) {
    try {
      const sbRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: apiKey,
        },
      });
      if (sbRes.ok) {
        const sbUser = (await sbRes.json()) as {
          email?: string;
          user_metadata?: { full_name?: string; avatar_url?: string };
        };
        if (sbUser.email) {
          return {
            email: sbUser.email,
            avatarUrl: sbUser.user_metadata?.avatar_url || '',
            fullName: sbUser.user_metadata?.full_name || '',
          };
        }
      }
    } catch {
      // Fall through to cryptographic JWKS verification
    }
  }

  // Cryptographic verification against Supabase Auth's public JWKS endpoint (works without SUPABASE_ANON_KEY)
  const decodedHeader = jwt.decode(accessToken, { complete: true }) as {
    header?: { kid?: string; alg?: string };
  } | null;
  if (!decodedHeader?.header) return null;

  const jwksRes = await fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
  if (!jwksRes.ok) return null;

  const jwks = (await jwksRes.json()) as { keys?: (crypto.JsonWebKey & { kid?: string })[] };
  const matchingJwk =
    jwks.keys?.find((k) => !decodedHeader.header?.kid || k.kid === decodedHeader.header.kid) ||
    jwks.keys?.[0];
  if (!matchingJwk) return null;

  const publicKey = crypto.createPublicKey({ key: matchingJwk, format: 'jwk' });
  const verifiedPayload = jwt.verify(accessToken, publicKey, {
    algorithms: ['ES256', 'RS256'],
    issuer: `${SUPABASE_URL}/auth/v1`,
  }) as {
    email?: string;
    user_metadata?: { full_name?: string; avatar_url?: string; picture?: string; name?: string };
  };

  if (!verifiedPayload?.email) return null;
  return {
    email: verifiedPayload.email,
    avatarUrl:
      verifiedPayload.user_metadata?.avatar_url ||
      verifiedPayload.user_metadata?.picture ||
      '',
    fullName:
      verifiedPayload.user_metadata?.full_name ||
      verifiedPayload.user_metadata?.name ||
      '',
  };
}

// Public church welcome metadata for the custom Pastor login page (/get-started/:slug)
app.get('/api/public/welcome/:slug', async (req, res) => {
  try {
    const slugParam = String(req.params.slug || '').trim().toLowerCase();
    if (!slugParam) {
      res.status(400).json({ error: 'Missing church identifier' });
      return;
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ slug: slugParam }, ...(slugParam.length === 36 ? [{ id: slugParam }] : [])],
      },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const pastorUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: 'ADMIN', isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { fullName: true, email: true },
    });

    res.json({
      church: {
        id: tenant.id,
        name: tenant.name,
        shortName: tenant.shortName,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        city: tenant.city,
        country: tenant.country,
      },
      pastorName: pastorUser?.fullName || '',
      pastorEmail: pastorUser?.email || '',
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed loading church welcome details',
    });
  }
});

// Resolve church & pastor details when a pastor taps the Supabase email invite link (shows custom church login page)
app.post('/api/auth/supabase/invite-context', async (req, res) => {
  try {
    const { accessToken, tokenHash, type } = req.body as {
      accessToken?: string;
      tokenHash?: string;
      type?: 'invite' | 'magiclink' | 'signup' | 'email';
    };

    let sbEmail = '';
    if (tokenHash) {
      const authClient = supabase || supabaseAdmin;
      if (!authClient) {
        res.status(500).json({ error: 'Supabase API keys are not configured on backend.' });
        return;
      }
      const { data, error } = await authClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: type || 'invite',
      });
      if (error || !data?.user?.email) {
        res.status(401).json({ error: error?.message || 'Invite link is invalid or expired.' });
        return;
      }
      sbEmail = data.user.email;
    } else if (accessToken) {
      const verified = await verifySupabaseAccessToken(accessToken);
      if (!verified?.email) {
        res.status(401).json({ error: 'Invalid or expired invite link.' });
        return;
      }
      sbEmail = verified.email;
    } else {
      res.status(400).json({ error: 'Missing invite token' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: sbEmail.toLowerCase() },
      include: { tenant: true },
    });

    if (!user || !user.tenant) {
      res.status(404).json({ error: 'No church is linked to this invite email.' });
      return;
    }

    res.json({
      church: {
        id: user.tenant.id,
        name: user.tenant.name,
        shortName: user.tenant.shortName,
        slug: user.tenant.slug,
        logoUrl: user.tenant.logoUrl,
        city: user.tenant.city,
        country: user.tenant.country,
      },
      pastorName: user.fullName,
      pastorEmail: user.email,
      userRole: user.role,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed resolving church invite link',
    });
  }
});

// Retrieve Supabase-hosted Google OAuth initiation URL
app.get('/api/auth/supabase/google-url', (req, res) => {
  const queryOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
  const nextPath =
    typeof req.query.next === 'string' && req.query.next.startsWith('/')
      ? req.query.next
      : '/login';
  const loginHint = typeof req.query.loginHint === 'string' ? req.query.loginHint.trim() : '';
  const origin = (
    queryOrigin ||
    req.headers.origin ||
    process.env.APP_URL ||
    process.env.FRONTEND_ORIGIN ||
    'http://localhost:5173'
  ).replace(/\/+$/, '');
  const redirectUrl = `${origin}${nextPath}`;
  const hintParam = loginHint ? `&login_hint=${encodeURIComponent(loginHint)}` : '';
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}&prompt=select_account${hintParam}`;
  res.json({ url });
});

// Exchange Supabase Auth access token or email invite token_hash for church session
app.post('/api/auth/supabase/callback', async (req, res) => {
  try {
    const { accessToken, tokenHash, type } = req.body as {
      accessToken?: string;
      tokenHash?: string;
      type?: 'invite' | 'magiclink' | 'signup' | 'email';
    };

    let sbEmail = '';
    let sbAvatarUrl = '';

    if (tokenHash) {
      const authClient = supabase || supabaseAdmin;
      if (!authClient) {
        res.status(500).json({
          error: 'Supabase API keys are not configured in backend/.env yet.',
        });
        return;
      }
      const { data, error } = await authClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: type || 'invite',
      });
      if (error || !data?.user?.email) {
        res.status(401).json({
          error: error?.message || 'Verification link is invalid or has expired.',
        });
        return;
      }
      sbEmail = data.user.email;
      sbAvatarUrl = data.user.user_metadata?.avatar_url || '';
    } else if (accessToken) {
      const verified = await verifySupabaseAccessToken(accessToken);
      if (!verified) {
        res.status(401).json({ error: 'Invalid or expired Supabase authentication token' });
        return;
      }
      sbEmail = verified.email;
      sbAvatarUrl = verified.avatarUrl;
    } else {
      res.status(400).json({ error: 'Supabase access token or verification token_hash is required' });
      return;
    }

    const verifiedEmail = sbEmail.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: verifiedEmail },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      res.status(404).json({
        error: `Account (${verifiedEmail}) was verified via Supabase, but is not registered in Open Church.`,
        email: verifiedEmail,
      });
      return;
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      res.status(403).json({ error: 'This church tenant is currently suspended' });
      return;
    }

    const [departments, tenantUsers] = user.tenantId
      ? await Promise.all([
          prisma.department.findMany({ where: { tenantId: user.tenantId } }),
          prisma.user.findMany({
            where: { tenantId: user.tenantId },
            select: {
              id: true,
              tenantId: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              role: true,
              departmentId: true,
              fellowshipUnitId: true,
              isActive: true,
              createdAt: true,
            },
          }),
        ])
      : [[], []];

    const token = signAuthToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    const { passwordHash: _pw, tenant, ...safeUser } = user;
    void _pw;

    res.json({
      token,
      user: safeUser,
      tenant: tenant ? { ...tenant, monthlyFee: Number(tenant.monthlyFee) } : null,
      departments,
      users: tenantUsers,
      googlePicture: sbAvatarUrl,
      supabaseLinked: true,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Supabase authentication failed',
    });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, email } = req.body as { credential?: string; email?: string };
    let verifiedEmail = email?.trim().toLowerCase();
    let googleProfileName = '';
    let googleProfilePicture = '';

    if (credential) {
      // 1. If Supabase is configured with an anon key, link credential into Supabase Auth
      if (supabase) {
        try {
          const { data: sbData, error: sbErr } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: credential,
          });
          if (!sbErr && sbData?.user?.email) {
            verifiedEmail = sbData.user.email.toLowerCase();
            googleProfileName = sbData.user.user_metadata?.full_name || '';
            googleProfilePicture = sbData.user.user_metadata?.avatar_url || '';
          }
        } catch (sbErr) {
          console.warn('Supabase ID token notice:', sbErr);
        }
      }

      // 2. Fallback / direct Google Identity verification
      if (!verifiedEmail) {
        const googleRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        if (!googleRes.ok) {
          res.status(401).json({ error: 'Invalid Google authentication token' });
          return;
        }
        const tokenInfo = (await googleRes.json()) as {
          email?: string;
          email_verified?: string | boolean;
          name?: string;
          picture?: string;
          aud?: string;
        };

        if (!tokenInfo.email || (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true)) {
          res.status(401).json({ error: 'Google email address is not verified' });
          return;
        }

        const expectedClientId = process.env.GOOGLE_CLIENT_ID;
        if (expectedClientId && tokenInfo.aud !== expectedClientId) {
          res.status(401).json({ error: 'Google token audience mismatch' });
          return;
        }

        verifiedEmail = tokenInfo.email.toLowerCase();
        googleProfileName = tokenInfo.name || '';
        googleProfilePicture = tokenInfo.picture || '';
      }
    }

    if (!verifiedEmail) {
      res.status(400).json({ error: 'No Google email was provided or resolved' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: verifiedEmail },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      res.status(404).json({
        error: `No Open Church account is linked to Google account (${verifiedEmail}). Ask your church administrator to assign your department role.`,
        email: verifiedEmail,
        googleName: googleProfileName,
      });
      return;
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      res.status(403).json({ error: 'This church tenant is currently suspended' });
      return;
    }

    const [departments, tenantUsers] = user.tenantId
      ? await Promise.all([
          prisma.department.findMany({ where: { tenantId: user.tenantId } }),
          prisma.user.findMany({
            where: { tenantId: user.tenantId },
            select: {
              id: true,
              tenantId: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              role: true,
              departmentId: true,
              fellowshipUnitId: true,
              isActive: true,
              createdAt: true,
            },
          }),
        ])
      : [[], []];

    const token = signAuthToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    const { passwordHash: _pw, tenant, ...safeUser } = user;
    void _pw;

    res.json({
      token,
      user: safeUser,
      tenant: tenant ? { ...tenant, monthlyFee: Number(tenant.monthlyFee) } : null,
      departments,
      users: tenantUsers,
      googlePicture: googleProfilePicture,
      supabaseLinked: true,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Google authentication failed',
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email?.trim()) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      res.status(403).json({ error: 'This church tenant is currently suspended' });
      return;
    }

    // Validate password if supplied; allow dev/prototype quick login if password omitted
    const validPassword = password
      ? await bcrypt.compare(password, user.passwordHash)
      : process.env.NODE_ENV !== 'production';
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signAuthToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    const { passwordHash: _pw, tenant, ...safeUser } = user;
    void _pw;

    res.json({
      token,
      user: safeUser,
      tenant,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Authentication failed',
    });
  }
});

// ─── 3. MULTI-TENANT BOOTSTRAP SNAPSHOT ───────────────────────────────────────

app.get('/api/bootstrap', requireTenantAuth, async (req: TenantRequest, res) => {
  try {
    const isPlatform = req.userRole === 'PLATFORM_ADMIN';
    const tenantFilter = isPlatform
      ? req.query.tenantId
        ? { tenantId: String(req.query.tenantId) }
        : {}
      : { tenantId: req.tenantId! };

    const [
      tenants,
      departments,
      users,
      members,
      children,
      servingMembers,
      services,
      serviceAttendance,
      childAttendance,
      partners,
      deptContributions,
      workplansRaw,
      requisitionsRaw,
      financeTransactions,
      fellowshipUnits,
      fellowshipMeetings,
      fellowshipMeetingAttendance,
      fellowshipOutreaches,
      teleReachouts,
      absenteeFollowups,
      soulsWon,
      soulFollowupWeeks,
      subscriptionPaymentsRaw,
    ] = await Promise.all([
      isPlatform
        ? prisma.tenant.findMany({ orderBy: { name: 'asc' } })
        : prisma.tenant.findMany({ where: { id: req.tenantId! } }),
      prisma.department.findMany({ where: tenantFilter }),
      prisma.user.findMany({
        where: isPlatform ? {} : { tenantId: req.tenantId! },
        select: {
          id: true,
          tenantId: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          role: true,
          departmentId: true,
          fellowshipUnitId: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.member.findMany({ where: tenantFilter }),
      prisma.child.findMany({ where: tenantFilter }),
      prisma.servingMember.findMany({ where: tenantFilter }),
      prisma.service.findMany({ where: tenantFilter, orderBy: { serviceDate: 'desc' } }),
      prisma.serviceAttendance.findMany({ where: tenantFilter }),
      prisma.childAttendance.findMany({ where: tenantFilter }),
      prisma.partner.findMany({ where: tenantFilter }),
      prisma.deptContribution.findMany({ where: tenantFilter }),
      prisma.workplan.findMany({ where: tenantFilter, include: { items: true } }),
      prisma.requisition.findMany({ where: tenantFilter }),
      prisma.financeTransaction.findMany({ where: tenantFilter }),
      prisma.fellowshipUnit.findMany({ where: tenantFilter }),
      prisma.fellowshipMeeting.findMany({ where: tenantFilter }),
      prisma.fellowshipMeetingAttendance.findMany({ where: tenantFilter }),
      prisma.fellowshipOutreach.findMany({ where: tenantFilter }),
      prisma.teleReachout.findMany({ where: tenantFilter }),
      prisma.absenteeFollowup.findMany({ where: tenantFilter }),
      prisma.soulWon.findMany({ where: tenantFilter }),
      prisma.soulFollowupWeek.findMany({ where: tenantFilter }),
      prisma.subscriptionPayment.findMany({
        where: tenantFilter,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const requisitions = requisitionsRaw.map((r) => ({
      ...r,
      items: Array.isArray(r.itemsJson) ? r.itemsJson : [],
    }));

    const subscriptionPayments = subscriptionPaymentsRaw.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));

    res.json({
      tenants: tenants.map((t) => ({ ...t, monthlyFee: Number(t.monthlyFee) })),
      departments,
      users,
      members,
      children,
      servingMembers,
      services,
      serviceAttendance,
      childAttendance,
      partners,
      deptContributions,
      workplans: workplansRaw,
      requisitions,
      financeTransactions,
      fellowshipUnits,
      fellowshipMeetings,
      fellowshipMeetingAttendance,
      fellowshipOutreaches,
      teleReachouts,
      absenteeFollowups,
      soulsWon,
      soulFollowupWeeks,
      subscriptionPayments,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed loading tenant bootstrap data',
    });
  }
});

// ─── 4. PLATFORM COUNCIL: TENANT PROVISIONING ─────────────────────────────────

const HOD_ROLE_BY_DEPT: Partial<Record<DepartmentCode, UserRole>> = {
  ADMIN: 'ADMIN',
  FINANCE: 'FINANCE_HOD',
  BACENTA: 'BACENTA_HOD',
  AIRPORT_STARS: 'AIRPORT_HOD',
  TELE_PASTORING: 'TELE_HOD',
  CHILDRENS_CHURCH: 'CHILDREN_HOD',
  CAMPUSES: 'CAMPUS_HOD',
};

app.post('/api/platform/tenants', requireTenantAuth, async (req: TenantRequest, res) => {
  if (req.userRole !== 'PLATFORM_ADMIN') {
    res.status(403).json({ error: 'Platform Council access required' });
    return;
  }

  try {
    const {
      name,
      slug,
      logoUrl,
      currency,
      city,
      country,
      adminName,
      adminEmail,
      adminPhone,
      adminPassword,
      leadPastor,
      departmentHeads,
      shortName,
      address,
      phone,
      email,
      timezone,
      launchDate,
    } = req.body as {
      shortName?: string;
      address?: string;
      phone?: string;
      email?: string;
      timezone?: string;
      launchDate?: string;
      name: string;
      slug?: string;
      logoUrl?: string;
      currency?: string;
      city?: string;
      country?: string;
      adminName: string;
      adminEmail: string;
      adminPhone?: string;
      adminPassword?: string;
      leadPastor?: { name: string; email: string; phone?: string } | null;
      departmentHeads?: { code: DepartmentCode; name: string; email: string; phone?: string }[];
    };

    const passwordHash = await bcrypt.hash(adminPassword || 'openchurch123', 10);
    const normalizedSlug = String(slug || name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: String(name).trim(),
          slug: normalizedSlug || `church-${Date.now().toString(36)}`,
          logoUrl: logoUrl || '/logo.jpg',
          currency: currency || 'UGX',
          city: city || '',
          country: country || '',
          status: 'ACTIVE',
          subscriptionStatus: 'TRIALING',
          monthlyFee: 50000,
          trialEndsAt,
          shortName: shortName?.trim() || null,
          address: address?.trim() || null,
          phone: phone?.trim() || null,
          email: email?.trim().toLowerCase() || null,
          timezone: timezone || null,
          launchDate: launchDate || null,
        },
      });

      await tx.department.createMany({
        data: CORE_DEPARTMENTS.map((d) => ({
          tenantId: tenant.id,
          code: d.code,
          name: d.name,
          description: d.description,
        })),
      });

      const departments = await tx.department.findMany({
        where: { tenantId: tenant.id },
      });

      const adminDept = departments.find((d) => d.code === 'ADMIN')!;
      const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();

      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          fullName: String(adminName).trim(),
          email: normalizedAdminEmail,
          passwordHash,
          phoneNumber: adminPhone || '',
          role: 'ADMIN',
          departmentId: adminDept.id,
        },
      });

      const seenEmails = new Set<string>([normalizedAdminEmail]);
      const createdUsers = [adminUser];

      // Create separate Lead Pastor account if distinct from Church Administrator
      if (leadPastor?.name?.trim() && leadPastor?.email?.trim()) {
        const pEmail = leadPastor.email.trim().toLowerCase();
        if (!seenEmails.has(pEmail)) {
          seenEmails.add(pEmail);
          const pastorUser = await tx.user.create({
            data: {
              tenantId: tenant.id,
              fullName: leadPastor.name.trim(),
              email: pEmail,
              passwordHash,
              phoneNumber: leadPastor.phone || '',
              role: 'ADMIN',
              departmentId: adminDept.id,
            },
          });
          createdUsers.push(pastorUser);
        }
      }

      // Create optional Department Heads (HODs)
      if (Array.isArray(departmentHeads)) {
        for (const h of departmentHeads) {
          const hEmail = h.email?.trim().toLowerCase();
          const hDept = departments.find((d) => d.code === h.code);
          const hRole = HOD_ROLE_BY_DEPT[h.code];
          if (h.name?.trim() && hEmail && !seenEmails.has(hEmail) && hDept && hRole) {
            seenEmails.add(hEmail);
            const hodUser = await tx.user.create({
              data: {
                tenantId: tenant.id,
                fullName: h.name.trim(),
                email: hEmail,
                passwordHash,
                phoneNumber: h.phone || '',
                role: hRole,
                departmentId: hDept.id,
              },
            });
            createdUsers.push(hodUser);
          }
        }
      }

      return { tenant, departments, adminUser, users: createdUsers };
    });

    // Send Supabase verification / welcome link (invite-welcome.html) to the Lead Pastor
    const pastorTarget =
      leadPastor?.email?.trim() && leadPastor?.name?.trim()
        ? { name: leadPastor.name.trim(), email: leadPastor.email.trim() }
        : { name: String(adminName).trim(), email: String(adminEmail).trim() };

    const reqOrigin = resolveFrontendOrigin(req);

    const verification = await sendPastorVerificationInvite({
      pastorName: pastorTarget.name,
      pastorEmail: pastorTarget.email,
      churchName: result.tenant.name,
      tenantId: result.tenant.id,
      tenantSlug: result.tenant.slug,
      trialEndsAt: result.tenant.trialEndsAt,
      appOrigin: reqOrigin,
    });

    // Also dispatch department invite emails to any separate Administrator or Department Heads added upfront
    const otherLeaders = result.users.filter(
      (u) => u.email.toLowerCase() !== pastorTarget.email.toLowerCase()
    );
    await Promise.allSettled(
      otherLeaders.map((leader) => {
        const dept = result.departments.find((d) => d.id === leader.departmentId);
        return sendDepartmentLeaderInvite({
          fullName: leader.fullName,
          email: leader.email,
          churchName: result.tenant.name,
          departmentName: dept?.name,
          role: leader.role,
          tenantId: result.tenant.id,
          appOrigin: reqOrigin,
        });
      })
    );

    const sanitizeUser = (u: typeof result.adminUser) => {
      const { passwordHash: _pw, ...safe } = u;
      void _pw;
      return safe;
    };

    res.status(201).json({
      tenant: {
        ...result.tenant,
        monthlyFee: Number(result.tenant.monthlyFee),
      },
      departments: result.departments,
      adminUser: sanitizeUser(result.adminUser),
      users: result.users.map(sanitizeUser),
      verification,
    });
  } catch (err: unknown) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed provisioning church tenant',
    });
  }
});

app.post(
  '/api/platform/tenants/:id/resend-invite',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    if (req.userRole !== 'PLATFORM_ADMIN') {
      res.status(403).json({ error: 'Platform Council access required' });
      return;
    }

    try {
      const tenantId = String(req.params.id);
      const { email } = (req.body || {}) as { email?: string };

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        res.status(404).json({ error: 'Church tenant not found' });
        return;
      }

      const targetUser = email?.trim()
        ? await prisma.user.findFirst({
            where: { tenantId, email: email.trim().toLowerCase() },
          })
        : await prisma.user.findFirst({
            where: { tenantId, role: 'ADMIN' },
            orderBy: { createdAt: 'asc' },
          });

      if (!targetUser) {
        res.status(404).json({ error: 'No pastor or administrator login found for this church' });
        return;
      }

      const reqOrigin =
        (req.headers.origin as string | undefined) ||
        (req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : undefined);

      const verification = await sendPastorVerificationInvite({
        pastorName: targetUser.fullName,
        pastorEmail: targetUser.email,
        churchName: tenant.name,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        trialEndsAt: tenant.trialEndsAt,
        appOrigin: reqOrigin,
      });

      res.json({ verification });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed resending verification invite',
      });
    }
  }
);

app.patch(
  '/api/platform/tenants/:id/toggle',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    if (req.userRole !== 'PLATFORM_ADMIN') {
      res.status(403).json({ error: 'Platform Council access required' });
      return;
    }
    const existing = await prisma.tenant.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const updated = await prisma.tenant.update({
      where: { id: existing.id },
      data: { status: existing.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
    });
    res.json({ data: updated });
  }
);

// Network Council records a bank transfer, MoMo Pay code or cash payment and unlocks the church.
app.post(
  '/api/platform/tenants/:id/payments',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    if (req.userRole !== 'PLATFORM_ADMIN') {
      res.status(403).json({ error: 'Platform Council access required' });
      return;
    }
    try {
      const tenantId = String(req.params.id);
      const { months, method, referenceNumber, paidOn } = (req.body || {}) as {
        months?: number;
        method?: string;
        referenceNumber?: string;
        paidOn?: string;
      };
      const count = Math.min(12, Math.max(1, Math.floor(Number(months) || 1)));
      const METHODS = ['MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'CASH'];
      const paymentMethod = METHODS.includes(String(method)) ? String(method) : 'BANK_TRANSFER';
      const ref = (referenceNumber || '').trim() || `MANUAL-${Date.now().toString(36).toUpperCase()}`;

      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) throw Object.assign(new Error('Church not found'), { status: 404 });
        const dup = await tx.subscriptionPayment.findFirst({ where: { referenceNumber: ref } });
        if (dup) throw Object.assign(new Error('That reference has already been recorded'), { status: 409 });

        const { periodStart } = computeNextSubscriptionWindow(tenant);
        let periodEnd = periodStart;
        for (let i = 0; i < count; i++) periodEnd = addOneCalendarMonth(periodEnd);
        const paidAt = paidOn && !isNaN(new Date(paidOn).getTime()) ? new Date(paidOn) : new Date();

        const payment = await tx.subscriptionPayment.create({
          data: {
            tenantId,
            amount: Number(tenant.monthlyFee) * count,
            currency: tenant.currency || 'UGX',
            paymentMethod,
            referenceNumber: ref,
            phoneOrAccount: '',
            status: 'COMPLETED',
            periodStart,
            periodEnd,
            recordedBy: req.userId ?? null,
            completedAt: paidAt,
            createdAt: paidAt,
          },
        });
        const updated = await tx.tenant.update({
          where: { id: tenantId },
          data: { subscriptionStatus: 'ACTIVE', status: 'ACTIVE', subscriptionEndsAt: periodEnd, lastPaidAt: paidAt },
        });
        return { payment, tenant: updated };
      });

      res.status(201).json({
        payment: serializeSubscriptionPayment(result.payment),
        tenant: { ...result.tenant, monthlyFee: Number(result.tenant.monthlyFee) },
      });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      res.status(status).json({ error: err instanceof Error ? err.message : 'Could not record the payment' });
    }
  }
);

// ─── 4b. GET STARTED: a new church's pastor finishes setting up ──────────────

const requireChurchAdmin = (req: TenantRequest, res: express.Response): string | null => {
  if (req.userRole !== 'ADMIN' || !req.tenantId) {
    res.status(403).json({ error: 'Only the church administrator or lead pastor can do this' });
    return null;
  }
  return req.tenantId;
};

const serializeTenant = <T extends { monthlyFee: unknown }>(t: T) => ({ ...t, monthlyFee: Number(t.monthlyFee) });

app.patch('/api/setup/church', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = requireChurchAdmin(req, res);
  if (!tenantId) return;
  try {
    const b = (req.body || {}) as Record<string, unknown>;
    const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() : undefined);
    const name = str('name');
    if (name !== undefined && !name) {
      res.status(400).json({ error: 'Church name is required' });
      return;
    }
    const opt = (k: string) => {
      const v = str(k);
      return v === undefined ? undefined : v || null;
    };
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name ? { name } : {}),
        ...(str('logoUrl') ? { logoUrl: str('logoUrl') } : {}),
        ...(str('currency') ? { currency: str('currency') } : {}),
        ...(str('city') !== undefined ? { city: str('city') } : {}),
        ...(str('country') !== undefined ? { country: str('country') } : {}),
        shortName: opt('shortName'),
        address: opt('address'),
        phone: opt('phone'),
        email: opt('email')?.toLowerCase() ?? opt('email'),
        timezone: opt('timezone'),
        launchDate: opt('launchDate'),
      },
    });
    res.json({ tenant: serializeTenant(updated) });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not save church info' });
  }
});

app.post('/api/setup/department-heads', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = requireChurchAdmin(req, res);
  if (!tenantId) return;
  try {
    const { heads } = (req.body || {}) as {
      heads?: { code: DepartmentCode; name: string; email: string; phone?: string }[];
    };
    if (!Array.isArray(heads) || heads.length === 0) {
      res.status(400).json({ error: 'Add at least one department head' });
      return;
    }
    const [tenant, departments] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.department.findMany({ where: { tenantId } }),
    ]);
    const reqOrigin = resolveFrontendOrigin(req);
    const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    const created = [];
    const invites = [];
    for (const h of heads) {
      const hEmail = h.email?.trim().toLowerCase();
      const dept = departments.find((d) => d.code === h.code);
      const role = HOD_ROLE_BY_DEPT[h.code];
      if (!h.name?.trim() || !hEmail || !dept || !role) {
        res.status(400).json({ error: 'Each head needs a name, a Google email and a department' });
        return;
      }
      const existing = await prisma.user.findUnique({ where: { email: hEmail } });
      if (existing) {
        res.status(409).json({ error: `${hEmail} already has an Open Church login` });
        return;
      }
      const u = await prisma.user.create({
        data: {
          tenantId,
          fullName: h.name.trim(),
          email: hEmail,
          passwordHash,
          phoneNumber: h.phone?.trim() || '',
          role,
          departmentId: dept.id,
        },
      });
      const { passwordHash: _pw, ...safe } = u;
      void _pw;
      created.push(safe);

      if (tenant) {
        invites.push(
          await sendDepartmentLeaderInvite({
            fullName: u.fullName,
            email: u.email,
            churchName: tenant.name,
            departmentName: dept.name,
            role: u.role,
            tenantId,
            appOrigin: reqOrigin,
          })
        );
      }
    }
    res.status(201).json({ users: created, invites });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not add department heads' });
  }
});

app.post(
  '/api/setup/department-heads/:userId/resend-invite',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    try {
      const userId = String(req.params.userId || '').trim();
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser || !targetUser.tenantId) {
        res.status(404).json({ error: 'Department head not found' });
        return;
      }

      const canManage =
        req.userRole === 'PLATFORM_ADMIN' ||
        (req.userRole === 'ADMIN' && req.tenantId === targetUser.tenantId);
      if (!canManage) {
        res.status(403).json({ error: 'Only the church administrator or lead pastor can resend invites' });
        return;
      }

      const [tenant, dept] = await Promise.all([
        prisma.tenant.findUnique({ where: { id: targetUser.tenantId } }),
        targetUser.departmentId
          ? prisma.department.findUnique({ where: { id: targetUser.departmentId } })
          : Promise.resolve(null),
      ]);
      if (!tenant) {
        res.status(404).json({ error: 'Church not found' });
        return;
      }

      const invite = await sendDepartmentLeaderInvite({
        fullName: targetUser.fullName,
        email: targetUser.email,
        churchName: tenant.name,
        departmentName: dept?.name,
        role: targetUser.role,
        tenantId: tenant.id,
        appOrigin: resolveFrontendOrigin(req),
      });

      res.json({ invite });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Could not resend department head invite',
      });
    }
  }
);

app.post('/api/setup/start-trial', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = requireChurchAdmin(req, res);
  if (!tenantId) return;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }
    // The 7-day trial starts when the pastor finishes setup (only once).
    const updated = tenant.setupCompletedAt
      ? tenant
      : await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            setupCompletedAt: new Date(),
            subscriptionStatus: 'TRIALING',
            trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
    res.json({ tenant: serializeTenant(updated) });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not start the free trial' });
  }
});

// Create a department head or serving-member dashboard login & email their invite link
app.post('/api/users', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  try {
    const { fullName, email, phoneNumber, role, departmentId, fellowshipUnitId } = req.body as {
      fullName: string;
      email: string;
      phoneNumber?: string;
      role: UserRole;
      departmentId?: string | null;
      fellowshipUnitId?: string | null;
    };

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!fullName?.trim() || !normalizedEmail) {
      res.status(400).json({ error: 'Full name and Google email are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ error: `${normalizedEmail} already has an Open Church login` });
      return;
    }

    const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    const [tenant, dept] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      departmentId ? prisma.department.findUnique({ where: { id: departmentId } }) : Promise.resolve(null),
    ]);

    const user = await prisma.user.create({
      data: {
        tenantId,
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        phoneNumber: phoneNumber || '',
        role: role || 'AIRPORT_MEMBER',
        departmentId: dept?.id ?? null,
        fellowshipUnitId: fellowshipUnitId || null,
      },
    });

    const reqOrigin = resolveFrontendOrigin(req);

    const invite = tenant
      ? await sendDepartmentLeaderInvite({
          fullName: user.fullName,
          email: user.email,
          churchName: tenant.name,
          departmentName: dept?.name,
          role: user.role,
          tenantId,
          appOrigin: reqOrigin,
        })
      : null;

    const { passwordHash: _pw, ...safeUser } = user;
    void _pw;
    res.status(201).json({ user: safeUser, invite });
  } catch (err: unknown) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed creating user login',
    });
  }
});

// ─── 5. MEMBERS, CHILDREN, SERVICES & CHECK-IN (AIRPORT STARS & KIDS) ─────────

app.post('/api/members', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const { fullName, phoneNumber, gender, residence, bacentaId, campusId, isFirstTimer } =
    req.body;
  const member = await prisma.member.create({
    data: {
      tenantId,
      fullName,
      phoneNumber,
      gender: gender || 'Female',
      residence: residence || 'General',
      bacentaId: bacentaId || null,
      campusId: campusId || null,
      isFirstTimer: Boolean(isFirstTimer),
      joinedAt: new Date().toISOString().slice(0, 10),
    },
  });
  res.status(201).json({ data: member });
});

app.post('/api/children', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const { fullName, age, ageGroup, guardianName, guardianPhone, parentMemberId } = req.body;
  const child = await prisma.child.create({
    data: {
      tenantId,
      fullName,
      age: Number(age),
      ageGroup,
      guardianName,
      guardianPhone,
      parentMemberId: parentMemberId || null,
      joinedAt: new Date().toISOString().slice(0, 10),
    },
  });
  res.status(201).json({ data: child });
});

app.post('/api/services', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const { title, serviceDate, category } = req.body;
  const srv = await prisma.service.create({
    data: {
      tenantId,
      title,
      serviceDate,
      category: category || 'SUNDAY',
      createdBy: req.userId,
    },
  });
  res.status(201).json({ data: srv });
});

app.post('/api/attendance/member', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const { serviceId, memberId, isServingCheckin, servingDepartmentId } = req.body;
  const record = await prisma.serviceAttendance.upsert({
    where: { serviceId_memberId: { serviceId, memberId } },
    update: {
      isServingCheckin: Boolean(isServingCheckin),
      servingDepartmentId: servingDepartmentId || null,
    },
    create: {
      tenantId,
      serviceId,
      memberId,
      isServingCheckin: Boolean(isServingCheckin),
      servingDepartmentId: servingDepartmentId || null,
      checkedInBy: req.userId,
    },
  });
  res.status(201).json({ data: record });
});

app.delete('/api/attendance/member', requireTenantAuth, async (req: TenantRequest, res) => {
  const { serviceId, memberId } = req.body;
  await prisma.serviceAttendance.deleteMany({
    where: { serviceId, memberId },
  });
  res.json({ ok: true });
});

app.post('/api/attendance/child', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const { serviceId, childId } = req.body;
  const record = await prisma.childAttendance.upsert({
    where: { serviceId_childId: { serviceId, childId } },
    update: {},
    create: {
      tenantId,
      serviceId,
      childId,
      checkedInBy: req.userId,
    },
  });
  res.status(201).json({ data: record });
});

app.patch(
  '/api/attendance/child/checkout',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    const { serviceId, childId } = req.body;
    const existing = await prisma.childAttendance.findUnique({
      where: { serviceId_childId: { serviceId, childId } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Child check-in record not found' });
      return;
    }
    const updated = await prisma.childAttendance.update({
      where: { id: existing.id },
      data: { checkedOutAt: existing.checkedOutAt ? null : new Date() },
    });
    res.json({ data: updated });
  }
);

// ─── 6. FINANCE & PARTNER REGISTER ────────────────────────────────────────────

app.post('/api/partners', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const { memberId, fullName, phoneNumber, email, tierOrPledge, monthlyPledge, frequency } =
    req.body;
  const partner = await prisma.partner.create({
    data: {
      tenantId,
      memberId: memberId || null,
      fullName,
      phoneNumber,
      email: email || '',
      tierOrPledge: tierOrPledge || 'Kingdom Partner',
      monthlyPledge: Number(monthlyPledge || 0),
      frequency: frequency || 'Monthly',
    },
  });
  res.status(201).json({ data: partner });
});

app.post(
  '/api/finance/service-income',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenant scope' });
      return;
    }
    const {
      serviceId,
      category,
      partnerId,
      memberId,
      amount,
      paymentMethod,
      referenceCode,
      description,
      transactionDate,
    } = req.body;

    if (category === 'PARTNERSHIP' && !partnerId) {
      res.status(400).json({
        error: 'Partnership entries must be tied to a registered Partner.',
      });
      return;
    }

    const finDept = await prisma.department.findUnique({
      where: { tenantId_code: { tenantId, code: 'FINANCE' } },
    });

    const tx = await prisma.financeTransaction.create({
      data: {
        tenantId,
        type: 'INCOME',
        category,
        sourceScope: 'SERVICE',
        serviceId,
        departmentId: finDept?.id ?? null,
        partnerId: category === 'PARTNERSHIP' ? partnerId : null,
        memberId: memberId || null,
        amount: Number(amount),
        paymentMethod: paymentMethod || 'Cash',
        referenceCode: referenceCode || '',
        description: description || `Service ${category}`,
        transactionDate,
        recordedBy: req.userId,
      },
    });
    res.status(201).json({ data: tx });
  }
);

app.post('/api/finance/expenses', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const {
    serviceId,
    departmentId,
    requisitionId,
    amount,
    paymentMethod,
    referenceCode,
    description,
    transactionDate,
  } = req.body;

  const tx = await prisma.$transaction(async (db) => {
    const created = await db.financeTransaction.create({
      data: {
        tenantId,
        type: 'EXPENSE',
        category: requisitionId ? 'REQUISITION_PAYOUT' : 'OTHER_EXPENSE',
        sourceScope: serviceId ? 'SERVICE' : 'DEPARTMENT',
        serviceId: serviceId || null,
        departmentId: departmentId || null,
        requisitionId: requisitionId || null,
        amount: Number(amount),
        paymentMethod: paymentMethod || 'Cash',
        referenceCode: referenceCode || '',
        description,
        transactionDate,
        recordedBy: req.userId,
      },
    });

    if (requisitionId) {
      const reqRow = await db.requisition.findUnique({ where: { id: requisitionId } });
      if (reqRow) {
        const nextPaid = Math.min(reqRow.totalAmount, reqRow.amountPaid + Number(amount));
        await db.requisition.update({
          where: { id: requisitionId },
          data: {
            amountPaid: nextPaid,
            status: nextPaid >= reqRow.totalAmount ? 'PAID' : reqRow.status,
          },
        });
      }
    }
    return created;
  });

  res.status(201).json({ data: tx });
});

// ─── 7. HOD "MORE" TAB (REQUISITIONS, WORKPLANS, CONTRIBUTIONS, TEAM) ─────────

app.post(
  '/api/departments/contributions',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenant scope' });
      return;
    }
    const {
      departmentId,
      memberId,
      amount,
      purpose,
      paymentMethod,
      referenceCode,
      contributionDate,
    } = req.body;

    const record = await prisma.$transaction(async (db) => {
      const contr = await db.deptContribution.create({
        data: {
          tenantId,
          departmentId,
          memberId,
          amount: Number(amount),
          purpose,
          paymentMethod: paymentMethod || 'Mobile Money',
          referenceCode: referenceCode || '',
          contributionDate,
          recordedBy: req.userId,
        },
      });
      await db.financeTransaction.create({
        data: {
          tenantId,
          type: 'INCOME',
          category: 'DEPT_CONTRIBUTION',
          sourceScope: 'DEPARTMENT',
          departmentId,
          memberId,
          amount: Number(amount),
          paymentMethod: paymentMethod || 'Mobile Money',
          referenceCode: referenceCode || '',
          description: `Dept Contribution: ${purpose}`,
          transactionDate: contributionDate,
          recordedBy: req.userId,
        },
      });
      return contr;
    });

    res.status(201).json({ data: record });
  }
);

app.post('/api/workplans', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const { departmentId, monthLabel, title, items, deptContributionAmount } = req.body as {
    departmentId: string;
    monthLabel: string;
    title: string;
    items: { activity: string; itemName: string; quantity: number; unitCost: number }[];
    deptContributionAmount: number;
  };

  const totalRequested = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const wp = await prisma.workplan.create({
    data: {
      tenantId,
      departmentId,
      monthLabel,
      title,
      totalRequested,
      deptContributionAmount: Number(deptContributionAmount || 0),
      submittedBy: req.userId,
      items: {
        create: items.map((i) => ({
          activity: i.activity,
          itemName: i.itemName,
          quantity: i.quantity,
          unitCost: i.unitCost,
          totalCost: i.quantity * i.unitCost,
        })),
      },
    },
    include: { items: true },
  });
  res.status(201).json({ data: wp });
});

app.patch(
  '/api/workplans/:id/review',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    const { decision, approvedAmount, reviewNotes } = req.body;
    const updated = await prisma.workplan.update({
      where: { id: String(req.params.id) },
      data: {
        status: decision,
        totalApproved: decision === 'APPROVED' ? Number(approvedAmount) : 0,
        reviewNotes: reviewNotes || '',
      },
    });
    res.json({ data: updated });
  }
);

app.post('/api/requisitions', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const { departmentId, workplanId, serviceId, title, items } = req.body as {
    departmentId: string;
    workplanId?: string | null;
    serviceId?: string | null;
    title: string;
    items: { description: string; quantity: number; unitCost: number }[];
  };
  const count = await prisma.requisition.count({ where: { tenantId } });
  const totalAmount = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const created = await prisma.requisition.create({
    data: {
      tenantId,
      departmentId,
      workplanId: workplanId || null,
      serviceId: serviceId || null,
      requisitionNumber: `REQ-${1001 + count}`,
      title,
      itemsJson: items,
      totalAmount,
      requestedBy: req.userId,
      requestedAt: new Date().toISOString().slice(0, 10),
    },
  });
  res.status(201).json({ data: created });
});

app.patch(
  '/api/requisitions/:id/review',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    const { decision, rejectionReason } = req.body;
    const updated = await prisma.requisition.update({
      where: { id: String(req.params.id) },
      data: {
        status: decision,
        rejectionReason: decision === 'REJECTED' ? rejectionReason || '' : '',
      },
    });
    res.json({ data: updated });
  }
);

// ─── 8. FELLOWSHIP ENGINE (BACENTAS & CAMPUSES) ───────────────────────────────

app.post('/api/fellowship/units', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const {
    unitType,
    name,
    locationOrInstitution,
    meetingDay,
    leaderName,
    leaderPhone,
  } = req.body;

  const unit = await prisma.fellowshipUnit.create({
    data: {
      tenantId,
      unitType,
      name,
      locationOrInstitution,
      meetingDay: meetingDay || 'Wednesday 6:00 PM',
      leaderName,
      leaderPhone,
    },
  });
  res.status(201).json({ data: unit });
});

app.post('/api/fellowship/meetings', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const {
    unitId,
    meetingDate,
    title,
    checkedInMemberIds,
    labourersCount,
    soulsWonCount,
    testimony,
  } = req.body as {
    unitId: string;
    meetingDate: string;
    title: string;
    checkedInMemberIds: string[];
    labourersCount: number;
    soulsWonCount: number;
    testimony: string;
  };

  const meeting = await prisma.fellowshipMeeting.create({
    data: {
      tenantId,
      unitId,
      meetingDate,
      title,
      labourersCount: Number(labourersCount || 1),
      soulsWonCount: Number(soulsWonCount || 0),
      testimony: testimony || '',
      submittedBy: req.userId,
      attendance: {
        create: (checkedInMemberIds || []).map((memberId) => ({
          tenantId,
          memberId,
        })),
      },
    },
  });
  res.status(201).json({ data: meeting });
});

app.post(
  '/api/fellowship/outreaches',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenant scope' });
      return;
    }
    const { unitId, outreachDate, location, labourersCount, soulsWonCount, testimony } =
      req.body;
    const outreach = await prisma.fellowshipOutreach.create({
      data: {
        tenantId,
        unitId,
        outreachDate,
        location: location || '',
        labourersCount: Number(labourersCount || 1),
        soulsWonCount: Number(soulsWonCount || 0),
        testimony,
        submittedBy: req.userId,
      },
    });
    res.status(201).json({ data: outreach });
  }
);

app.post('/api/fellowship/finance', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const {
    unitId,
    unitName,
    unitType,
    category,
    amount,
    paymentMethod,
    referenceCode,
    transactionDate,
  } = req.body;

  const dept = await prisma.department.findUnique({
    where: {
      tenantId_code: {
        tenantId,
        code: unitType === 'BACENTA' ? 'BACENTA' : 'CAMPUSES',
      },
    },
  });

  const tx = await prisma.financeTransaction.create({
    data: {
      tenantId,
      type: 'INCOME',
      category,
      sourceScope: unitType === 'BACENTA' ? 'BACENTA_MEETING' : 'CAMPUS_MEETING',
      departmentId: dept?.id ?? null,
      fellowshipUnitId: unitId,
      amount: Number(amount),
      paymentMethod: paymentMethod || 'Mobile Money',
      referenceCode: referenceCode || '',
      description: `${unitName} Meeting ${category}`,
      transactionDate,
      recordedBy: req.userId,
    },
  });
  res.status(201).json({ data: tx });
});

// ─── 9. TELE PASTORING, ABSENTEES & 4-WEEK SOULS ──────────────────────────────

app.post(
  '/api/tele-pastoring/reachouts',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenant scope' });
      return;
    }
    const {
      memberId,
      serviceId,
      mode,
      labourersCount,
      amountSpentOrSent,
      comment,
      reachoutDate,
    } = req.body;

    const record = await prisma.$transaction(async (db) => {
      let financeTxId: string | null = null;
      const numericAmount = Number(amountSpentOrSent || 0);

      if (numericAmount > 0) {
        const teleDept = await db.department.findUnique({
          where: { tenantId_code: { tenantId, code: 'TELE_PASTORING' } },
        });
        const member = await db.member.findUnique({ where: { id: memberId } });
        const exp = await db.financeTransaction.create({
          data: {
            tenantId,
            type: 'EXPENSE',
            category: 'TELE_REACHOUT_EXPENSE',
            sourceScope: serviceId ? 'SERVICE' : 'DEPARTMENT',
            serviceId: serviceId || null,
            departmentId: teleDept?.id ?? null,
            memberId,
            amount: numericAmount,
            paymentMethod: mode === 'PHONE_CALL' ? 'Mobile Money' : 'Cash',
            description: `Tele-Pastoring ${
              mode === 'PHYSICAL_VISIT' ? 'Physical Visit' : 'Phone Support'
            } — ${member?.fullName ?? 'Member'}`,
            transactionDate: reachoutDate,
            recordedBy: req.userId,
          },
        });
        financeTxId = exp.id;
      }

      return db.teleReachout.create({
        data: {
          tenantId,
          memberId,
          serviceId: serviceId || null,
          mode,
          labourersCount:
            mode === 'PHYSICAL_VISIT' ? Math.max(1, Number(labourersCount || 1)) : null,
          amountSpent: numericAmount,
          comment,
          financeTransactionId: financeTxId,
          reachedBy: req.userId,
          reachoutDate,
        },
      });
    });

    res.status(201).json({ data: record });
  }
);

app.post('/api/souls/weeks', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant scope' });
    return;
  }
  const { soulId, weekNumber, contactMode, attendedService, comment } = req.body;

  await prisma.$transaction(async (db) => {
    await db.soulFollowupWeek.upsert({
      where: { soulId_weekNumber: { soulId, weekNumber: Number(weekNumber) } },
      update: {
        contactMode,
        attendedService: Boolean(attendedService),
        comment,
        completedBy: req.userId,
        completedAt: new Date(),
      },
      create: {
        tenantId,
        soulId,
        weekNumber: Number(weekNumber),
        contactMode,
        attendedService: Boolean(attendedService),
        comment,
        completedBy: req.userId,
      },
    });

    const weeks = await db.soulFollowupWeek.findMany({ where: { soulId } });
    let nextStatus: SoulStatus = 'WEEK_1';
    if (weeks.length >= 4) {
      nextStatus = 'INTEGRATED';
    } else {
      const maxWeek = Math.max(...weeks.map((w) => w.weekNumber));
      const map: Record<number, SoulStatus> = {
        1: 'WEEK_1',
        2: 'WEEK_2',
        3: 'WEEK_3',
        4: 'INTEGRATED',
      };
      nextStatus = map[maxWeek] ?? 'WEEK_1';
    }

    await db.soulWon.update({
      where: { id: soulId },
      data: { status: nextStatus },
    });
  });

  res.json({ ok: true });
});

// ─── 10. MARZPAY MONTHLY SUBSCRIPTION COLLECTIONS & WEBHOOKS ──────────────────

function addOneCalendarMonth(from: Date): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

const serializeSubscriptionPayment = <T extends { amount: unknown }>(p: T) => ({
  ...p,
  amount: Number(p.amount),
});

function computeNextSubscriptionWindow(tenant: {
  subscriptionStatus: string;
  trialEndsAt: Date;
  subscriptionEndsAt: Date | null;
}): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const currentEnd =
    tenant.subscriptionStatus === 'TRIALING' ? tenant.trialEndsAt : tenant.subscriptionEndsAt;
  const activeWindow =
    currentEnd &&
    currentEnd > now &&
    tenant.subscriptionStatus !== 'PAST_DUE' &&
    tenant.subscriptionStatus !== 'SUSPENDED';

  const periodStart = activeWindow ? currentEnd : now;
  const periodEnd = addOneCalendarMonth(periodStart);
  return { periodStart, periodEnd };
}

/**
 * Concurrency-safe, idempotent settlement of a MarzPay collection.
 * Ensures duplicate webhooks or simultaneous status polls never add two months for one payment.
 */
async function settleMarzPaySubscriptionPayment(
  paymentIdentifier: { reference?: string; marzpayUuid?: string },
  outcome: MarzPayStatusResult
) {
  const orConditions = [
    ...(paymentIdentifier.reference ? [{ referenceNumber: paymentIdentifier.reference }] : []),
    ...(paymentIdentifier.marzpayUuid ? [{ marzpayUuid: paymentIdentifier.marzpayUuid }] : []),
  ];
  if (orConditions.length === 0) return null;

  const existing = await prisma.subscriptionPayment.findFirst({
    where: { OR: orConditions },
  });
  if (!existing) return null;

  if (outcome.normalizedStatus === 'COMPLETED') {
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: existing.tenantId } });
      if (!tenant) return null;

      const now = new Date();
      const { periodStart, periodEnd } = computeNextSubscriptionWindow(tenant);

      // Atomic transition guard: only the first caller moving status != COMPLETED wins
      const claimed = await tx.subscriptionPayment.updateMany({
        where: { id: existing.id, status: { not: 'COMPLETED' } },
        data: {
          status: 'COMPLETED',
          periodStart,
          periodEnd,
          completedAt: now,
          failureReason: null,
          ...(outcome.providerTransactionId
            ? { providerReference: outcome.providerTransactionId }
            : {}),
        },
      });

      if (claimed.count === 1) {
        const updatedTenant = await tx.tenant.update({
          where: { id: tenant.id },
          data: {
            subscriptionStatus: 'ACTIVE',
            status: 'ACTIVE',
            subscriptionEndsAt: periodEnd,
            lastPaidAt: now,
          },
        });
        const updatedPayment = await tx.subscriptionPayment.findUnique({
          where: { id: existing.id },
        });
        return { payment: updatedPayment!, tenant: updatedTenant, newlySettled: true };
      }

      // Already settled by an earlier webhook/poll — update providerReference if newly available
      if (outcome.providerTransactionId && !existing.providerReference) {
        await tx.subscriptionPayment.update({
          where: { id: existing.id },
          data: { providerReference: outcome.providerTransactionId },
        });
      }
      const currentPayment = await tx.subscriptionPayment.findUnique({
        where: { id: existing.id },
      });
      return { payment: currentPayment!, tenant, newlySettled: false };
    });
  }

  if (outcome.normalizedStatus === 'FAILED' && existing.status !== 'COMPLETED') {
    await prisma.subscriptionPayment.updateMany({
      where: { id: existing.id, status: { not: 'COMPLETED' } },
      data: {
        status: 'FAILED',
        failureReason: outcome.failureReason || 'Payment failed or was cancelled.',
      },
    });
    const [updatedPayment, tenant] = await Promise.all([
      prisma.subscriptionPayment.findUnique({ where: { id: existing.id } }),
      prisma.tenant.findUnique({ where: { id: existing.tenantId } }),
    ]);
    return updatedPayment && tenant
      ? { payment: updatedPayment, tenant, newlySettled: false }
      : null;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: existing.tenantId } });
  return tenant ? { payment: existing, tenant, newlySettled: false } : null;
}

// Initiate monthly subscription payment via MarzPay (MTN MoMo, Airtel Money, or Card)
app.post(
  '/api/billing/subscription/collect',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = resolveTargetTenantId(req);
      if (!tenantId) {
        res.status(400).json({ error: 'Network Council accounts do not pay church subscriptions.' });
        return;
      }

      if (req.userRole !== 'ADMIN' && req.userRole !== 'PLATFORM_ADMIN') {
        res
          .status(403)
          .json({ error: 'Only the church administrator or lead pastor can manage subscription billing.' });
        return;
      }

      if (!isMarzPayConfigured()) {
        res.status(503).json({
          error:
            'MarzPay credentials are not configured on the server yet. Add MARZPAY_API_KEY and MARZPAY_API_SECRET.',
        });
        return;
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        res.status(404).json({ error: 'Church not found' });
        return;
      }

      const { method, phoneNumber } = (req.body || {}) as {
        method?: 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA';
        phoneNumber?: string;
      };

      const requestedMethod: 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA' =
        method === 'VISA' || method === 'AIRTEL_MONEY' || method === 'MTN_MOMO'
          ? method
          : 'MTN_MOMO';

      const targetInfo = normalizeMarzPayTarget({
        phoneInput: phoneNumber,
        tenantCountry: tenant.country,
        tenantCurrency: tenant.currency,
      });

      const resolvedMethod: 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA' =
        requestedMethod === 'VISA'
          ? 'VISA'
          : targetInfo.inferredMethod || requestedMethod;

      const feeAmount = Math.max(500, Math.round(Number(tenant.monthlyFee) || 50000));
      const frontendOrigin = resolveFrontendOrigin(req);
      const callbackUrl = resolveMarzPayCallbackUrl(frontendOrigin);

      const init = await initiateMarzPayCollection({
        amount: feeAmount,
        method: resolvedMethod,
        phoneInput: phoneNumber,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        churchName: tenant.name,
        tenantCountry: tenant.country,
        tenantCurrency: tenant.currency,
        callbackUrl,
      });

      const { periodStart, periodEnd } = computeNextSubscriptionWindow(tenant);

      const finalMethod: 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA' =
        resolvedMethod === 'VISA'
          ? 'VISA'
          : init.provider?.toLowerCase().includes('airtel')
            ? 'AIRTEL_MONEY'
            : init.provider?.toLowerCase().includes('mtn')
              ? 'MTN_MOMO'
              : resolvedMethod;

      const pendingPayment = await prisma.subscriptionPayment.create({
        data: {
          tenantId: tenant.id,
          amount: init.amountRaw || feeAmount,
          currency: init.currency || tenant.currency || 'UGX',
          paymentMethod: finalMethod,
          referenceNumber: init.reference,
          marzpayUuid: init.marzpayUuid || null,
          phoneOrAccount: init.phoneNumber || '',
          status: 'PENDING',
          periodStart,
          periodEnd,
          recordedBy: req.userId || null,
        },
      });

      res.status(201).json({
        payment: serializeSubscriptionPayment(pendingPayment),
        marzpayStatus: init.marzpayStatus,
        redirectUrl: init.redirectUrl || null,
        sandboxMode: init.sandboxMode,
        message: init.message,
      });
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Could not initiate MarzPay subscription payment.',
      });
    }
  }
);

// Poll status of an in-flight MarzPay subscription payment (confirms via DB + MarzPay GET /collect-money/{uuid})
app.get(
  '/api/billing/subscription/payments/:reference/status',
  requireTenantAuth,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = resolveTargetTenantId(req);
      const refParam = String(req.params.reference || '').trim();
      if (!refParam) {
        res.status(400).json({ error: 'Missing payment reference' });
        return;
      }

      const payment = await prisma.subscriptionPayment.findFirst({
        where: {
          referenceNumber: refParam,
          ...(tenantId ? { tenantId } : {}),
        },
      });

      if (!payment) {
        res.status(404).json({ error: 'Subscription payment record not found' });
        return;
      }

      if (payment.status === 'PENDING' && payment.marzpayUuid && isMarzPayConfigured()) {
        try {
          const liveOutcome = await checkMarzPayCollectionStatus(payment.marzpayUuid);
          const settled = await settleMarzPaySubscriptionPayment(
            { reference: payment.referenceNumber, marzpayUuid: payment.marzpayUuid },
            liveOutcome
          );
          if (settled) {
            res.json({
              status: settled.payment.status,
              marzpayStatus: liveOutcome.rawStatus,
              payment: serializeSubscriptionPayment(settled.payment),
              tenant: serializeTenant(settled.tenant),
            });
            return;
          }
        } catch (pollErr) {
          console.warn('[MarzPay] Poll status warning:', pollErr);
        }
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: payment.tenantId } });
      res.json({
        status: payment.status,
        marzpayStatus: payment.status.toLowerCase(),
        payment: serializeSubscriptionPayment(payment),
        tenant: tenant ? serializeTenant(tenant) : null,
      });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed checking subscription payment status',
      });
    }
  }
);

// List subscription payment history for the authenticated church
app.get('/api/billing/subscription/payments', requireTenantAuth, async (req: TenantRequest, res) => {
  const tenantId = resolveTargetTenantId(req);
  if (!tenantId) {
    res.json({ payments: [] });
    return;
  }
  const rows = await prisma.subscriptionPayment.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ payments: rows.map(serializeSubscriptionPayment) });
});

// MarzPay webhook handler (supports both direct callback_url POSTs and dashboard-wrapped { data } events)
const handleMarzPayWebhook: express.RequestHandler = async (req, res) => {
  try {
    const rawBody = (req as express.Request & { rawBody?: string }).rawBody;
    if (!verifyMarzPayWebhookSignature(rawBody, req.headers)) {
      console.warn('[MarzPay Webhook] Invalid HMAC signature rejected.');
      res.status(401).json({ error: 'Invalid MarzPay signature' });
      return;
    }

    const parsed = parseMarzPayWebhookPayload((req.body || {}) as Record<string, unknown>);
    if (!parsed.reference && !parsed.marzpayUuid) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    const result = await settleMarzPaySubscriptionPayment(
      { reference: parsed.reference, marzpayUuid: parsed.marzpayUuid },
      parsed
    );

    console.log(
      `[MarzPay Webhook] event=${parsed.eventType || parsed.rawStatus} ref=${parsed.reference || parsed.marzpayUuid} outcome=${parsed.normalizedStatus} settled=${Boolean(result?.newlySettled)}`
    );

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[MarzPay Webhook] Error processing callback:', err);
    res.status(200).json({ received: true });
  }
};

app.post('/api/webhooks/marzpay', handleMarzPayWebhook);
app.post('/webhooks/marzpay', handleMarzPayWebhook);

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`Open Church Backend (Prisma + Supabase Postgres) running on http://localhost:${PORT}`);
});
