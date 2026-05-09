# feature/payment-tracker

Payment tracking feature branch for FaconDormitelProject.
No changes to `docker-compose.yml` or any Docker configuration.

---

## What this branch adds

### Backend — new files
| File | Description |
|---|---|
| `Backend/models/Bill.js` | Bill schema — stores utilities, auto-calculated splits per tenant |
| `Backend/controllers/billController.js` | All bill logic (create, list, status update, tenant reads) |
| `Backend/routes/bills.js` | Tenant-facing routes (`/api/bills/my`) |

### Backend — modified files
| File | Change |
|---|---|
| `Backend/models/Room.js` | Added `tenants[]` array (ObjectId refs) for bill-splitting |
| `Backend/routes/admin.js` | Added bill routes + room↔tenant assignment routes |
| `Backend/server.js` | Registered `/api/bills` route |

### Frontend — new files
| File | Route | Who sees it |
|---|---|---|
| `Frontend/src/pages/admin/BillsPage.jsx` | `/admin/bills` | Owner only |
| `Frontend/src/pages/tenant/BillingStatementsPage.jsx` | `/tenant/billing` | Tenant only |
| `Frontend/src/pages/tenant/BillDetailPage.jsx` | `/tenant/bills/:billId` | Tenant only |
| `Frontend/src/pages/tenant/PaymentTrackerPage.jsx` | `/tenant/payments` | Tenant only |

---

## How to set up the branch

```bash
# 1. Create and switch to the feature branch
git checkout -b feature/payment-tracker

# 2. Copy all new files into place (see structure above)

# 3. Restart only the backend container — no Docker rebuild needed
docker compose restart backend
```

---

## API routes added

### Owner routes — all require `Authorization: Bearer <token>` with role `owner`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/bills` | Create a bill for a room |
| `GET` | `/api/admin/bills` | List all bills |
| `GET` | `/api/admin/bills/:billId` | Get single bill detail |
| `PATCH` | `/api/admin/bills/:billId/tenants/:tenantId` | Mark payment as paid / pending / overdue |
| `POST` | `/api/admin/rooms/:roomId/tenants` | Assign a tenant to a room |
| `DELETE` | `/api/admin/rooms/:roomId/tenants/:tenantId` | Remove a tenant from a room |

### Tenant routes — all require `Authorization: Bearer <token>` with role `client`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/bills/my` | Get all my bills |
| `GET` | `/api/bills/my/:billId` | Get single bill detail (my share + roommates) |

---

## Example: Create a bill (owner)

```json
POST /api/admin/bills
{
  "roomId": "<mongo-room-id>",
  "period": "2025-05",
  "dueDate": "2025-05-15",
  "utilities": {
    "electricity": 1400,
    "water": 600,
    "internet": 550
  }
}
```

Response includes `shareAmount` auto-calculated as `totalAmount ÷ tenants.length`.

---

## App.jsx — routes to add

Add these imports and routes inside your existing React Router setup:

```jsx
// imports
import BillsPage               from './pages/admin/BillsPage';
import BillingStatementsPage   from './pages/tenant/BillingStatementsPage';
import BillDetailPage          from './pages/tenant/BillDetailPage';
import PaymentTrackerPage      from './pages/tenant/PaymentTrackerPage';

// inside your <Routes> — adjust wrapper components to match your existing layout
<Route path="/admin/bills"          element={<BillsPage />} />
<Route path="/tenant/billing"       element={<BillingStatementsPage />} />
<Route path="/tenant/bills/:billId" element={<BillDetailPage />} />
<Route path="/tenant/payments"      element={<PaymentTrackerPage />} />
```

---

## Owner workflow

1. Go to **Admin → Bill Management**
2. Assign tenants to rooms first via `POST /api/admin/rooms/:roomId/tenants`
3. Click **+ New Bill**, select the room, period, due date, and enter utility amounts
4. The system auto-splits the total equally across all assigned tenants
5. Click **Details** on any bill to expand per-tenant payment rows
6. Use the dropdown on each row to mark payments as **Paid / Pending / Overdue**

## Tenant workflow

1. Go to **Billing Statements** to see all posted bills and their statuses
2. Click **View →** on any bill to see the full utility breakdown and your share
3. Go to **Payment Tracker** for the full ledger with filter tabs (All / Paid / Pending / Overdue)
