# Payroll Workflow

## Overview

The payroll workflow connects visit completion through timesheet submission, approval, and payroll export to external systems like Gusto.

```
Visit Scheduled
     ↓
Visit Completed (clock in/out)
     ↓
Timesheet Submitted
     ↓
Timesheet Approved/Rejected
     ↓
Payroll Export Created
     ↓
Timesheets Locked
     ↓
Gusto CSV Export
     ↓
Payroll Processed
```

---

## Database Tables

### payroll_exports
Master payroll export records for pay periods.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `pay_period_start` | Date | Period start date |
| `pay_period_end` | Date | Period end date |
| `export_type` | Enum | gusto, csv, quickbooks |
| `status` | Enum | draft, preview, exported, processed |
| `total_hours` | Decimal | Sum of all hours |
| `total_mileage` | Decimal | Sum of all miles |
| `caregiver_count` | Integer | Number of caregivers |
| `exported_by` | UUID | Admin who exported |
| `exported_at` | Timestamp | Export timestamp |

### payroll_export_items
Individual caregiver line items per export.

| Field | Type | Description |
|-------|------|-------------|
| `payroll_export_id` | UUID | Parent export |
| `caregiver_id` | UUID | Caregiver reference |
| `regular_hours` | Decimal | Non-OT hours |
| `overtime_hours` | Decimal | OT hours (>40/week) |
| `total_hours` | Decimal | Total hours |
| `mileage` | Decimal | Miles driven |
| `mileage_reimbursement` | Decimal | Calculated at IRS rate |
| `total_pay` | Decimal | Regular + OT + Mileage |
| `status` | Enum | pending, included, excluded, exported |

---

## Workflow Steps

### 1. Pay Period Setup

Admin creates payroll export:
```javascript
const export = await createPayrollExport({
    startDate: '2026-05-01',
    endDate: '2026-05-15',
    exportType: 'gusto',
    createdBy: 'admin-uuid'
});
// System auto-calculates from approved timesheets
// Creates export items for each caregiver
```

**System Actions:**
- Calls `get_payroll_summary()` for period data
- Creates master export record
- Creates line items per caregiver
- Calculates regular vs overtime hours
- Computes mileage reimbursement

### 2. Review & Preview

Admin reviews before export:
```javascript
const exportData = await getPayrollExportById(export.id);
// Shows all caregivers with hours, OT, mileage

await updatePayrollExportStatus(export.id, 'preview');
// Marks as ready for review
```

**Dashboard Shows:**
- Total caregivers: 12
- Total hours: 480.5
- Regular: 440.0
- Overtime: 40.5
- Total mileage: 850 miles
- Reimbursement: $556.75

### 3. Export to Gusto

Admin exports approved timesheets:
```javascript
await updatePayrollExportStatus(export.id, 'exported', { processedBy: 'admin-uuid' });
// Locks all approved timesheets
// Prevents future edits
```

**System Actions:**
1. Updates export status to 'exported'
2. Calls `lock_timesheets_for_export()`
3. Changes timesheet status to 'payroll_exported'
4. Sets `payroll_export_id` on each timesheet

### 4. CSV Generation

Export Gusto-compatible CSV:
```javascript
const csv = await exportPayrollToCSV(export.id);
// Returns: Employee ID, Name, Regular Hours, OT Hours, Mileage, Reimbursement, Total

// Download or upload directly to Gusto
```

**CSV Format:**
```
Employee ID,Employee Name,Regular Hours,Overtime Hours,Mileage,Mileage Reimbursement,Total Pay
uuid-123,Jane Smith,40.0,2.5,75.5,49.45,687.45
uuid-456,John Doe,40.0,0,62.0,40.61,520.61
```

### 5. Mark Processed

After Gusto confirms:
```javascript
await updatePayrollExportStatus(export.id, 'processed');
// Final status, payroll complete
```

---

## API Reference

### Payroll Exports

```javascript
// Get exports with filters
const exports = await getPayrollExports({
    status: 'draft',
    startDate: '2026-05-01',
    endDate: '2026-05-15'
});

// Get single export with items
const exportData = await getPayrollExportById('export-uuid');

// Create new export
const newExport = await createPayrollExport({
    startDate: '2026-05-01',
    endDate: '2026-05-15',
    exportType: 'gusto',
    createdBy: 'admin-uuid'
});

// Update status
await updatePayrollExportStatus('export-uuid', 'exported', { processedBy: 'admin-uuid' });
// Statuses: draft → preview → exported → processed

// Export to CSV
const csv = await exportPayrollToCSV('export-uuid');
```

