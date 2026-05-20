# SeniorSitters CareHub

A clean, professional admin portal for managing SeniorSitters caregiver applications, care requests, caregivers, and clients.

## Phase 1 Features

### Pages
- **Login** - Mock authentication (admin@seniorsittersco.com / demo123)
- **Dashboard** - Overview statistics and recent activity
- **Applications** - Review and approve/deny caregiver applications
- **Care Requests** - Review and approve/deny client care requests
- **Caregivers** - View and manage caregiver profiles
- **Clients** - View and manage client profiles
- **Settings** - Basic configuration (placeholder for future)

### Core Workflows

#### Application → Caregiver Workflow
1. Job seeker submits application via SeniorSitters website
2. Application appears in CareHub with "pending" status
3. Admin reviews application details in modal
4. Admin approves → Application status changes to "approved"
5. New caregiver created with "onboarding" status

#### Care Request → Client Workflow
1. Family submits care request via SeniorSitters website
2. Request appears in CareHub with "pending" status
3. Admin reviews request details in modal
4. Admin approves → Request status changes to "approved"
5. New client created with "active" status

## File Structure

```
CareHub Portal/
├── index.html          # Main dashboard app
├── login.html          # Login page
├── css/
│   └── style.css       # All styles
├── js/
│   ├── config.js       # Supabase config, constants
│   ├── auth.js         # Authentication logic
│   ├── database.js     # Supabase queries
│   └── app.js          # Main application logic
└── README.md           # This file
```

## Setup Instructions

### 1. Supabase Configuration

Edit `js/config.js` and add your Supabase credentials:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 2. Database Schema

Ensure your Supabase project has the following tables (lowercase):

- `applications` - Career applications from website
- `care_requests` - Care request forms from website
- `caregivers` - Approved caregiver profiles
- `clients` - Approved client profiles
- `notifications` - Internal notifications

### 3. Running Locally

Simply open `login.html` in a browser or serve via a local web server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

Then navigate to `http://localhost:8000/login.html`

## Demo Login

- **Email:** admin@seniorsittersco.com
- **Password:** demo123

Session is stored in localStorage for 24 hours.

## What's NOT in Phase 1

- Caregiver/client portal access
- Email notifications (records only created in database)
- Real-time updates
- Payroll system
- Complex role-based permissions
- User management

These will be added in future phases.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

Requires ES6+ support.
