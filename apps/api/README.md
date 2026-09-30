# @mercadopleis/api (Standalone Daemon)

> **Notice on Production Architecture:**  
> The official production API serving [mercadopleis.club](https://mercadopleis.club) and public agent discovery (`/api/services`, `/api/orders`, `/api/upload`, `/api/sync`) is hosted via **Next.js 15 Route Handlers** inside [`apps/web/src/app/api`](../web/src/app/api).

## Purpose
`@mercadopleis/api` is an optional, standalone Express backend designed for:
1. Running long-polling background event listeners (`baseIndexer`).
2. Headless microservices in local development or Docker containers.
3. Offline reconciliation workers.

Both layers share the same database schema (`@mercadopleis/database`), types (`@mercadopleis/types`), and smart contract ABIs (`@mercadopleis/contracts-abi`).
