# SeniorSitters CareHub - Unified Calendar System

## Overview

The CareHub now uses a **single, unified calendar system** that powers both the dashboard mini calendar and the full scheduling calendar. This ensures visual consistency, shared logic, and maintainable code.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified Calendar System                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Shared CSS (design-system.css)              │  │
│  │  .calendar-container, .calendar-day, .calendar-event │  │
│  │  Same colors, spacing, shadows, and transitions     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Shared JavaScript Utilities                │  │
│  │  renderCalendarDay(), groupSchedulesByDate(), etc.  │  │
│  │  Same rendering logic, date handling, timezone-safe   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐        │
│  │   Dashboard │   │  Schedule  │   │   Week/    │        │
│  │   Mini Cal  │   │  Month View│   │   Day View │        │
│  └────────────┘   └────────────┘   └────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Shared Visual System
Both calendars use identical:
- **Colors**: Same event status colors (blue=scheduled, green=completed, red=cancelled, amber=unassigned)
- **Typography**: Same font sizes, weights, and hierarchy
- **Spacing**: Consistent padding and gaps
- **Borders**: Unified border system
- **Shadows**: Same elevation shadows
- **Hover/Active States**: Consistent interactions

### 2. Shared Logic
Both calendars share:
- **Date rendering**: `renderCalendarDay()` function
- **Event grouping**: `groupSchedulesByDate()` function
- **Date parsing**: Timezone-safe `parseLocalDate()` and `formatDateForAPI()`
- **Status classes**: `getCalendarEventClass()` and `getCalendarEventDotClass()`
- **Navigation**: Same prev/next handlers

### 3. Status Colors (Unified)

| Status | Color | Usage |
|--------|-------|-------|
| Scheduled | 🔵 Blue | `#DBEAFE` bg, `#1E40AF` text |
| Completed | 🟢 Green | `#D1FAE5` bg, `#065F46` text |
| Cancelled | 🔴 Red | `#FEE2E2` bg, `#991B1B` text |
| In Progress | 🟠 Amber | `#FEF3C7` bg, `#92400E` text |
| Unassigned | 🟡 Warning | Dashed border amber |
| No Show | ⚪ Gray | `#F3F4F6` bg, `#4B5563` text |

### 4. Component Hierarchy

```
calendar-container
├── calendar-header
│   ├── calendar-nav-btn (prev)
│   ├── calendar-title
│   └── calendar-nav-btn (next)
├── calendar-day-headers
│   └── calendar-day-header (x7)
├── calendar-grid
│   └── calendar-day (x42 for month view)
│       ├── calendar-day-number
│       └── calendar-events
│           ├── calendar-event (compact view: dot)
│           └── calendar-event (full view: pill)
└── calendar-legend (optional)
```

## Shared Utility Functions

### `renderCalendarDay(options)`
Renders a single calendar day cell.

```javascript
renderCalendarDay({
    dateStr: '2026-01-15',
    dayNumber: 15,
    isToday: false,
    isCurrentMonth: true,
    isWeekend: false,
    isSelected: false,
    events: [...],
    maxEvents: 3,
    compact: false,  // true = mini calendar (dots), false = full (pills)
    onClick: 'openCreateScheduleModalForDate("2026-01-15")'
});
```

### `renderCalendarHeader(options)`
Renders calendar header with navigation.

```javascript
renderCalendarHeader({
    title: 'January 2026',
    onPrev: 'changeMonth(-1)',
    onNext: 'changeMonth(1)',
    compact: false
});
```

### `renderCalendarDayHeaders(compact)`
Renders Sun-Sat headers. `compact=true` shows "S M T W T F S".

### `groupSchedulesByDate(schedules)`
Groups array of schedules by date string.

```javascript
const grouped = groupSchedulesByDate(schedules);
// Returns: { '2026-01-15': [schedule1, schedule2], ... }
```

### `getCalendarEventClass(status, isUnassigned)`
Returns CSS class string for event styling.

### `getCalendarEventDotClass(status, isUnassigned)`
Returns CSS class string for mini calendar dot indicators.

### `isToday(dateStr)`
Checks if date string is today.

### `navigateToDateFromCalendar(dateStr)`
Navigates to schedules page with selected date.

## CSS Classes Reference

### Container
```css
.calendar-container          /* Main wrapper */
.calendar-container.compact  /* Mini calendar variant */
```

### Header
```css
.calendar-header
.calendar-title
.calendar-nav
.calendar-nav-btn
```

### Day Grid
```css
.calendar-day-headers
.calendar-day-header
.calendar-day-header.weekend
.calendar-grid
```

### Day Cell
```css
.calendar-day
.calendar-day.compact      /* Mini calendar */
.calendar-day.other-month   /* Previous/next month days */
.calendar-day.today         /* Today's cell */
.calendar-day.selected      /* Selected date */
.calendar-day.weekend       /* Saturday/Sunday */
.calendar-day-number        /* Day number circle */
```

