# Model Public ID Forwarding — Blueprint

## A. SYSTEM OVERVIEW

### Problem
BYOK API users currently see raw OmniRouter model IDs (e.g., `opencode-zen/deepseek-v4-flash-free`). These IDs are internal, inconsistent, and expose provider routing details. Duplicate models from different providers (e.g., `opencode-zen/deepseek-v4-flash-free` vs `kr/deepseek-v4-flash`) need canonical resolution.

### Goal
- Custom branded model IDs for BYOK API (e.g., `milabs/deepseek-v4-flash`)
- Admin panel edit mode for managing model public IDs
- Automatic duplicate resolution during sync (pick one active provider per base model)
- Backward compatible: internal `id` unchanged for OmniRouter proxy

### Key Design Decisions
1. **`public_id` column on `models` table** — minimal schema change, no extra JOINs
2. **NULL = fallback to internal `id`** — backward compatible
3. **Brand prefix convention**: `milabs/{normalized-model-name}`
4. **Auto-assign on sync**: new models get `public_id` based on naming convention
5. **Duplicate detection**: if multiple providers serve the same base model, only the first active one gets a `public_id`

---

## B. FILE MAPPING

```
Modified Files:
├── src/lib/migration-public-id.sql          [NEW] Migration script
├── src/lib/store.ts                          [MOD] Add publicId to Model interface
├── src/repositories/model.repo.ts            [MOD] Add findByPublicId(), update sync
├── src/services/model.service.ts             [MOD] Handle publicId in update/get, auto-assign on sync
├── src/services/api-gateway.service.ts       [MOD] Resolve public_id before proxy
├── src/app/api/v1/models/route.ts            [MOD] Return public_id as model ID
├── src/app/api/models/route.ts               [MOD] Handle publicId in PUT
├── src/components/admin/admin-models-table.tsx [MOD] Add public_id column
├── src/components/admin/edit-model-dialog.tsx [MOD] Add public_id field
```

---

## C. MODULE SPECIFICATIONS

### C1. Database Migration — `src/lib/migration-public-id.sql`

```sql
-- Step 1: Add public_id column
ALTER TABLE models ADD COLUMN public_id VARCHAR(255) NULL DEFAULT NULL AFTER id;

-- Step 2: Add unique index
ALTER TABLE models ADD UNIQUE INDEX idx_models_public_id (public_id);

-- Step 3: Auto-populate public_id for active models
-- Convention: milabs/{normalized-name}
-- normalized-name = strip provider prefix, strip -free suffix, lowercase
UPDATE models 
SET public_id = CONCAT('milabs/', 
  REPLACE(
    REPLACE(
      SUBSTRING_INDEX(id, '/', -1),
      '-free', ''
    ),
    'DeepSeek', 'deepseek'
  )
)
WHERE status = 'active' 
  AND public_id IS NULL;

-- Step 4: Handle duplicates — clear public_id for duplicates 
-- (keep the first one alphabetically)
UPDATE models m1
INNER JOIN (
  SELECT public_id, MIN(id) as keep_id 
  FROM models 
  WHERE public_id IS NOT NULL 
  GROUP BY public_id 
  HAVING COUNT(*) > 1
) m2 ON m1.public_id = m2.public_id AND m1.id != m2.keep_id
SET m1.public_id = NULL;
```

### C2. TypeScript Type — `src/lib/store.ts`

Add `publicId` to `Model` interface:

```typescript
export interface Model {
  id: string;
  publicId?: string;           // ← NEW: branded model ID for BYOK API
  name: string;
  provider: string;
  // ... rest unchanged
}
```

### C3. Repository Layer — `src/repositories/model.repo.ts`

**New method `findByPublicId()`**:
```typescript
async findByPublicId(publicId: string): Promise<Model | null> {
  return await querySingle<Model>(
    'SELECT * FROM models WHERE public_id = ?', [publicId]
  );
},
```

**Update `syncModels()`**:
- After INSERT/UPDATE, auto-assign `public_id` for models that don't have one
- Use convention: `milabs/{normalized-base-name}`
- Handle duplicates: if `public_id` already exists for different model, skip assignment
- The `ON DUPLICATE KEY UPDATE` should NOT overwrite `public_id` (admin-controlled)

**Update `getModels()`**:
- Include `public_id` in SELECT (already covered by `SELECT *`)

### C4. Service Layer — `src/services/model.service.ts`

**Update `getModels()` mapping** (line 41-55):
```typescript
return models.map(m => ({
  id: m.id,
  publicId: m.public_id || undefined,  // ← NEW
  name: m.name,
  // ... rest unchanged
}));
```

