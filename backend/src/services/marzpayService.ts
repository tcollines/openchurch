import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const cleanSecret = (v?: string): string =>
  (v || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '');

const getApiBase = () =>
  (cleanSecret(process.env.MARZPAY_API_BASE) || 'https://wallet.wearemarz.com/api/v1').replace(
    /\/+$/,
    ''
  );
const getApiKey = () => cleanSecret(process.env.MARZPAY_API_KEY);
const getApiSecret = () => cleanSecret(process.env.MARZPAY_API_SECRET);
const getBase64Header = () => cleanSecret(process.env.MARZPAY_BASE64_AUTHORIZATION_HEADER);
const getWebhookSecret = () => cleanSecret(process.env.MARZPAY_WEBHOOK_SECRET);
const getCallbackUrlEnv = () => cleanSecret(process.env.MARZPAY_CALLBACK_URL);

export type MarzPayCountryCode =
  | 'UG'
  | 'KE'
  | 'RW'
  | 'CD'
  | 'ZM'
  | 'CM'
  | 'BJ'
  | 'CI'
  | 'GA'
  | 'CG'
  | 'SN'
  | 'SL';

const COUNTRY_CONFIG: Record<
  MarzPayCountryCode,
  { dial: string; currency: string; names: string[] }
> = {
  UG: { dial: '256', currency: 'UGX', names: ['uganda', 'ug'] },
  KE: { dial: '254', currency: 'KES', names: ['kenya', 'ke'] },
  RW: { dial: '250', currency: 'RWF', names: ['rwanda', 'rw'] },
  CD: {
    dial: '243',
    currency: 'CDF',
    names: ['drc', 'democratic republic of the congo', 'congo-kinshasa', 'cd'],
  },
  ZM: { dial: '260', currency: 'ZMW', names: ['zambia', 'zm'] },
  CM: { dial: '237', currency: 'XAF', names: ['cameroon', 'cm'] },
  BJ: { dial: '229', currency: 'XOF', names: ['benin', 'bj'] },
  CI: { dial: '225', currency: 'XOF', names: ["cote d'ivoire", 'côte d’ivoire', 'ivory coast', 'ci'] },
  GA: { dial: '241', currency: 'XAF', names: ['gabon', 'ga'] },
  CG: { dial: '242', currency: 'XAF', names: ['congo-brazzaville', 'republic of the congo', 'cg'] },
  SN: { dial: '221', currency: 'XOF', names: ['senegal', 'sn'] },
  SL: { dial: '232', currency: 'SLE', names: ['sierra leone', 'sl'] },
};

export function isMarzPayConfigured(): boolean {
  return Boolean((getApiKey() && getApiSecret()) || getBase64Header());
}

function getMarzPayAuthHeader(): string {
  const apiKey = getApiKey();
  const apiSecret = getApiSecret();
  const base64Header = getBase64Header();
  if (apiKey && apiSecret) {
    return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  }
  if (base64Header) {
    const stripped = base64Header.replace(/^Basic\s+/i, '').trim();
    return `Basic ${stripped}`;
  }
  throw new Error(
    'MarzPay API credentials are not configured. Set MARZPAY_API_KEY and MARZPAY_API_SECRET in backend/.env.'
  );
}

export function resolveMarzPayCallbackUrl(fallbackHttpsOrigin?: string): string | undefined {
  const callbackEnv = getCallbackUrlEnv();
  if (callbackEnv && callbackEnv.startsWith('https://')) {
    return callbackEnv;
  }
  if (fallbackHttpsOrigin && fallbackHttpsOrigin.startsWith('https://')) {
    return `${fallbackHttpsOrigin.replace(/\/+$/, '')}/api/webhooks/marzpay`;
  }
  return 'https://openchurch.onrender.com/api/webhooks/marzpay';
}