### Events
```css
.calendar-events
.calendar-events.compact    /* Mini calendar row */
.calendar-event             /* Full event pill */
.calendar-event-dot         /* Mini calendar dot */
.calendar-more-events       /* "+3 more" indicator */
```

### Event Status Classes
```css
.calendar-event.scheduled
.calendar-event.confirmed
.calendar-event.in_progress
.calendar-event.completed
.calendar-event.cancelled
.calendar-event.no_show
.calendar-event.unassigned
```

## Implementation Examples

### Dashboard Mini Calendar
```javascript
async function renderMiniCalendarV2() {
    const monthSchedules = await getSchedulesForMonth(year, month);
    const schedulesByDate = groupSchedulesByDate(monthSchedules);
    
    let calendarGridHTML = '';
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${month+1}-${day}`;
        calendarGridHTML += renderCalendarDay({
            dateStr,
            dayNumber: day,
            isToday: isToday(dateStr),
            isCurrentMonth: true,
            events: schedulesByDate[dateStr] || [],
            compact: true  // <-- Dots instead of pills
        });
    }
    
    container.innerHTML = `
        <div class="calendar-container compact">
            ${renderCalendarHeader({...})}
            ${renderCalendarDayHeaders(true)}
            <div class="calendar-grid">${calendarGridHTML}</div>
        </div>
    `;
}
```

### Full Month View
```javascript
async function renderMonthView() {
    const schedules = await getSchedules({ date_from: start, date_to: end });
    const schedulesByDate = groupSchedulesByDate(schedules);
    
    let calendarGridHTML = '';
    for (let i = 0; i < 42; i++) {
        const dateStr = ...;
        calendarGridHTML += renderCalendarDay({
            dateStr,
            dayNumber: day,
            isToday: isToday(dateStr),
            isSelected: dateStr === selectedDate,
            events: schedulesByDate[dateStr] || [],
            compact: false,  // <-- Full event pills
            onClick: `openCreateScheduleModalForDate('${dateStr}')`
        });
    }
    
    container.innerHTML = `
        <div class="calendar-container">
            ${renderCalendarHeader({...})}
            ${renderCalendarDayHeaders(false)}
            <div class="calendar-grid">${calendarGridHTML}</div>
        </div>
    `;
}
```

## Timezone Safety

The unified calendar system treats all dates as **local plain strings** (YYYY-MM-DD), never as JavaScript Date objects that could cause timezone shifts.

```javascript
// ✅ CORRECT
const dateStr = '2026-01-15';
const isToday = isToday(dateStr);

// ❌ WRONG - causes timezone issues
const date = new Date('2026-01-15');  // May shift to Jan 14 or 16
```

## Sync Between Calendars

When you click a date on the mini calendar:

1. `navigateToDateFromCalendar(dateStr)` is called
2. Sets `scheduleCurrentDate` to the clicked date
3. Resets mini calendar offset to 0
4. Navigates to schedules page
5. Full calendar renders with that date as "selected"

```javascript
function navigateToDateFromCalendar(dateStr) {
    scheduleCurrentDate = parseLocalDate(dateStr);
    document.getElementById('miniCalendar').dataset.monthOffset = '0';
    navigateTo('schedules');
}
```

## Realtime Updates

When schedules change via Supabase realtime:

```javascript
// In realtime.js
if (currentPage === 'dashboard') {
    renderMiniCalendarV2WithOffset(offset);  // Refresh mini calendar
}
```

## Customization

### Changing Event Colors
Edit CSS variables in `design-system.css`:

```css
--info: #3B82F6;           /* Scheduled events */
--success: #22C55E;        /* Completed events */
--warning: #F59E0B;        /* In progress/unassigned */
--danger: #EF4444;         /* Cancelled events */
```

### Changing Day Cell Size
```css
.calendar-day {
    min-height: 120px;  /* Default: 100px */
}

.calendar-day.compact {
    min-height: 40px;   /* Mini calendar */
}
```

### Adding New Status
1. Add to `getCalendarEventClass()` statusMap
2. Add CSS class `.calendar-event.newstatus`
3. Add to legend if needed

## Migration Guide

To migrate an existing calendar view:

1. **Replace container class**: `class="my-old-calendar"` → `class="calendar-container"`
2. **Use shared renderers**: Replace custom day rendering with `renderCalendarDay()`
3. **Use shared header**: Replace custom header with `renderCalendarHeader()`
4. **Group schedules**: Use `groupSchedulesByDate()` instead of custom grouping
5. **Update event classes**: Use `getCalendarEventClass()` for status styling

## Testing Checklist

- [ ] Mini calendar and full calendar use same colors
- [ ] Event pills look identical in both calendars
- [ ] Today highlighting is the same
- [ ] Hover states work consistently
- [ ] Date selection syncs between calendars
- [ ] Timezone-safe date handling everywhere
- [ ] Realtime updates refresh both calendars
- [ ] Responsive layout works on mobile
- [ ] Status colors are correct (blue=scheduled, green=completed, etc.)
- [ ] Unassigned visits show warning styling
