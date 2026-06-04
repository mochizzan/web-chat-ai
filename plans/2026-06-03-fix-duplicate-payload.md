# Blueprint: Fix Duplicate Request Payload

## A. SYSTEM OVERVIEW

### Target Architecture
Modify the chat message sending flow in the frontend to ensure that the current user message and its associated assistant placeholder are not included in the conversation history sent to the backend.

### Feature Scope
- **Issue**: The current implementation adds the user message and an empty assistant placeholder to the Zustand store *before* reading the store to construct the request payload. This leads to the user message appearing twice (once in history, once as the current message) and an empty assistant message being sent, which wastes tokens and can confuse the LLM.
- **Goal**: Reorder operations in `handleSend` to capture history before updating the UI state.

## B. FILE MAPPING

| File | Action | Description |
| :--- | :--- | :--- |\n| [`src/hooks/useChatStream.ts`](src/hooks/useChatStream.ts) | Modify | Reorder logic in `handleSend` function |

## C. MODULE SPECIFICATIONS

### `useChatStream.ts` -> `handleSend`

**Current Logic (Buggy):**
1. Generate `tempId` and `placeholderAssistantId`.
2. Call `addMessage` (user) $\\rightarrow$ Store updated.
3. Call `addMessage` (assistant) $\\rightarrow$ Store updated.
4. `const currentMessages = useChatStore.getState().messages` $\\rightarrow$ **Captures current user msg + placeholder**.
5. Map `currentMessages` to `conversationHistory`.
6. Send `conversationHistory` to backend.
7. Backend adds current user message again $\\rightarrow$ **DUPLICATE**.

**Corrected Logic:**
1. Generate `tempId` and `placeholderAssistantId`.
2. `const currentMessages = useChatStore.getState().messages` $\\rightarrow$ **Captures only previous history**.
3. Map `currentMessages` to `conversationHistory`.
4. Call `addMessage` (user) $\\rightarrow$ UI updates.
5. Call `addMessage` (assistant) $\\rightarrow$ UI updates.
6. Send `conversationHistory` to backend.
7. Backend adds current user message $\\rightarrow$ **SINGLE/CORRECT**.

## D. DATA FLOW & ERROR HANDLING

### Data Flow Comparison

**Before Fix (Payload):**
`System` $\\rightarrow$ `User (Msg A)` $\\rightarrow$ `Assistant (Empty)` $\\rightarrow$ `User (Msg A)`

**After Fix (Payload):**
`System` $\\rightarrow$ `User (Msg A)`

### Error Handling
- No change to existing error handling in `handleSend` (try-catch blocks remain intact).
- Zustand store updates remain synchronous, ensuring no UI flicker.

## E. EXECUTION SEQUENCE

1. Open [`src/hooks/useChatStream.ts`](src/hooks/useChatStream.ts).
2. Locate the `handleSend` function (starting around line 626).
3. Move the block of code from lines 727-738 (history construction) to a position before lines 706-721 (the `addMessage` calls).
4. Ensure `tempId` and `placeholderAssistantId` are still declared at the top as they are needed for `addMessage`.
5. Verify that `conversationHistory` is still defined and accessible before the API call is initiated.
6. Test by sending a message and inspecting the network request payload to confirm duplication is gone.