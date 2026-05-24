# SeniorSitters CareHub - Operating System Integration

## Overview

The CareHub has been transformed from a collection of separate pages into a unified, connected operating system with shared state management, realtime subscriptions, and automatic cross-module synchronization.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CareHub Operating System                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   State.js   │  │  Realtime.js │  │  Refresh-Coordinator.js  │ │
│  │  (Central    │  │ (Supabase    │  │  (Cross-module sync)   │ │
│  │   State)     │  │   Subs)      │  │                          │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬───────────────┘ │
│         │                │                    │                  │
│         └────────────────┴────────────────────┘                  │
│                          │                                      │
│  ┌───────────────────────┼──────────────────────────────────┐ │
│  │                       ▼                                  │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │Dashboard │ │Schedules │ │Caregivers│ │  Timesheets  │  │ │
│  │  │          │ │          │ │          │ │              │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │  Clients │ │  Applications │ │Care Req. │ │Visit Updates│  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## New Modules

### 1. state.js - Shared State Management
- **Purpose**: Central reactive state store for all CareHub data
- **Features**:
  - Path-based state access (`state.get('dashboard.todaysVisits')`)
  - Reactive subscriptions with automatic UI updates
  - Batch updates for performance
  - Cache management with stale detection
  - Deep cloning to prevent mutations

**Key Methods**:
```javascript
// Get state
CareHubState.get('dashboard.newApplications');

// Set state (triggers subscribers)
CareHubState.set('todaysSchedule', scheduleData);

// Subscribe to changes
const unsubscribe = CareHubState.subscribe('dashboard', (newVal, oldVal) => {
    updateUI(newVal);
});

// Batch update multiple values
CareHubState.batchUpdate({
    'dashboard.todaysVisits': 5,
    'dashboard.pendingTimesheets': 3
});
```

### 2. realtime.js - Supabase Realtime Subscriptions
- **Purpose**: Live data synchronization via Supabase realtime
- **Features**:
  - Automatic subscriptions to all tables
  - Change handlers for each data type
  - Activity feed logging
  - Cross-module refresh triggering

**How It Works**:
1. Subscribes to INSERT, UPDATE, DELETE on all tables
2. When data changes, updates shared state
3. Triggers refresh coordinator for affected modules
4. Logs activities to recent activity feed

**Subscriptions**:
- `applications-changes`
- `care_requests-changes`
- `caregivers-changes`
- `clients-changes`
- `schedules-changes` ← Critical for calendar sync
- `timesheets-changes`
- `visit_updates-changes`

### 3. refresh-coordinator.js - Cross-Module Sync
- **Purpose**: Manages intelligent refreshing across all modules
- **Features**:
  - Module registration with priority levels
  - Dependency-based refresh triggering
  - Smart refresh (only active modules)
  - Debounced batch processing
  - Auto-refresh intervals

**Dependency Map**:
```javascript
{
    'applications': ['dashboard', 'caregivers', 'onboarding'],
    'care-requests': ['dashboard', 'clients', 'onboarding'],
    'caregivers': ['dashboard', 'schedules', 'timesheets', 'visit-updates', 'onboarding'],
    'clients': ['dashboard', 'schedules', 'care-requests'],
    'schedules': ['dashboard', 'todays-schedule', 'timesheets', 'visit-updates', 
                  'calendar-admin', 'calendar-caregiver', 'calendar-client'],
    'timesheets': ['dashboard', 'payroll', 'caregivers'],
    'visit-updates': ['dashboard', 'schedules', 'clients']
}
```

## Integrated Data Operations

When you use these integrated functions instead of direct database calls, they automatically:
1. Execute the database operation
2. Trigger refresh coordinator
3. Update all affected modules
4. Refresh dashboard KPIs