**Update `updateModel()`** (line 58-86):
- Add `publicId` handling:
```typescript
if (data.publicId !== undefined) updates.public_id = data.publicId;
```

**New method `autoAssignPublicIds()`**:
- Called after sync or manually from admin
- Iterates all active models without `public_id`
- Generates `public_id` using naming convention
- Skips if `public_id` already taken by another model

**Naming Convention Logic**:
```typescript
function generatePublicId(internalId: string): string {
  // opencode-zen/deepseek-v4-flash-free → milabs/deepseek-v4-flash
  const baseName = internalId.split('/').pop() || internalId;
  const normalized = baseName
    .replace(/-free$/i, '')           // strip -free suffix
    .replace(/^DeepSeek/i, 'deepseek') // normalize casing
    .toLowerCase();
  return `milabs/${normalized}`;
}
```

**Update `syncModelsFromRemote()`** (line 120-186):
- After sync, call `autoAssignPublicIds()` to assign `public_id` for newly created models

### C5. API Gateway — `src/services/api-gateway.service.ts`

**Update `processRequest()`** (line 141-170):
```typescript
async processRequest(keyContext, body) {
  const requestedModel = body.model;
  let modelRecord = await ModelRepository.findByPublicId(requestedModel);
  
  if (!modelRecord) {
    // Fallback: try internal id (backward compat)
    modelRecord = await ModelRepository.getModelById(requestedModel);
  }
  
  if (!modelRecord || modelRecord.status !== 'active') {
    return oaiModelNotFound(requestedModel);
  }
  
  // Use internal id for OmniRouter proxy
  const omniBody = { ...body, model: modelRecord.id };
  // ... rest of proxy logic uses modelRecord for pricing etc.
}
```

**Key**: The `body.model` sent to OmniRouter should always be the internal `modelRecord.id`, NOT the `public_id`.

### C6. Public Models API — `src/app/api/v1/models/route.ts`

**CRITICAL RULE**: Only models with a non-null `public_id` appear in the BYOK API. Models without `public_id` are invisible to BYOK users.

**Update GET** (line 21-44):
```typescript
export async function GET() {
  try {
    // Only fetch models that have public_id assigned AND are active
    const models = await ModelRepository.getModelsWithPublicId();
    const data: OpenAIModel[] = models.map((m) => ({
      id: m.public_id!,  // ← Always public_id (guaranteed non-null by query)
      object: 'model' as const,
      created: Math.floor(new Date(m.created_at || Date.now()).getTime() / 1000),
      owned_by: m.provider || 'system',
    }));
    return Response.json({ object: 'list', data }, { status: 200 });
  } catch (error) { /* ... */ }
}
```

**New Repository Method `getModelsWithPublicId()`**:
```typescript
async getModelsWithPublicId(): Promise<Model[]> {
  return await query<Model[]>(
    "SELECT * FROM models WHERE public_id IS NOT NULL AND public_id != '' AND status = 'active' ORDER BY provider, name"
  );
},
```

**Example**: BYOK user sees `milabs/deepseek-v4-flash` in models list, uses it in `model: "milabs/deepseek-v4-flash"`.

### C7. Admin Models API — `src/app/api/models/route.ts`

**Update PUT handler** to accept `publicId`:
- Already handled by `ModelService.updateModel()` which will now support `publicId`

### C8. Admin Models Table — `src/components/admin/admin-models-table.tsx`

**Add `public_id` column** after Model name column (line 177):

```tsx
<TableHead className="text-xs font-semibold">Public ID</TableHead>
```

**Render in table body** (around line 200):
```tsx
<TableCell>
  <span className="text-xs font-mono text-muted-foreground">
    {model.publicId || <span className="text-muted-foreground/40 italic">auto</span>}
  </span>
</TableCell>
```

**Update search filter** (line 51-57) to also search `publicId`:
```typescript
const matchesSearch =
  model.name.toLowerCase().includes(q) ||
  model.provider.toLowerCase().includes(q) ||
  (model.publicId ?? '').toLowerCase().includes(q) ||
  (model.description ?? '').toLowerCase().includes(q);
```

**Add "Auto-assign" button** next to "Pull Models" (line 120-123):
```tsx
<Button variant="outline" className="gap-2" onClick={onAutoAssign}>
  <Wand2 className="h-4 w-4" />
  Auto Public ID
</Button>
```

### C9. Edit Model Dialog — `src/components/admin/edit-model-dialog.tsx`

**Add `publicId` to form state** (line 23-38):
```typescript
useEffect(() => {
  if (model) {
    setFormData({
      publicId: model.publicId,  // ← NEW
      name: model.name,
      // ... rest unchanged
    });
  }
}, [model]);
```

