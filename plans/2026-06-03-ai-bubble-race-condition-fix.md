# Plan: Fix AI Bubble Premature Disappearance & State Leak

## System Overview
Fix a race condition where the `StreamingBubble` unmounts immediately on empty responses and a state leak where `isGenerating` stays `true` after network errors, freezing the chat UI.

## File Mapping
- `src/hooks/useChatStream.ts`: Fix state reset in `handleSend` catch block.
- `src/components/chat/message-list.tsx`: Update `StreamingBubble` completion logic.

## Module Specifications

### 1. `src/hooks/useChatStream.ts`
- **Target**: `handleSend` function catch block (~line 804).
- **Change**: Add `setIsGenerating(false)` before throwing the error.
- **Goal**: Ensure the user can send another message if the previous one failed due to a network error.

### 2. `src/components/chat/message-list.tsx`
- **Target**: `StreamingBubble` useEffect for `onVisualComplete` (~line 246).
- **Change**: Modify the condition to prevent immediate completion when content is empty.
- **Updated Logic**: 
  `if (phase === 'responding' && !isStreaming && visibleLength === content.length && content.length > 0)`
- **Goal**: If the response is empty, the bubble shouldn't just vanish; it should either show an error or stay as a bubble until handled by the store.

## Execution Sequence
1. Modify `src/hooks/useChatStream.ts` to ensure `setIsGenerating(false)` is called in all error paths.
2. Modify `src/components/chat/message-list.tsx` to prevent premature `onVisualComplete` for empty content.
3. Test with:
    - Normal response (Verify bubble flow).
    - Empty response (Verify bubble doesn't flash/disappear).
    - Network failure (Verify `isGenerating` resets and UI stays interactive).