## The Metaphor Problem: What IS the Carnival?

You've identified a critical ambiguity:

**Option A: Carnival = The Network (Infrastructure)**
- The carnival is the *venue* - the stage, lights, infrastructure
- Performers = individual vaults/plugins joining the network
- Acts = the content being shared
- This is what I suggested in the review

**Option B: Carnival = The Entire Distributed System**
- The carnival is *everything* - all vaults, all content, all coordination
- Network = the troupe (collection of performers)
- Individual plugins = performers
- The infrastructure is just the "backstage equipment"

---

## Thematic Analysis: Carnival Semantics

Let's examine what a "carnival" actually represents:

**In Reality:**
- A carnival is **the entire event** - performers, audience, venue, acts, everything
- The carnival *contains* multiple troupes
- Each troupe might perform different acts
- The carnival grounds host it all
- Management/infrastructure makes it function

**The Hierarchy:**
```
CARNIVAL (the whole event)
    ├── Grounds (physical infrastructure)
    ├── Troupes (groups of performers)
    │   ├── Performers (individuals)
    │   └── Acts (what they perform)
    ├── Audience (observers/consumers)
    └── Management (coordination/operations)
```
---

## Proposed Nomenclature: A Clear Hierarchy

### **The Carnival = The Entire Distributed Ecosystem**

This is the largest scope - every vault, every plugin instance, all content, all coordination.

### **The Network = The Troupe(s)**

The collection of connected performers. When vaults join together, they form the troupe.

```typescript
// Rename in main.ts
private activePerformers: Map<string, CarnivalPerformer> = new Map();

// But conceptually, the collection IS the troupe:
public getTroupe(): CarnivalPerformer[] {
    return Array.from(this.activePerformers.values());
}

public getTroupeSize(): number {
    return this.activePerformers.size;
}
```
### **Individual Instances = Performers**

Each `CarnivalPerformer` instance = one performer in the troupe.

### **The Infrastructure = Carnival Grounds**

The HTTP registry, territory services, cache, etc. This is where the carnival happens.

```typescript
// Existing naming is actually good:
- Territory (a section of the grounds)
- Registry (the booking office)
- Cache (the program/roster)
```
### **The Content = Acts**

Already correctly named! These are the performances being shared.

---

## Mental Map: The Complete Picture

```
┌─────────────────────────────────────────────────────────────┐
│                    THE CARNIVAL                              │
│              (Entire Distributed Ecosystem)                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              CARNIVAL GROUNDS                       │    │
│  │         (Infrastructure/Network Services)           │    │
│  │                                                     │    │
│  │  • Territories (locations/channels)                │    │
│  │  • Registry Service (booking/discovery)            │    │
│  │  • Observability (show metrics)                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │               THE TROUPE                            │    │
│  │        (Network of Connected Performers)            │    │
│  │                                                     │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │    │
│  │  │Performer │  │Performer │  │Performer │        │    │
│  │  │  (Vault  │  │  (Vault  │  │  (Vault  │        │    │
│  │  │    A)    │  │    B)    │  │    C)    │        │    │
│  │  └──────────┘  └──────────┘  └──────────┘        │    │
│  │     Each is a CarnivalPerformer instance              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │                 THE ACTS                            │    │
│  │        (Content Being Performed/Shared)             │    │
│  │                                                     │    │
│  │  • Changelogs                                      │    │
│  │  • Conversations                                   │    │
│  │  • Cross-vault messages                            │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```
---

## Specific Naming Recommendations

### **Keep As-Is:**
- ✅ `CarnivalPerformer` (a client to the carnival infrastructure)
- ✅ `CarnivalPerformerInterface` (the performer's contract)
- ✅ `CarnivalAct` (the content)
- ✅ `Territory` (section of the grounds)
- ✅ `CarnivalQueryService` (carnival intelligence)
- ✅ `CarnivalConfig` (carnival setup)

### **Add for Clarity:**
```typescript
// In main.ts
private activePerformers: Map<string, CarnivalPerformer> = new Map();

// New utility methods that use the troupe concept:
public getTroupeRoster(): PerformerInfo[] {
    return Array.from(this.activePerformers.values())
        .map(performer => performer.getPerformerInfo());
}

public getTroupeSize(): number {
    return this.activePerformers.size;
}

// The "troupe" is the collective, accessed through the main plugin
```
### **In Documentation:**
```markdown
## The Carnival Hierarchy

- **The Carnival**: The entire distributed ecosystem across all vaults
- **The Grounds**: Infrastructure services (territories, registry, cache)
- **The Troupe**: Collection of connected performers (the network)
- **Performers**: Individual vault instances (each CarnivalPerformer)
- **Acts**: Content being shared (CarnivalAct instances)
- **Territories**: Named channels/locations on the grounds
```
---

## Thematic Extensions for Future Features

This hierarchy allows clean expansions:

### **Carnival Management** (Future observability dashboard)
```typescript
interface CarnivalManagement {
    getTroupeStatus(): TroupeStatus;
    getGroundsStatus(): GroundsStatus;
    getUpcomingActs(): CarnivalAct[];
    getPerformerRoster(): PerformerInfo[];
}
```
### **Troupe Coordination** (Future group operations)
```typescript
interface TroupeCoordinator {
    broadcastToTroupe(act: CarnivalAct): Promise<void>;
    getTroupeConsensus(proposal: Proposal): Promise<ConsensusResult>;
    electTroupeLeader(): Promise<PerformerId>;
}
```
### **Carnival Events** (Future event system)
```typescript
type CarnivalEvent = 
    | { type: 'performer-joined'; performer: PerformerInfo }
    | { type: 'performer-left'; performerId: string }
    | { type: 'act-performed'; act: CarnivalAct }
    | { type: 'territory-established'; territory: Territory };
```
---

## The Answer to Your Question

**Yes, the network IS the troupe** - the collection of connected performers.

**The Carnival is larger** - it's the entire ecosystem, including:
- The grounds (infrastructure)
- The troupe (network of performers)
- The acts (content)
- The management (coordination services)

**Analogy:**
- **Carnival** = Silco's entire operation (all of Zaun, all the territories, all the operations)
- **Troupe** = The network of connected operators/lieutenants working together
- **Performer** = Each individual agent/vault in the network
- **Grounds** = The infrastructure (the Last Drop, the shimmer labs, the territory control points)
- **Acts** = The operations being coordinated (deals, messages, activities)

This gives you:
- Clear hierarchy (carnival > troupe > performer)
- Thematic consistency (all terms relate to the carnival metaphor)
- Room for expansion (can add carnival management, troupe coordination, etc.)
- Natural language ("join the troupe", "the troupe performs", "carnival grounds")

---

## Implementation Note

You **don't need to rename types**. Just use the terms correctly in documentation and method names:

```typescript
// The type name is fine
class CarnivalPerformer { }

// But we understand the semantics:
// - Each CarnivalPerformer = one performer
// - Collection of CarnivalPerformers = the troupe
// - The plugin + infrastructure + troupe = the carnival
```
Does this mental model work better for you? The carnival is the **everything**, the troupe is the **network**, and each client is a **performer**.