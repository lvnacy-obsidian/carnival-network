# 🗺️ Territory System Migration Guide

## Overview

This guide documents the migration from hardcoded territories to a dynamic, user-configurable territory system. The changes also include removal of platform detection to keep the plugin focused on Obsidian functionality.

---

## What Changed

### ❌ Removed Features

1. **Hardcoded Territory Detection**
   - Old: Territory auto-detected from vault path keywords (`necropolis`, `backstage`, `boutique`, `athenaeum`, `carnival-main`)
   - New: User explicitly assigns performers to territories

2. **Platform Detection**
   - Old: Detected OS platform (macOS, Windows, Linux) from user agent
   - New: Removed to keep plugin Obsidian-focused and avoid system information leaks
   - Metadata now only includes: `vaultPath`, `vaultName`, `apiHost`, `apiPort`, `useHttps`, `version`

### ✅ Added Features

1. **User-Defined Territories**
   - Create custom territory names
   - Join existing territories from the network
   - Assign performer to multiple territories

2. **Territory Management UI**
   - Settings tab section for territory management
   - Visual territory assignment with primary/secondary indicators
   - Quick actions (add, remove, set primary)
   - Preset configurations

3. **Territory Commands**
   - `Create or Join Territory` - Quick modal for joining/creating
   - `Manage Territory Assignments` - Full management interface
   - `Set Primary Territory` - Quick selector for primary territory
   - `Leave Territory` - Quick selector for leaving

4. **Territory Assignment Persistence**
   - `performerTerritories: string[]` in settings
   - First territory = primary territory
   - Defaults to `['general']` if none assigned

---

## Implementation Steps

### Step 1: Create Territory Cache Module

**File**: `src/network/territory-cache.ts` (NEW FILE)

Create this new file with two cache classes:
- `TerritoryCache` - Stores territory definitions
- `TerritoryAssignmentCache` - Stores performer assignments

See artifact: `territory_cache` for complete implementation.

**Key features:**
- Persistent storage using vault adapter
- Background auto-save every 5 minutes
- Similar pattern to `PersistentPerformerCache`
- Separate JSON files for territories and assignments

### Step 2: Update Default Settings

**File**: `main.ts`

```typescript
export const DEFAULT_SETTINGS: CarnivalConfig = {
	// ... existing defaults ...
	territoryConfig: {
		defaultTerritory: 'general'
	},
	// ... rest of defaults ...
};
```

**Note:** Territory assignments are NOT in settings - they're managed by `TerritoryAssignmentCache`.

### Step 3: Update CarnivalRegistryManager

**File**: `src/network/carnival-registry-manager.ts`

**Changes Made:**
1. ❌ Removed `detectPlatform()` method
2. ❌ Removed `detectTerritory(vaultPath)` method
3. ✅ Added `territoryCache` and `assignmentCache` properties
4. ✅ Initialize caches in constructor
5. ✅ Updated `buildPerformerInfo()` to accept `territory` parameter
6. ✅ Updated territory management methods to use caches:
   - `getAssignedTerritories(performerId?)` - from assignmentCache
   - `getPrimaryTerritory(performerId?)` - from assignmentCache
   - `assignTerritories(territories, performerId?)` - to assignmentCache
   - `addTerritory(territory, performerId?)` - to assignmentCache
   - `removeTerritory(territory, performerId?)` - from assignmentCache
   - `setPrimaryTerritory(territory, performerId?)` - to assignmentCache
7. ✅ Added new methods:
   - `getTerritoryDetails(territory)` - from territoryCache
   - `upsertTerritory(name, updates)` - to territoryCache
8. ✅ Added `getCurrentPerformerId()` helper
9. ✅ Updated `cleanup()` to clean up territory caches

**Updated method signature:**
```typescript
// OLD
async buildPerformerInfo(performerId: string): Promise<PerformerRegistrationInfo>

// NEW
async buildPerformerInfo(
	performerId: string,
	territory: string
): Promise<PerformerRegistrationInfo>
```

