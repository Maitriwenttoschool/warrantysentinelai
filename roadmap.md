# Roadmap (order: 2 → 3 → 4 → 1)
- [x] Complete remaining development that does not need external services: approval controls and dealer analytics.
- [x] Reviewer sign-in and profiles.
- [x] Save claims, analysis, decisions, and audit steps; reopen after reload.
## 2. Adjudication & intake
- [x] Claims queue page with status filter, dealer search, date sort.
- [x] Evidence attachments (work order, invoice, telematics log) with pre-flight check.
- [x] View/open/download attached evidence on saved claims.
- [x] Dealer accreditation rule + mandatory diagnostic log rule.
- [x] Configurable SRTG labor matrix.
## 3. Compliance & reporting
- [x] Printable/PDF audit summary.
- [x] Escalation for claims over $50k or high risk, with an explicitly assigned different reviewer and atomic audit signoff.
- [ ] Restrict signoff to designated senior managers — needs approved manager identities; currently assigned independent reviewers.
## 4. Enterprise integrations
- [ ] Telematics API ingestion (needs vendor credentials).
- [x] Dealer risk analytics, date/dealer filters, owner-only aggregation, and CSV export.
- [ ] ERP settlement export (needs ERP endpoint).
## 1. Closeout
- [ ] Verify signed-in workflow end to end — no registered reviewers exist; needs first reviewer sign-in and a second reviewer for dual signoff.
- [x] Verify public desktop/mobile pages, print PDF, approval business rules, and deployed security checks.
- [x] Mandatory decision note for Investigate/Reject.
