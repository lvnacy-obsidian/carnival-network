# Carnival Network Settings Tab - Redesign Recommendation

**Date**: 2025-01-20  
**Status**: Recommendation for implementation  
**Scope**: Complete rewrite with tabbed interface

---

## Executive Summary

The current `settings-tab.ts` (816 lines) is monolithic and difficult to navigate. This document proposes a tabbed interface with logical groupings, improved UX, and better maintainability.

### Key Improvements

1. **Tabbed Interface**: 5 tabs grouping related settings
2. **Better Organization**: Logical hierarchy for 40+ settings
3. **Progressive Disclosure**: Show advanced options only when needed
4. **Status Dashboard**: Real-time network monitoring
5. **Validation & Feedback**: Inline validation with helpful errors
6. **Accessibility**: Keyboard navigation, ARIA labels
7. **Maintainability**: Modular tab classes

---

## Current State Analysis

### Settings Categories Identified

From `CarnivalConfig`, `AuthenticationConfig`, `ObservabilityConfig`, and current UI:

**Network Settings (12 settings)**
- Enable Network
- Auto Discovery
- Registry Endpoints (dynamic list)
- Communication Timeout
- Max Connections
- Heartbeat Interval
- Circuit Breaker (threshold, timeout, reset)
- Content Sync (changelogs, conversations)
- Broadcast Default

**API & Authentication Settings (15+ settings)**
- API Keys Management (dynamic list)
- Authentication Enabled
- Require Credentials
- Allowed Methods (backstagePass, performanceTicket, stageDoor)
- JWT Configuration (secret, expiration)
- Rate Limiting
- Custom Ticket Tiers
- Webhook Signatures
- OAuth Features (scoping, refresh tokens)
- Audit Logging
- Security (HTTPS, entropy, rate limits, lockouts)

**Observability Settings (15 settings)**
- Enable Observability
- Metrics Endpoint
- Provider (webhook)
- Endpoint URL
- API Key
- Webhook Secret
- Custom Headers
- Flush Interval
- Batch Size
- Buffer Configuration
- Retry Configuration
- Circuit Breaker
- Connection Testing

**Cache & Performance (7 settings)**
- Performer Cache TTL
- Max Cached Performers
- Retry Configuration (base delay, max retries)

**TLS/Security (10 settings)**
- Enable TLS
- CA Certificate Path
- Client Certificate Path
- Client Key Path
- Allow Self-Signed
- Validate Certificates
- Server Name (SNI)

**Webhook Configuration (4 settings)**
- Enable Webhooks
- Webhook Handlers (dynamic list)

**Status & Monitoring (Read-only displays)**
- Network Status Overview
- Circuit Breaker States
- Certificate Health
- Cache Performance
- Network Topology
- Request Metrics

---

## Proposed Tab Structure

### Tab 1: 🌐 Network

**Purpose**: Core network connectivity and discovery settings

**Sections**:
1. **Connection** (collapsible)
   - Enable Network (toggle)
   - Auto Discovery (toggle)
   - Heartbeat Interval (slider + text, ms)
   - Communication Timeout (slider + text, ms)
   - Max Connections (slider, 1-50)

2. **Registry Endpoints** (collapsible, expanded by default)
   - Dynamic list of endpoints
   - Add/Remove buttons
   - HTTPS validation
   - Test connection button per endpoint

3. **Circuit Breaker** (collapsible, collapsed by default)
   - Failure Threshold (slider, 1-10)
   - Circuit Timeout (ms)
   - Reset Timeout (ms)
   - Visual indicator of current states

4. **Content Sync** (collapsible)
   - Sync Changelogs (toggle)
   - Sync Conversations (toggle)
   - Broadcast by Default (toggle)

**Dependencies**:
- Requires Secure Store plugin (show warning if missing)
- Registry endpoints must be HTTPS (except localhost)

---

### Tab 2: 🔐 API & Authentication

**Purpose**: API access control and authentication configuration