export function normalizeMarzPayTarget(params: {
  phoneInput?: string;
  tenantCountry?: string;
  tenantCurrency?: string;
}): {
  country: MarzPayCountryCode;
  currency: string;
  e164Phone: string;
  inferredMethod?: 'MTN_MOMO' | 'AIRTEL_MONEY';
} {
  const countryLower = (params.tenantCountry || '').trim().toLowerCase();
  let country: MarzPayCountryCode = 'UG';

  for (const [code, cfg] of Object.entries(COUNTRY_CONFIG) as [
    MarzPayCountryCode,
    (typeof COUNTRY_CONFIG)[MarzPayCountryCode],
  ][]) {
    if (cfg.names.includes(countryLower)) {
      country = code;
      break;
    }
  }

  const rawDigits = (params.phoneInput || '').replace(/[^\d+]/g, '');
  const digitsOnly = rawDigits.replace(/\D/g, '');

  // If the phone explicitly starts with a supported country dial code, honor it
  for (const [code, cfg] of Object.entries(COUNTRY_CONFIG) as [
    MarzPayCountryCode,
    (typeof COUNTRY_CONFIG)[MarzPayCountryCode],
  ][]) {
    if (digitsOnly.startsWith(cfg.dial) && digitsOnly.length >= cfg.dial.length + 8) {
      country = code;
      break;
    }
  }

  const dial = COUNTRY_CONFIG[country].dial;
  let e164Phone = '';
  if (digitsOnly) {
    if (digitsOnly.startsWith(dial)) {
      e164Phone = `+${digitsOnly}`;
    } else if (digitsOnly.startsWith('0')) {
      e164Phone = `+${dial}${digitsOnly.slice(1)}`;
    } else {
      e164Phone = `+${dial}${digitsOnly}`;
    }
  }

  let currency = COUNTRY_CONFIG[country].currency;
  if (country === 'CD') {
    currency = (params.tenantCurrency || '').toUpperCase() === 'USD' ? 'USD' : 'CDF';
  }

  let inferredMethod: 'MTN_MOMO' | 'AIRTEL_MONEY' | undefined;
  if (country === 'UG' && e164Phone.startsWith('+256')) {
    const prefix = e164Phone.slice(4, 6);
    if (['70', '74', '75'].includes(prefix)) {
      inferredMethod = 'AIRTEL_MONEY';
    } else if (['76', '77', '78', '39'].includes(prefix)) {
      inferredMethod = 'MTN_MOMO';
    }
  }

  return { country, currency, e164Phone, inferredMethod };
}

function formatMarzPayApiError(status: number, body: Record<string, unknown>): string {
  const code = String(body.error_code || '').toUpperCase();
  const baseMsg = String(body.message || '').trim();

  // Extract field-level validation messages when present
  const fieldMessages: string[] = [];
  if (Array.isArray(body.all_messages)) {
    for (const m of body.all_messages) {
      if (typeof m === 'string' && m.trim()) fieldMessages.push(m.trim());
    }
  } else if (body.errors && typeof body.errors === 'object') {
    for (const val of Object.values(body.errors as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string' && item.trim()) fieldMessages.push(item.trim());
        }
      } else if (typeof val === 'string' && val.trim()) {
        fieldMessages.push(val.trim());
      }
    }
  }

  if (code === 'IP_WHITELIST_REQUIRED' || /ip whitelist/i.test(baseMsg)) {
    return 'MarzPay IP Whitelist required: add your backend server IP in MarzPay Dashboard → IP Whitelist to process live collections.';
  }
  if (code === 'UNAUTHORIZED' || status === 401) {
    return 'MarzPay authentication failed. Check MARZPAY_API_KEY and MARZPAY_API_SECRET on the backend.';
  }
  if (code === 'SERVICE_NOT_SUBSCRIBED') {
    return 'MarzPay Collection service is not enabled yet on your merchant account. Subscribe to Mobile Money / Card Collections in MarzPay Dashboard → Services.';
  }
  if (code === 'INVALID_PHONE_NUMBER') {
    return 'Invalid Mobile Money phone number. Enter a valid MTN or Airtel number (e.g. +256 772 000000).';
  }
  if (code === 'ACCOUNT_FROZEN') {
    return 'Merchant payment account is temporarily unavailable. Please contact Open Church support.';
  }
  if (fieldMessages.length > 0) {
    return fieldMessages.join(' ');
  }
  return baseMsg || `MarzPay request failed (HTTP ${status})`;
}

