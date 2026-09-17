# Antum / Antum People

Antum is a strategic workforce intelligence platform, and **Antum People** is our HR onboarding and offboarding intelligence product specifically tailored for the **GCC market (UAE, KSA, etc.)**.

## Overview

Antum People transforms administrative transitions into strategic intelligence levers. We provide deep data capture and ensure compliance with regional labor laws and data privacy regulations (e.g., UAE PDPL, KSA PDPL).

### Key Features

- **GCC Compliance Engine**: Specialized workflows for UAE and Saudi Arabia.
- **EOSB Calculator**: Accurate End-of-Service Benefit calculations based on local laws.
- **Privacy Center**: Automated PDPL consent tracking and data subject rights management.
- **Workforce Intelligence**: Dashboard insights into retention, cost-per-hire, and time-to-value.

## Architecture

- **Frontend**: React + Vite + TypeScript (client/)
- **Backend**: Node.js + Express API (server/)
- **Data Layer**: Shared team-db (SQLite)
- **Primary Domains**: antum.ae (UAE), antum.me (global)

## Local Development

### Prerequisites

- Node.js (v18+)
- Bun (optional)

### Setup

1. Install dependencies:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```

2. Start the backend:
   ```bash
   cd server && npm start
   ```

3. Build and serve the frontend:
   ```bash
   cd client && npm run build
   ```

The server is configured to serve the built frontend at `/` and API routes at `/api`.

## Rebranding Note

On 2026-09-17, this product was rebranded from **VantageHR** to **Antum** / **Antum People**.

## Contact

- UAE: privacy@antum.ae, dpo@antum.ae, legal@antum.ae
- Global: privacy@antum.me