**Sections**:
1. **External API Keys** (collapsible, expanded by default)
   - Generate new key button
   - List of existing keys (masked)
   - Per-key settings (enable/disable, delete)
   - Key details modal (permissions, session duration, types, description)

2. **Authentication System** (collapsible, collapsed by default - Phase 3.5)
   - Enable Authentication (toggle)
   - Require Credentials (toggle)
   - Allowed Methods (multi-select: backstagePass, performanceTicket, stageDoor)
   
3. **JWT Configuration** (collapsible, only show if authentication enabled)
   - JWT Secret (text, with "Generate" button)
   - Expiration Hours (slider, 1-168)
   
4. **Rate Limiting** (collapsible)
   - Enable Rate Limiting (toggle)
   - Custom Ticket Tiers (advanced, nested settings)
   - Requests per minute (slider)
   - Requests per hour (slider)
   - Burst limit (slider)

5. **Security** (collapsible, collapsed by default)
   - Require HTTPS (toggle)
   - Min Key Entropy (slider, bits)
   - Failed Auth Rate Limit (slider, per minute)
   - Lockout Duration (slider, minutes)

6. **Audit Logging** (collapsible, collapsed by default)
   - Enable Audit Log (toggle)
   - Log Success (toggle)
   - Log Failures (toggle)
   - Log Credential Changes (toggle)
   - Log Path (text)
   - Max Log Size MB (slider)
   - Max Rotated Files (slider)

**Note**: Many auth settings are for Phase 3.5. Show "Coming in Phase 3.5" badge for disabled features.

---

### Tab 3: 📡 Observability

**Purpose**: Metrics, monitoring, and external observability configuration

**Sections**:
1. **Metrics Endpoint** (collapsible, expanded by default)
   - Enable Metrics Endpoint (toggle)
   - Endpoint: `GET /metrics` (read-only display)
   - Format: Prometheus text (read-only)
   - Refresh button + Last updated timestamp

2. **Metrics Export** (collapsible)
   - Enable Export (toggle)
   - Provider dropdown (none, webhook)
   - Endpoint URL (text, only if webhook)
   - API Key (password field, only if webhook)
   - Webhook Secret (password field, optional)
   - Custom Headers (key-value pairs, dynamic list)
   - Method (dropdown: POST, PUT)

3. **Buffer Configuration** (collapsible, collapsed by default)
   - Max Buffer Size (slider, metrics count)
   - Max Age (slider, ms)
   - Overflow Strategy (dropdown: drop-oldest, drop-newest, drop-random)
   - Warning Threshold (slider, percentage)

4. **Delivery** (collapsible, collapsed by default)
   - Flush Interval (slider, ms)
   - Batch Size (slider, metrics per batch)
   - Max Retries (slider, 0-10)
   - Retry Base Delay (slider, ms)
   - Retry Max Delay (slider, ms)
   - Backoff Multiplier (slider, 1.0-5.0)

5. **Circuit Breaker** (collapsible, collapsed by default)
   - Enable Circuit Breaker (toggle)
   - Failure Threshold (slider)
   - Circuit Timeout (slider, ms)
   - Reset Timeout (slider, ms)

6. **Connection** (collapsible, collapsed by default)
   - Test Connection on Init (toggle)
   - Connection Timeout (slider, ms)
   - Sentry Environment (text, if applicable)
   - Sample Rate (slider, percentage, if applicable)

**Live Metrics Preview**:
- Show last 5 metrics sent (read-only)
- Success/failure indicators
- Last flush timestamp

---

### Tab 4: 📊 Status & Monitor

**Purpose**: Real-time network health and performance monitoring

**Read-only dashboard with refresh controls**

**Sections**:
1. **Network Overview** (always visible)
   - Status (connected/degraded/disconnected)
   - Connected Territories (count)
   - Uptime (formatted duration)
   - Error Rate (percentage)
   - Active Performers (count)