async function marzPayRequest<T = Record<string, unknown>>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  payload?: Record<string, unknown>
): Promise<T> {
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: getMarzPayAuthHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Unexpected response from MarzPay (HTTP ${res.status})`);
  }

  if (!res.ok || json.status === 'error' || json.success === false) {
    throw new Error(formatMarzPayApiError(res.status, json));
  }

  return json as T;
}

export interface MarzPayCollectionInitResult {
  reference: string;
  marzpayUuid: string;
  marzpayStatus: string;
  amountRaw: number;
  currency: string;
  country: MarzPayCountryCode;
  phoneNumber: string;
  provider?: string;
  redirectUrl?: string;
  sandboxMode: boolean;
  message: string;
}

/**
 * Initiates a MarzPay Mobile Money or Card collection (POST /collect-money).
 * Always generates a fresh UUID v4 reference and never marks the subscription paid upfront.
 */
export async function initiateMarzPayCollection(params: {
  amount: number;
  method: 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA';
  phoneInput?: string;
  tenantId: string;
  tenantSlug: string;
  churchName: string;
  tenantCountry?: string;
  tenantCurrency?: string;
  callbackUrl?: string;
}): Promise<MarzPayCollectionInitResult> {
  const reference = crypto.randomUUID();
  const target = normalizeMarzPayTarget({
    phoneInput: params.phoneInput,
    tenantCountry: params.tenantCountry,
    tenantCurrency: params.tenantCurrency,
  });

  const isCard = params.method === 'VISA';
  if (!isCard) {
    const digits = target.e164Phone.replace(/\D/g, '');
    if (digits.length < 10) {
      throw new Error('Enter a valid Mobile Money phone number (e.g. +256 772 000000).');
    }
  }

  const description = `Open Church Monthly Subscription - ${params.churchName}`.slice(0, 250);

  const requestBody: Record<string, unknown> = isCard
    ? {
        amount: Math.round(params.amount),
        method: 'card',
        reference,
        country: target.country,
        ...(target.country === 'CD' ? { currency: target.currency } : {}),
        description,
        ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
      }
    : {
        amount: Math.round(params.amount),
        phone_number: target.e164Phone,
        method: 'mobile_money',
        reference,
        country: target.country,
        ...(target.country === 'CD' ? { currency: target.currency } : {}),
        description,
        ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
        metadata: [
          { tenantId: params.tenantId },
          { churchSlug: params.tenantSlug },
          { plan: 'MONTHLY_SUBSCRIPTION' },
        ],
      };

  const response = await marzPayRequest<{
    status?: string;
    message?: string;
    data?: {
      transaction?: {
        uuid?: string;
        reference?: string;
        status?: string;
      };
      collection?: {
        amount?: { raw?: number; formatted?: string; currency?: string };
        provider?: string;
        phone_number?: string;
        mode?: string;
      };
      redirect_url?: string;
      metadata?: {
        sandbox_mode?: boolean;
      };
    };
  }>('/collect-money', 'POST', requestBody);

  const tx = response.data?.transaction || {};
  const col = response.data?.collection || {};
  const marzpayUuid = String(tx.uuid || '').trim();
  const returnedRef = String(tx.reference || reference).trim();
  const marzpayStatus = String(tx.status || 'processing').toLowerCase();
  const amountRaw = Number(col.amount?.raw ?? params.amount);
  const currency = String(col.amount?.currency || target.currency);
  const sandboxMode =
    Boolean(response.data?.metadata?.sandbox_mode) ||
    marzpayStatus === 'sandbox' ||
    col.mode === 'sandbox';

  return {
    reference: returnedRef,
    marzpayUuid,
    marzpayStatus,
    amountRaw,
    currency,
    country: target.country,
    phoneNumber: isCard ? '' : String(col.phone_number || target.e164Phone),
    provider: col.provider,
    redirectUrl: response.data?.redirect_url,
    sandboxMode,
    message:
      response.message ||
      (isCard
        ? 'Redirecting to MarzPay card checkout…'
        : 'Mobile Money prompt sent. Check your phone and enter your PIN.'),
  };
}

export interface MarzPayStatusResult {
  normalizedStatus: 'COMPLETED' | 'FAILED' | 'PENDING';
  rawStatus: string;
  eventType?: string;
  reference?: string;
  marzpayUuid?: string;
  providerTransactionId?: string;
  provider?: string;
  amountRaw?: number;
  currency?: string;
  failureReason?: string;
}

function classifyMarzPayOutcome(eventType: string, txStatus: string): 'COMPLETED' | 'FAILED' | 'PENDING' {
  const ev = eventType.toLowerCase();
  const st = txStatus.toLowerCase();

  if (
    ev === 'collection.completed' ||
    ev === 'success' ||
    st === 'completed' ||
    st === 'successful' ||
    st === 'succeeded' ||
    st === 'paid'
  ) {
    return 'COMPLETED';
  }

  if (
    ev === 'collection.failed' ||
    ev === 'collection.cancelled' ||
    ev === 'collection.canceled' ||
    ev === 'failure' ||
    st === 'failed' ||
    st === 'cancelled' ||
    st === 'canceled' ||
    st === 'expired' ||
    st === 'rejected'
  ) {
    return 'FAILED';
  }

  return 'PENDING';
}

/**
 * Queries MarzPay GET /collect-money/{uuid} (with fallback to GET /transactions/{uuid}).
 * Parses both standard { status, data } envelopes and callback-shaped { event_type, transaction, collection } responses.
 */
export async function checkMarzPayCollectionStatus(marzpayUuid: string): Promise<MarzPayStatusResult> {
  let raw: Record<string, any>;
  try {
    raw = await marzPayRequest<Record<string, any>>(
      `/collect-money/${encodeURIComponent(marzpayUuid)}`,
      'GET'
    );
  } catch {
    raw = await marzPayRequest<Record<string, any>>(
      `/transactions/${encodeURIComponent(marzpayUuid)}`,
      'GET'
    );
  }

  const inner = raw?.data?.transaction ? raw.data : raw;
  const eventType = String(inner?.event_type || raw?.event_type || '');
  const tx = inner?.transaction || inner || {};
  const col = inner?.collection || {};
  const rawStatus = String(tx?.status || inner?.status || 'processing').toLowerCase();
  const normalizedStatus = classifyMarzPayOutcome(eventType, rawStatus);

  const providerTransactionId = col?.provider_transaction_id
    ? String(col.provider_transaction_id)
    : tx?.provider_transaction_id
      ? String(tx.provider_transaction_id)
      : undefined;

  return {
    normalizedStatus,
    rawStatus,
    eventType: eventType || undefined,
    reference: tx?.reference ? String(tx.reference) : undefined,
    marzpayUuid: tx?.uuid ? String(tx.uuid) : marzpayUuid,
    providerTransactionId,
    provider: col?.provider || tx?.provider,
    amountRaw:
      typeof col?.amount?.raw === 'number'
        ? col.amount.raw
        : typeof tx?.amount?.raw === 'number'
          ? tx.amount.raw
          : undefined,
    currency: col?.amount?.currency || tx?.amount?.currency,
    failureReason:
      normalizedStatus === 'FAILED'
        ? String(
            tx?.failure_reason ||
              col?.failure_reason ||
              raw?.message ||
              (rawStatus === 'cancelled' || eventType.includes('cancelled')
                ? 'Payment prompt was cancelled on the phone.'
                : 'Mobile Money collection was declined or timed out.')
          )
        : undefined,
  };
}

/**
 * Verifies optional MarzPay HMAC signature when MARZPAY_WEBHOOK_SECRET is configured.
 * Header format: X-MarzPay-Timestamp (unix secs), X-MarzPay-Signature: t={timestamp},v1={hmac_sha256_hex}
 */
export function verifyMarzPayWebhookSignature(
  rawBody: string | undefined,
  headers: Record<string, string | string[] | undefined>
): boolean {
  const webhookSecret = getWebhookSecret();
  if (!webhookSecret) return true;

  const sigHeaderRaw = headers['x-marzpay-signature'];
  const tsHeaderRaw = headers['x-marzpay-timestamp'];
  const sigHeader = Array.isArray(sigHeaderRaw) ? sigHeaderRaw[0] : sigHeaderRaw;
  const tsHeader = Array.isArray(tsHeaderRaw) ? tsHeaderRaw[0] : tsHeaderRaw;

  if (!sigHeader || !rawBody) return false;

  const parts = Object.fromEntries(
    sigHeader.split(',').map((segment) => {
      const [k, v] = segment.trim().split('=', 2);
      return [k, v || ''];
    })
  );

  const timestamp = parts.t || tsHeader || '';
  const signatureHex = parts.v1 || '';
  if (!timestamp || !signatureHex) return false;

  const expectedHex = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  try {
    const a = Buffer.from(signatureHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Parses both direct callback_url payloads and dashboard-registered { data: ... } webhook wrappers.
 */
export function parseMarzPayWebhookPayload(body: Record<string, any>): MarzPayStatusResult & {
  phoneNumber?: string;
  metadata?: Record<string, unknown>[];
} {
  const payload = body?.data?.transaction ? body.data : body;
  const eventType = String(payload?.event_type || body?.event_type || '');
  const tx = payload?.transaction || {};
  const col = payload?.collection || {};
  const rawStatus = String(tx?.status || '').toLowerCase();
  const normalizedStatus = classifyMarzPayOutcome(eventType, rawStatus);

  const providerTransactionId = col?.provider_transaction_id
    ? String(col.provider_transaction_id)
    : undefined;

  const metadata = Array.isArray(payload?.metadata)
    ? payload.metadata
    : Array.isArray(body?.metadata)
      ? body.metadata
      : undefined;

  return {
    normalizedStatus,
    rawStatus,
    eventType: eventType || undefined,
    reference: tx?.reference ? String(tx.reference).trim() : undefined,
    marzpayUuid: tx?.uuid ? String(tx.uuid).trim() : undefined,
    providerTransactionId,
    provider: col?.provider || tx?.provider,
    phoneNumber: col?.phone_number || tx?.phone_number,
    amountRaw:
      typeof col?.amount?.raw === 'number'
        ? col.amount.raw
        : typeof tx?.amount?.raw === 'number'
          ? tx.amount.raw
          : undefined,
    currency: col?.amount?.currency || tx?.amount?.currency,
    metadata,
    failureReason:
      normalizedStatus === 'FAILED'
        ? String(
            tx?.failure_reason ||
              col?.failure_reason ||
              (eventType.includes('cancelled') || rawStatus === 'cancelled'
                ? 'Payment prompt was cancelled.'
                : 'Mobile Money payment failed or was declined.')
          )
        : undefined,
  };
}
