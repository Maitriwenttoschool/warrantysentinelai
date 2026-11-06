# Warranty Sentinel

Autonomous warranty claim orchestration for heavy equipment fleets.

## What it does

- **Claim intake** — reviewers enter warranty claims with serial number, dealer ID, and evidence files (private storage, 20 MB per file).
- **AI analysis** — a server-side narrative check reviews each claim; on AI failure the claim routes to manual review.
- **Audit trail** — every analysis and human decision is saved atomically with append-only audit events.
- **Second approval** — independent sign-off is assigned to a different registered reviewer, enforced by database triggers.
- **Dealer analytics** — aggregates owner-submitted saved claims per dealer.

## Development

```sh
bun install
bun dev
```

Tests:

```sh
bunx vitest run
```