2. **Circuit Breakers** (collapsible, expanded by default)
   - Per-endpoint circuit states (colored indicators)
   - Request metrics (requests, successes, failures, rate)
   - Last state change timestamp

3. **Cache Performance** (collapsible)
   - Cache Size (current/max)
   - Hit Rate (percentage with color coding)
   - Total Operations
   - Hits/Misses
   - Evictions (warning if > 0)
   - Storage Writes/Reads
   - Memory Usage (formatted bytes)
   - Persistence Status

4. **Certificate Health** (collapsible)
   - Total Certificates
   - Healthy (green)
   - Expiring Soon (yellow)
   - Expired (red)
   - Revoked (grey)

5. **Network Topology** (collapsible)
   - Territories breakdown (name: count)
   - Capabilities breakdown (capability: count)

**Controls**:
- 🔄 Refresh All (button)
- ⏱️ Auto Refresh 30s (toggle button)
- 🔄 Refresh Network Topology (button)
- 💾 Flush Cache to Storage (button)
- 🗑️ Clear Cache (warning button)
- 🚫 Disconnect Network (danger button)

---

### Tab 5: ⚙️ Advanced

**Purpose**: Advanced configuration for power users

**Sections**:
1. **TLS/Security** (collapsible, collapsed by default)
   - Enable TLS (toggle)
   - CA Certificate Path (text)
   - CA Certificate Content (textarea)
   - Client Certificate Path (text)
   - Client Certificate Content (textarea)
   - Client Key Path (text)
   - Client Key Content (textarea)
   - Allow Self-Signed (toggle)
   - Validate Certificates (toggle)
   - Server Name (SNI) (text)

2. **Webhooks** (collapsible, collapsed by default - Phase 3.4)
   - Enable Webhooks (toggle)
   - Webhook Handlers (dynamic list)
   - Per-handler: id, type, url, secret, enabled

3. **Cache Tuning** (collapsible, collapsed by default)
   - Performer Cache TTL (slider, ms)
   - Max Cached Performers (slider, 1-1000)

4. **Retry Configuration** (collapsible, collapsed by default)
   - Max Retries (slider, 0-10)
   - Retry Base Delay (slider, ms)

5. **Debug** (collapsible, collapsed by default)
   - Enable Debug Logging (toggle)
   - Log Level (dropdown: ERROR, WARN, INFO, DEBUG, TRACE)
   - Export Configuration (button, downloads JSON)
   - Import Configuration (button, uploads JSON)
   - Reset to Defaults (danger button with confirmation)

6. **About** (always visible at bottom)
   - Plugin Version (from manifest)
   - Phase Status (Phase 3.3 Complete)
   - Dependencies Status (list with checkmarks)
   - GitHub Link
   - Ko-fi Link
   - Documentation Link

---

## Design Patterns & Components

### Tab Navigation

**Implementation**:
```typescript
class TabbedSettingsTab extends PluginSettingTab {
  private activeTab: string = 'network';
  
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    // Header
    containerEl.createEl('h1', { 
      text: '🎪 Carnival Network Settings',
      cls: 'carnival-settings-header'
    });
    
    // Tab navigation bar
    const tabNav = containerEl.createDiv({ cls: 'carnival-tab-nav' });
    this.renderTabButtons(tabNav);
    
    // Tab content container
    const tabContent = containerEl.createDiv({ cls: 'carnival-tab-content' });
    this.renderActiveTab(tabContent);
  }
  
  private renderTabButtons(container: HTMLElement): void {
    const tabs = [
      { id: 'network', icon: '🌐', label: 'Network' },
      { id: 'api', icon: '🔐', label: 'API & Auth' },
      { id: 'observability', icon: '📡', label: 'Observability' },
      { id: 'status', icon: '📊', label: 'Status' },
      { id: 'advanced', icon: '⚙️', label: 'Advanced' }
    ];
    
    tabs.forEach(tab => {
      const button = container.createEl('button', {
        text: `${tab.icon} ${tab.label}`,
        cls: `carnival-tab-button ${this.activeTab === tab.id ? 'active' : ''}`
      });
      button.onclick = () => {
        this.activeTab = tab.id;
        this.display(); // Re-render
      };
    });
  }
  
  private renderActiveTab(container: HTMLElement): void {
    switch (this.activeTab) {
      case 'network':
        this.renderNetworkTab(container);
        break;
      case 'api':
        this.renderAPITab(container);
        break;
      case 'observability':
        this.renderObservabilityTab(container);
        break;
      case 'status':
        this.renderStatusTab(container);
        break;
      case 'advanced':
        this.renderAdvancedTab(container);
        break;
    }
  }
}
```