**Updated metadata (in buildPerformerInfo):**
```typescript
// OLD
metadata: {
	apiHost: 'localhost',
	apiPort: this.localApiPort,
	useHttps: false,
	vaultPath,
	platform: this.detectPlatform(), // ❌ REMOVED
	version: '1.0.0'
}

// NEW
metadata: {
	apiHost: 'localhost',
	apiPort: this.localApiPort,
	useHttps: false,
	vaultPath,
	vaultName: vault.getName(), // ✅ ADDED
	version: '1.0.0'
}
```

### Step 4: Update Settings Tab

**File**: `src/ui/settings-tab.ts`

**Add Territory Management Section** to `renderNetworkTab()` method.

Place the new section after "Connection Section" and before "Registry Endpoints Section":

```typescript
private renderNetworkTab(container: HTMLElement): void {
	// ... Connection Section ...
	
	// ✅ ADD TERRITORY MANAGEMENT SECTION HERE
	// (See artifact: territory_settings_section)
	
	// ... Registry Endpoints Section ...
}
```

**Add helper method** to the `CarnivalNetworkSettingsTab` class:

```typescript
private showCustomTerritoryInput(): void {
	// (See artifact: territory_settings_section)
}
```

### Step 5: Create Territory Modals

**File**: `src/ui/territory-modals.ts` (NEW FILE)

Create this new file with the modal classes:
- `TerritorySelectionModal`
- `TerritoryManagementModal`
- `PrimaryTerritorySelectorModal`
- `LeaveTerritoryModal`

See artifact: `territory_commands` for complete implementation.

### Step 6: Register Commands

**File**: `main.ts`

In the `onload()` method, add territory management commands:

```typescript
async onload() {
	// ... existing initialization ...
	
	// ✅ ADD TERRITORY COMMANDS
	this.addCommand({
		id: 'create-join-territory',
		name: 'Create or Join Territory',
		callback: () => this.showTerritorySelectionModal()
	});
	
	this.addCommand({
		id: 'manage-territories',
		name: 'Manage Territory Assignments',
		callback: () => this.showTerritoryManagementModal()
	});
	
	this.addCommand({
		id: 'set-primary-territory',
		name: 'Set Primary Territory',
		callback: () => this.showPrimaryTerritorySelector()
	});
	
	this.addCommand({
		id: 'leave-territory',
		name: 'Leave Territory',
		callback: () => this.showLeaveTerritoryModal()
	});
}
```

**Add modal helper methods** to the `CarnivalNetworkPlugin` class:

```typescript
private showTerritorySelectionModal(): void {
	const modal = new TerritorySelectionModal(this.app, this);
	modal.open();
}

private showTerritoryManagementModal(): void {
	const modal = new TerritoryManagementModal(this.app, this);
	modal.open();
}

private showPrimaryTerritorySelector(): void {
	const assigned = this.settings.performerTerritories || [];
	// ... (see territory_commands artifact)
}

private showLeaveTerritoryModal(): void {
	const assigned = this.settings.performerTerritories || [];
	// ... (see territory_commands artifact)
}
```

### Step 7: Update Registration Calls

**File**: Anywhere `buildPerformerInfo()` is called

**OLD**:
```typescript
const info = await this.registryManager.buildPerformerInfo('performer-id');
await this.registryManager.establishTerritory('territory', info);
```

**NEW**:
```typescript
const territory = this.registryManager.getPrimaryTerritory();
const info = await this.registryManager.buildPerformerInfo('performer-id', territory);
await this.registryManager.establishTerritory(territory, info);
```

### Step 8: Add CSS Styles

**File**: `styles.css` (or wherever plugin styles are defined)

