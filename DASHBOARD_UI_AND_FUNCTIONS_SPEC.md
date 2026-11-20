# Open Church — Complete Dashboard Functions & UI Creation Specification

![Open Church — 1000 Micro Church Network International](./frontend/public/logo.jpg)

> **Purpose of This Document**: Serves as the definitive **UI/UX Design & Functional Blueprint** for creating, refining, or prototyping every screen in **Open Church**. Every dashboard, role boundary, navigation bar, KPI card, chart, list item, bottom-sheet form, field validation rule, and cross-department data link is specified below.

---

## 1. Visual Identity & Mobile-First UI Rules

### 1.1 Brand Color Tokens (Derived from Logo)

| Token | Hex | UI Usage |
| :--- | :--- | :--- |
| **Forest Primary** | `#073B1D` | Desktop left sidebar, executive hero banners, primary dark buttons, active mobile bottom-nav pill |
| **Emerald Action** | `#16A34A` | Primary CTA buttons (`Check In`, `Save Entry`, `Approve`), positive counters, WhatsApp badges |
| **Micro-Church Lime** | `#A3E635` | Active tab text/icon on `#073B1D` surfaces, chart highlights, subtle focus accents |
| **Light Canvas** | `#F4F7F5` | App background — high contrast for outdoor/daylight mobile check-in |
| **Card Surface** | `#FFFFFF` | All content cards (`rounded-2xl`, `1px solid #E2E8F0` border, subtle shadow) |
| **Slate Ink** | `#0F172A` / `#64748B` | Primary headings (`font-black` / `font-extrabold`) and secondary helper labels |
| **Warning Amber** | `#F59E0B` | Pending approvals, 3-missed-services alerts, un-checked-out child safety banner |
| **Alert Rose** | `#EF4444` | Expenditures, rejected requisitions, suspended tenants |

### 1.2 Core Mobile-First Layout Principles
1. **Phone-First Viewport (`360px – 430px`)**:
   - **Top Sticky Header (`56px`)**: Displays Church Logo, Active Tenant Name + Currency badge (`UGX`, `KES`, `USD`), Current Role subtitle, and Profile/Switch menu.
   - **Thumb-Zone Fixed Bottom Navigation (`64px` + safe-area)**: Maximum **3 to 5 tabs** per dashboard. Never overflow horizontally.
   - **Card-Over-Table Pattern**: On mobile, never render wide horizontal-scrolling data tables. Render each member, transaction, soul, or report as a **tappable vertical card** with primary info on the left and a **44px–48px 1-tap action button** on the right.
   - **Slide-Up Bottom Sheets (`MobileSheet`)**: All creation/edit forms (`+ Create Service`, `+ Register New`, `+ Submit Requisition`, `Comment`) slide up from the bottom of the phone screen (`max-h-[90vh]`, rounded top corners `24px`) and center as clean modals on desktop (`>= 640px`).
2. **Simple Desktop Adaptation (`>= 768px`)**:
   - Fixed left `256px` `#073B1D` sidebar with navigation items + quick department inspection links (for Church Administration).
   - Clean `max-w-6xl` centered content area with 2–4 KPI cards per row and 2-column split grids where helpful.
3. **Typography**:
   - **UI & Headings**: `Inter` (`700–900` weights for titles/KPIs, `500–600` for labels).
   - **Numbers, Phones & Currency**: `JetBrains Mono` so financial columns, E.164 phone numbers (`+256...`), dates, and requisition IDs (`REQ-1001`) align crisply.

---

## 2. Master Dashboard & Role Matrix

Open Church has **12 distinct dashboard experiences** across **14 roles** (1 Platform role + 13 Church Tenant roles):

