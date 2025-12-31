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

### Multi-Tenant Data Isolation (Security Hardened)
- **Storage Layer Enforcement**: All update/delete storage methods require tenantId parameter and enforce it in SQL WHERE clauses with AND conditions
- **Read Methods with Tenant Scoping**: getStudent, getGroup, getTeacher, getPayment, getAttendanceById, getGradeById all accept optional tenantId for tenant-scoped queries
- **Route Handler Consistency**: All tenant-specific routes extract tenant_id from session via `getTenantId(req)` and pass it to storage methods
- **No Post-Fetch Checks**: Tenant validation happens at the database query level, not after fetching (prevents TOCTOU vulnerabilities)
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

### Development Tools
- **Drizzle Kit**: Database migration tooling
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Production bundling for server code