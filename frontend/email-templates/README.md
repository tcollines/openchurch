# Open Church — email templates

## `invite-welcome.html` — welcome email for a new church's pastor

Sent when the Network Council creates a church. It welcomes the pastor, gives the
**Start using Open Church** link, the **7-day free trial terms**, and the price
(**UGX 50,000 per month**).

### Add it to Supabase

1. Supabase dashboard → **Authentication → Emails → Templates → Invite user**.
2. **Subject:** `Welcome to Open Church — start your 7-day free trial`
3. **Message body:** paste the whole of `invite-welcome.html` → **Save**.
4. **Authentication → URL Configuration**
   - **Site URL** = your live app address (e.g. `https://openchurch.app`).
     The logo loads from `{{ .SiteURL }}/logo.jpg` (the file in `frontend/public`).
   - Add your app address (and `http://localhost:5173` for testing) to **Redirect URLs**.

### Send it (server side only — needs the service-role key)

Call this from the backend when a church is created — never from the browser:

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

await supabaseAdmin.auth.admin.inviteUserByEmail(pastor.email, {
  redirectTo: `${process.env.APP_URL}/login`,
  data: {
    full_name: 'Pastor Samuel',          // shown as "Welcome to Open Church, Pastor Samuel"
    church_name: 'Gulu City',            // shown in the intro and footer
    trial_ends: '25 Nov 2026',           // shown in the first trial term
    support_whatsapp: '+256 700 000 000',// Network Council WhatsApp (leave out to hide the line)
    tenant_id: tenant.id,
    role: 'ADMIN',
  },
});
```

### Placeholders Supabase fills in

| Placeholder | What it is |
|---|---|
| `{{ .ConfirmationURL }}` | The start link — accepts the invite and signs the pastor in |
| `{{ .Email }}` | The pastor's email |
| `{{ .SiteURL }}` | Your Site URL (used for the logo, terms and privacy links) |
| `{{ .Data.full_name }}` | From `data.full_name` — falls back to just "Welcome to Open Church" |
| `{{ .Data.church_name }}` | From `data.church_name` — falls back to "Your church" |
| `{{ .Data.trial_ends }}` | From `data.trial_ends` — the date is left out if missing |
| `{{ .Data.support_whatsapp }}` | From `data.support_whatsapp` — the WhatsApp line is hidden if missing |

### Notes

- Supabase's built-in email sender is only for testing (a few emails per hour).
  For real churches, set up your own SMTP under **Authentication → Emails → SMTP Settings**
  (e.g. Resend, SendGrid, Brevo or Google Workspace).
- `/terms` and `/privacy` in the footer should point to real pages before launch.
- The layout is email-safe (tables, inline styles, a button Outlook can draw), so it
  looks the same in Gmail, Outlook and phone mail apps.