### Collapsible Sections

**Implementation**:
```typescript
private createCollapsibleSection(
  container: HTMLElement,
  title: string,
  icon: string,
  expanded: boolean = false
): { header: HTMLElement; content: HTMLElement } {
  const section = container.createDiv({ cls: 'carnival-collapsible-section' });
  
  const header = section.createDiv({ 
    cls: `carnival-section-header ${expanded ? 'expanded' : 'collapsed'}` 
  });
  header.createSpan({ text: `${icon} ${title}`, cls: 'section-title' });
  const toggle = header.createSpan({ 
    text: expanded ? '▼' : '▶', 
    cls: 'section-toggle' 
  });
  
  const content = section.createDiv({ 
    cls: 'carnival-section-content',
    attr: { style: expanded ? '' : 'display: none;' }
  });
  
  header.onclick = () => {
    const isExpanded = content.style.display !== 'none';
    content.style.display = isExpanded ? 'none' : '';
    toggle.textContent = isExpanded ? '▶' : '▼';
    header.removeClass(isExpanded ? 'expanded' : 'collapsed');
    header.addClass(isExpanded ? 'collapsed' : 'expanded');
  };
  
  return { header, content };
}
```

### Validation & Feedback

**Patterns**:
- Inline validation for text inputs (URL, numbers, paths)
- Color-coded status indicators (green/yellow/red)
- Helpful error messages below inputs
- Success notifications for actions (save, test connection)
- Warning dialogs for dangerous actions (clear cache, disconnect)

**Example**:
```typescript
private addValidatedTextInput(
  setting: Setting,
  value: string,
  validator: (val: string) => { valid: boolean; error?: string },
  onChange: (val: string) => Promise<void>
): void {
  const errorDiv = setting.controlEl.createDiv({ 
    cls: 'carnival-setting-error',
    attr: { style: 'display: none;' }
  });
  
  setting.addText(text => {
    text.setValue(value)
      .onChange(async (newValue) => {
        const result = validator(newValue);
        if (result.valid) {
          errorDiv.style.display = 'none';
          text.inputEl.removeClass('error');
          await onChange(newValue);
        } else {
          errorDiv.textContent = result.error || 'Invalid input';
          errorDiv.style.display = 'block';
          text.inputEl.addClass('error');
        }
      });
  });
}
```

---

## CSS Styling Requirements

### Tab Navigation
```css
.carnival-tab-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 2px solid var(--background-modifier-border);
  padding-bottom: 0;
}

.carnival-tab-button {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  transition: all 0.2s;
}

.carnival-tab-button:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}

.carnival-tab-button.active {
  color: var(--text-accent);
  border-bottom-color: var(--text-accent);
}
```

### Collapsible Sections
```css
.carnival-collapsible-section {
  margin-bottom: 16px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  overflow: hidden;
}

.carnival-section-header {
  padding: 12px 16px;
  background: var(--background-secondary);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
}

.carnival-section-header:hover {
  background: var(--background-modifier-hover);
}

.carnival-section-header.expanded {
  border-bottom: 1px solid var(--background-modifier-border);
}

.carnival-section-content {
  padding: 16px;
}

.section-toggle {
  font-size: 12px;
  opacity: 0.7;
}
```

