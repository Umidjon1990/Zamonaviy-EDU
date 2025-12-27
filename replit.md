# EduCRM - O'quv Markaz Boshqaruv Tizimi

## Overview

EduCRM is a School CRM / Education Center Management Web Application designed for the Uzbekistan market. The entire UI is in Uzbek (Latin alphabet), targeting education centers (o'quv markazlari) with features for managing leads, students, groups, schedules, attendance, and payments. The system is built as a single-tenant MVP with multi-tenant architecture prepared for future scaling.

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
- **Hardcoded Tenant ID**: MVP uses `TENANT_ID = 1` for single-tenant operation
- **Uzbek Localization**: All UI text stored in `client/src/lib/i18n.ts`
- **API Hooks Pattern**: Custom hooks in `lib/api.ts` wrap React Query for data fetching
- **Mobile-First**: Responsive sidebar with Sheet component for mobile navigation

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