### Overtime Calculation

```javascript
// Automatic 40-hour weekly threshold
const { regular_hours, overtime_hours } = await supabaseClient
    .rpc('calculate_overtime', {
        p_caregiver_id: 'caregiver-uuid',
        p_week_start: '2026-05-04',
        p_hours: 45
    });
// Returns: { regular_hours: 40, overtime_hours: 5 }
```

---

## Payroll Summary

SQL function for dashboard:
```sql
SELECT * FROM get_payroll_summary('2026-05-01', '2026-05-15');
-- Returns: caregiver_id, caregiver_name, total_hours, regular_hours, 
--          overtime_hours, mileage, visit_count
```

**Dashboard Widget:**
```
┌─────────────────────────────────────────────┐
│ Payroll Summary (May 1-15, 2026)           │
├─────────────────────────────────────────────┤
│                                             │
│ Total Hours:        480.5 hours            │
│ Regular:            440.0 hours            │
│ Overtime:            40.5 hours            │
│ Mileage:            850 miles              │
│ Reimbursement:      $556.75                │
│                                             │
│ Caregivers:         12                     │
│ Avg Hours:          40.0 hours             │
│                                             │
│ [Create Payroll Export]                    │
└─────────────────────────────────────────────┘
```

---

## Caregiver Payroll Portal

### My Pay

Caregivers see:
- Approved timesheets by pay period
- Hours breakdown (regular + overtime)
- Mileage reimbursement
- Payroll export history
- Download approved timesheets

**View:**
```
┌─────────────────────────────────────────────┐
│ My Payroll                                   │
├─────────────────────────────────────────────┤
│                                             │
│ Current Pay Period (May 1-15)               │
│ Status: Approved                            │
│                                             │
│ Regular Hours:     40.0                     │
│ Overtime Hours:     2.5                     │
│ Total Hours:        42.5                    │
│ Mileage:            75.5 miles              │
│ Reimbursement:      $49.45                  │
│                                             │
│ Est. Pay:          $687.45                 │
│                                             │
│ [Download Timesheet PDF]                    │
│                                             │
├─────────────────────────────────────────────┤
│ Previous Pay Periods                         │
│ • April 16-30 - $650.20                    │
│ • April 1-15 - $720.50                     │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Best Practices

### For Admins
1. **Export weekly or bi-weekly** - Consistent pay periods
2. **Review before export** - Check for anomalies
3. **Lock after export** - Prevents changes to processed timesheets
4. **Export early** - Allow time for Gusto processing
5. **Keep records** - Export history for audits

### For Caregivers
1. **Submit timesheets promptly** - Before pay period ends
2. **Verify hours match visits** - Use clock in/out when possible
3. **Log mileage accurately** - Include all work-related travel
4. **Check pay period totals** - Before approval

---

## Troubleshooting

### Timesheet not included in export
- Check status is 'approved' (not 'submitted')
- Verify date falls within pay period
- Confirm payroll_export_id is NULL

### Wrong overtime calculation
- Check week_starting date on timesheet
- Verify 40-hour threshold calculation
- Review overlapping week boundaries

### Export failed
- Check admin permissions
- Verify no duplicate exports for period
- Review browser console for errors

---

## Gusto Integration

### CSV Upload Process
1. Generate CSV from export
2. Log into Gusto admin
3. Navigate to Payroll → Run Payroll
4. Upload CSV for hour import
5. Review and approve in Gusto
6. Mark as 'processed' in CareHub

### Field Mapping
| CareHub | Gusto CSV | Gusto Field |
|---------|-----------|-------------|
| caregiver_id | Employee ID | Employee ID |
| name | Employee Name | Name |
| regular_hours | Regular Hours | Regular Pay Hours |
| overtime_hours | Overtime Hours | Overtime Pay Hours |
| mileage | Mileage | Custom Field |
| reimbursement | Mileage Reimbursement | Reimbursement |

---

## Notifications

| Event | Recipient | Message |
|-------|-----------|---------|
| Timesheet Approved | Caregiver | "Your timesheet for [date] has been approved" |
| Timesheet Rejected | Caregiver | "Your timesheet has been rejected. Reason: [reason]" |
| Correction Needed | Caregiver | "Please correct and resubmit your timesheet" |
| Payroll Exported | Admin | "Payroll export [period] is ready for Gusto" |
