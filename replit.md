# AI Code Review Assistant

## Overview

This is a full-stack web application built for AI-powered code review assistance. The application allows users to fetch GitHub pull requests and generate AI reviews using an n8n workflow integration. It features a React frontend with shadcn/ui components, an Express.js backend, and PostgreSQL database integration using Drizzle ORM.

## System Architecture

The application follows a full-stack TypeScript architecture with clear separation between client and server:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Build Tool**: Vite with TypeScript compilation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Database Driver**: Neon Database serverless driver
- **Session Management**: Express sessions with PostgreSQL storage
- **API Design**: RESTful endpoints for GitHub PR operations

### Project Structure
```
├── client/          # React frontend application
├── server/          # Express.js backend
├── shared/          # Shared TypeScript types and schemas
├── migrations/      # Database migration files
└── dist/           # Production build output
```

## Key Components

### 1. GitHub Integration
- **PR Fetching**: Proxies requests to n8n workflow for listing GitHub pull requests
- **Review Triggering**: Sends PR data to n8n workflow for AI review generation
- **Review Display**: Fetches and displays generated reviews from file system

### 2. Database Layer
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: User management schema with potential for expansion
- **Migrations**: Automated database schema management

### 3. External Service Integration
- **n8n Workflow**: Integration with external n8n instance via ngrok tunnel
- **GitHub API**: Indirect access through n8n workflow proxy
- **File System**: Review storage and retrieval from local files

### 4. User Interface
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Component Library**: Comprehensive shadcn/ui components
- **Dark Mode**: Built-in theme switching capability
- **Error Handling**: Toast notifications and error boundaries

## Data Flow

1. **PR Fetching Flow**:
   - User inputs repository name
   - Frontend calls `/api/prs` endpoint
   - Backend proxies request to n8n workflow
   - GitHub data returned and displayed in table format

2. **Review Generation Flow**:
   - User clicks "Generate Review" for specific PR
   - Frontend sends POST to `/api/trigger` with repo and PR number
   - Backend constructs GitHub API URL and sends to n8n workflow
   - n8n processes PR and generates review.txt file
   - User can fetch review via `/api/review` endpoint

3. **Review Display Flow**:
   - Frontend polls `/api/review` endpoint
   - Backend reads review.txt from file system
   - Review content displayed in expandable UI component

## External Dependencies

### Backend Dependencies
- **Database**: Neon PostgreSQL serverless database
- **Session Store**: PostgreSQL-based session storage
- **HTTP Client**: Axios for external API calls
- **File System**: Node.js fs/promises for file operations

### Frontend Dependencies
- **UI Framework**: Radix UI primitives for accessibility
- **State Management**: TanStack Query for caching and synchronization
- **HTTP Client**: Fetch API with custom wrapper
- **Utilities**: Class variance authority, clsx, date-fns

### External Services
- **n8n Workflow**: External automation platform accessible via ngrok
- **GitHub API**: Accessed indirectly through n8n workflow
- **Ngrok Tunnel**: Provides HTTPS endpoint for n8n workflow

## Deployment Strategy

### Development Environment
- **Frontend**: Vite dev server with HMR
- **Backend**: tsx for TypeScript execution with hot reload
- **Database**: Development database with push-based schema updates

### Production Build
- **Frontend**: Vite production build to `dist/public`
- **Backend**: esbuild compilation to `dist/index.js`
- **Database**: Migration-based schema management
- **Static Serving**: Express serves built frontend assets

### Environment Configuration
- **Database**: `DATABASE_URL` environment variable required
- **N8N Integration**: Hardcoded ngrok URL (should be configurable)
- **CORS**: Configured for cross-origin requests in development

## Changelog

```
Changelog:
- July 06, 2025. Initial setup
- July 06, 2025 (PM). Connected to real n8n workflow - removed demo data fallbacks, implemented proper n8n response handling, added workflow status notifications
- July 06, 2025 (Evening). Major UI overhaul and feature enhancement:
  * Completely redesigned modern UI with gradient backgrounds and glass-morphism effects
  * Implemented actual AI review format parsing and display with syntax highlighting
  * Added comprehensive debugging statements throughout frontend and backend
  * Created detailed README.md with complete setup and troubleshooting guide
  * Enhanced review display with proper code blocks, category icons, and copy functionality
  * Replaced "powered by n8n" branding with "Intelligent code analysis powered by AI"
  * Added support for localhost:5678 AI agent integration for local development
  * Implemented structured review parsing for point-wise presentation
  * Enhanced error handling and user feedback throughout the application
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```