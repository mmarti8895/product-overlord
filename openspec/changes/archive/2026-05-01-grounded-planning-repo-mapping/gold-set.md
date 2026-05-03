# Repo-Mapping Gold Set

20 labeled tickets with expected top-3 component matches.
Used to gate rollout at **component precision-at-3 ≥ 70%**.

Format: `ticket_key | summary | expected_top_3_components`

---

## Gold Set v1 (2026-04-30)

| # | Ticket Key | Summary | Expected Top-3 Components |
|---|---|---|---|
| 1 | AUTH-101 | Add OAuth2 login to auth service | `auth`, `api-gateway`, `frontend` |
| 2 | AUTH-102 | Fix JWT token expiry not refreshing | `auth`, `session`, `api-gateway` |
| 3 | AUTH-103 | Add MFA support for admin accounts | `auth`, `admin`, `notifications` |
| 4 | PAY-201 | Integrate Stripe checkout for subscriptions | `payments`, `billing`, `frontend` |
| 5 | PAY-202 | Fix double-charge bug on retry | `payments`, `billing`, `api-gateway` |
| 6 | PAY-203 | Add Apple Pay support to checkout | `payments`, `frontend`, `mobile` |
| 7 | NOTIF-301 | Send email on failed payment | `notifications`, `payments`, `email` |
| 8 | NOTIF-302 | Push notification when order ships | `notifications`, `orders`, `mobile` |
| 9 | NOTIF-303 | Allow users to unsubscribe from emails | `notifications`, `email`, `user-prefs` |
| 10 | ORDERS-401 | Add order cancellation flow | `orders`, `payments`, `notifications` |
| 11 | ORDERS-402 | Show estimated delivery date on order page | `orders`, `frontend`, `logistics` |
| 12 | ORDERS-403 | Fix order history pagination bug | `orders`, `frontend`, `api-gateway` |
| 13 | SEARCH-501 | Add full-text product search | `search`, `products`, `frontend` |
| 14 | SEARCH-502 | Improve search relevance for typos | `search`, `nlp`, `products` |
| 15 | SEARCH-503 | Cache search results in Redis | `search`, `cache`, `infra` |
| 16 | ADMIN-601 | Add bulk user deactivation to admin panel | `admin`, `auth`, `frontend` |
| 17 | ADMIN-602 | Export user data as CSV | `admin`, `reporting`, `storage` |
| 18 | INFRA-701 | Migrate database to PostgreSQL 16 | `infra`, `db`, `migrations` |
| 19 | INFRA-702 | Add health check endpoint to all services | `infra`, `api-gateway`, `monitoring` |
| 20 | INFRA-703 | Enable distributed tracing with OpenTelemetry | `infra`, `monitoring`, `api-gateway` |

---

## Precision-at-3 Calculation

For each ticket, the mapper is run against the repo index. A ticket is counted
as a **hit** if at least one of the expected top-3 components appears in the
mapper's top-3 results. Precision-at-3 = hits / 20.

**Rollout gate: precision-at-3 ≥ 0.70 (≥ 14/20 hits)**

---

## Notes

- Components named here are illustrative. Actual component names depend on the
  connected repository structure. Update expected components after initial index.
- Low-confidence results (`low_confidence: true`) count as a miss unless the
  expected component still appears in the top-3.
- Re-run this evaluation after any change to mapper scoring weights.
