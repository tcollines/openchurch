# Open Church — Multi-Tenant Church Management System

Built for **1000 Micro Church Network International** as a mobile-first, multi-tenant Church Management System covering **7 core departments** plus a **Multi-Tenant Network Council** portal.

## Core Departments & Features

1. **Administration (`/admin/*`)**
   - Church Member **Attendance Percentage (%) Graph** across services
   - Cross-department **Requisitions & Workplans / Budgets** approval queue
   - **Members Data & Attendance History** + **Pick-a-Service Attendance Inspector** (with Excel export)
   - **Finance Oversight Tab**: Collected vs Spent globally and **per specific service**
   - **Serving Members Directory** & login provisioning + Admin HOD `More` tab
2. **Finance Department (`/finance/*`)**
   - Per-service collection entry in **3 categories**: `1. Offertory`, `2. Tithe`, and `3. Partnership` (strictly tied to a registered Partner)
   - **Partner Register** + cumulative Partner giving statements
   - **Expenses & Requisition Payouts** + HOD `More` tab
3. **Bacenta Department (`/bacentas/*`)**
   - **Head of Bacentas Dashboard**: Add Bacentas, receive Meeting & Outreach reports, track individual Bacenta finance contributions, track dual **Bacenta Meeting + Church Service** member attendance, plus HOD `More` tab
   - **Individual Bacenta Dashboard**: Meeting Check-In, Meeting & Outreach report submission (Date, Labourers, Souls Won, Testimony), and Meeting Finance (`Tithe` / `Offertory`)
4. **Airport Stars Department (`/airport-stars/*`)**
   - Create Services + instant Name/Phone search check-in + inline New Member registration
   - **Airport Stars Members** are strictly locked to `Service Check-In` only
   - **Airport Stars HOD** accesses `Dept Attendance` plus the HOD `More` tab
5. **Tele Pastoring Department (`/tele-pastoring/*`)**
   - **3-Missed Services** automatic absentee retention alert queue + pastoral comments
   - **Submit Reachout Report**: Member search + `Physical Visit` (Labourers, Amount Spent, Comment) or `Phone Call` (Comment, Amount Sent if any) synced automatically to Finance expenses
   - **Souls Won (4-Week Follow-Up Tracker)** + **Members Dashboard** + HOD `More` tab
6. **Children's Church (`/children/*`)**
   - **Kids Check-In** consuming Services created by Airport Stars + Child Safety Check-Out banner
   - **Souls Won** + **3-Missed Services** child follow-up + HOD `More` tab
7. **Campuses Department (`/campuses/*`)**
   - **Head of Campuses Dashboard** + **Individual Campus Dashboard** (operating with dual attendance, outreach/meeting reports, campus finance, and HOD `More` tab)

### Universal HOD `More` Tab (`HodMoreTab`)
Every HOD dashboard mounts a dedicated **`More`** tab (`••• More` on mobile bottom navigation) containing:
1. **Requisitions**
2. **Workplans / Budgets**
3. **Dept Contributions**
4. **Dept Members Info** (including serving attendance & contact actions)

---

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

For live Supabase deployment, run `supabase/migrations/001_open_church_schema.sql` in your Supabase SQL Editor and copy `.env.example` to `.env`.