```css
/* Territory Management Styles */
.carnival-territory-modal {
	padding: 20px;
	max-width: 600px;
}

.carnival-territory-list {
	list-style: none;
	padding: 0;
	margin: 10px 0;
}

.carnival-territory-list li {
	padding: 8px 12px;
	margin: 4px 0;
	background: var(--background-secondary);
	border-radius: 4px;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.carnival-badge {
	display: inline-block;
	padding: 2px 8px;
	font-size: 0.85em;
	border-radius: 3px;
	margin-left: 8px;
}

.carnival-badge-primary {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
}

.carnival-territory-management {
	margin-top: 15px;
}

.territory-item {
	margin-bottom: 10px;
	padding: 10px;
	background: var(--background-secondary);
	border-radius: 6px;
}

.carnival-bulk-actions {
	margin-top: 15px;
	padding-top: 15px;
	border-top: 1px solid var(--background-modifier-border);
}

.carnival-territory-presets {
	margin-top: 20px;
}

.carnival-preset-buttons {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	margin-top: 10px;
}

.carnival-preset-buttons button {
	flex: 1;
	min-width: 120px;
}

.territory-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	gap: 10px;
	margin: 15px 0;
}

.territory-button {
	padding: 10px 15px;
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	background: var(--background-secondary);
	cursor: pointer;
	transition: all 0.2s;
	text-align: center;
}

.territory-button:hover {
	background: var(--background-secondary-alt);
	border-color: var(--interactive-accent);
}

.territory-button.assigned {
	background: var(--background-modifier-success);
	border-color: var(--interactive-success);
}

.territory-button.primary {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
	font-weight: 600;
}

.territory-button.warning {
	border-color: var(--background-modifier-error);
}

.territory-check {
	color: var(--interactive-success);
	font-weight: bold;
}

.carnival-known-territories {
	list-style: none;
	padding: 0;
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.carnival-known-territories li {
	padding: 4px 12px;
	background: var(--background-secondary);
	border-radius: 12px;
	font-size: 0.9em;
}

.carnival-territory-select-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin: 20px 0;
}

.territory-actions {
	display: flex;
	gap: 8px;
	margin-top: 8px;
}

.territory-name {
	display: flex;
	align-items: center;
	font-weight: 500;
	margin-bottom: 8px;
}
```

---

## Migration Path for Existing Users

### Automatic Migration

When users upgrade to this version, the plugin should automatically:

1. **Check for existing territory assignment**:
   ```typescript
   if (!this.settings.performerTerritories || this.settings.performerTerritories.length === 0) {
     this.settings.performerTerritories = ['general'];
     await this.saveSettings();
   }
   ```

2. **Optionally attempt to detect from vault path** (one-time migration):
   ```typescript
   // In onload() - only on first run after upgrade
   if (!this.settings.performerTerritories) {
     const vaultPath = this.app.vault.adapter.path.toLowerCase();
     let migratedTerritory = 'general';
     
     if (vaultPath.includes('necropolis')) migratedTerritory = 'necropolis';
     else if (vaultPath.includes('backstage')) migratedTerritory = 'backstage';
     else if (vaultPath.includes('boutique')) migratedTerritory = 'boutique';
     else if (vaultPath.includes('athenaeum')) migratedTerritory = 'athenaeum';
     
     this.settings.performerTerritories = [migratedTerritory];
     await this.saveSettings();
     
     new Notice(`Migrated to territory system. Assigned to: ${migratedTerritory}`);
   }
   ```

### User Communication

Show a notice on first run after upgrade:

```typescript
// Check if this is first run with new territory system
if (!this.settings.territorySystemMigrated) {
  this.settings.territorySystemMigrated = true;
  await this.saveSettings();
  
  const territory = this.settings.performerTerritories?.[0] || 'general';
  
  new Notice(
    `🎪 Territory system updated! You are now assigned to: ${territory}. ` +
    `Use "Manage Territory Assignments" command to customize.`,
    8000
  );
}
```

---

## Testing Checklist

### Unit Tests

- [ ] `getAssignedTerritories()` returns correct territories
- [ ] `getPrimaryTerritory()` returns first territory or 'general'
- [ ] `assignTerritories()` validates and deduplicates
- [ ] `addTerritory()` adds only if not present
- [ ] `removeTerritory()` ensures at least one territory remains
- [ ] `getKnownTerritories()` returns unique sorted list
- [ ] `buildPerformerInfo()` accepts territory parameter
- [ ] `buildPerformerInfo()` excludes platform from metadata

### Integration Tests

- [ ] Territory assignment persists across plugin reload
- [ ] Primary territory is used for registration
- [ ] Can assign to multiple territories
- [ ] Can change primary territory
- [ ] Can leave territory (defaults to 'general' if last)
- [ ] Settings UI displays current assignments correctly
- [ ] Commands open appropriate modals
- [ ] Custom territory creation works
- [ ] Known territories populate from network

### UI Tests

