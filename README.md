# Commands To Run The Project

## Quick Start (npm)

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open the app:

http://localhost:8080

## Quick Start (bun)

1. Install dependencies:

```bash
bun install
```

2. Start development server:

```bash
bun run dev
```

3. Open the app:

http://localhost:8080

## Useful Scripts

```bash
npm run dev         # Run local dev server
npm run build       # Production build
npm run build:dev   # Development-mode build
npm run preview     # Preview production build
npm run lint        # Lint source code
npm run test        # Run Vitest once
npm run test:watch  # Run Vitest in watch mode
```

Playwright (end-to-end):

```bash
npx playwright install
npx playwright test
```

# Project Information

Frontend-procureflow is a React + TypeScript procurement workflow application. It models the full purchasing lifecycle from request creation to payment approval, with AI-assisted insights in key screens.

The current implementation is frontend-focused and uses mock datasets for requests, vendors, RFQs, bids, purchase orders, invoices, notifications, and analytics.

## Core Modules

- Dashboard and operational KPIs
- Raise Request and Demand Validation
- Request management and Finance review
- Vendor and RFQ/Tender management
- Bid management and vendor shortlisting
- Approval workflow
- Purchase orders, delivery tracking, invoices, and payment approval
- Notifications and activity feed

## Tech Stack

- React 18
- TypeScript 5
- Vite 5
- React Router DOM 6
- TanStack Query
- Tailwind CSS + Radix UI (shadcn-style components)
- Vitest + Testing Library
- Playwright

## Project Structure

```text
src/
	components/         # Layout, shared, and UI components
	hooks/              # Reusable React hooks
	lib/                # Utilities and mock data
	pages/              # Route-level page components
	test/               # Test setup and examples
```

## Data Source

Mock data is defined in:

- src/lib/mock-data.ts

Replace these mocks with API calls when backend services are ready.

## Environment Notes

- No required environment variables are needed to run the project locally right now.
- If you add secrets later, place them in .env files and do not commit them.

## Development Notes

- Default dev server port is 8080.
- The app entry is src/main.tsx and routes are configured in src/App.tsx.
- A placeholder page exists at src/pages/Index.tsx and is not used by the main route setup.
