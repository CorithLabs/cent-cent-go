# cent-cent-go 📈

> ByteByteGo-style clear visual explanations — but for stocks.

A web platform for individual investors and traders to analyze stocks, understand economic processes, and explore market data. Search any ticker to see price charts, fundamental metrics, and a plain-English ELI5 summary powered by Chrome Built-in AI.

**Data is for informational purposes only and does not constitute financial advice.**

---

## Prerequisites

| Tool | Version |
|---|---|
| Go | 1.22+ |
| Node.js | 20+ |
| Docker & Docker Compose | Latest stable |
| gitleaks (optional but recommended) | v8+ |

---

## Quick Start

### 1. Clone and set up environment variables

```bash
git clone https://github.com/CorithLabs/cent-cent-go.git
cd cent-cent-go

# Copy the example env file and fill in your API keys
cp .env.example .env
```

Edit `.env` and set:
- `POLYGON_API_KEY` — free at https://polygon.io/dashboard/signup
- `FRED_API_KEY` — free at https://fred.stlouisfed.org/docs/api/api_key.html
- `DATABASE_URL` — auto-set by docker-compose for local dev

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts a PostgreSQL 16 instance on port 5432. The initial schema migrations run automatically from `backend/db/migrations/`.

Wait for PostgreSQL to be healthy:
```bash
docker compose ps  # shows "healthy" when ready
```

### 3. Start the backend

```bash
cd backend
go run ./cmd/server
# Server running on :8080
# GET http://localhost:8080/health → { "status": "ok" }
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
# Vite dev server running on http://localhost:5173
# /api/* requests are proxied to http://localhost:8080
```

Open http://localhost:5173 in Chrome 127+ for full ELI5 support.

---

## Project Structure

```
cent-cent-go/
├── backend/                    # Go (Gin) REST API
│   ├── cmd/server/main.go      # Entry point
│   ├── api/routes.go           # Gin router
│   ├── internal/
│   │   ├── handlers/           # HTTP handlers (one file per resource)
│   │   ├── services/           # Business logic & external API calls
│   │   ├── models/             # Data models / DTOs
│   │   ├── middleware/         # Rate limiting, CORS, auth middleware
│   │   └── db/                 # PostgreSQL connection
│   └── db/migrations/          # SQL migration files (run at startup via docker)
├── frontend/                   # React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── pages/              # Route-level page components
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # Custom React hooks
│   │   └── main.tsx            # App entry point
│   └── index.html
├── .env.example                # Required environment variable template
├── .gitleaksrc.toml            # Secret scanning rules
├── .git-hooks/pre-commit       # Pre-commit secret scan hook
├── docker-compose.yml          # Local PostgreSQL
└── .github/workflows/ci.yml    # CI: secret scan + Go tests + frontend tests
```

---

## Running Tests

```bash
# Backend
cd backend && go test ./...

# Frontend
cd frontend && npm run test
```

---

## Security

### API Key Protection

All API keys (`POLYGON_API_KEY`, `FRED_API_KEY`) are stored **server-side only** via environment variables. They are never sent to the frontend.

### Secret Scanning

This repo uses [gitleaks](https://github.com/gitleaks/gitleaks) for defense-in-depth:

**Install the pre-commit hook** (one-time setup):
```bash
git config core.hooksPath .git-hooks
chmod +x .git-hooks/pre-commit
```

The hook runs `gitleaks detect` before every commit and blocks it if credentials are detected.

The CI pipeline also runs gitleaks on every push and PR — commits with detected secrets will fail CI.

If you hit a false positive in a test fixture, add the fingerprint to `.gitleaksignore` with a comment explaining why.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POLYGON_API_KEY` | ✅ | Polygon.io API key (stock data) |
| `FRED_API_KEY` | ✅ | FRED API key (economic indicators) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `PORT` | ❌ | Server port (default: 8080) |
| `RATE_LIMIT_RPM` | ❌ | Rate limit: requests per minute per IP (default: 60) |
| `RATE_LIMIT_WINDOW` | ❌ | Rate limit window duration (default: 60s) |

---

## Data Sources

- **Stocks**: [Polygon.io](https://polygon.io) — delayed quotes, OHLCV history, fundamentals, ticker search
- **Economics**: [FRED](https://fred.stlouisfed.org) — GDP, CPI, Fed Funds Rate, Unemployment, Treasury yields
- **ELI5 narratives**: [Chrome Built-in AI](https://developer.chrome.com/docs/ai/built-in) (window.ai / Gemini Nano) — runs on-device, zero API cost

**Disclaimer**: Data is for informational purposes only and does not constitute financial advice.
