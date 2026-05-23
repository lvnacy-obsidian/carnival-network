You're absolutely right. Let me think through this strategically.

## The Case for Renaming

**Your reasoning is sound:**

1. **Consistency with existing refactoring**
   - `CarnivalRecord` → `CarnivalAct` ✅ (already done)
   - `CarnivalPerformer` → `CarnivalPerformer` (logical next step)

2. **Hierarchy clarity**
```typescript
   // Current (ambiguous):
   CarnivalPerformer
   CarnivalPerformerInterface
   
   // Proposed (hierarchically clear):
   CarnivalPerformer
   CarnivalPerformerInterface
```
3. **At-a-glance understanding**
   - Developer sees `CarnivalPerformer` → immediately understands role in hierarchy
   - "Client" is generic networking terminology
   - "Performer" is carnival-specific and metaphorically precise

4. **Type system alignment**
```typescript
   CarnivalAct          // What they perform
   CarnivalPerformer    // Who performs
   CarnivalTroupe       // Collection of performers (future type)
   Territory            // Where they perform
```
---

## Proposed Renaming Strategy

### Phase 1: Core Type Renames

```typescript
// RENAME:
CarnivalPerformer           → CarnivalPerformer
CarnivalPerformerInterface  → CarnivalPerformerInterface

// KEEP (already correct):
CarnivalAct
CarnivalConfig
CarnivalQueryService
Territory
PerformerAccessService
ActService
```
### Phase 2: File Renames

```
src/network/
├── carnival-network-client.ts  → carnival-performer.ts
└── carnival-network.ts          → carnival-troupe-manager.ts (or keep as-is)

src/types/public/
└── carnival-client-types.ts    → carnival-performer-types.ts
```
### Phase 3: Variable & Method Updates

```typescript
// main.ts
private activePerformers: Map<string, CarnivalPerformer> = new Map();

// Public API methods
joinCarnival(
    performerId: string,
    storage: APIKeyStorage,
    config: CarnivalConfig
): CarnivalPerformerInterface {
    // Returns a performer instance
}
```
---

## Impact Analysis

### **Public API Breaking Change**

This IS a breaking change for any consuming plugins:

```typescript
// OLD (current):
const client: CarnivalPerformerInterface = plugin.joinCarnival(...);

// NEW (proposed):
const performer: CarnivalPerformerInterface = plugin.joinCarnival(...);
```
**Mitigation:**
- Since you're in Phase 3.3 (pre-release), NOW is the right time
- No public consumers yet (plugin not shipped)
- Better to break now than after v1.0

### **Internal Refactoring Scope**

Files to update:
```
src/main.ts                                    # Variable names
src/network/carnival-performer.ts              # Class rename
src/network/carnival-network.ts                # Import updates
src/types/public/carnival-performer-types.ts   # Interface renames
src/types/public/carnival-service-types.ts     # Return type references
src/types/public/index.ts                      # Re-exports
```
Estimated: **~15-20 files** to update imports/references

---

## Recommended Approach

### **Option A: Do It Now** (Recommended)

**Pros:**
- ✅ Phase 3.3 is perfect timing (type system refinement phase)
- ✅ No external consumers to break yet
- ✅ Aligns with `CarnivalRecord` → `CarnivalAct` refactoring already done
- ✅ Future-proof hierarchy clarity
- ✅ Easier onboarding for new developers

**Cons:**
- ⚠️ Moderate refactoring effort (~15-20 files)
- ⚠️ Requires updating CHANGELOG and docs

**Timeline:** Complete in Phase 3.3 before API implementation finishes

---

### **Option B: Alias Pattern** (Compromise)

Keep both names temporarily:

```typescript
// Export both for transition period
export class CarnivalPerformer implements CarnivalPerformerInterface {
    // Implementation
}

// Deprecated alias
/** @deprecated Use CarnivalPerformer instead */
export type CarnivalPerformer = CarnivalPerformer;

/** @deprecated Use CarnivalPerformerInterface instead */
export type CarnivalPerformerInterface = CarnivalPerformerInterface;
```
**Pros:**
- ✅ Gradual migration path
- ✅ Less immediate refactoring

**Cons:**
- ❌ Technical debt (maintain aliases)
- ❌ Confusion during transition
- ❌ Not necessary since no external consumers yet

---

## My Recommendation: **Do It Now**

Given that:
1. You're in active refactoring phase (Phase 3.3)
2. No external consuming plugins exist yet
3. You've already done `CarnivalRecord` → `CarnivalAct` 
4. The hierarchy clarity is valuable long-term
5. Your instinct for consistency is correct

**Let's do the full rename:**

```typescript
CarnivalPerformer          → CarnivalPerformer
CarnivalPerformerInterface → CarnivalPerformerInterface
```
This completes the thematic alignment and gives you:
- `CarnivalAct` (what)
- `CarnivalPerformer` (who)
- `Territory` (where)
- `ActService` (operations)
- `CarnivalQueryService` (intelligence)

---

## Implementation Plan

1. **Rename class and interface files** (2 files)
2. **Update all imports** (~15 files)
3. **Update main.ts** (variable names, method signatures)
4. **Update type exports** (index.ts)
5. **Update CHANGELOG.md** (document the rename)
6. **Update NETWORK-ROADMAP.md** (update terminology)
7. **Update architecture-review doc** (reflect new naming)
8. **Search/replace in comments** (change "client" to "performer" in docstrings)

Would you like me to create a TODO list for this refactoring and then execute it? It's a straightforward rename that will make the codebase significantly clearer.