| # | Dashboard Name | Target Role(s) | Bottom / Sidebar Navigation Tabs | Has HOD `More` Tab? |
| :--- | :--- | :--- | :--- | :---: |
| **0** | **Network Council** | `PLATFORM_ADMIN` | `Tenants`, `Inspect Tenant` | N/A |
| **1** | **Administration** | `ADMIN` | `Overview`, `Members`, `Finance`, `Serving`, **`More`** | **Yes** |
| **2A** | **Finance (HOD)** | `FINANCE_HOD` | `Entry`, `Partners`, `Outflows`, **`More`** | **Yes** |
| **2B** | **Finance (Member)** | `FINANCE_OFFICER` | `Entry`, `Partners`, `Outflows` | No |
| **3A** | **Head of Bacentas** | `BACENTA_HOD` | `Bacentas`, `Attend`, `Finance`, **`More`** | **Yes** |
| **3B** | **Bacenta Dashboard** | `BACENTA_LEADER` | `Check-In`, `Outreach`, `Finance` | No |
| **4A** | **Airport Stars (HOD)** | `AIRPORT_HOD` | `Check-In`, `Team Att.`, **`More`** | **Yes** |
| **4B** | **Airport Stars (Member)** | `AIRPORT_MEMBER` | **`Check-In` ONLY** *(bottom bar hidden — single-view lock)* | No |
| **5A** | **Tele Pastoring (HOD)** | `TELE_HOD` | `3-Missed`, `Reachout`, `Souls`, `Members`, **`More`** | **Yes** |
| **5B** | **Tele Pastoring (Member)** | `TELE_PASTOR` | `3-Missed`, `Reachout`, `Souls`, `Members` | No |
| **6A** | **Children's Church (HOD)** | `CHILDREN_HOD` | `Check-In`, `Souls`, `Follow-Up`, **`More`** | **Yes** |
| **6B** | **Children's Church (Worker)**| `CHILDREN_WORKER` | `Check-In`, `Souls`, `Follow-Up` | No |
| **7A** | **Head of Campuses** | `CAMPUS_HOD` | `Campuses`, `Attend`, `Finance`, **`More`** | **Yes** |
| **7B** | **Campus Dashboard** | `CAMPUS_LEADER` | `Check-In`, `Outreach`, `Finance` | No |

---

## 3. Shared Component: Universal HOD `More` Tab (`••• More`)

Every **Head of Department (HOD)** dashboard (`ADMIN`, `FINANCE_HOD`, `BACENTA_HOD`, `AIRPORT_HOD`, `TELE_HOD`, `CHILDREN_HOD`, `CAMPUS_HOD`) mounts this exact component as its final **`More`** tab. Regular members and unit leaders **never** see this tab.

### Functions of the 4 Sub-Sections Inside `More`
1. **`Requisitions`**:
   - **Displays**: List of departmental fund requests showing `Requisition Number` (`REQ-1001`), `Date`, `Title`, itemized `Qty × Description`, `Paid` vs `Total` amount, Status badge (`PENDING ADMIN`, `APPROVED`, `PAID`, `REJECTED`), and inline red Admin rejection reason if rejected.
   - **Primary Action (`+ Submit Requisition` Sheet)**: `Requisition Title`, optional `Link to Workplan`, optional `Link to Specific Service`, and dynamic `Line Items` repeater (`Item Description`, `Quantity`, `Unit Cost` -> live calculated total).
2. **`Workplans / Budget`**:
   - **Displays**: Monthly departmental budget cards showing `Month (YYYY-MM)`, `Title`, `Status` badge, itemized `Activity + Item Needed + Cost`, and 3-column summary (`Gross Budget`, `Dept Contribution Offset`, `Approved Amount`).
   - **Primary Action (`+ New Workplan` Sheet)**: `Month (YYYY-MM)`, `Dept Contribution Offset`, `Workplan Title`, and dynamic `Budget Activities` repeater (`Activity`, `Item Needed`, `Qty`, `Unit Cost`).
3. **`Contributions` (Department Member Contributions)**:
   - **Displays**: 2 KPI cards (`Total Dept Contributions`, `Contributing Members`) + chronological ledger of internal contributions made by department members (`Member Name`, `Purpose`, `Date`, `Payment Method`, `+Amount`).
   - **Primary Action (`+ Record Contribution` Sheet)**: `Contributing Member`, `Contribution Amount`, `Purpose / Project`, `Payment Method`, `Date`. Automatically syncs to the church finance ledger under `DEPT_CONTRIBUTION`.
