# Blueprint: Custom Toast for Anonymous Users on Paid Models

## A. System Overview

Currently, anonymous users who attempt to use a paid model are greeted with a "Kredit Habis" (Credit Exhausted) toast. This is misleading because anonymous users do not have a credit balance to "exhaust"; they simply lack an account to hold credits.

**Target:** Change the toast message to "Model Berbayar - Login Untuk Menggunakan" specifically for unauthenticated users, while maintaining the "Kredit Habis" message for authenticated users who have actually run out of credits.

## B. File Mapping

| File | Action | Purpose |
| :--- | :--- | :--- |
| [`src/hooks/useChatStream.ts`](src/hooks/useChatStream.ts) | Modify | Update `handleSend` credit guard to differentiate between anonymous and logged-in users. |
| [`src/components/chat/chat-input.tsx`](src/components/chat/chat-input.tsx) | Modify | Update `handleSend` credit guard to differentiate between anonymous and logged-in users. |

## C. Module Specifications

### 1. `useChatStream.ts`
- **Location:** `handleSend` function, around line 645.
- **Logic Change:** 
  - Instead of a generic toast, retrieve `isLoggedIn` state from `useChatDataStore`.
  - If `!isLoggedIn` $\\rightarrow$ Toast: "Model Berbayar - Login Untuk Menggunakan".
  - If `isLoggedIn` $\\rightarrow$ Toast: "Kredit Habis".

### 2. `chat-input.tsx`
- **Location:** `handleSend` function, around line 66.
- **Logic Change:** 
  - Instead of a generic toast, retrieve `isLoggedIn` state from `useChatDataStore`.
  - If `!isLoggedIn` $\\rightarrow$ Toast: "Model Berbayar - Login Untuk Menggunakan".
  - If `isLoggedIn` $\\rightarrow$ Toast: "Kredit Habis".

## D. Data Flow & Error Handling

1. **Input:** User clicks send with a paid model selected.
2. **Guard Check:** `credit <= 0 && !isFreeModel` is evaluated.
3. **Branching:**
   - **Path A (Anonymous):** `isLoggedIn` is false $\\rightarrow$ UI triggers "Model Berbayar..." toast $\\rightarrow$ Function returns (blocks request).
   - **Path B (Logged-in):** `isLoggedIn` is true $\\rightarrow$ UI triggers "Kredit Habis..." toast $\\rightarrow$ Function returns (blocks request).
4. **Result:** Request is blocked before hitting the API, providing a context-aware explanation to the user.

## E. Execution Sequence

1. **Modify `src/hooks/useChatStream.ts`**: Update the credit check block to include the `isLoggedIn` check and the new toast message.
2. **Modify `src/components/chat/chat-input.tsx`**: Update the credit check block to include the `isLoggedIn` check and the new toast message.
3. **Verification**: 
   - Test as anonymous user $\\rightarrow$ Select paid model $\\rightarrow$ Send $\\rightarrow$ Verify "Model Berbayar..." toast.
   - Test as logged-in user (0 credit) $\\rightarrow$ Select paid model $\\rightarrow$ Send $\\rightarrow$ Verify "Kredit Habis" toast.
   - Test as anonymous user $\\rightarrow$ Select free model $\\rightarrow$ Send $\\rightarrow$ Verify message sends successfully.