**Available Integrated Functions**:
```javascript
// Applications
integratedSaveApplicationStatus(id, status, notes)
integratedConvertApplication(appId, caregiverData)

// Schedules (Calendar sync)
integratedCreateSchedule(scheduleData)
integratedUpdateSchedule(id, updates)
integratedCancelSchedule(id, reason)

// Timesheets
integratedCreateTimesheet(timesheetData)
integratedApproveTimesheet(id)

// Visit Updates
integratedCreateVisitUpdate(updateData)

// Care Requests
integratedConvertCareRequest(requestId, clientData)
```

## State Subscriptions in Dashboard

The dashboard now subscribes to state changes and auto-updates:

```javascript
// In initStateSubscriptions()
CareHubState.subscribe('dashboard', updateDashboardKPIs);
CareHubState.subscribe('todaysSchedule', updateScheduleView);
CareHubState.subscribe('activities', updateActivityFeed);
CareHubState.subscribe('alerts', updateAlertsPanel);
CareHubState.subscribe('onboardingList', updateOnboardingView);
```

## Usage Examples

### Example 1: Creating a Schedule (Triggers Calendar Updates)
```javascript
// Old way (modules disconnected)
await createSchedule({
    caregiver_id: '123',
    client_id: '456',
    date: '2026-01-15',
    start_time: '09:00'
});
// Dashboard, calendars, and today's schedule remain stale

// New way (connected OS)
await integratedCreateSchedule({
    caregiver_id: '123',
    client_id: '456',
    date: '2026-01-15',
    start_time: '09:00'
});
// Automatically refreshes:
// - Dashboard (today's visit count)
// - Today's schedule panel
// - Admin calendar
// - Caregiver calendar
// - Client calendar
// - Activity feed
```

### Example 2: Approving a Timesheet
```javascript
// Triggers refresh of:
// - Timesheets page
// - Dashboard (pending count)
// - Payroll export (available timesheets)
await integratedApproveTimesheet(timesheetId);
```

### Example 3: Converting Care Request to Client
```javascript
// Triggers refresh of:
// - Care requests page
// - Clients page
// - Dashboard (both counts)
// - Onboarding list
await integratedConvertCareRequest(requestId, clientData);
```

## Auto-Refresh

The system includes a 1-minute auto-refresh interval that intelligently updates only visible modules:

```javascript
CareHubRefreshCoordinator.setupAutoRefresh(60000);
```

## Debug Information

Access the current system state via browser console:

```javascript
// View state snapshot
CareHubState.debug()

// View refresh coordinator status
CareHubRefreshCoordinator.getStatus()

// View all subscribers
CareHubState.debug().subscriberPaths

// Force refresh all modules
CareHubRefreshCoordinator.refreshAll()
```

## Migration Guide

To use the integrated system in existing code:

1. **Replace direct DB calls** with integrated functions:
   ```javascript
   // Before
   await createSchedule(data);
   
   // After
   await integratedCreateSchedule(data);
   ```

2. **Access shared state** instead of local variables:
   ```javascript
   // Before
   let apps = await getApplications();
   
   // After (reactive)
   const apps = CareHubState.get('applications');
   // Or use subscribe for live updates
   ```

3. **Register custom modules** if building new features:
   ```javascript
   CareHubRefreshCoordinator.register('my-module', {
       refresh: async () => { /* refresh logic */ },
       isActive: () => currentPage === 'my-page',
       priority: 5
   });
   ```

## Benefits

1. **Single Source of Truth**: All data comes from shared state
2. **No Fake Data**: No mock data or duplicate stores
3. **Live Updates**: Real-time sync via Supabase
4. **Smart Refreshing**: Only active modules refresh
5. **Automatic KPI Sync**: Dashboard always shows current counts
6. **Cross-Module Awareness**: Changes in one module update all related modules
7. **Performance**: Debounced batch processing prevents UI thrashing

## Technical Details

- **State Management**: Custom reactive store with subscription pattern
- **Realtime**: Supabase PostgreSQL changes via WebSocket
- **Refresh Logic**: Dependency graph with priority-based execution
- **Cache Strategy**: 30-second staleness threshold for auto-refresh
- **Debounce**: 100ms batching for rapid sequential changes