4. **`Members Info` (Department Serving Roster & Duty Attendance)**:
   - **Displays**: Service selector (`Duty: <Service Name>`) + cards for every member serving in the department (`Full Name`, `Serving Role` badge, `Phone`, `Residence`, `Overall Service Attendance %`, `Call`, `WhatsApp`, `Mark Duty / On Duty` toggle, and `Remove`).
   - **Primary Action (`+ Add Member` Sheet)**: Picks an existing person from the central Church Member database and assigns their `Department Role`.

---

## 4. Screen-by-Screen Specification of Every Dashboard

### 4.0 Authentication (`/login`) & Multi-Tenant Network Council (`/platform/tenants`)
- **Login (`/login`)**: Forest Green branded login screen with the circular **1000 Micro Church Network International** logo, email login card, and automatic post-login role routing.
- **Network Council (`/platform/tenants` — `PLATFORM_ADMIN`)**: KPI strip (`Total Churches`, `Active Churches`, `Platform Users`), Tenant directory cards (`Suspend / Activate`, `Inspect`), and `+ Provision New Church` sheet (creates isolated tenant + auto-seeds all 7 core departments + primary Admin account).

### 4.1 Dashboard 1 — Administration Department (`/admin/*`)
1. **`Overview` (`/admin/overview`)**:
   - 4 KPI cards (`Avg Attendance %`, `Church Members`, `Pending Requisitions`, `Pending Workplans`).
   - **Church Member Attendance Percentage Graph** (AreaChart plotting `%` attendance per service).
   - **Requisitions & Workplans/Budgets Approval Queues** with 1-tap `Approve` and `Reject` actions.
2. **`Members & Services` (`/admin/members`)**:
   - **Sub-view A (`Members History`)**: Searchable member directory; tapping any member opens their chronological **Service Attendance Timeline Sheet**.
   - **Sub-view B (`Pick a Service`)**: Service dropdown picker showing `Adults Attended`, `Attendance %`, `Children Checked In`, full `CHECKED IN` vs `ABSENT` roster, and **1-click Excel Export**.
3. **`Finance Oversight` (`/admin/finance`)**:
   - Scope dropdown (`All Services & Operations` vs **Pick Specific Service**) + 3 KPIs (`Total Collected`, `Total Spent`, `Net Balance`) + full income/expense transaction feed.
4. **`Serving Members` (`/admin/serving`)**:
   - Cross-department directory of all serving volunteers & HODs with attendance `%` + `+ Assign Serving Member` sheet (with optional System Dashboard Login creation).
5. **`More` (`/admin/more`)**: Universal `HodMoreTab` for Administration's internal team.

### 4.2 Dashboard 2 — Finance Department (`/finance/*`)
1. **`Service Entry` (`/finance/collections`)**:
   - Pick active/past Service -> 4 live summary cards (`Offertory`, `Tithe`, `Partnership`, `Service Total`) -> 3-category entry form:
     - `1. Offertory`
     - `2. Tithe` (optional member link)
     - `3. Partnership` (**strictly requires selecting a Partner from the Partner Register**, with inline `+ Register Partner` shortcut).
2. **`Partner Register` (`/finance/partners`)**:
   - Partner cards with pledge tier & cumulative giving; tap any card to open their **Partner Giving Statement**; `+ Add Partner` sheet.
3. **`Expenses & Payouts` (`/finance/outflows`)**:
   - 1-tap **`Disburse`** queue for Admin-approved department requisitions + `+ Record Expense` sheet + complete expenditure ledger.
4. **`More` (`/finance/more` — `FINANCE_HOD` only)**: Universal `HodMoreTab`.

### 4.3 Dashboards 3A & 3B — Bacenta Department (`/bacentas/*`)
- **3A. Head of Bacentas (`/bacentas/hod/*`)**:
  - `Bacentas`: KPIs, Bacenta cards, `+ Add Bacenta` wizard (with member assignment & leader login), and incoming **Meeting & Outreach Reports** feed (`Labourers`, `Souls Won`, `Testimony`).
  - `Dual Attendance`: Side-by-side per-member **Bacenta Meeting Attendance `%`** vs **Main Church Service Attendance `%`**.
  - `Finance`: Per-Bacenta Tithes & Offertories summary and remittance ledger.
  - `More`: Universal `HodMoreTab`.