### Status Indicators
```css
.status-healthy { color: var(--text-success); }
.status-warning { color: var(--text-warning); }
.status-error { color: var(--text-error); }
.status-unknown { color: var(--text-muted); }

.circuit-state {
  font-size: 20px;
  margin-right: 8px;
}

.circuit-closed { color: var(--text-success); }
.circuit-open { color: var(--text-error); }
.circuit-half-open { color: var(--text-warning); }
```

### Validation
```css
.carnival-setting-error {
  color: var(--text-error);
  font-size: 12px;
  margin-top: 4px;
  padding: 4px 8px;
  background: var(--background-modifier-error);
  border-radius: 4px;
}

input.error, textarea.error {
  border-color: var(--text-error);
  background: var(--background-modifier-error-hover);
}
```

---

## Implementation Plan

### Phase 1: Foundation (2-3 hours)
- Create base tabbed interface
- Implement tab navigation
- Create collapsible section helper
- Add CSS styling

### Phase 2: Network Tab (1-2 hours)
- Migrate all network settings
- Add registry endpoint management
- Implement circuit breaker section
- Add content sync settings

### Phase 3: API Tab (1-2 hours)
- Migrate API key management
- Add authentication sections (show Phase 3.5 coming soon)
- Implement rate limiting UI
- Add security and audit sections

### Phase 4: Observability Tab (1-2 hours)
- Migrate observability settings
- Create buffer configuration UI
- Add delivery and circuit breaker sections
- Implement live metrics preview

### Phase 5: Status Tab (2-3 hours)
- Migrate all status displays
- Add refresh controls
- Implement auto-refresh
- Add management actions (flush, clear, disconnect)

### Phase 6: Advanced Tab (1 hour)
- Migrate TLS/security settings
- Add webhook configuration (Phase 3.4 coming soon)
- Create cache tuning section
- Add debug and about sections

### Phase 7: Polish & Testing (1-2 hours)
- Add validation throughout
- Improve error messages
- Test all interactions
- Verify persistence
- Accessibility audit

**Total Estimated Time**: 10-15 hours

---

## Accessibility Considerations

1. **Keyboard Navigation**
   - Tab key navigation between settings
   - Enter/Space to toggle sections and buttons
   - Arrow keys for tab navigation
   - Focus indicators on all interactive elements

2. **ARIA Labels**
   - `role="tablist"` for tab navigation
   - `role="tab"` for each tab button
   - `role="tabpanel"` for tab content
   - `aria-expanded` for collapsible sections
   - `aria-label` for icon-only buttons

3. **Screen Reader Support**
   - Descriptive labels for all inputs
   - Status announcements for actions
   - Error messages properly associated with inputs

---

## Migration Notes

### Breaking Changes
- None (internal UI only)

### Data Migration
- No data migration needed
- All settings use existing `CarnivalConfig` structure
- Settings persist automatically via `plugin.saveSettings()`

### Backward Compatibility
- Fully backward compatible
- Old settings will work with new UI
- No changes to public API

---

## Future Enhancements

### Phase 3.4 (Webhooks)
- Add webhook handler management UI in Advanced tab
- Test webhook endpoint button
- Webhook event log viewer

### Phase 3.5 (Authentication)
- Enable all auth sections in API tab
- Backstage pass management UI
- Performance ticket viewer
- Audit log viewer with filtering

### Phase 4 (Database)
- Add database configuration section
- RxDB settings (storage, sync, replication)
- Database migrations UI

---

## Summary

This redesign transforms the monolithic 816-line settings file into a maintainable, user-friendly tabbed interface with:

✅ **5 logical tabs** grouping 60+ settings  
✅ **Collapsible sections** for progressive disclosure  
✅ **Real-time status dashboard** for monitoring  
✅ **Inline validation** with helpful feedback  
✅ **Modular architecture** for maintainability  
✅ **Accessibility** built-in from the start  
✅ **Future-proof** for Phase 3.4, 3.5, 4  

The user experience improves dramatically with clear organization, better visual hierarchy, and intuitive navigation. Power users can access advanced settings while beginners see only what they need.
