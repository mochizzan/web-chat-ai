# Blueprint: BYOK Credit Protection Hardening

**Date:** 2026-06-03
**Scope:** Hardening credit protection across all BYOK and Web UI request paths to prevent negative balances and standardize error messages in Bahasa Indonesia.

---

## A. SYSTEM OVERVIEW

### Problem
The BYOK credit check workflow already prevents requests when credit is insufficient, but has:
1. Error messages in English (API path) instead of Bahasa Indonesia (Web UI path already correct)
2. No SQL-level guard against negative credit balances as a last-resort defense

### Goal
- All credit-related error messages standardized to Bahasa Indonesia
- SQL-level negative balance guard added as defense-in-depth
- Consistent behavior across BYOK API and Web UI paths

---

## B. FILE MAPPING

| File | Action | Changes |
|------|--------|---------|
| `src/services/api-gateway.service.ts` | Modify | Change `reserveCredit()` error message to Indonesian |
| `src/lib/openai-errors.ts` | Modify | Change `oaiQuotaError()` default message to Indonesian |
| `src/services/billing.service.ts` | Modify | Change `deductCredit()` error message to Indonesian |
| `src/repositories/billing.repo.ts` | Modify | Add `WHERE credit >= ?` guard in `updateUserCredit()` |

---

## C. MODULE SPECIFICATIONS

### C1. `src/services/api-gateway.service.ts` — `reserveCredit()` (Line 489)

**Current (English):**
```typescript
throw new Error(
  `INSUFFICIENT_CREDITS: Required ${minRequired.toFixed(4)}, available ${balance.toFixed(4)}`
);
```

**Target (Indonesian):**
```typescript
throw new Error(
  `INSUFFICIENT_CREDITS: Kredit tidak cukup. Diperlukan minimal ${minRequired.toFixed(4)}, tersedia ${balance.toFixed(4)}`
);
```

- Keep `INSUFFICIENT_CREDITS:` prefix for error type detection (`err.message?.includes('INSUFFICIENT_CREDITS')`)
- Only change the human-readable portion after the prefix

### C2. `src/lib/openai-errors.ts` — `oaiQuotaError()` (Line 70)

**Current:**
```typescript
export function oaiQuotaError(message = 'Insufficient credit balance'): Response {
```

**Target:**
```typescript
export function oaiQuotaError(message = 'Kredit tidak cukup'): Response {
```

### C3. `src/services/billing.service.ts` — `deductCredit()` (Line 159)

**Current:**
```typescript
throw new Error('Insufficient credit');
```

**Target:**
```typescript
throw new Error('Insufficient credit: Kredit tidak cukup. Silakan lakukan top-up terlebih dahulu.');
```

- Keep `Insufficient credit` prefix for backward compatibility with error catching logic
- Append Indonesian message for user-facing display

### C4. `src/repositories/billing.repo.ts` — `updateUserCredit()` (Line 245)

**Current:**
```typescript
const sql = 'UPDATE users SET credit = credit + ? WHERE id = ?';
const params = [amount, userId];
```

**Target (when used for deduction, amount is negative):**
```typescript
// For deduction (amount < 0), add SQL-level guard against negative balance
if (amount < 0) {
  const sql = 'UPDATE users SET credit = credit + ? WHERE id = ? AND credit >= ?';
  const params = [amount, userId, Math.abs(amount)];
} else {
  const sql = 'UPDATE users SET credit = credit + ? WHERE id = ?';
  const params = [amount, userId];
}
```

**Alternative approach (simpler — modify `deductCredit` in billing.service.ts):**

Since `BillingService.deductCredit()` already does `SELECT ... FOR UPDATE` + balance check before calling `updateUserCredit()`, and the deducted amount passed is always positive (then converted to negative via `credit + ?`), the safest fix is to:

1. In `BillingService.deductCredit()`, pass the deduction as a **negative value** with a guard clause in SQL
2. OR: Change the repository method signature to accept a guard parameter

**Recommended approach:**
```typescript
// billing.repo.ts — add new method or modify existing
async deductUserCredit(userId: string, amount: number, conn?: PoolConnection): Promise<boolean> {
  const sql = 'UPDATE users SET credit = credit - ? WHERE id = ? AND credit >= ?';
  const params = [amount, userId, amount];
  const [result] = conn
    ? await conn.execute(sql, params)
    : await query(sql, params);
  return (result as any).affectedRows > 0;
}
```

Then in `BillingService.deductCredit()`, replace the `updateUserCredit` call:
```typescript
const deducted = await BillingRepository.deductUserCredit(userId, amount, conn);
if (!deducted) {
  throw new Error('Insufficient credit: Kredit tidak cukup. Silakan lakukan top-up terlebih dahulu.');
}
```

---

## D. DATA FLOW & ERROR HANDLING

### Current Error Flow (BYOK API)
```
Request → reserveCredit() → balance < minRequired?
  ├─ YES → throw INSUFFICIENT_CREDITS (English) → oaiQuotaError() → HTTP 402 (English default)
  └─ NO  → proceed → OmniRouter → deductCredit() → currentBalance < amount?
              ├─ YES → throw "Insufficient credit" (English)
              └─ NO  → UPDATE credit (no SQL guard)
```

### Target Error Flow (BYOK API)
```
Request → reserveCredit() → balance < minRequired?
  ├─ YES → throw INSUFFICIENT_CREDITS (Indonesian) → oaiQuotaError() → HTTP 402 (Indonesian default)
  └─ NO  → proceed → OmniRouter → deductCredit() → currentBalance < amount?
              ├─ YES → throw "Insufficient credit: Kredit tidak cukup..." (Indonesian)
              └─ NO  → UPDATE credit WHERE credit >= ? (SQL guard)
                        └─ affectedRows === 0 → throw Indonesian error (race condition catch)
```

### Failure Handling
- **Race condition between check and deduct**: SQL `WHERE credit >= ?` guard catches this
- **DB unavailable in checkCredit**: Currently returns -1 (allows proceed) — this is acceptable for free models only
- **Deduction fails mid-stream**: `analyzeStreamInBackground` logs error but stream already sent to client — acceptable tradeoff

---

## E. EXECUTION SEQUENCE

1. **Modify `src/lib/openai-errors.ts`** (Line 70)
   - Change default message of `oaiQuotaError()` from English to Indonesian

2. **Modify `src/services/api-gateway.service.ts`** (Line 489-491)
   - Change `reserveCredit()` error message from `"Required X, available Y"` to `"Kredit tidak cukup. Diperlukan minimal X, tersedia Y"`

3. **Modify `src/services/billing.service.ts`** (Line 159)
   - Change `deductCredit()` error message to include Indonesian text

4. **Modify `src/repositories/billing.repo.ts`** (Line 237-267)
   - Add `deductUserCredit()` method with `WHERE credit >= ?` SQL guard
   - OR modify `updateUserCredit()` to accept a `guardMinimum` parameter

5. **Update `src/services/billing.service.ts`** to use the new repository method
   - Replace `updateUserCredit(userId, -amount, conn)` with `deductUserCredit(userId, amount, conn)`
   - Check return value and throw Indonesian error if deduction failed

6. **Verify existing tests still pass**
   - Run `npm test` to confirm no regressions