- **3B. Individual Bacenta Dashboard (`/bacentas/my-unit/*`)**:
  - `Check-In`: 1-tap Bacenta member meeting check-in, `+ Member` quick add, and Meeting Report (`Date`, `Labourers`, `Souls Won` + convert contact, `Testimony`).
  - `Outreach`: Submit Outreach Report (`When outreach was`, `Location`, `How many labourers`, `How many souls won`, `Testimony`).
  - `Finance`: Submit meeting `Offertory` or `Tithe`.

### 4.4 Dashboards 4A & 4B — Airport Stars Department (`/airport-stars/*`)
- **4A. Airport Stars Member (`/airport-stars/checkin`)**:
  - **Strictly locked to Service Check-In ONLY** (bottom bar & `More` hidden).
  - `+ Create Service` sheet, `+ Register New & Check In` sheet, live `Checked In` & `First Timers` KPIs, instant Name/Phone search, and 1-tap `Check In`.
- **4B. Airport Stars HOD (`/airport-stars/*`)**:
  - Adds `Undo Check-In`, **`Dept Attendance`** tab (duty attendance & `%` for Airport Stars members), and **`More`** (`HodMoreTab`).

### 4.5 Dashboard 5 — Tele Pastoring Department (`/tele-pastoring/*`)
1. **`3-Missed Services` (`/tele-pastoring/absentees`)**: `Needs Contact` vs `Followed Up` toggle cards + members who spent 3 consecutive services without attending + 1-tap `Call`/`WhatsApp` + `Comment` sheet.
2. **`Submit Reachout` (`/tele-pastoring/reachout`)**: Search & pick Member + mode toggle:
   - `Physical Visit`: `How many labourers`, `How much was spent`, `Comment`.
   - `Phone Call`: `Comment`, `How much sent (if any)`.
   - Non-zero spend/sent auto-posts to Finance expenses.
3. **`Souls Won (4 Weeks)` (`/tele-pastoring/souls`)**: Interactive `Wk 1` -> `Wk 2` -> `Wk 3` -> `Wk 4` step buttons per soul, progressing automatically to `INTEGRATED`.
4. **`Members Directory` (`/tele-pastoring/members`)**: Member search, attendance `%`, and pastoral reachout history sheet.
5. **`More` (`/tele-pastoring/more` — `TELE_HOD` only)**: Universal `HodMoreTab`.

### 4.6 Dashboard 6 — Children's Church (`/children/*`)
1. **`Kids Check-In` (`/children/checkin`)**: Uses Services created by Airport Stars, displays live Amber/Green **Child Safety Banner**, `Checked In` / `Checked Out` / `Souls Won` KPIs, 1-tap `Check In`, `Check Out`, `Soul Won`, and `+ Register Child`.
2. **`Souls Won` (`/children/souls`)**: Child salvations directory, guardian `Call`/`WhatsApp`, and `+ Log Child Soul`.
3. **`3-Missed Kids` (`/children/followup`)**: Flags children missing 3 consecutive services with guardian contact links and follow-up comment sheet.
4. **`More` (`/children/more` — `CHILDREN_HOD` only)**: Universal `HodMoreTab`.

### 4.7 Dashboards 7A & 7B — Campuses Department (`/campuses/*`)
- **7A. Head of Campuses (`/campuses/hod/*`)**: `+ Add Campus`, incoming Campus Meeting & Outreach Reports, **Dual Campus + Church Service Attendance**, per-Campus `Tithe` & `Offertory` tracker, and HOD `More` tab.
- **7B. Individual Campus Dashboard (`/campuses/my-unit/*`)**: 1-tap student Meeting Check-In + Meeting Report, Outreach Report (`Date`, `Labourers`, `Souls Won`, `Testimony`), and Campus Meeting Finance (`Offertory` / `Tithe`).

