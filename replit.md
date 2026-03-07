# Zamonaviy-Edu - O'quv Markaz Boshqaruv Tizimi

## Overview

Zamonaviy-Edu is a School CRM / Education Center Management Web Application designed for the Uzbekistan market. The entire UI is in Uzbek (Latin alphabet), targeting education centers (o'quv markazlari) with features for managing leads, students, groups, schedules, attendance, and payments. The system is built as a single-tenant MVP with multi-tenant architecture prepared for future scaling.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom CSS variables for theming
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API endpoints under `/api/*`
- **Development**: Hot module replacement via Vite middleware
- **Production**: Static file serving with SPA fallback

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` with Zod validation via drizzle-zod
- **Migrations**: Drizzle Kit with `db:push` command

### Core Entities
- **Tenants**: Education centers (multi-tenant ready with `tenant_id` on all entities)
- **Users**: Staff with roles (super_admin, markaz_admin, teacher, manager, student, parent)
- **Leads**: Potential customers with status tracking (new, contacted, trial, converted, lost)
- **Students**: Enrolled students with balance tracking
- **Subjects**: Course subjects offered
- **Groups**: Class groups with teacher, schedule, and room assignments
- **Attendance**: Student attendance records
- **Payments**: Financial transactions

### Project Structure
```
├── client/           # Frontend React application
│   ├── src/
│   │   ├── components/  # UI components (layout, shadcn/ui)
│   │   ├── pages/       # Route pages (Dashboard, Leads, Students, etc.)
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities, API functions, i18n
├── server/           # Backend Express application
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database access layer
│   └── seed.ts       # Database seeding script
├── shared/           # Shared code between client/server
│   └── schema.ts     # Drizzle schema definitions
```

### Key Design Decisions
- **Multi-Tenant Architecture**: Full tenant isolation with session-based authentication
- **Uzbek Localization**: All UI text stored in `client/src/lib/i18n.ts`
- **API Hooks Pattern**: Custom hooks in `lib/api.ts` wrap React Query for data fetching
- **Mobile-First**: Responsive sidebar with Sheet component for mobile navigation

### Authentication System
- **Tenant User Auth**: Session-based authentication with bcrypt password hashing
  - Login: `POST /api/auth/login` with phone and password
  - Logout: `POST /api/auth/logout`
  - Check session: `GET /api/auth/me`
- **Super Admin Auth**: Token-based authentication for system administration
  - Login: `POST /api/super-admin/login` with username and password
  - Verify: `GET /api/super-admin/verify`
  - Credentials stored in environment secrets

### Multi-Tenant Data Isolation (Security Hardened - Feb 2026)
- **Storage Layer Enforcement**: ALL storage methods (read, update, delete) require tenantId parameter and enforce it in SQL WHERE clauses with AND conditions
- **Read Methods with MANDATORY Tenant Scoping**: getStudent, getGroup, getTeacher, getPayment, getAttendanceById, getGradeById, getSubject, getStudentsByGroup, getStudentGroups all REQUIRE tenantId (not optional)
- **Route Handler Consistency**: All tenant-specific routes extract tenant_id from session via `getTenantId(req)` and pass it to storage methods
- **No Post-Fetch Checks**: Tenant validation happens at the database query level, not after fetching (prevents TOCTOU vulnerabilities)
- **Session Integrity Check**: `/api/auth/me` validates user.tenantId matches session.tenantId, destroys session on mismatch
- User passwords are hashed with bcrypt (10 rounds)
- Session data stored in PostgreSQL via connect-pg-simple
- Suspended tenants cannot login (checked during authentication)

### Environment Secrets Required
- `SESSION_SECRET`: **REQUIRED** - Secret for signing session cookies. App will fail to start without this.
- `SUPER_ADMIN_USERNAME`: Super admin login username
- `SUPER_ADMIN_PASSWORD`: Super admin login password
- `SUPER_ADMIN_TOKEN_SECRET`: Secret for signing super admin tokens
- `TELEGRAM_BOT_TOKEN`: Telegram bot API token
- `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`: Eskiz.uz SMS gateway credentials

## External Dependencies

### Database
- **PostgreSQL**: Primary database (connection via `DATABASE_URL` environment variable)
- **connect-pg-simple**: Session storage for Express sessions

### UI Libraries
- **Radix UI**: Headless component primitives (dialogs, dropdowns, tabs, etc.)
- **Lucide React**: Icon library
- **Recharts**: Chart library for dashboard visualizations
- **Embla Carousel**: Carousel component
- **cmdk**: Command palette component

### Form & Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **@hookform/resolvers**: Zod resolver for React Hook Form

### PDF Generation
- **jsPDF**: PDF document generation for salary receipts, debtor lists, payment reports
- **jspdf-autotable**: Table plugin for jsPDF

### Development Tools
- **Drizzle Kit**: Database migration tooling
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Production bundling for server code

## Recent Features (March 2026)

### Teacher Salary System Improvements
- **Month range selector**: Salary can be calculated across a range of months (from/to) in Reports > Oylik tab
- **API endpoint**: `GET /api/teacher-salary/:teacherId?fromMonth=&toMonth=&year=&includeStudents=true` for detailed salary data with student breakdown
- **PDF export with students**: Two PDF options - basic salary receipt and full receipt with student payment details table
- **Print receipt**: Uses CSS `@media print` to print only the salary receipt (not the entire page), with clean formatted layout including teacher info, financial summary, and student list
- **Telegram sharing**: Share salary summary via Telegram

### Dashboard Month Filter
- Dashboard now has month/year selector (defaults to current month) in the header area
- All financial stats (monthly income, charts, financial summary) update based on selected month
- `GET /api/stats` endpoint now accepts optional `?month=&year=` query params

### Print System
- Global `@media print` CSS in `index.css` hides all page content except elements with `.print-receipt` class
- Both PaymentReceipt component and Reports salary receipt use `.print-receipt` class for clean printing
- Elements with `.no-print` class are hidden during printing

### Expense-Teacher Linking (March 2026)
- Expenses table now has `teacherId` column to link salary expenses to specific teachers
- When category is "salary" (Oylik maosh), teacher selector appears in expense form
- Teacher salary calculation deducts advance expenses: `finalSalary = calculatedSalary - totalAdvance`
- Advance amounts shown in salary receipt (UI cards, PDF, print, Telegram)
- `getExpensesByTeacher()` storage method filters expenses by teacherId + category='salary' + date range

### Teacher Permissions System (March 2026)
- Users table has `permissions` text array column for teacher-specific permissions
- Default teacher capabilities (always available): guruh yaratish, dars vaqtlarini belgilash, davomat olish, baho qo'yish
- Optional permissions (admin can grant/revoke):
  - `accept_payment`: To'lov qabul qilish
  - `move_student`: O'quvchini guruhdan guruhga ko'chirish
  - `edit_group`: Guruhlarni tahrir qila olish
  - `remove_student`: O'quvchini guruhdan chiqarish
  - `add_student`: O'quvchi qo'shish
- Backend: `hasTeacherPermission()` and `requireTeacherPermission()` middleware enforce permissions
- Frontend: Teachers page has permissions section with checkboxes in create/edit dialogs
- Permissions returned in both login and `/api/auth/me` responses

### Teacher Password Visibility (March 2026)
- Users table has `plainPassword` text column storing readable password alongside bcrypt hash
- Admin can see teacher passwords in Teachers page (eye icon toggle per row)
- Admin can change teacher password in edit dialog; both hash and plainPassword updated
- Excel import also saves plainPassword ("123456" default)

### Payment Filters (March 2026)
- Payments page has client-side filters: date range (fromDate/toDate) and name search
- Search matches student first/last name and teacher first/last name (case-insensitive)
- Shows filtered count vs total when filters active
- Clear filters button resets all

### Bulk Student Delete (March 2026)
- Students page has checkbox selection (individual + select all)
- Selection bar shows count with "O'chirish" and "Bekor qilish" buttons
- `POST /api/students/bulk-delete` endpoint accepts `{ studentIds: number[] }`
- Deletes from student_groups and students tables; payments are PRESERVED
- Tenant-scoped: first validates student IDs belong to tenant before deleting
- Confirmation dialog warns that payments will be preserved
- Permissions returned in both login and `/api/auth/me` responses

### Telegram Bot - Teacher Enhancements (March 2026)
- **Payment notifications**: When a student makes a payment, all teachers of that student's groups get a Telegram notification with student name, amount, and group name
- **New teacher commands**:
  - `📊 Ma'lumot` — Personal overview: groups count, students count, debtors, paid, monthly income, salary
  - `⚠️ Qarzdorlar` — Debtor students list by group with names, phone numbers, and debt amounts
- **Enhanced salary view** (`💰 Oylik`): Now includes paid students list and debtors list with balances
- **Enhanced daily schedule**: Morning schedule shows student names list per group + last attendance stats
- **Enhanced class reminder**: 30-min reminder now includes student names and last attendance (present/absent count)
- **Debtor logic**: `balance <= 0` = debtor (includes newly added students with 0 balance), `balance > 0` = paid
- Teacher keyboard: [📚 Guruhlar, 💰 Oylik], [📅 Davomat, 📊 Ma'lumot], [⚠️ Qarzdorlar]
- `notifyTeacherAboutPayment()` exported from telegram-bot.ts, called in POST /api/payments

### Payment Student Name Preservation (March 2026)
- Payments table now has `studentName` text column storing student's full name at payment time
- When a payment is created, `studentName` is populated from the student record
- Frontend `getStudentName()` falls back to `payment.studentName` if student no longer exists in DB
- This ensures deleted students' names still appear in payment history
- Search filter also checks `payment.studentName` for deleted students
- `fixDatabaseSchema()` includes `ALTER TABLE payments ADD COLUMN IF NOT EXISTS student_name TEXT`

### Payments Month Filter (March 2026)
- Payments page has month/year selector (defaults to current month) next to title
- All stats cards (tushum, jami to'lovlar, to'langan) filter by selected month
- Payment list filters by selected month first, then applies additional filters

### Dashboard Improvements (March 2026)
- Attendance stats now fetched for selected month (not just today)
- Attendance chart subtitle shows selected month name + year + record count
- Payment rate: percentage of active students who paid in selected month
- Today's classes show teacher name and time range (start-end)
- Today's classes show up to 6 classes (was 4)

### Telegram Admin Attendance Notifications (March 2026)
- When a teacher takes attendance, all admins with Telegram get a summary notification
- Notification includes: teacher name, group name, date, time, present/absent/total counts
- Uses 5-second debounce to batch individual attendance records into one summary message
- `notifyAdminAttendanceTaken()` exported from telegram-bot.ts
- Debounce logic in POST /api/attendance using `attendanceNotifyTimers` and `attendancePendingCounts` maps

### Groups Page Enrichment (March 2026)
- Groups API now returns `studentCount` and `teacherName` for each group
- Groups page cards show real student count in capacity bar (was hardcoded to 0)
- Groups page cards show teacher name with Users icon
- Progress bar fills proportionally based on studentCount / maxStudents

### Dashboard Teacher Attendance Summary (March 2026)
- `GET /api/attendance/teacher-summary?period=day|week|month&date=&month=&year=` endpoint returns per-teacher attendance stats
- Dashboard shows "O'qituvchilar davomati" section with period filter (Kun/Hafta/Oy tabs)
- Date navigation arrows for day/week modes, date input picker
- Per teacher: name, group count, days worked, present/absent counts, attendance rate %, today's class indicator
- Group-level breakdown showing per-group present/absent counts
- "Bugun darsi bor" badge for teachers with classes today, with time and room info
- Color-coded badges: green (>=80%), amber (>=50%), red (<50%), gray (no records)