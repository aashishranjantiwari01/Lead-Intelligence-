# Lead Intelligence Engine V1

A local web application for analyzing business leads, auditing websites, identifying sales opportunities, and managing a CRM pipeline.

> **Local only** — No cloud services, no paid APIs, no authentication required.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Environment Setup](#environment-setup)
4. [Starting the Application](#starting-the-application)
5. [Importing the Sample CSV](#importing-the-sample-csv)
6. [Running an Audit](#running-an-audit)
7. [Understanding Lead Scores](#understanding-lead-scores)
8. [API Endpoints](#api-endpoints)
9. [Running Tests](#running-tests)
10. [Project Structure](#project-structure)
11. [Limitations](#limitations)

---

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- Windows 10/11 (tested), macOS, or Linux

> **Playwright** (used for website auditing) requires Chromium. It is installed automatically, but may prompt you to run `npx playwright install chromium` if browsers are not found.

---

## Installation

```bash
# 1. Clone/copy the project
cd "d:\lead entillegence"

# 2. Install all dependencies (root + server + client)
npm install

# 3. Install Playwright browsers (required for website auditing)
cd server
npx playwright install chromium
cd ..
```

---

## Environment Setup

Copy the example environment file to create your local `.env`:

```bash
# The .env file is already pre-configured with defaults
# Edit if you need to change ports or database path
```

Default values in `.env`:
```
PORT=3001
CLIENT_URL=http://localhost:5173
DATABASE_PATH=./data/app.db
AUDIT_TIMEOUT_MS=15000
MAX_CONCURRENT_AUDITS=3
LOG_LEVEL=info
```

> The SQLite database is created automatically at `server/data/app.db` when the server starts.

---

## Starting the Application

Run both frontend and backend simultaneously from the root:

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

To run separately:
```bash
# Backend only
npm run dev:server

# Frontend only
npm run dev:client
```

---

## Importing the Sample CSV

1. Open http://localhost:5173
2. Click **Import** in the sidebar
3. Drop or select `sample-leads.csv` (in the project root)
4. Review the preview:
   - 10 total rows
   - One duplicate row will be detected
   - One invalid URL row will be flagged
5. Click **Import Leads**

The sample CSV includes:
| Business | Test Case |
|---|---|
| Dental Smile Clinic | Working fictional domain, Instagram |
| La Bella Pizzeria | Working fictional domain, Facebook |
| Fitnessclub Zürich | Working fictional domain, both social |
| Buchhandlung Müller | **No website** |
| Spa & Wellness Center | Working fictional domain |
| Tech Solutions GmbH | Working fictional domain, LinkedIn |
| Green Garden Café | **No website, no social** |
| Dental Smile Clinic (row 8) | **Duplicate** — same as row 2 |
| AutoHaus Schneider | **Invalid website URL** |
| Mountain View Hotel | Full contact info, all social platforms |

> All businesses are entirely fictional. No real personal data is used.

---

## Running an Audit

### Single Lead Audit
1. Open any lead from the Leads page
2. Click **Run Audit**
3. The audit runs in the background via Playwright
4. Refresh or wait — the audit queue page shows live progress
5. Results appear on the lead detail page

### Batch Audit
1. Go to **Audit Queue** page
2. Click **Audit Unaudited Leads** to queue all leads with websites
3. Or select multiple leads on the Leads page and click **Audit Selected**

### What the Audit Checks
- ✅ Website reachability (HTTPS, redirects, HTTP status)
- ✅ Load time and page size (internal performance heuristic)
- ✅ SEO: title, meta description, H1, canonical, viewport
- ✅ Mobile heuristic (viewport meta, horizontal overflow)
- ✅ Contact paths (forms, mailto, tel links)
- ✅ Booking flow detection (Calendly, Acuity, Fresha, etc.)
- ✅ WhatsApp links
- ✅ Social media links (Instagram, Facebook, LinkedIn)
- ✅ Analytics (Google Analytics, GTM, Meta Pixel)
- ✅ Technology detection (WordPress, Shopify, Webflow, etc.)
- ✅ Accessibility (axe-core automated check)

> **Important**: These are heuristic checks. Mobile results are labeled "Mobile heuristic." Performance scores are internal, not Google PageSpeed.

---

## Understanding Lead Scores

Lead scores (0–100) are **internal sales-prioritization scores only**. A higher score means more sales opportunity — it does NOT rate the quality of the business.

### Scoring Breakdown

| Signal | Points |
|---|---|
| No website | +30 |
| Website unreachable/broken | +25 |
| Poor performance (internal score < 50) | +10 |
| Mobile issues detected | +10 |
| No clear CTA | +8 |
| No booking flow | +10 |
| No contact form | +8 |
| No WhatsApp | +5 |
| Social presence + weak conversion | +5 |
| Email available | +5 |
| Phone available | +5 |
| Social profile available | +3 |

**Score is capped at 100.**

Every score shows the exact breakdown in the lead detail page under "Lead Score".

---

## API Endpoints

Base URL: `http://localhost:3001`

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server health check |

### Leads
| Method | Path | Description |
|---|---|---|
| GET | `/api/leads` | List leads (supports filters, search, sort) |
| POST | `/api/leads` | Create a lead |
| GET | `/api/leads/:id` | Get a single lead |
| PUT | `/api/leads/:id` | Update a lead |
| DELETE | `/api/leads/:id` | Delete a lead |
| POST | `/api/leads/import?action=preview` | Preview CSV import |
| POST | `/api/leads/import?action=import` | Import CSV |
| POST | `/api/leads/:id/audit` | Queue a website audit |
| GET | `/api/leads/:id/audit` | Get audit results |
| POST | `/api/leads/audit-batch` | Queue batch audit |
| POST | `/api/leads/:id/notes` | Add a note |
| GET | `/api/leads/export/csv` | Export leads to CSV |

### Dashboard
| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/stats` | Get dashboard statistics |

### Audit Queue
| Method | Path | Description |
|---|---|---|
| GET | `/api/audit-queue` | List all audit jobs |
| GET | `/api/audit-queue/stats` | Get queue stats |
| POST | `/api/audit-queue/:jobId/retry` | Retry a failed job |

### Activities
| Method | Path | Description |
|---|---|---|
| GET | `/api/activities/:leadId` | Get lead activity timeline |

### Settings
| Method | Path | Description |
|---|---|---|
| GET | `/api/settings` | Get current settings |
| PUT | `/api/settings` | Update settings |

### Query Parameters for `GET /api/leads`
| Parameter | Type | Description |
|---|---|---|
| `search` | string | Search business name, city, website, email |
| `lead_status` | string | Filter by CRM status |
| `website_status` | string | Filter by website status |
| `country` | string | Filter by country |
| `has_email` | boolean | Only leads with email |
| `has_phone` | boolean | Only leads with phone |
| `sort_by` | string | `lead_score`, `business_name`, `created_at`, `last_audited_at` |
| `sort_order` | `asc`/`desc` | Sort direction |

---

## Running Tests

```bash
# From root — runs all server tests
npm run test

# From server directory — watch mode
cd server
npm run test:watch
```

### What's Tested
- URL normalization (including SSRF protection)
- Business name normalization and deduplication
- Lead scoring algorithm
- Opportunity engine rules

---

## Project Structure

```
lead-intelligence-engine/
├── client/                    # React + Vite + Tailwind frontend
│   └── src/
│       ├── pages/             # Dashboard, Leads, Import, etc.
│       ├── layouts/           # AppLayout, Sidebar
│       ├── hooks/             # TanStack Query hooks
│       └── lib/               # API client, utilities
│
├── server/                    # Node.js + Express backend
│   └── src/
│       ├── analyzers/         # Modular website analyzers
│       ├── config/            # DB connection, app config
│       ├── db/                # Repository layer (CRUD)
│       ├── routes/            # Express route handlers
│       ├── services/          # Business logic
│       │   ├── csvImportService.ts
│       │   ├── websiteAuditService.ts
│       │   ├── opportunityEngine.ts
│       │   ├── leadScoringService.ts
│       │   ├── auditQueue.ts
│       │   └── sources/       # LeadSource implementations
│       ├── utils/             # URL/name normalization, logging
│       └── validators/        # Zod schemas
│
├── shared/                    # Shared TypeScript types
│   └── src/index.ts
│
├── sample-leads.csv           # 10 fictional test leads
├── .env                       # Environment configuration
└── package.json               # Monorepo root
```

---

## Limitations (V1 — Honest Assessment)

- **Mobile heuristic only**: The mobile check uses viewport meta and overflow detection, not a real device compatibility test.
- **Performance scores are internal**: Not Google PageSpeed — they are approximations based on load time and HTML size.
- **Accessibility is automated only**: axe-core automated checks only — not a comprehensive accessibility audit or certification.
- **Website auditing requires public URLs**: Private/intranet URLs are blocked for security.
- **No Google Maps, Instagram, or email outreach**: Planned for future phases.
- **Single user**: No authentication — this is a local tool.
- **Sequential audit queue**: V1 uses in-process sequential auditing. Performance under high load is not optimized.
- **No email enrichment**: Contact information is limited to what's manually entered or found on the website.

---

## Future Architecture

The application is designed for extensibility:

- **New lead sources**: Implement the `LeadSource` interface (`shared/src/index.ts`) to add Google Maps, Apollo, or any directory source.
- **Enrichment providers**: Implement `EnrichmentProvider` to add email or social enrichment.
- **The core pipeline remains the same**: LEAD → NORMALIZE → ENRICH → AUDIT → OPPORTUNITY → SCORE → MANAGE.

---

*Lead Intelligence Engine V1 — Built for local use. No cloud required.*
