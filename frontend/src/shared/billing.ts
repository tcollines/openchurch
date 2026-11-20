/**
 * Where churches send the monthly Open Church subscription (UGX 50,000).
 *
 * ⚠ EXAMPLE DETAILS — replace every value below with the real merchant codes and
 * bank account before launch. Set PAYMENT_DETAILS_ARE_EXAMPLES to false once done.
 */
export const PAYMENT_DETAILS_ARE_EXAMPLES = true;

export const PAYMENT_DETAILS = {
  mtnMerchantCode: '000000 · Open Church',
  airtelPayCode: '000000 · Open Church',
  bankAccount: 'Open Church Ltd · 0000000000',
  bankName: 'Bank name',
};

/** Reference a church quotes on manual payments so they can be matched, e.g. OC-KAMPALA-CENTRAL. */
export const paymentReference = (slug: string): string =>
  `OC-${(slug || 'church').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/** "1000 Micro Church — Kampala Central" → "Kampala Central" */
export const churchShortName = (name?: string | null, shortName?: string | null): string =>
  shortName || (name ?? '').replace(/^1000 Micro Church\s*[—-]\s*/, '') || 'your church';

export const formatLongDate = (d: Date): string =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatShortDay = (d: Date): string =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