- [ ] Territory management section renders in settings
- [ ] Current assignments display correctly
- [ ] Primary badge shows on first territory
- [ ] Add territory dropdown works
- [ ] Custom territory input validates name format
- [ ] Remove territory buttons work
- [ ] Set primary button reorders territories
- [ ] Preset buttons assign correctly
- [ ] Clear all territories resets to 'general'
- [ ] Territory modals open and function correctly

---

## API Changes Summary

### CarnivalRegistryManager

#### Modified Methods

```typescript
// BEFORE
async buildPerformerInfo(performerId: string): Promise<PerformerRegistrationInfo>

// AFTER
async buildPerformerInfo(
	performerId: string,
	territory: string
): Promise<PerformerRegistrationInfo>
```

#### New Methods

```typescript
getAssignedTerritories(): string[]
getPrimaryTerritory(): string
async assignTerritories(territories: string[]): Promise<void>
async addTerritory(territory: string): Promise<void>
async removeTerritory(territory: string): Promise<void>
getKnownTerritories(): string[]
```

#### Removed Methods

```typescript
detectPlatform(): string  // ❌ REMOVED
detectTerritory(vaultPath: string): string  // ❌ REMOVED
```

### Settings Interface

```typescript
interface CarnivalConfig {
	// NEW
	performerTerritories?: string[];
	
	// NEW (for migration tracking)
	territorySystemMigrated?: boolean;
}
```

### Commands Added

- `create-join-territory` - Create or Join Territory
- `manage-territories` - Manage Territory Assignments
- `set-primary-territory` - Set Primary Territory
- `leave-territory` - Leave Territory

---

## Backwards Compatibility

### Breaking Changes

1. **`buildPerformerInfo()` signature changed** - now requires `territory` parameter
2. **Platform detection removed** - `metadata.platform` no longer exists
3. **Auto-territory detection removed** - must be explicitly assigned

### Migration Strategy

**For Existing Code:**

```typescript
// OLD CODE
const info = await this.registryManager.buildPerformerInfo('performer-id');

// MIGRATION
const territory = this.registryManager.getPrimaryTerritory();
const info = await this.registryManager.buildPerformerInfo('performer-id', territory);
```

**For Tests:**

Update any tests that:
- Call `buildPerformerInfo()` without territory parameter
- Expect `metadata.platform` to exist
- Rely on automatic territory detection

---

## Future Enhancements

### Planned Features

1. **Territory Discovery API**
   - Query registry for all known territories
   - Get territory metadata (description, performer count, etc.)
   - Search/filter territories

2. **Territory Invitations**
   - Send invitations to join private territories
   - Accept/reject territory invitations
   - Territory access control

3. **Territory Sync**
   - Sync territory assignments across devices
   - Cloud-based territory management
   - Territory templates/presets

4. **Territory Analytics**
   - Track territory activity
   - Performer counts per territory
   - Territory health metrics

---

## Troubleshooting

### Issue: "No territories assigned" after upgrade

**Solution**: Run automatic migration or manually assign in settings:
```typescript
await this.registryManager.assignTerritories(['general']);
```

### Issue: Territory commands not appearing

**Solution**: Check that commands are registered in `onload()` and modal files are imported correctly.

### Issue: Settings UI not showing territory section

**Solution**: Ensure territory section code is added to `renderNetworkTab()` in correct location.

### Issue: Build errors with `buildPerformerInfo()`

**Solution**: Update all calls to include territory parameter:
```typescript
const territory = this.registryManager.getPrimaryTerritory();
const info = await this.registryManager.buildPerformerInfo(id, territory);
```

---

## Resources

- **Type Definitions**: `territory_types` artifact
- **Manager Updates**: See updated `carnival-registry-manager.ts` artifact
- **Settings UI**: `territory_settings_section` artifact
- **Commands & Modals**: `territory_commands` artifact
- **Interface Updates**: `updated_settings_interface` artifact

---

## Conclusion

This migration transforms the territory system from hardcoded paths to a flexible, user-controlled system that:

✅ Gives users full control over territory assignments  
✅ Supports multiple territories per performer  
✅ Removes OS platform detection for privacy  
✅ Provides intuitive UI and commands  
✅ Maintains network-wide territory discovery  
✅ Defaults to 'general' for simplicity  

The changes improve flexibility while maintaining the carnival metaphor and network functionality.