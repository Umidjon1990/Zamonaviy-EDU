# Zamonaviy-Edu - O'quv Markaz Boshqaruv Tizimi

## Overview

Zamonaviy-Edu is a School CRM / Education Center Management Web Application developed for the Uzbekistan market. It provides a comprehensive system for managing education centers, including features for leads, students, groups, schedules, attendance, and payments. The UI is entirely in Uzbek (Latin alphabet), and the system is built as a single-tenant MVP with a multi-tenant architecture designed for future scalability.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui with Radix UI
- **Styling**: Tailwind CSS v4 with custom CSS variables
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **API Pattern**: RESTful API endpoints
- **Authentication**: Session-based for tenants, token-based for super admin

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL
- **Schema**: Defined in `shared/schema.ts` with Zod validation
- **Migrations**: Drizzle Kit

### Core Entities
The system manages entities such as Tenants, Users (with roles), Leads, Students, Subjects, Groups, Attendance, and Payments. All tenant-specific entities include a `tenant_id` for multi-tenancy.

### Key Design Decisions
- **Multi-Tenant Architecture**: Ensures full tenant isolation with session-based authentication and database-level enforcement of `tenantId` on all storage operations.
- **Uzbek Localization**: All UI text is localized.
- **API Hooks Pattern**: Custom React Query hooks for data fetching.
- **Mobile-First Design**: Responsive layout with a mobile navigation sidebar.
- **Security**: Bcrypt for password hashing, session data stored in PostgreSQL, and stringent checks to prevent unauthorized data access across tenants.
- **Printing System**: Global `@media print` CSS for clean printing of specific components.

### Authentication System
- **Tenant User Auth**: Session-based login with phone and password, logout, and session validation.
- **Super Admin Auth**: Token-based login with username and password.

## External Dependencies

### Database
- **PostgreSQL**: Primary database.
- **connect-pg-simple**: For storing Express sessions.

### UI Libraries
- **Radix UI**: Headless component primitives.
- **Lucide React**: Icon library.
- **Recharts**: Charting for visualizations.
- **Embla Carousel**: Carousel component.
- **cmdk**: Command palette component.

### Form & Validation
- **React Hook Form**: Form state management.
- **Zod**: Schema validation.
- **@hookform/resolvers**: Zod resolver for React Hook Form.

### PDF Generation
- **jsPDF**: For generating PDF documents.
- **jspdf-autotable**: Plugin for table generation in PDFs.

### Development Tools
- **Drizzle Kit**: Database migration tool.
- **tsx**: TypeScript execution for Node.js.
- **esbuild**: Production bundling for server code.

### Third-Party Integrations
- **Telegram Bot API**: For notifications and teacher commands.
- **Eskiz.uz**: SMS gateway for sending messages.