**Add field in UI** — "Informasi Dasar" section (after line 84):
```tsx
<div className="space-y-2">
  <Label htmlFor="publicId">Public ID (BYOK)</Label>
  <Input
    id="publicId"
    value={formData.publicId || ''}
    onChange={(e) => updateField('publicId', e.target.value || undefined)}
    placeholder="milabs/deepseek-v4-flash"
    className="bg-background font-mono text-sm"
  />
  <p className="text-xs text-muted-foreground">
    ID yang terlihat oleh pengguna BYOK API. Kosongkan untuk auto-generate.
  </p>
</div>
```

### C10. WS Events — `src/lib/ws-events.ts`

**Update `ModelWS` interface** (line 3-12):
```typescript
interface ModelWS {
  id: string;
  publicId?: string;  // ← NEW
  status: ModelStatus;
  // ... rest unchanged
}
```

**Update `NotificationService.broadcast`** in `model.service.ts` to include `publicId`.

---

## D. DATA FLOW AND ERROR HANDLING

### D1. Model List & Resolution Flow (BYOK API)

**Model List** (`GET /api/v1/models`):
```
Request → ModelRepository.getModelsWithPublicId()
  → SELECT * FROM models WHERE public_id IS NOT NULL AND status = 'active'
  → Return array with id = public_id (NEVER internal OmniRouter ID)
  → Models without public_id are INVISIBLE to BYOK users
```

**Model Resolution** (`POST /api/v1/chat/completions`):
```
User request (model: "milabs/deepseek-v4-flash")
  → ApiGatewayService.processRequest()
    → ModelRepository.findByPublicId("milabs/deepseek-v4-flash")
      → Found? Use this model record
      → Not found? ModelRepository.getModelById("milabs/deepseek-v4-flash")
        → Found? Use this model record (backward compat for direct internal ID)
        → Not found? Return 404 oaiModelNotFound
    → Proxy to OmniRouter with model: modelRecord.id (internal ID, e.g. "opencode-zen/deepseek-v4-flash-free")
```

### D2. Sync Flow

```
Admin clicks "Pull Models"
  → ModelService.syncModelsFromRemote()
    → Fetch from OmniRouter /models
    → ModelRepository.syncModels() — upsert all models
      → New models: INSERT with public_id = NULL
      → Existing models: UPDATE name, provider, etc. (NOT public_id)
      → Disabled models: those no longer in remote
    → ModelService.autoAssignPublicIds() — NEW
      → Find active models without public_id
      → Generate milabs/{normalized-name}
      → Skip if public_id already taken by another model
```

### D3. Error Handling

| Scenario | Handling |
|---|---|
| `public_id` already exists (duplicate) | Return 409 Conflict, admin must resolve |
| `public_id` set to empty string | Treat as NULL (auto-generate on next sync) |
| Model not found by `public_id` or `id` | 404 oaiModelNotFound |
| `public_id` collision during auto-assign | Skip, log warning, leave NULL |
| Sync overwrites admin-set `public_id` | Never overwrite — `ON DUPLICATE KEY UPDATE` excludes `public_id` |

---

## E. EXECUTION SEQUENCE

### Phase 1: Database Migration
1. Create `src/lib/migration-public-id.sql`
2. Run migration manually or via `init-db.js`

### Phase 2: Repository Layer
1. Add `public_id` to `Model` interface in `store.ts`
2. Add `findByPublicId()` to `ModelRepository`
3. Update `syncModels()` to preserve `public_id` on upsert
4. Add `autoAssignPublicIds()` to `ModelRepository`

### Phase 3: Service Layer
1. Update `ModelService.getModels()` mapping to include `publicId`
2. Update `ModelService.updateModel()` to handle `publicId`
3. Update `ModelService.syncModelsFromRemote()` to call `autoAssignPublicIds()`

### Phase 4: API Gateway
1. Update `ApiGatewayService.processRequest()` with dual lookup
2. Always proxy with internal `id`, never `public_id`

### Phase 5: Public API
1. Update `/api/v1/models` to return `public_id` as model ID

### Phase 6: Admin Panel
1. Update `admin-models-table.tsx` with `Public ID` column
2. Update `edit-model-dialog.tsx` with `public_id` field
3. Add "Auto Public ID" button with bulk assignment

### Phase 7: Testing
1. Unit test `findByPublicId()` in model.repo.test.ts
2. Unit test `autoAssignPublicIds()` logic
3. Unit test API gateway dual lookup
4. Integration test: BYOK request with `public_id` resolves correctly
5. Verify all existing tests still pass
