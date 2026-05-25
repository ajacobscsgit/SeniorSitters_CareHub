// SeniorSitters CareHub - Database Operations
// ============================================

// Reference to global config (set in config.js)
const TABLES = window.TABLES;

// Initialize Supabase client
// The Supabase UMD library exposes createClient on window.supabase
let supabaseClient = null;

function initSupabase() {
    // The CDN exposes supabase as a global with createClient
    if (typeof window !== 'undefined' && window.supabase && window.CAREHUB_CONFIG) {
        try {
            // UMD build exposes supabase.createClient directly
            const client = window.supabase.createClient(
                window.CAREHUB_CONFIG.SUPABASE_URL,
                window.CAREHUB_CONFIG.SUPABASE_ANON_KEY
            );
            if (window.DEBUG) console.log('Supabase client initialized successfully');
            return client;
        } catch (e) {
            console.error('Error creating Supabase client:', e);
        }
    }
    console.warn('Supabase library not loaded yet or config missing');
    return null;
}

// Try to initialize immediately
supabaseClient = initSupabase();

// Also initialize on DOMContentLoaded in case scripts load in different order
document.addEventListener('DOMContentLoaded', function() {
    if (!supabaseClient) {
        if (window.DEBUG) console.log('[CareHub] Initializing Supabase on DOMContentLoaded');
        supabaseClient = initSupabase();
    } else {
        if (window.DEBUG) console.log('[CareHub] Supabase already initialized');
    }
    
    // Expose to window for direct testing
    window.carehubSupabase = supabaseClient;
    if (window.DEBUG) console.log('[CareHub] Exposed to window.carehubSupabase for testing');
});

// ==================== APPLICATIONS ====================

/**
 * Get all applications with optional filtering
 * @param {Object} filters - Optional filters (status, etc.)
 * @returns {Promise<Array>}
 */
async function getApplications(filters = {}) {
    if (window.DEBUG) console.log('[CareHub] === Fetching Applications ===');
    if (window.DEBUG) console.log('[CareHub] Supabase client exists:', !!supabaseClient);
    
    if (!supabaseClient) {
        console.error('[CareHub] ERROR: Supabase client not initialized');
        return [];
    }
    
    if (window.DEBUG) console.log('[CareHub] Table:', TABLES.APPLICATIONS);
    if (window.DEBUG) console.log('[CareHub] Filters:', JSON.stringify(filters));
    
    // Select actual columns from applications table
    let query = supabaseClient
        .from(TABLES.APPLICATIONS)
        .select('id, full_name, phone, email, city, availability, transportation, willing_outings, experience, why_work_with_seniors, resume_url, status, admin_notes, denial_reason, interview_datetime, created_at')
        .order('created_at', { ascending: false });
    
    // Only filter if a specific status is requested
    if (filters.status) {
        query = query.eq('status', filters.status);
        if (window.DEBUG) console.log('[CareHub] Filtering by status:', filters.status);
    } else {
        if (window.DEBUG) console.log('[CareHub] No status filter - fetching ALL applications');
    }
    
    if (window.DEBUG) console.log('[CareHub] Executing Supabase query...');
    const { data, error } = await query;
    
    if (error) {
        console.error('[CareHub] ERROR fetching applications:', error);
        console.error('[CareHub] Error details:', JSON.stringify(error));
        return [];
    }
    
    if (window.DEBUG) console.log('[CareHub] SUCCESS - Applications returned:', data ? data.length : 0);
    if (window.DEBUG) console.log('[CareHub] Data:', data);
    
    return data || [];
}

// Direct test function as requested
async function testDirectQuery() {
    if (window.DEBUG) console.log('[CareHub] === Direct Query Test ===');
    if (window.DEBUG) console.log('[CareHub] Using window.carehubSupabase:', !!window.carehubSupabase);
    
    if (!window.carehubSupabase) {
        console.error('[CareHub] window.carehubSupabase not available');
        return;
    }
    
    const { data, error } = await window.carehubSupabase
        .from(TABLES.APPLICATIONS)
        .select("*")
        .order("created_at", { ascending: false });
    
    if (window.DEBUG) console.log("Applications direct query:", data, error);
    return { data, error };
}

/**
 * Get single application by ID
 * @param {string} id 
 * @returns {Promise<Object|null>}
 */
async function getApplicationById(id) {
    if (!supabaseClient) return null;
    
    const { data, error } = await supabaseClient
        .from(TABLES.APPLICATIONS)
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('Error fetching application:', error);
        return null;
    }
    
    return data;
}

/**
 * Update application status
 * @param {string} id 
 * @param {string} status - 'approved', 'denied', etc.
 * @param {string} notes - Optional admin notes
 * @returns {Promise<boolean>}
 */
async function updateApplicationStatus(id, status, notes = '') {
    if (!supabaseClient) return false;

    if (window.DEBUG) console.log(`[CareHub] Updating application ${id} to status: ${status}`);

    const updates = {
        status: status,
        updated_at: new Date().toISOString()
    };

    if (status === 'approved') {
        updates.approved_at = new Date().toISOString();
    }

    if (status === 'denied' && notes) {
        // Save denial reason separately from admin notes
        updates.denial_reason = notes;
    } else if (notes) {
        updates.admin_notes = notes;
    }

    const { error } = await supabaseClient
        .from(TABLES.APPLICATIONS)
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error('[CareHub] ERROR updating application:', error);
        console.error('[CareHub] Error code:', error.code);
        console.error('[CareHub] Error message:', error.message);

        // Check for missing column errors
        if (error.message && error.message.includes('column')) {
            const columnMatch = error.message.match(/column "([^"]+)"/);
            if (columnMatch) {
                console.error(`[CareHub] MISSING COLUMN: applications table needs column "${columnMatch[1]}"`);
            }
        }

        return false;
    }

    if (window.DEBUG) console.log(`[CareHub] Application ${id} updated to ${status} successfully`);
    return true;
}

// ==================== CARE REQUESTS ====================

/**
 * Get all care requests with optional filtering
 * @param {Object} filters 
 * @returns {Promise<Array>}
 */
async function getCareRequests(filters = {}) {
    if (window.DEBUG) console.log('[CareHub] === Fetching Care Requests ===');
    if (window.DEBUG) console.log('[CareHub] Filters:', JSON.stringify(filters));

    if (!supabaseClient) {
        console.error('[CareHub] ERROR: Supabase client not initialized');
        return [];
    }

    let query = supabaseClient
        .from(TABLES.CARE_REQUESTS)
        .select('*')
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
        if (window.DEBUG) console.log('[CareHub] Filtering by status:', filters.status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[CareHub] ERROR fetching care requests:', error);
        return [];
    }

    if (window.DEBUG) console.log('[CareHub] SUCCESS - Care requests returned:', data ? data.length : 0);
    return data || [];
}

/**
 * Get single care request by ID
 * @param {string} id 
 * @returns {Promise<Object|null>}
 */
async function getCareRequestById(id) {
    if (!supabaseClient) return null;
    
    const { data, error } = await supabaseClient
        .from(TABLES.CARE_REQUESTS)
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('Error fetching care request:', error);
        return null;
    }
    
    return data;
}

async function createCareRequest(formData) {
    if (!supabaseClient) return null;

    const careRequest = {
        requester_name: formData.requester_name || formData.full_name || '',
        phone: formData.phone || '',
        email: formData.email || '',
        care_for: formData.care_for || '',
        location: formData.location || '',
        best_time_to_contact: formData.best_time_to_contact || '',
        start_timeframe: formData.start_timeframe || '',
        preferred_time: formData.preferred_time || '',
        preferred_days: formData.preferred_days || null,
        support_types: formData.support_types || null,
        level_of_care: formData.level_of_care || '',
        mobility_notes: formData.mobility_notes || '',
        lives_alone: formData.lives_alone ?? null,
        pets_in_home: formData.pets_in_home ?? null,
        main_concern: formData.main_concern || '',
        notes: formData.notes || '',
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
        .from(TABLES.CARE_REQUESTS)
        .insert([careRequest])
        .select()
        .single();

    if (error) {
        console.error('[CareHub] ERROR creating care request:', error);
        return null;
    }

    return data;
}

/**
 * Update care request status
 * @param {string} id 
 * @param {string} status 
 * @param {string} notes 
 * @returns {Promise<boolean>}
 */
async function updateCareRequestStatus(id, status, notes = '') {
    if (!supabaseClient) return false;

    if (window.DEBUG) console.log(`[CareHub] Updating care request ${id} to status: ${status}`);

    const updates = {
        status: status,
        updated_at: new Date().toISOString()
    };

    if (status === 'converted_to_client') {
        updates.converted_at = new Date().toISOString();
    }

    // Handle notes based on status
    if (status === 'denied' && notes) {
        updates.denial_reason = notes;
    } else if (notes) {
        updates.admin_notes = notes;
    }

    const { error } = await supabaseClient
        .from(TABLES.CARE_REQUESTS)
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error('[CareHub] ERROR updating care request:', error);
        console.error('[CareHub] Error code:', error.code);
        console.error('[CareHub] Error message:', error.message);

        // Check for missing column errors
        if (error.message && error.message.includes('column')) {
            const columnMatch = error.message.match(/column "([^"]+)"/);
            if (columnMatch) {
                console.error(`[CareHub] MISSING COLUMN: care_requests table needs column "${columnMatch[1]}"`);
            }
        }

        return false;
    }

    if (window.DEBUG) console.log(`[CareHub] Care request ${id} updated to ${status} successfully`);
    return true;
}

async function updateCareRequestAdminNotes(id, notes) {
    if (!supabaseClient) return false;

    const { error } = await supabaseClient
        .from(TABLES.CARE_REQUESTS)
        .update({
            admin_notes: notes,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        console.error('[CareHub] ERROR updating care request admin notes:', error);
        return false;
    }

    return true;
}

// ==================== CAREGIVERS ====================

/**
 * Get all caregivers
 * @param {Object} filters 
 * @returns {Promise<Array>}
 */
async function getCaregivers(filters = {}) {
    if (window.DEBUG) console.log('[CareHub] === Fetching Caregivers ===');
    if (window.DEBUG) console.log('[CareHub] Filters:', JSON.stringify(filters));

    if (!supabaseClient) {
        console.error('[CareHub] ERROR: Supabase client not initialized');
        return [];
    }

    // Role-scoped: caregivers see only their own row;
    // client_family gets all caregivers (filtered post-query by app.js using assigned schedule IDs)
    const isFullAccess = window.RoleFilter ? window.RoleFilter._isFullAccess() : true;
    if (!isFullAccess && window.getCurrentRole) {
        const role = window.getCurrentRole();
        if (role === 'caregiver') {
            const caregiverId = window.RoleFilter.getCurrentCaregiverId();
            if (!caregiverId) return [];
            // Fetch only this caregiver's own row
            const { data, error } = await supabaseClient
                .from(TABLES.CAREGIVERS)
                .select('*')
                .eq('id', caregiverId)
                .limit(1);
            if (error) { console.error('[CareHub] ERROR fetching caregiver (scoped):', error); return []; }
            return data || [];
        }
        // client_family: fetch all (app.js will narrow to assigned caregiver IDs)
    }

    let query = supabaseClient
        .from(TABLES.CAREGIVERS)
        .select('*')
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
        if (window.DEBUG) console.log('[CareHub] Filtering by status:', filters.status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[CareHub] ERROR fetching caregivers:', error);
        return [];
    }

    if (window.DEBUG) console.log('[CareHub] SUCCESS - Caregivers returned:', data ? data.length : 0);
    return data || [];
}

/**
 * Get caregiver by ID
 * @param {string} id 
 * @returns {Promise<Object|null>}
 */
async function getCaregiverById(id) {
    if (!supabaseClient) return null;
    
    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVERS)
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('Error fetching caregiver:', error);
        return null;
    }
    
    return data;
}

/**
 * Create caregiver from approved application
 * @param {Object} application 
 * @returns {Promise<Object|null>}
 */
async function createCaregiverFromApplication(application) {
    if (!supabaseClient) return null;

    if (window.DEBUG) console.log('[CareHub] Creating caregiver from application:', application.id, application.full_name);

    // Map actual application fields to caregiver fields
    const caregiver = {
        name: application.full_name,
        phone: application.phone,
        email: application.email,
        city: application.city,
        availability: application.availability,
        transportation: application.transportation,
        willing_outings: application.willing_outings,
        // Experience and motivation from application
        experience: application.experience || '',
        why_work_with_seniors: application.why_work_with_seniors || '',
        application_id: application.id,
        status: 'onboarding',
        account_status: 'approved_no_invite',
        pay_rate: 17,
        background_check_status: 'pending',
        training_status: 'pending',
        documents_status: 'pending',
        welcome_package_status: 'not_sent',
        // Admin notes for onboarding tracking
        notes: '',
        created_at: new Date().toISOString()
    };

    if (window.DEBUG) console.log('[CareHub] Inserting caregiver:', caregiver);

    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVERS)
        .insert([caregiver])
        .select()
        .single();

    if (error) {
        console.error('[CareHub] ERROR creating caregiver:', error);
        console.error('[CareHub] Error code:', error.code);
        console.error('[CareHub] Error message:', error.message);

        // Check for missing column errors
        if (error.message && error.message.includes('column')) {
            const columnMatch = error.message.match(/column "([^"]+)"/);
            if (columnMatch) {
                console.error(`[CareHub] MISSING COLUMN: caregivers table needs column "${columnMatch[1]}"`);
            }
        }

        return null;
    }

    if (window.DEBUG) console.log('[CareHub] Caregiver created successfully:', data);

    // Create notification
    if (window.DEBUG) console.log('[CareHub] Creating notification for new caregiver...');
    const notification = await createNotification({
        type: 'caregiver_created',
        title: 'New Caregiver Onboarding',
        message: `${caregiver.name} has been added as a new caregiver (onboarding).`,
        related_id: data.id,
        related_type: 'caregiver'
    });

    if (!notification) {
        console.warn('[CareHub] Failed to create notification, but caregiver was created');
    }

    return data;
}

/**
 * Update caregiver
 * @param {string} id 
 * @param {Object} updates 
 * @returns {Promise<boolean>}
 */
async function updateCaregiver(id, updates) {
    if (!supabaseClient) return false;

    if (window.DEBUG) console.log('[CareHub] updateCaregiver called with id:', id);

    // Whitelist only columns that exist in caregivers table
    const allowedColumns = [
        'status',
        'account_status',
        'pay_rate',
        'background_check_status',
        'training_status',
        'documents_status',
        'welcome_package_status',
        'notes'
    ];

    // Filter updates to only include allowed columns
    const filteredUpdates = {};
    for (const key of allowedColumns) {
        if (updates.hasOwnProperty(key)) {
            filteredUpdates[key] = updates[key];
        }
    }

    if (window.DEBUG) console.log('[CareHub] Filtered updates object:', filteredUpdates);

    const { error } = await supabaseClient
        .from(TABLES.CAREGIVERS)
        .update(filteredUpdates)
        .eq('id', id);

    if (error) {
        console.error('[CareHub] ERROR updating caregiver:', error);
        console.error('[CareHub] Error code:', error.code);
        console.error('[CareHub] Error message:', error.message);
        console.error('[CareHub] Error details:', error.details);
        return false;
    }

    if (window.DEBUG) console.log('[CareHub] Caregiver updated successfully');
    return true;
}

/**
 * Update the portal account_status for a caregiver.
 * Valid values: 'approved_no_invite' | 'pending_invite' | 'invite_sent' | 'active' | 'inactive'
 * @param {string} id
 * @param {string} accountStatus
 * @returns {Promise<boolean>}
 */
async function updateCaregiverAccountStatus(id, accountStatus) {
    if (!supabaseClient) return false;

    const VALID = ['approved_no_invite', 'pending_invite', 'invite_sent', 'active', 'inactive'];
    if (!VALID.includes(accountStatus)) {
        console.error('[CareHub] updateCaregiverAccountStatus: invalid status:', accountStatus);
        return false;
    }

    if (window.DEBUG) console.log('[CareHub] updateCaregiverAccountStatus', id, '->', accountStatus);

    const { error } = await supabaseClient
        .from(TABLES.CAREGIVERS)
        .update({ account_status: accountStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('[CareHub] ERROR updating caregiver account_status:', error.message);
        return false;
    }
    return true;
}

// ==================== CLIENTS ====================

/**
 * Get all clients
 * @param {Object} filters 
 * @returns {Promise<Array>}
 */
async function getClients(filters = {}) {
    if (!supabaseClient) return [];

    // Role-scoped: client_family sees only their own client row;
    // caregivers get all (filtered post-query by app.js using assigned schedule IDs)
    const isFullAccess = window.RoleFilter ? window.RoleFilter._isFullAccess() : true;
    if (!isFullAccess && window.getCurrentRole) {
        const role = window.getCurrentRole();
        if (role === 'client_family') {
            const clientId = window.RoleFilter.getCurrentClientId();
            if (!clientId) return [];
            const { data, error } = await supabaseClient
                .from(TABLES.CLIENTS)
                .select('*')
                .eq('id', clientId)
                .limit(1);
            if (error) { console.error('[CareHub] ERROR fetching client (scoped):', error); return []; }
            return data || [];
        }
        // caregiver: fetch all (app.js will narrow to assigned client IDs)
    }

    let query = supabaseClient
        .from(TABLES.CLIENTS)
        .select('*')
        .order('created_at', { ascending: false });
    
    if (filters.status) {
        query = query.eq('status', filters.status);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }
    
    return data || [];
}

/**
 * Get client by ID
 * @param {string} id 
 * @returns {Promise<Object|null>}
 */
async function getClientById(id) {
    if (!supabaseClient) return null;
    
    const { data, error } = await supabaseClient
        .from(TABLES.CLIENTS)
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('Error fetching client:', error);
        return null;
    }
    
    return data;
}

/**
 * Create client from approved care request
 * @param {Object} careRequest 
 * @returns {Promise<Object|null>}
 */
async function createClientFromCareRequest(careRequest) {
    if (!supabaseClient) return null;

    if (careRequest.status !== 'approved' && careRequest.status !== 'onboarding') {
        console.error('[CareHub] Care request must be approved or onboarding before conversion:', careRequest.status);
        return null;
    }

    if (window.DEBUG) console.log('[CareHub] Creating client from care request:', careRequest.id, careRequest.requester_name);

    const client = {
        care_request_id: careRequest.id,
        requester_name: careRequest.requester_name,
        phone: careRequest.phone,
        email: careRequest.email,
        care_for: careRequest.care_for,
        location: careRequest.location,
        preferred_days: careRequest.preferred_days,
        preferred_time: careRequest.preferred_time,
        support_types: careRequest.support_types,
        level_of_care: careRequest.level_of_care,
        mobility_notes: careRequest.mobility_notes,
        lives_alone: careRequest.lives_alone,
        pets_in_home: careRequest.pets_in_home,
        main_concern: careRequest.main_concern,
        notes: careRequest.notes,
        admin_notes: careRequest.admin_notes,
        status: 'active',
        name: careRequest.care_for,
        address: careRequest.location,
        service_package: careRequest.support_types
    };

    if (window.DEBUG) console.log('[CareHub] Inserting client:', client);

    const { data, error } = await supabaseClient
        .from(TABLES.CLIENTS)
        .insert([client])
        .select()
        .single();

    if (error) {
        console.error('[CareHub] ERROR creating client:', error);
        console.error('[CareHub] Error code:', error.code);
        console.error('[CareHub] Error message:', error.message);

        // Check for missing column errors
        if (error.message && error.message.includes('column')) {
            const columnMatch = error.message.match(/column "([^"]+)"/);
            if (columnMatch) {
                console.error(`[CareHub] MISSING COLUMN: clients table needs column "${columnMatch[1]}"`);
            }
        }

        return null;
    }

    if (window.DEBUG) console.log('[CareHub] Client created successfully:', data);

    // Update care request status to converted_to_client
    if (window.DEBUG) console.log('[CareHub] Updating care request status to converted_to_client...');
    const statusUpdated = await updateCareRequestStatus(careRequest.id, 'converted_to_client');
    if (!statusUpdated) {
        console.warn('[CareHub] Failed to update care request status, but client was created');
        return null;
    }

    // Create notification
    if (window.DEBUG) console.log('[CareHub] Creating notification for new client...');
    const notification = await createNotification({
        type: 'client_created',
        title: 'New Client Added',
        message: `${client.name || client.requester_name || 'A new client'} has been added as a new client.`,
        related_id: data.id,
        related_type: 'client'
    });

    if (!notification) {
        console.warn('[CareHub] Failed to create notification, but client was created');
    }

    return data;
}

/**
 * Update client
 * @param {string} id 
 * @param {Object} updates 
 * @returns {Promise<boolean>}
 */
async function updateClient(id, updates) {
    if (!supabaseClient) return false;
    
    updates.updated_at = new Date().toISOString();
    
    const { error } = await supabaseClient
        .from(TABLES.CLIENTS)
        .update(updates)
        .eq('id', id);
    
    if (error) {
        console.error('Error updating client:', error);
        return false;
    }
    
    return true;
}

// ==================== NOTIFICATIONS ====================

/** Valid notification type values */
const NOTIFICATION_TYPES = [
    'new_visit_assigned', 'visit_changed', 'visit_cancelled', 'caregiver_reassigned',
    'timesheet_submitted', 'timesheet_approved', 'timesheet_rejected',
    'visit_update_submitted', 'visit_update_approved', 'visit_update_rejected',
    'training_assigned', 'invite_queued', 'invite_sent', 'emergency_alert',
    'schedule_created', 'schedule_updated'
];

/**
 * Create a notification row.
 *
 * @param {Object} n
 * @param {string}  n.type               – one of NOTIFICATION_TYPES
 * @param {string}  n.title
 * @param {string}  n.message
 * @param {string}  [n.recipient_user_id] – specific auth user
 * @param {string}  [n.recipient_role]    – 'admin_owner'|'co_owner'|'caregiver'|'client_family'
 * @param {string}  [n.caregiver_id]
 * @param {string}  [n.client_id]
 * @param {string}  [n.priority]          – 'low'|'normal'|'high'|'emergency'  (default: 'normal')
 * @param {string}  [n.related_table]     – table name the event concerns
 * @param {string}  [n.related_record_id] – uuid of the related row
 * @param {string}  [n.related_type]      – legacy alias kept for backward compat
 * @param {string}  [n.related_id]        – legacy alias kept for backward compat
 * @returns {Promise<Object|null>}
 */
async function createNotification(n) {
    if (!supabaseClient) return null;

    const row = {
        type:               n.type,
        title:              n.title,
        message:            n.message,
        recipient_user_id:  n.recipient_user_id  || null,
        recipient_role:     n.recipient_role     || null,
        caregiver_id:       n.caregiver_id       || null,
        client_id:          n.client_id          || null,
        priority:           n.priority           || 'normal',
        related_table:      n.related_table      || n.related_type  || null,
        related_record_id:  n.related_record_id  || n.related_id    || null,
        read:               false,
        read_at:            null,
        created_at:         new Date().toISOString()
    };

    if (window.DEBUG) console.log('[CareHub] createNotification:', row);

    const { data, error } = await supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .insert([row])
        .select()
        .single();

    if (error) {
        console.error('[CareHub] ERROR createNotification:', error.message, error.details);
        return null;
    }

    if (window.DEBUG) console.log('[CareHub] Notification created:', data?.id);
    return data;
}

/**
 * Get unread notifications (bell badge + dropdown — max 20).
 * RLS enforces role-scoping; JS-layer double-checks for safety.
 * @returns {Promise<Array>}
 */
async function getUnreadNotifications() {
    if (!supabaseClient) return [];

    const { data, error } = await supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .select('*')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) { console.error('[CareHub] getUnreadNotifications error:', error.message); return []; }
    return _filterNotificationsForRole(data || []);
}

/**
 * Get notifications with optional filters (for the Notifications page).
 * @param {Object}  opts
 * @param {boolean} [opts.unreadOnly]
 * @param {string}  [opts.type]
 * @param {string}  [opts.priority]
 * @param {number}  [opts.limit=50]
 * @param {number}  [opts.offset=0]
 * @returns {Promise<Array>}
 */
async function getNotifications({ unreadOnly = false, type = null, priority = null, limit = 50, offset = 0 } = {}) {
    if (!supabaseClient) return [];

    let q = supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (unreadOnly) q = q.is('read_at', null);
    if (type)       q = q.eq('type', type);
    if (priority)   q = q.eq('priority', priority);

    const { data, error } = await q;
    if (error) { console.error('[CareHub] getNotifications error:', error.message); return []; }
    return _filterNotificationsForRole(data || []);
}

/**
 * Get count of unread notifications for badge.
 * @returns {Promise<number>}
 */
async function getNotificationCount() {
    if (!supabaseClient) return 0;
    const { count, error } = await supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
    if (error) { console.error('[CareHub] getNotificationCount error:', error.message); return 0; }
    return count || 0;
}

/**
 * Mark a single notification as read.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function markNotificationRead(id) {
    if (!supabaseClient) return false;
    const now = new Date().toISOString();
    const { error } = await supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .update({ read: true, read_at: now })
        .eq('id', id);
    if (error) { console.error('[CareHub] markNotificationRead error:', error.message); return false; }
    return true;
}

/**
 * Mark all unread notifications as read (for the current role's visible set).
 * @returns {Promise<boolean>}
 */
async function markAllNotificationsRead() {
    if (!supabaseClient) return false;
    const now = new Date().toISOString();
    const { error } = await supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .update({ read: true, read_at: now })
        .is('read_at', null);
    if (error) { console.error('[CareHub] markAllNotificationsRead error:', error.message); return false; }
    return true;
}

/**
 * Delete a single notification.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deleteNotification(id) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .delete()
        .eq('id', id);
    if (error) { console.error('[CareHub] deleteNotification error:', error.message); return false; }
    return true;
}

/** @private JS-layer role safety filter (RLS is the real gate) */
function _filterNotificationsForRole(rows) {
    const isFullAccess = window.RoleFilter ? window.RoleFilter._isFullAccess() : true;
    if (isFullAccess) return rows;

    const role       = window.getCurrentRole ? window.getCurrentRole() : null;
    const cgId       = window.RoleFilter ? window.RoleFilter.getCurrentCaregiverId() : null;
    const clId       = window.RoleFilter ? window.RoleFilter.getCurrentClientId()    : null;

    return rows.filter(n => {
        if (role === 'caregiver') {
            if (n.recipient_role === 'caregiver') return true;
            if (n.caregiver_id && String(n.caregiver_id) === String(cgId)) return true;
            return false;
        }
        if (role === 'client_family') {
            if (n.recipient_role === 'client_family') return true;
            if (n.client_id && String(n.client_id) === String(clId)) return true;
            return false;
        }
        return false;
    });
}

// ==================== DASHBOARD STATS ====================

/**
 * Get dashboard statistics for Command Center
 * @returns {Promise<Object>}
 */
async function getDashboardStats() {
    const emptyStats = {
        newApplications: 0, pendingCareRequests: 0,
        totalCaregivers: 0, totalClients: 0,
        onboardingCaregivers: 0, activeCaregivers: 0, activeClients: 0,
        todaysVisits: 0, pendingTimesheets: 0, pendingVisitUpdates: 0,
        unassignedVisits: 0, cancelledVisits: 0, rejectedTimesheets: 0
    };

    if (!supabaseClient) return emptyStats;

    // ── Role-scoped stats for caregiver / client_family ──────────────────
    // For restricted roles, return only counts relevant to their own data.
    // The calling code (renderDashboard) further scopes these via
    // RoleFilter.scopeDashboardStats() using the actual schedule arrays.
    const isFullAccess = window.RoleFilter ? window.RoleFilter._isFullAccess() : true;
    if (!isFullAccess && window.getCurrentRole) {
        const role = window.getCurrentRole();
        const today = formatDateForAPI(new Date());

        if (role === 'caregiver') {
            const caregiverId = window.RoleFilter ? window.RoleFilter.getCurrentCaregiverId() : null;
            if (!caregiverId) return emptyStats;
            try {
                const [
                    { count: todaysVisits },
                    { count: pendingTimesheets },
                    { count: pendingVisitUpdates },
                    { count: rejectedTimesheets }
                ] = await Promise.all([
                    supabaseClient.from(TABLES.SCHEDULES).select('*', { count: 'exact', head: true }).eq('caregiver_id', caregiverId).eq('date', today).not('status', 'eq', 'cancelled'),
                    supabaseClient.from(TABLES.TIMESHEETS).select('*', { count: 'exact', head: true }).eq('caregiver_id', caregiverId).eq('status', 'pending'),
                    supabaseClient.from(TABLES.VISIT_UPDATES).select('*', { count: 'exact', head: true }).eq('caregiver_id', caregiverId).in('status', ['pending', 'submitted']),
                    supabaseClient.from(TABLES.TIMESHEETS).select('*', { count: 'exact', head: true }).eq('caregiver_id', caregiverId).eq('status', 'rejected')
                ]);
                return { ...emptyStats, todaysVisits: todaysVisits || 0, pendingTimesheets: pendingTimesheets || 0, pendingVisitUpdates: pendingVisitUpdates || 0, rejectedTimesheets: rejectedTimesheets || 0 };
            } catch (e) {
                console.error('Error fetching caregiver dashboard stats:', e);
                return emptyStats;
            }
        }

        if (role === 'client_family') {
            const clientId = window.RoleFilter ? window.RoleFilter.getCurrentClientId() : null;
            if (!clientId) return emptyStats;
            try {
                const [
                    { count: todaysVisits },
                    { count: upcomingVisits },
                    { count: approvedUpdates }
                ] = await Promise.all([
                    supabaseClient.from(TABLES.SCHEDULES).select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('date', today).not('status', 'eq', 'cancelled'),
                    supabaseClient.from(TABLES.SCHEDULES).select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'scheduled').gte('date', today),
                    supabaseClient.from(TABLES.VISIT_UPDATES).select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'approved')
                ]);
                return { ...emptyStats, todaysVisits: todaysVisits || 0, upcomingVisits: upcomingVisits || 0, approvedUpdates: approvedUpdates || 0 };
            } catch (e) {
                console.error('Error fetching client_family dashboard stats:', e);
                return emptyStats;
            }
        }
    }

    // ── Full-access: admin_owner / co_owner ───────────────────────────────
    const today = formatDateForAPI(new Date());

    try {
        const [
            { count: newApplications },
            { count: pendingCareRequests },
            { count: totalCaregivers },
            { count: totalClients },
            { count: onboardingCaregivers },
            { count: activeCaregivers },
            { count: activeClients },
            { count: todaysVisits },
            { count: pendingTimesheets },
            { count: pendingVisitUpdates },
            { count: unassignedVisits },
            { count: cancelledVisits },
            { count: rejectedTimesheets }
        ] = await Promise.all([
            supabaseClient.from(TABLES.APPLICATIONS).select('*', { count: 'exact', head: true }).eq('status', 'new'),
            supabaseClient.from(TABLES.CARE_REQUESTS).select('*', { count: 'exact', head: true }).eq('status', 'new'),
            supabaseClient.from(TABLES.CAREGIVERS).select('*', { count: 'exact', head: true }),
            supabaseClient.from(TABLES.CLIENTS).select('*', { count: 'exact', head: true }),
            supabaseClient.from(TABLES.CAREGIVERS).select('*', { count: 'exact', head: true }).eq('status', 'onboarding'),
            supabaseClient.from(TABLES.CAREGIVERS).select('*', { count: 'exact', head: true }).eq('status', 'active'),
            supabaseClient.from(TABLES.CLIENTS).select('*', { count: 'exact', head: true }).eq('status', 'active'),
            supabaseClient.from(TABLES.SCHEDULES).select('*', { count: 'exact', head: true }).eq('date', today).not('status', 'eq', 'cancelled'),
            supabaseClient.from(TABLES.TIMESHEETS).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabaseClient.from(TABLES.VISIT_UPDATES).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabaseClient.from(TABLES.SCHEDULES).select('*', { count: 'exact', head: true }).is('caregiver_id', null).not('status', 'eq', 'cancelled'),
            supabaseClient.from(TABLES.SCHEDULES).select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
            supabaseClient.from(TABLES.TIMESHEETS).select('*', { count: 'exact', head: true }).eq('status', 'rejected')
        ]);

        return {
            newApplications: newApplications || 0,
            pendingCareRequests: pendingCareRequests || 0,
            totalCaregivers: totalCaregivers || 0,
            totalClients: totalClients || 0,
            onboardingCaregivers: onboardingCaregivers || 0,
            activeCaregivers: activeCaregivers || 0,
            activeClients: activeClients || 0,
            todaysVisits: todaysVisits || 0,
            pendingTimesheets: pendingTimesheets || 0,
            pendingVisitUpdates: pendingVisitUpdates || 0,
            unassignedVisits: unassignedVisits || 0,
            cancelledVisits: cancelledVisits || 0,
            rejectedTimesheets: rejectedTimesheets || 0
        };
    } catch (e) {
        console.error('Error fetching dashboard stats:', e);
        return emptyStats;
    }
}

/**
 * Get today's schedule with caregiver and client details
 * @returns {Promise<Array>}
 */
async function getTodaysSchedule() {
    if (!supabaseClient) return [];

    const today = formatDateForAPI(new Date());
    const roleFilters = (window.RoleFilter ? window.RoleFilter.buildQueryFilters('schedules') : {});
    if (roleFilters.caregiver_id === '__none__' || roleFilters.client_id === '__none__') return [];

    let query = supabaseClient
        .from(TABLES.SCHEDULES)
        .select(`
            *,
            caregiver:caregiver_id (id, name, email, phone),
            client:client_id (id, care_for, name, address)
        `)
        .eq('date', today)
        .not('status', 'eq', 'cancelled')
        .order('start_time', { ascending: true });

    if (roleFilters.caregiver_id) query = query.eq('caregiver_id', roleFilters.caregiver_id);
    if (roleFilters.client_id)    query = query.eq('client_id',    roleFilters.client_id);

    const { data, error } = await query;

    if (error) {
        console.error('[CareHub] ERROR fetching today\'s schedule:', error);
        return [];
    }

    return data || [];
}

/**
 * Get recent activity for dashboard feed
 * @param {number} limit - Number of activities to fetch
 * @returns {Promise<Array>}
 */
async function getRecentActivity(limit = 10) {
    if (!supabaseClient) return [];

    const isFullAccess = window.RoleFilter ? window.RoleFilter._isFullAccess() : true;
    const caregiverId  = window.RoleFilter ? window.RoleFilter.getCurrentCaregiverId() : null;
    const clientId     = window.RoleFilter ? window.RoleFilter.getCurrentClientId()    : null;

    // Build scoped Supabase queries
    let tsQuery  = supabaseClient.from(TABLES.TIMESHEETS).select('*').order('updated_at', { ascending: false }).limit(limit);
    let vuQuery  = supabaseClient.from(TABLES.VISIT_UPDATES).select('*').order('updated_at', { ascending: false }).limit(limit);
    let schQuery = supabaseClient.from(TABLES.SCHEDULES).select('*').order('updated_at', { ascending: false }).limit(limit);

    if (!isFullAccess) {
        if (caregiverId) {
            tsQuery  = tsQuery.eq('caregiver_id', caregiverId);
            vuQuery  = vuQuery.eq('caregiver_id', caregiverId);
            schQuery = schQuery.eq('caregiver_id', caregiverId);
        } else if (clientId) {
            vuQuery  = vuQuery.eq('client_id', clientId);
            schQuery = schQuery.eq('client_id', clientId);
            // Timesheets not visible to client_family
            tsQuery  = null;
        }
    }

    // Admin-facing tables only fetched for full-access roles
    const promises = [
        isFullAccess ? supabaseClient.from(TABLES.APPLICATIONS).select('*').order('updated_at', { ascending: false }).limit(limit) : Promise.resolve({ data: [] }),
        isFullAccess ? supabaseClient.from(TABLES.CARE_REQUESTS).select('*').order('updated_at', { ascending: false }).limit(limit) : Promise.resolve({ data: [] }),
        tsQuery  || Promise.resolve({ data: [] }),
        vuQuery,
        schQuery
    ];

    const [
        { data: applications },
        { data: careRequests },
        { data: timesheets },
        { data: visitUpdates },
        { data: schedules }
    ] = await Promise.all(promises);

    const activities = [];

    // Process applications
    (applications || []).forEach(app => {
        if (app.status === 'approved') {
            activities.push({
                type: 'application_approved',
                title: 'Application Approved',
                message: `${app.name || 'Someone'} was approved as a caregiver`,
                timestamp: app.updated_at,
                icon: 'ph-check-circle',
                color: 'success'
            });
        } else if (app.status === 'denied') {
            activities.push({
                type: 'application_denied',
                title: 'Application Denied',
                message: `${app.name || 'Someone'}'s application was denied`,
                timestamp: app.updated_at,
                icon: 'ph-x-circle',
                color: 'danger'
            });
        } else if (app.status === 'new') {
            activities.push({
                type: 'application_received',
                title: 'New Application',
                message: `Application received from ${app.name || 'someone'}`,
                timestamp: app.created_at,
                icon: 'ph-user-plus',
                color: 'primary'
            });
        }
    });

    // Process care requests
    (careRequests || []).forEach(req => {
        if (req.status === 'converted') {
            activities.push({
                type: 'client_converted',
                title: 'Client Converted',
                message: `${req.care_for || 'A care request'} became an active client`,
                timestamp: req.updated_at,
                icon: 'ph-confetti',
                color: 'success'
            });
        } else if (req.status === 'new') {
            activities.push({
                type: 'care_request',
                title: 'New Care Request',
                message: `Care request from ${req.requester_name || 'someone'}`,
                timestamp: req.created_at,
                icon: 'ph-handshake',
                color: 'primary'
            });
        }
    });

    // Process timesheets
    (timesheets || []).forEach(ts => {
        if (ts.status === 'approved') {
            activities.push({
                type: 'timesheet_approved',
                title: 'Timesheet Approved',
                message: `Timesheet for ${ts.date} was approved`,
                timestamp: ts.updated_at,
                icon: 'ph-currency-dollar',
                color: 'success'
            });
        } else if (ts.status === 'rejected') {
            activities.push({
                type: 'timesheet_rejected',
                title: 'Timesheet Rejected',
                message: `Timesheet for ${ts.date} was rejected`,
                timestamp: ts.updated_at,
                icon: 'ph-prohibit',
                color: 'danger'
            });
        }
    });

    // Process visit updates
    (visitUpdates || []).forEach(vu => {
        if (vu.status === 'approved') {
            activities.push({
                type: 'visit_update_approved',
                title: 'Visit Update Approved',
                message: `Visit update was approved`,
                timestamp: vu.updated_at,
                icon: 'ph-check',
                color: 'success'
            });
        } else if (vu.status === 'rejected') {
            activities.push({
                type: 'visit_update_rejected',
                title: 'Visit Update Rejected',
                message: `Visit update was rejected`,
                timestamp: vu.updated_at,
                icon: 'ph-x',
                color: 'danger'
            });
        }
    });

    // Process schedules
    (schedules || []).forEach(sch => {
        if (sch.status === 'completed') {
            activities.push({
                type: 'visit_completed',
                title: 'Visit Completed',
                message: `Visit on ${sch.date} marked complete`,
                timestamp: sch.updated_at,
                icon: 'ph-check',
                color: 'success'
            });
        } else if (sch.status === 'cancelled') {
            activities.push({
                type: 'visit_cancelled',
                title: 'Visit Cancelled',
                message: `Visit on ${sch.date} was cancelled`,
                timestamp: sch.updated_at,
                icon: 'ph-prohibit',
                color: 'danger'
            });
        }
    });

    // Sort by timestamp and take top limit
    return activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
}

/**
 * Get urgent alerts for dashboard
 * @returns {Promise<Array>}
 */
async function getDashboardAlerts() {
    if (!supabaseClient) return [];

    const isFullAccess = window.RoleFilter ? window.RoleFilter._isFullAccess() : true;
    const caregiverId  = window.RoleFilter ? window.RoleFilter.getCurrentCaregiverId() : null;
    const clientId     = window.RoleFilter ? window.RoleFilter.getCurrentClientId()    : null;

    const alerts = [];

    if (isFullAccess) {
        // ── Admin / Co-Owner: full operational alerts ──────────────────────

        const { data: unassigned } = await supabaseClient
            .from(TABLES.SCHEDULES)
            .select('id, date, start_time, client:client_id (care_for)')
            .is('caregiver_id', null)
            .not('status', 'eq', 'cancelled')
            .gte('date', formatDateForAPI(new Date()))
            .order('date', { ascending: true })
            .limit(5);

        (unassigned || []).forEach(u => {
            alerts.push({
                type: 'unassigned',
                severity: 'urgent',
                title: 'Unassigned Visit',
                message: `${u.client?.care_for || 'A visit'} on ${formatDate(u.date)} at ${formatTime(u.start_time)} needs a caregiver`,
                link: `/schedules`,
                action: 'Assign Now',
                icon: 'ph-warning-circle'
            });
        });

        const { data: onboarding } = await supabaseClient
            .from(TABLES.CAREGIVERS)
            .select('id, name')
            .eq('status', 'onboarding')
            .limit(5);

        (onboarding || []).forEach(o => {
            alerts.push({
                type: 'onboarding',
                severity: 'warning',
                title: 'Pending Onboarding',
                message: `${o.name} is waiting for onboarding completion`,
                link: `/caregivers`,
                action: 'Review',
                icon: 'ph-hand-waving'
            });
        });

        const { data: rejectedTimesheets } = await supabaseClient
            .from(TABLES.TIMESHEETS)
            .select('id, date, caregiver:caregiver_id (name)')
            .eq('status', 'rejected')
            .limit(3);

        (rejectedTimesheets || []).forEach(ts => {
            alerts.push({
                type: 'rejected_timesheet',
                severity: 'warning',
                title: 'Rejected Timesheet',
                message: `Timesheet for ${ts.caregiver?.name || 'caregiver'} on ${formatDate(ts.date)} was rejected`,
                link: `/timesheets`,
                action: 'Review',
                icon: 'ph-clipboard-text'
            });
        });

        const { count: pendingTsCount } = await supabaseClient
            .from(TABLES.TIMESHEETS)
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (pendingTsCount > 0) {
            alerts.push({
                type: 'pending_timesheets',
                severity: 'info',
                title: 'Pending Timesheets',
                message: `${pendingTsCount} timesheet${pendingTsCount > 1 ? 's' : ''} awaiting approval`,
                link: `/timesheets`,
                action: 'Review',
                icon: 'ph-hourglass'
            });
        }

        const { count: pendingVuCount } = await supabaseClient
            .from(TABLES.VISIT_UPDATES)
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (pendingVuCount > 0) {
            alerts.push({
                type: 'pending_updates',
                severity: 'info',
                title: 'Pending Visit Updates',
                message: `${pendingVuCount} visit update${pendingVuCount > 1 ? 's' : ''} awaiting approval`,
                link: `/visit-updates`,
                action: 'Review',
                icon: 'ph-megaphone'
            });
        }

    } else if (caregiverId) {
        // ── Caregiver: show own rejected timesheets ─────────────────────────

        const { data: myRejected } = await supabaseClient
            .from(TABLES.TIMESHEETS)
            .select('id, date')
            .eq('caregiver_id', caregiverId)
            .eq('status', 'rejected')
            .limit(5);

        (myRejected || []).forEach(ts => {
            alerts.push({
                type: 'rejected_timesheet',
                severity: 'warning',
                title: 'Timesheet Rejected',
                message: `Your timesheet for ${formatDate(ts.date)} was rejected and needs resubmission`,
                link: `/timesheets`,
                action: 'Review',
                icon: 'ph-clipboard-text',
                caregiver_id: caregiverId
            });
        });

        // Show upcoming visits today for this caregiver
        const today = formatDateForAPI(new Date());
        const { data: todayVisits } = await supabaseClient
            .from(TABLES.SCHEDULES)
            .select('id, date, start_time, client:client_id (care_for)')
            .eq('caregiver_id', caregiverId)
            .eq('date', today)
            .eq('status', 'scheduled')
            .order('start_time', { ascending: true })
            .limit(3);

        (todayVisits || []).forEach(v => {
            alerts.push({
                type: 'upcoming_visit',
                severity: 'info',
                title: 'Visit Today',
                message: `Visit with ${v.client?.care_for || 'client'} at ${formatTime(v.start_time)}`,
                link: `/schedules`,
                action: 'View',
                icon: 'ph-calendar-check',
                caregiver_id: caregiverId
            });
        });

    } else if (clientId) {
        // ── Client/Family: show upcoming visits for loved one ───────────────

        const today = formatDateForAPI(new Date());
        const { data: upcoming } = await supabaseClient
            .from(TABLES.SCHEDULES)
            .select('id, date, start_time, caregiver:caregiver_id (name)')
            .eq('client_id', clientId)
            .eq('status', 'scheduled')
            .gte('date', today)
            .order('date', { ascending: true })
            .limit(5);

        (upcoming || []).forEach(v => {
            alerts.push({
                type: 'upcoming_visit',
                severity: 'info',
                title: 'Upcoming Visit',
                message: `Visit on ${formatDate(v.date)} at ${formatTime(v.start_time)} with ${v.caregiver?.name || 'your caregiver'}`,
                link: `/schedules`,
                action: 'View',
                icon: 'ph-calendar-check',
                client_id: clientId
            });
        });
    }

    return alerts;
}

// ==================== SCHEDULES ====================

/**
 * Get all schedules with optional filters
 * @param {Object} filters - Optional filters (date_from, date_to, status, caregiver_id, client_id)
 * @returns {Promise<Array>}
 */
async function getSchedules(filters = {}) {
    if (!supabaseClient) return [];

    // Merge role-based query filters so Supabase restricts at DB level
    const roleFilters = (window.RoleFilter ? window.RoleFilter.buildQueryFilters('schedules') : {});
    const merged = { ...roleFilters, ...filters };

    // If filter resolves to __none__ (e.g. unlinked caregiver), return empty
    if (merged.caregiver_id === '__none__' || merged.client_id === '__none__') return [];

    let query = supabaseClient
        .from(TABLES.SCHEDULES)
        .select(`
            *,
            caregiver:caregivers!caregiver_id(name),
            client:clients!client_id(name, care_for)
        `)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

    if (merged.date_from) {
        query = query.gte('date', merged.date_from);
    }
    if (merged.date_to) {
        query = query.lte('date', merged.date_to);
    }
    if (merged.status) {
        query = query.eq('status', merged.status);
    }
    if (merged.caregiver_id) {
        query = query.eq('caregiver_id', merged.caregiver_id);
    }
    if (merged.client_id) {
        query = query.eq('client_id', merged.client_id);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[CareHub] Error fetching schedules:', error);
        return [];
    }

    return data || [];
}

/**
 * Get schedules for a specific month (for calendar view)
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {Promise<Array>}
 */
async function getSchedulesForMonth(year, month) {
    if (!supabaseClient) return [];

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

    const roleFilters = (window.RoleFilter ? window.RoleFilter.buildCalendarQueryFilters() : {});
    if (roleFilters.caregiver_id === '__none__' || roleFilters.client_id === '__none__') return [];

    let query = supabaseClient
        .from(TABLES.SCHEDULES)
        .select('date, status, caregiver_id, client_id')
        .gte('date', startDate)
        .lte('date', endDate)
        .not('status', 'eq', 'cancelled');

    if (roleFilters.caregiver_id) query = query.eq('caregiver_id', roleFilters.caregiver_id);
    if (roleFilters.client_id)    query = query.eq('client_id',    roleFilters.client_id);

    const { data, error } = await query;

    if (error) {
        console.error('[CareHub] Error fetching month schedules:', error);
        return [];
    }

    return data || [];
}

/**
 * Get schedule by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function getScheduleById(id) {
    if (!supabaseClient) return null;

    const { data, error } = await supabaseClient
        .from(TABLES.SCHEDULES)
        .select(`
            *,
            caregiver:caregivers!caregiver_id(name),
            client:clients!client_id(name, care_for)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('[CareHub] Error fetching schedule:', error);
        return null;
    }

    return data;
}

/**
 * Create a new schedule
 * @param {Object} scheduleData
 * @returns {Promise<Object|null>}
 */
async function createSchedule(scheduleData) {
    if (!supabaseClient) return null;

    const schedule = {
        caregiver_id: scheduleData.caregiver_id,
        client_id: scheduleData.client_id,
        date: scheduleData.date,
        start_time: scheduleData.start_time,
        end_time: scheduleData.end_time,
        status: scheduleData.status || 'scheduled',
        service_type: scheduleData.service_type || '',
        location: scheduleData.location || '',
        notes: scheduleData.notes || '',
        created_by: scheduleData.created_by || 'admin'
    };

    if (window.DEBUG) console.log('[CareHub] Creating schedule:', schedule);

    const { data, error } = await supabaseClient
        .from(TABLES.SCHEDULES)
        .insert([schedule])
        .select()
        .single();

    if (error) {
        console.error('[CareHub] ERROR creating schedule:', error);
        console.error('[CareHub] Error code:', error.code);
        console.error('[CareHub] Error message:', error.message);
        return null;
    }

    if (window.DEBUG) console.log('[CareHub] Schedule created successfully:', data);
    return data;
}

/**
 * Update schedule
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<boolean>}
 */
async function updateSchedule(id, updates) {
    if (!supabaseClient) return false;

    if (window.DEBUG) console.log('[CareHub] updateSchedule called with id:', id);

    // Whitelist only columns that exist in schedules table
    const allowedColumns = [
        'caregiver_id',
        'client_id',
        'date',
        'start_time',
        'end_time',
        'status',
        'service_type',
        'location',
        'notes',
        'is_recurring',
        'recurrence_rule',
        'recurrence_end_date',
        'recurrence_parent_id'
    ];

    // Filter updates to only include allowed columns
    const filteredUpdates = {};
    for (const key of allowedColumns) {
        if (updates.hasOwnProperty(key)) {
            filteredUpdates[key] = updates[key];
        }
    }

    if (window.DEBUG) console.log('[CareHub] Filtered updates object:', filteredUpdates);

    const { error } = await supabaseClient
        .from(TABLES.SCHEDULES)
        .update(filteredUpdates)
        .eq('id', id);

    if (error) {
        console.error('[CareHub] ERROR updating schedule:', error);
        console.error('[CareHub] Error code:', error.code);
        console.error('[CareHub] Error message:', error.message);
        console.error('[CareHub] Error details:', error.details);
        return false;
    }

    if (window.DEBUG) console.log('[CareHub] Schedule updated successfully');
    return true;
}

/**
 * Cancel a schedule
 * @param {string} id
 * @param {string} reason - Optional cancellation reason
 * @returns {Promise<boolean>}
 */
async function cancelSchedule(id, reason = '') {
    if (!supabaseClient) return false;

    if (window.DEBUG) console.log('[CareHub] Cancelling schedule:', id);

    const updates = {
        status: 'cancelled'
    };

    if (reason) {
        updates.notes = reason;
    }

    const { error } = await supabaseClient
        .from(TABLES.SCHEDULES)
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error('[CareHub] ERROR cancelling schedule:', error);
        return false;
    }

    if (window.DEBUG) console.log('[CareHub] Schedule cancelled successfully');
    return true;
}

// ==================== TIMESHEETS ====================

/**
 * Get timesheets with optional filters
 * @param {Object} filters - Optional filters
 * @param {string} filters.caregiver_id - Filter by caregiver
 * @param {string} filters.client_id - Filter by client
 * @param {string} filters.schedule_id - Filter by schedule
 * @param {string} filters.status - Filter by status
 * @param {string} filters.date_from - Start date (YYYY-MM-DD)
 * @param {string} filters.date_to - End date (YYYY-MM-DD)
 * @returns {Promise<Array>}
 */
async function getTimesheets(filters = {}) {
    if (!supabaseClient) return [];

    // Merge role-scoped filters (caregiver sees own; client_family blocked)
    const roleFilters = (window.RoleFilter ? window.RoleFilter.buildQueryFilters('timesheets') : {});
    const merged = { ...roleFilters, ...filters };
    if (merged.caregiver_id === '__none__' || merged.client_id === '__none__') return [];

    let query = supabaseClient
        .from(TABLES.TIMESHEETS)
        .select(`
            *,
            caregiver:caregiver_id (id, name),
            client:client_id (id, care_for, name),
            schedule:schedule_id (id, date, start_time, end_time)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    if (merged.caregiver_id) query = query.eq('caregiver_id', merged.caregiver_id);
    if (merged.client_id)    query = query.eq('client_id',    merged.client_id);
    if (merged.schedule_id)  query = query.eq('schedule_id',  merged.schedule_id);
    if (merged.status)       query = query.eq('status',       merged.status);
    if (merged.date_from)    query = query.gte('date',        merged.date_from);
    if (merged.date_to)      query = query.lte('date',        merged.date_to);

    const { data, error } = await query;

    if (error) {
        console.error('[CareHub] ERROR fetching timesheets:', error);
        return [];
    }

    return data || [];
}

/**
 * Get a single timesheet by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function getTimesheetById(id) {
    if (!supabaseClient) return null;

    if (window.DEBUG) console.log('[CareHub] Fetching timesheet:', id);

    const { data, error } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .select(`
            *,
            caregiver:caregiver_id (id, name),
            client:client_id (id, care_for, name),
            schedule:schedule_id (id, date, start_time, end_time, service_type, location)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('[CareHub] ERROR fetching timesheet:', error);
        return null;
    }

    return data;
}

/**
 * Create a new timesheet
 * @param {Object} timesheetData
 * @returns {Promise<Object|null>}
 */
async function createTimesheet(timesheetData) {
    if (!supabaseClient) return null;

    if (window.DEBUG) console.log('[CareHub] Creating timesheet:', timesheetData);

    const { data, error } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .insert([timesheetData])
        .select()
        .single();

    if (error) {
        console.error('[CareHub] ERROR creating timesheet:', error);
        return null;
    }

    if (window.DEBUG) console.log('[CareHub] Timesheet created:', data.id);
    return data;
}

/**
 * Update a timesheet
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<boolean>}
 */
async function updateTimesheet(id, updates) {
    if (!supabaseClient) return false;

    if (window.DEBUG) console.log('[CareHub] Updating timesheet:', id, updates);

    const { error } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        console.error('[CareHub] ERROR updating timesheet:', error);
        return false;
    }

    if (window.DEBUG) console.log('[CareHub] Timesheet updated successfully');
    return true;
}

/**
 * Approve a timesheet
 * @param {string} id
 * @param {string} reviewedBy - Admin user identifier
 * @returns {Promise<boolean>}
 */
async function approveTimesheet(id, reviewedBy) {
    return await updateTimesheet(id, {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy
    });
}

/**
 * Reject a timesheet
 * @param {string} id
 * @param {string} reason - Rejection reason
 * @param {string} reviewedBy - Admin user identifier
 * @returns {Promise<boolean>}
 */
async function rejectTimesheet(id, reason, reviewedBy) {
    return await updateTimesheet(id, {
        status: 'rejected',
        notes: reason,
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy
    });
}

// ==================== PAYROLL EXPORTS ====================

/**
 * Get payroll export history
 * @returns {Promise<Array>}
 */
async function getPayrollExports() {
    if (!supabaseClient) return [];

    if (window.DEBUG) console.log('[CareHub] Fetching payroll exports');

    const { data, error } = await supabaseClient
        .from(TABLES.PAYROLL_EXPORTS)
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[CareHub] ERROR fetching payroll exports:', error);
        return [];
    }

    return data || [];
}

/**
 * Get approved timesheets for payroll calculation
 * @param {string} dateFrom - Start date (YYYY-MM-DD)
 * @param {string} dateTo - End date (YYYY-MM-DD)
 * @returns {Promise<Array>}
 */
async function getApprovedTimesheetsForPayroll(dateFrom, dateTo) {
    if (!supabaseClient) return [];

    if (window.DEBUG) console.log('[CareHub] Fetching approved timesheets for payroll:', dateFrom, 'to', dateTo);

    const { data, error } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .select(`
            *,
            caregiver:caregiver_id (id, name, email, pay_rate)
        `)
        .eq('status', 'approved')
        .gte('date', dateFrom)
        .lte('date', dateTo);

    if (error) {
        console.error('[CareHub] ERROR fetching approved timesheets:', error);
        return [];
    }

    return data || [];
}

/**
 * Create a payroll export record
 * @param {Object} exportData
 * @returns {Promise<Object|null>}
 */
async function createPayrollExport(exportData) {
    if (!supabaseClient) return null;

    if (window.DEBUG) console.log('[CareHub] Creating payroll export:', exportData);

    const { data, error } = await supabaseClient
        .from(TABLES.PAYROLL_EXPORTS)
        .insert([exportData])
        .select()
        .single();

    if (error) {
        console.error('[CareHub] ERROR creating payroll export:', error);
        return null;
    }

    if (window.DEBUG) console.log('[CareHub] Payroll export created:', data.id);
    return data;
}

// ==================== VISIT UPDATES ====================

/**
 * Get visit updates with optional filters
 * @param {Object} filters - Optional filters
 * @param {string} filters.caregiver_id - Filter by caregiver
 * @param {string} filters.client_id - Filter by client
 * @param {string} filters.schedule_id - Filter by schedule
 * @param {string} filters.status - Filter by status
 * @param {string} filters.visit_date_from - Start visit date
 * @param {string} filters.visit_date_to - End visit date
 * @returns {Promise<Array>}
 */
async function getVisitUpdates(filters = {}) {
    if (!supabaseClient) return [];

    // Merge role-scoped filters
    const roleFilters = (window.RoleFilter ? window.RoleFilter.buildQueryFilters('visit_updates') : {});
    const merged = { ...roleFilters, ...filters };
    if (merged.caregiver_id === '__none__' || merged.client_id === '__none__') return [];

    let query = supabaseClient
        .from(TABLES.VISIT_UPDATES)
        .select(`
            *,
            caregiver:caregiver_id (id, name),
            client:client_id (id, care_for, name),
            schedule:schedule_id (id, date, start_time, end_time)
        `)
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (merged.caregiver_id)    query = query.eq('caregiver_id',  merged.caregiver_id);
    if (merged.client_id)       query = query.eq('client_id',     merged.client_id);
    if (merged.schedule_id)     query = query.eq('schedule_id',   merged.schedule_id);
    if (merged.status)          query = query.eq('status',        merged.status);
    if (merged.visit_date_from) query = query.gte('visit_date',   merged.visit_date_from);
    if (merged.visit_date_to)   query = query.lte('visit_date',   merged.visit_date_to);

    // client_family: hide internal-only and rejected updates
    if (window.RoleFilter && typeof window.RoleFilter._isFullAccess === 'function') {
        if (!window.RoleFilter._isFullAccess() && window.getCurrentRole && window.getCurrentRole() === 'client_family') {
            query = query.not('status', 'in', '("internal_only","rejected","draft")');
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error('[CareHub] ERROR fetching visit updates:', error);
        return [];
    }

    // JS-level safety net – apply canViewVisitUpdate to catch any edge cases
    const filtered = (window.RoleFilter && !window.RoleFilter._isFullAccess())
        ? (data || []).filter(u => window.RoleFilter.canViewVisitUpdate(u))
        : (data || []);
    return filtered;
}

/**
 * Get a single visit update by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function getVisitUpdateById(id) {
    if (!supabaseClient) return null;

    if (window.DEBUG) console.log('[CareHub] Fetching visit update:', id);

    const { data, error } = await supabaseClient
        .from(TABLES.VISIT_UPDATES)
        .select(`
            *,
            caregiver:caregiver_id (id, name),
            client:client_id (id, care_for, name),
            schedule:schedule_id (id, date, start_time, end_time, service_type, location)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('[CareHub] ERROR fetching visit update:', error);
        return null;
    }

    return data;
}

/**
 * Create a new visit update
 * @param {Object} updateData
 * @returns {Promise<Object|null>}
 */
async function createVisitUpdate(updateData) {
    if (!supabaseClient) return null;

    if (window.DEBUG) console.log('[CareHub] Creating visit update:', updateData);

    const { data, error } = await supabaseClient
        .from(TABLES.VISIT_UPDATES)
        .insert([updateData])
        .select()
        .single();

    if (error) {
        console.error('[CareHub] ERROR creating visit update:', error);
        return null;
    }

    if (window.DEBUG) console.log('[CareHub] Visit update created:', data.id);
    return data;
}

/**
 * Update a visit update
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<boolean>}
 */
async function updateVisitUpdate(id, updates) {
    if (!supabaseClient) return false;

    if (window.DEBUG) console.log('[CareHub] Updating visit update:', id, updates);

    const { error } = await supabaseClient
        .from(TABLES.VISIT_UPDATES)
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        console.error('[CareHub] ERROR updating visit update:', error);
        return false;
    }

    if (window.DEBUG) console.log('[CareHub] Visit update updated successfully');
    return true;
}

/**
 * Approve a visit update
 * @param {string} id
 * @param {string} reviewedBy - Admin user identifier
 * @returns {Promise<boolean>}
 */
async function approveVisitUpdate(id, reviewedBy) {
    return await updateVisitUpdate(id, {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy
    });
}

/**
 * Reject a visit update
 * @param {string} id
 * @param {string} reason - Rejection reason
 * @param {string} reviewedBy - Admin user identifier
 * @returns {Promise<boolean>}
 */
async function rejectVisitUpdate(id, reason, reviewedBy) {
    return await updateVisitUpdate(id, {
        status: 'rejected',
        admin_notes: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy
    });
}

/**
 * Mark visit update as internal only
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function markVisitUpdateInternal(id) {
    return await updateVisitUpdate(id, {
        status: 'internal_only'
    });
}

// ==================== CLIENT SCHEDULE PREFERENCES ====================

/**
 * Get schedule preferences for a client.
 * @param {string} clientId
 * @returns {Promise<Object|null>}
 */
async function getClientSchedulePreferences(clientId) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from(TABLES.CLIENT_SCHEDULE_PREFERENCES)
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
    if (error) { console.error('[CareHub] Error fetching client schedule preferences:', error.message); return null; }
    return data;
}

/**
 * Save (upsert) schedule preferences for a client.
 * @param {string} clientId
 * @param {Object} prefs
 * @returns {Promise<Object|null>}
 */
async function saveClientSchedulePreferences(clientId, prefs) {
    if (!supabaseClient) return null;
    const row = {
        client_id:          clientId,
        preferred_days:     prefs.preferred_days     || [],
        preferred_start:    prefs.preferred_start    || null,
        preferred_end:      prefs.preferred_end      || null,
        visit_length_hours: prefs.visit_length_hours || null,
        frequency:          prefs.frequency          || null,
        service_type:       prefs.service_type       || null,
        start_date:         prefs.start_date         || null,
        is_recurring:       prefs.is_recurring !== false,
        notes:              prefs.notes              || null,
        updated_at:         new Date().toISOString()
    };
    if (window.DEBUG) console.log('[CareHub] saveClientSchedulePreferences:', row);
    const { data, error } = await supabaseClient
        .from(TABLES.CLIENT_SCHEDULE_PREFERENCES)
        .upsert(row, { onConflict: 'client_id' })
        .select()
        .single();
    if (error) { console.error('[CareHub] Error saving client schedule preferences:', error.message); return null; }
    return data;
}

// ==================== CAREGIVER AVAILABILITY ====================

/**
 * Get availability slots for a caregiver.
 * @param {string} caregiverId
 * @returns {Promise<Array>}
 */
async function getCaregiverAvailability(caregiverId) {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVER_AVAILABILITY)
        .select('*')
        .eq('caregiver_id', caregiverId)
        .order('day_of_week');
    if (error) { console.error('[CareHub] Error fetching caregiver availability:', error.message); return []; }
    return data || [];
}

/**
 * Get availability for multiple caregivers at once.
 * @param {string[]} caregiverIds
 * @returns {Promise<Array>}
 */
async function getCaregiverAvailabilityBulk(caregiverIds) {
    if (!supabaseClient || !caregiverIds.length) return [];
    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVER_AVAILABILITY)
        .select('*')
        .in('caregiver_id', caregiverIds);
    if (error) { console.error('[CareHub] Error fetching bulk caregiver availability:', error.message); return []; }
    return data || [];
}

/**
 * Save availability slots for a caregiver.
 * Replaces ALL existing slots for that caregiver.
 * @param {string} caregiverId
 * @param {Array<{day_of_week, start_time, end_time, max_hours_week, service_area, notes}>} slots
 * @returns {Promise<boolean>}
 */
async function saveCaregiverAvailability(caregiverId, slots) {
    if (!supabaseClient) return false;
    if (window.DEBUG) console.log('[CareHub] saveCaregiverAvailability:', caregiverId, slots);

    const { error: delError } = await supabaseClient
        .from(TABLES.CAREGIVER_AVAILABILITY)
        .delete()
        .eq('caregiver_id', caregiverId);
    if (delError) { console.error('[CareHub] Error clearing caregiver availability:', delError.message); return false; }

    if (!slots || slots.length === 0) return true;

    const rows = slots.map(s => ({
        caregiver_id:  caregiverId,
        day_of_week:   s.day_of_week,
        start_time:    s.start_time,
        end_time:      s.end_time,
        max_hours_week: s.max_hours_week || null,
        service_area:  s.service_area || null,
        notes:         s.notes || null,
        updated_at:    new Date().toISOString()
    }));

    const { error } = await supabaseClient
        .from(TABLES.CAREGIVER_AVAILABILITY)
        .insert(rows);
    if (error) { console.error('[CareHub] Error inserting caregiver availability:', error.message); return false; }
    return true;
}

// ==================== CAREGIVER UNAVAILABLE DATES ====================

/**
 * Get blocked dates for a caregiver.
 * @param {string} caregiverId
 * @returns {Promise<Array>}
 */
async function getCaregiverUnavailableDates(caregiverId) {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVER_UNAVAILABLE_DATES)
        .select('*')
        .eq('caregiver_id', caregiverId)
        .order('date');
    if (error) { console.error('[CareHub] Error fetching unavailable dates:', error.message); return []; }
    return data || [];
}

/**
 * Add a blocked date for a caregiver.
 * @param {string} caregiverId
 * @param {string} date  – ISO date string YYYY-MM-DD
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
async function addCaregiverUnavailableDate(caregiverId, date, reason = '') {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient
        .from(TABLES.CAREGIVER_UNAVAILABLE_DATES)
        .upsert({ caregiver_id: caregiverId, date, reason }, { onConflict: 'caregiver_id,date' });
    if (error) { console.error('[CareHub] Error adding unavailable date:', error.message); return false; }
    return true;
}

/**
 * Remove a blocked date for a caregiver.
 * @param {string} caregiverId
 * @param {string} date  – ISO date string YYYY-MM-DD
 * @returns {Promise<boolean>}
 */
async function removeCaregiverUnavailableDate(caregiverId, date) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient
        .from(TABLES.CAREGIVER_UNAVAILABLE_DATES)
        .delete()
        .eq('caregiver_id', caregiverId)
        .eq('date', date);
    if (error) { console.error('[CareHub] Error removing unavailable date:', error.message); return false; }
    return true;
}

// ==================== TIME-OFF REQUESTS ====================

/**
 * Get time-off requests with optional filtering
 * @param {Object} filters
 * @param {string} [filters.caregiverId]
 * @param {string} [filters.status] - 'pending', 'approved', 'denied', 'cancelled'
 * @param {string} [filters.requestType] - 'time_off', 'unavailable', 'schedule_change', 'availability_update'
 * @param {boolean} [filters.pendingOnly]
 * @param {number} [filters.limit=50]
 * @returns {Promise<Array>}
 */
async function getTimeOffRequests({ caregiverId = null, status = null, requestType = null, pendingOnly = false, limit = 50 } = {}) {
    if (!supabaseClient) return [];
    let q = supabaseClient
        .from(TABLES.CAREGIVER_TIME_OFF_REQUESTS)
        .select('*, caregivers(id, name, email)')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (caregiverId) q = q.eq('caregiver_id', caregiverId);
    if (status) q = q.eq('status', status);
    if (requestType) q = q.eq('request_type', requestType);
    if (pendingOnly) q = q.eq('status', 'pending');

    const { data, error } = await q;
    if (error) { console.error('[CareHub] getTimeOffRequests error:', error.message); return []; }
    return data || [];
}

/**
 * Get count of pending time-off requests (for dashboard alerts)
 * @returns {Promise<number>}
 */
async function getPendingTimeOffCount() {
    if (!supabaseClient) return 0;
    const { count, error } = await supabaseClient
        .from(TABLES.CAREGIVER_TIME_OFF_REQUESTS)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
    if (error) { console.error('[CareHub] getPendingTimeOffCount error:', error.message); return 0; }
    return count || 0;
}

/**
 * Create a new time-off request
 * @param {Object} request
 * @param {string} request.caregiverId
 * @param {string} request.requestedBy - User ID creating the request
 * @param {string} request.startDate - YYYY-MM-DD
 * @param {string} request.endDate - YYYY-MM-DD
 * @param {string} [request.startTime] - HH:MM
 * @param {string} [request.endTime] - HH:MM
 * @param {string} request.requestType
 * @param {string} [request.reason]
 * @param {boolean} [sendNotification=true]
 * @returns {Promise<Object|null>}
 */
async function createTimeOffRequest({ caregiverId, requestedBy, startDate, endDate, startTime = null, endTime = null, requestType, reason = null }, { sendNotification = true } = {}) {
    if (!supabaseClient) return null;

    const row = {
        caregiver_id: caregiverId,
        requested_by: requestedBy,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        request_type: requestType,
        reason: reason,
        status: 'pending',
        created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVER_TIME_OFF_REQUESTS)
        .insert([row])
        .select()
        .single();

    if (error) { console.error('[CareHub] createTimeOffRequest error:', error.message); return null; }

    // Send notification to admins
    if (sendNotification && data) {
        const caregiver = await getCaregiverById(caregiverId);
        const typeLabel = { time_off: 'Time Off', unavailable: 'Unavailability', schedule_change: 'Schedule Change', availability_update: 'Availability Update' }[requestType] || requestType;

        await createNotification({
            type: 'time_off_request_submitted',
            title: `${typeLabel} Request`,
            message: `${caregiver?.name || 'A caregiver'} requested ${typeLabel.toLowerCase()}: ${startDate}${endDate !== startDate ? ` to ${endDate}` : ''}${reason ? `. Reason: ${reason}` : ''}`,
            recipient_role: 'admin_owner',
            priority: 'normal',
            related_table: TABLES.CAREGIVER_TIME_OFF_REQUESTS,
            related_record_id: data.id,
            caregiver_id: caregiverId
        });
    }

    return data;
}

/**
 * Review (approve/deny) a time-off request
 * @param {string} requestId
 * @param {string} status - 'approved' or 'denied'
 * @param {string} reviewedBy - Admin user ID
 * @param {string} [adminNotes]
 * @param {boolean} [addToUnavailable=true] - If approved, add to unavailable_dates
 * @returns {Promise<boolean>}
 */
async function reviewTimeOffRequest(requestId, status, reviewedBy, { adminNotes = null, addToUnavailable = true } = {}) {
    if (!supabaseClient) return false;
    if (!['approved', 'denied'].includes(status)) return false;

    const now = new Date().toISOString();

    // Get the request first
    const { data: request } = await supabaseClient
        .from(TABLES.CAREGIVER_TIME_OFF_REQUESTS)
        .select('*')
        .eq('id', requestId)
        .single();

    if (!request) return false;

    // Update the request
    const { error } = await supabaseClient
        .from(TABLES.CAREGIVER_TIME_OFF_REQUESTS)
        .update({
            status,
            admin_notes: adminNotes,
            reviewed_by: reviewedBy,
            reviewed_at: now,
            updated_at: now
        })
        .eq('id', requestId);

    if (error) { console.error('[CareHub] reviewTimeOffRequest error:', error.message); return false; }

    // If approved and it's time_off or unavailable, add to unavailable_dates
    if (status === 'approved' && addToUnavailable && ['time_off', 'unavailable'].includes(request.request_type)) {
        // Add each date in the range
        const start = new Date(request.start_date);
        const end = new Date(request.end_date);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            await addCaregiverUnavailableDate(request.caregiver_id, dateStr, request.reason);
        }
    }

    // Send notification to caregiver
    const caregiver = await getCaregiverById(request.caregiver_id);
    const typeLabel = { time_off: 'Time Off', unavailable: 'Unavailability', schedule_change: 'Schedule Change', availability_update: 'Availability Update' }[request.request_type] || request.request_type;

    await createNotification({
        type: status === 'approved' ? 'time_off_request_approved' : 'time_off_request_denied',
        title: `${typeLabel} Request ${status === 'approved' ? 'Approved' : 'Denied'}`,
        message: `Your ${typeLabel.toLowerCase()} request for ${request.start_date}${request.end_date !== request.start_date ? ` to ${request.end_date}` : ''} has been ${status}.${adminNotes ? ` Note: ${adminNotes}` : ''}`,
        caregiver_id: request.caregiver_id,
        priority: 'normal',
        related_table: TABLES.CAREGIVER_TIME_OFF_REQUESTS,
        related_record_id: requestId
    });

    return true;
}

/**
 * Cancel a pending time-off request (by caregiver)
 * @param {string} requestId
 * @param {string} caregiverId - For verification
 * @returns {Promise<boolean>}
 */
async function cancelTimeOffRequest(requestId, caregiverId) {
    if (!supabaseClient) return false;

    const { error } = await supabaseClient
        .from(TABLES.CAREGIVER_TIME_OFF_REQUESTS)
        .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('caregiver_id', caregiverId)
        .eq('status', 'pending'); // Only cancel if still pending

    if (error) { console.error('[CareHub] cancelTimeOffRequest error:', error.message); return false; }
    return true;
}

/**
 * Check if caregiver has any approved time-off for a date range
 * @param {string} caregiverId
 * @param {string} date - YYYY-MM-DD
 * @param {string} [startTime] - HH:MM
 * @param {string} [endTime] - HH:MM
 * @returns {Promise<Object|null>} - Returns time-off request if found
 */
async function checkCaregiverTimeOff(caregiverId, date, startTime = null, endTime = null) {
    if (!supabaseClient) return null;

    let q = supabaseClient
        .from(TABLES.CAREGIVER_TIME_OFF_REQUESTS)
        .select('*')
        .eq('caregiver_id', caregiverId)
        .eq('status', 'approved')
        .lte('start_date', date)
        .gte('end_date', date);

    const { data, error } = await q;
    if (error) { console.error('[CareHub] checkCaregiverTimeOff error:', error.message); return null; }

    if (!data || data.length === 0) return null;

    // If time provided, check for overlap
    if (startTime && endTime) {
        const overlapping = data.find(r => {
            if (!r.start_time || !r.end_time) return true; // Full day off
            return _timesOverlap(startTime, endTime, r.start_time, r.end_time);
        });
        return overlapping || null;
    }

    return data[0];
}

// ==================== CONFLICT CHECKING ====================

/**
 * Check for scheduling conflicts for a proposed visit.
 * Returns an array of conflict objects (empty = no conflicts).
 *
 * Checks:
 *   1. Caregiver already booked at that time
 *   2. Client already has a visit at that time
 *   3. Caregiver is on an unavailable date
 *   4. Visit falls outside caregiver's availability window for that day
 *
 * @param {Object} proposed
 * @param {string}  proposed.date          – YYYY-MM-DD
 * @param {string}  proposed.start_time    – HH:MM
 * @param {string}  proposed.end_time      – HH:MM
 * @param {string}  proposed.caregiver_id
 * @param {string}  proposed.client_id
 * @param {string}  [proposed.exclude_id]  – schedule id to ignore (for edits)
 * @returns {Promise<Array<{type, message}>>}
 */
async function checkScheduleConflicts(proposed) {
    if (!supabaseClient) return [];
    const conflicts = [];
    const { date, start_time, end_time, caregiver_id, client_id, exclude_id } = proposed;

    // ── 1. Caregiver double-booking ──────────────────────────────────────────
    if (caregiver_id) {
        let q = supabaseClient
            .from(TABLES.SCHEDULES)
            .select('id, start_time, end_time')
            .eq('caregiver_id', caregiver_id)
            .eq('date', date)
            .not('status', 'eq', 'cancelled');
        if (exclude_id) q = q.neq('id', exclude_id);
        const { data: cgVisits } = await q;
        if (cgVisits) {
            for (const v of cgVisits) {
                if (_timesOverlap(start_time, end_time, v.start_time, v.end_time)) {
                    conflicts.push({
                        type: 'caregiver_booked',
                        message: `Caregiver is already booked ${v.start_time}–${v.end_time} on this date.`
                    });
                    break;
                }
            }
        }
    }

    // ── 2. Client double-booking ─────────────────────────────────────────────
    if (client_id) {
        let q = supabaseClient
            .from(TABLES.SCHEDULES)
            .select('id, start_time, end_time')
            .eq('client_id', client_id)
            .eq('date', date)
            .not('status', 'eq', 'cancelled');
        if (exclude_id) q = q.neq('id', exclude_id);
        const { data: clVisits } = await q;
        if (clVisits) {
            for (const v of clVisits) {
                if (_timesOverlap(start_time, end_time, v.start_time, v.end_time)) {
                    conflicts.push({
                        type: 'client_booked',
                        message: `Client already has a visit ${v.start_time}–${v.end_time} on this date.`
                    });
                    break;
                }
            }
        }
    }

    // ── 3. Caregiver unavailable date ────────────────────────────────────────
    if (caregiver_id) {
        const { data: blocked } = await supabaseClient
            .from(TABLES.CAREGIVER_UNAVAILABLE_DATES)
            .select('reason')
            .eq('caregiver_id', caregiver_id)
            .eq('date', date)
            .maybeSingle();
        if (blocked) {
            conflicts.push({
                type: 'unavailable_date',
                message: `Caregiver marked unavailable on this date${blocked.reason ? ': ' + blocked.reason : ''}.`
            });
        }
    }

    // ── 3b. Caregiver approved time-off ───────────────────────────────────────
    if (caregiver_id) {
        const timeOff = await checkCaregiverTimeOff(caregiver_id, date, start_time, end_time);
        if (timeOff) {
            conflicts.push({
                type: 'time_off',
                message: `Caregiver has approved ${timeOff.request_type === 'time_off' ? 'time off' : 'unavailability'}${timeOff.reason ? ': ' + timeOff.reason : ''}.`
            });
        }
    }

    // ── 4. Outside availability window ──────────────────────────────────────
    if (caregiver_id) {
        const dow = _dateToDayOfWeek(date);
        const { data: slots } = await supabaseClient
            .from(TABLES.CAREGIVER_AVAILABILITY)
            .select('start_time, end_time')
            .eq('caregiver_id', caregiver_id)
            .eq('day_of_week', dow);
        if (slots && slots.length > 0) {
            const covered = slots.some(s =>
                start_time >= s.start_time && end_time <= s.end_time
            );
            if (!covered) {
                conflicts.push({
                    type: 'outside_availability',
                    message: `Visit falls outside caregiver's availability window for ${dow}.`
                });
            }
        }
        // No availability rows = no constraint; skip warning (admin may not have set it up yet)
    }

    if (window.DEBUG) console.log('[CareHub] checkScheduleConflicts result:', conflicts);
    return conflicts;
}

/** @private Convert YYYY-MM-DD to day-of-week name */
function _dateToDayOfWeek(dateStr) {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    return days[new Date(dateStr + 'T00:00:00').getDay()];
}

/** @private True if [s1,e1) overlaps [s2,e2) (HH:MM strings) */
function _timesOverlap(s1, e1, s2, e2) {
    return s1 < e2 && e1 > s2;
}

// ==================== AVAILABILITY MATCHING ====================

/**
 * Return active caregivers that are likely available for a proposed visit,
 * ranked by match quality.
 *
 * Match criteria (in order of weight):
 *   1. Has an availability slot covering the visit day + time window
 *   2. Not on an unavailable date
 *   3. Not already booked at that time
 *   4. Service area matches client city (loose text match)
 *   5. Has transportation if client city differs from caregiver city
 *
 * @param {Object} proposed
 * @param {string} proposed.date
 * @param {string} proposed.start_time
 * @param {string} proposed.end_time
 * @param {string} [proposed.client_city]
 * @returns {Promise<Array<{caregiver, score, reasons}>>}
 */
async function getAvailableCaregivers(proposed) {
    if (!supabaseClient) return [];
    const { date, start_time, end_time, client_city } = proposed;
    const dow = _dateToDayOfWeek(date);

    // Fetch all active caregivers
    const { data: caregivers } = await supabaseClient
        .from(TABLES.CAREGIVERS)
        .select('id, name, email, city, transportation, willing_outings, availability, status')
        .eq('status', 'active');
    if (!caregivers || caregivers.length === 0) return [];

    const cgIds = caregivers.map(c => c.id);

    // Parallel fetch: availability, unavailable dates, time-off, existing bookings
    const [availSlots, unavailRows, timeOffRows, bookedRows] = await Promise.all([
        supabaseClient
            .from(TABLES.CAREGIVER_AVAILABILITY)
            .select('caregiver_id, start_time, end_time, service_area')
            .in('caregiver_id', cgIds)
            .eq('day_of_week', dow)
            .then(r => r.data || []),
        supabaseClient
            .from(TABLES.CAREGIVER_UNAVAILABLE_DATES)
            .select('caregiver_id')
            .in('caregiver_id', cgIds)
            .eq('date', date)
            .then(r => r.data || []),
        supabaseClient
            .from(TABLES.CAREGIVER_TIME_OFF_REQUESTS)
            .select('caregiver_id, start_time, end_time, request_type, reason')
            .in('caregiver_id', cgIds)
            .eq('status', 'approved')
            .lte('start_date', date)
            .gte('end_date', date)
            .then(r => r.data || []),
        supabaseClient
            .from(TABLES.SCHEDULES)
            .select('caregiver_id, start_time, end_time')
            .in('caregiver_id', cgIds)
            .eq('date', date)
            .not('status', 'eq', 'cancelled')
            .then(r => r.data || [])
    ]);

    const unavailSet = new Set(unavailRows.map(r => r.caregiver_id));

    const results = [];
    for (const cg of caregivers) {
        const reasons = [];
        let score = 0;

        // Hard block: unavailable date
        if (unavailSet.has(cg.id)) {
            reasons.push({ type: 'block', text: 'Marked unavailable on this date' });
            results.push({ caregiver: cg, score: -1, reasons, blocked: true });
            continue;
        }

        // Hard block: approved time-off
        const hasTimeOff = timeOffRows
            .filter(t => t.caregiver_id === cg.id)
            .some(t => {
                if (!t.start_time || !t.end_time) return true; // Full day off
                return _timesOverlap(start_time, end_time, t.start_time, t.end_time);
            });
        if (hasTimeOff) {
            reasons.push({ type: 'block', text: 'Has approved time off' });
            results.push({ caregiver: cg, score: -1, reasons, blocked: true });
            continue;
        }

        // Hard block: already booked at that time
        const alreadyBooked = bookedRows
            .filter(b => b.caregiver_id === cg.id)
            .some(b => _timesOverlap(start_time, end_time, b.start_time, b.end_time));
        if (alreadyBooked) {
            reasons.push({ type: 'block', text: 'Already booked at this time' });
            results.push({ caregiver: cg, score: -1, reasons, blocked: true });
            continue;
        }

        // Availability slot covers the window
        const mySlots = availSlots.filter(s => s.caregiver_id === cg.id);
        if (mySlots.length > 0) {
            const covered = mySlots.some(s =>
                start_time >= s.start_time && end_time <= s.end_time
            );
            if (covered) {
                score += 40;
                reasons.push({ type: 'good', text: `Available ${dow}` });
            } else {
                score += 10;
                reasons.push({ type: 'warn', text: `Has ${dow} availability but time window extends outside it` });
            }
        } else {
            reasons.push({ type: 'info', text: 'No structured availability set — may still be available' });
        }

        // Service area match
        if (client_city && mySlots.some(s => s.service_area && s.service_area.toLowerCase().includes(client_city.toLowerCase()))) {
            score += 20;
            reasons.push({ type: 'good', text: 'Serves this area' });
        } else if (client_city && cg.city && cg.city.toLowerCase().includes(client_city.toLowerCase())) {
            score += 10;
            reasons.push({ type: 'good', text: 'Same city as client' });
        }

        // Transportation
        if (cg.transportation) {
            score += 10;
            reasons.push({ type: 'good', text: 'Has transportation' });
        }

        results.push({ caregiver: cg, score, reasons, blocked: false });
    }

    // Sort: unblocked first, then by score desc, then alphabetically
    results.sort((a, b) => {
        if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
        if (b.score !== a.score) return b.score - a.score;
        return (a.caregiver.name || '').localeCompare(b.caregiver.name || '');
    });

    if (window.DEBUG) console.log('[CareHub] getAvailableCaregivers:', results.length, 'results for', date, start_time, '-', end_time);
    return results;
}

// ==================== RECURRING VISIT GENERATOR ====================

/**
 * Create a series of recurring schedule entries from a single template.
 * Returns { created: number, errors: number }.
 *
 * @param {Object} template   – same shape as createSchedule() input + recurrence fields
 * @param {string} template.recurrence_rule        – 'daily'|'weekly'|'bi-weekly'|'monthly'
 * @param {string} template.recurrence_end_date    – YYYY-MM-DD
 * @returns {Promise<{created: number, errors: number, parentId: string|null}>}
 */
async function createRecurringSchedules(template) {
    if (!supabaseClient) return { created: 0, errors: 0, parentId: null };

    const { recurrence_rule, recurrence_end_date, ...baseSchedule } = template;
    if (!recurrence_rule || !recurrence_end_date) {
        // Not actually recurring — fall through to single create
        const single = await createSchedule(baseSchedule);
        return { created: single ? 1 : 0, errors: single ? 0 : 1, parentId: single?.id || null };
    }

    const stepDays = { daily: 1, weekly: 7, 'bi-weekly': 14, monthly: null };
    const endDate  = new Date(recurrence_end_date + 'T00:00:00');
    let   current  = new Date(baseSchedule.date + 'T00:00:00');
    let   parentId = null;
    let   created  = 0;
    let   errors   = 0;

    while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        const row = {
            ...baseSchedule,
            date:                  dateStr,
            is_recurring:          true,
            recurrence_rule,
            recurrence_end_date,
            recurrence_parent_id:  parentId
        };

        const result = await createSchedule(row);
        if (result) {
            if (!parentId) parentId = result.id;
            created++;
        } else {
            errors++;
        }

        // Advance date
        if (recurrence_rule === 'monthly') {
            current.setMonth(current.getMonth() + 1);
        } else {
            current.setDate(current.getDate() + stepDays[recurrence_rule]);
        }
    }

    if (window.DEBUG) console.log('[CareHub] createRecurringSchedules:', created, 'created,', errors, 'errors. parentId:', parentId);
    return { created, errors, parentId };
}

// ==================== TRAINING HUB ====================

async function getTrainingModules({ activeOnly = true } = {}) {
    if (!supabaseClient) return [];
    let q = supabaseClient.from(TABLES.TRAINING_MODULES).select('*').order('sort_order').order('created_at');
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) { console.error('[CareHub] getTrainingModules error:', error.message); return []; }
    return data || [];
}

async function createTrainingModule(mod) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.from(TABLES.TRAINING_MODULES).insert([{ ...mod, created_at: new Date().toISOString() }]).select().single();
    if (error) { console.error('[CareHub] createTrainingModule error:', error.message); return null; }
    return data;
}

async function updateTrainingModule(id, updates) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient.from(TABLES.TRAINING_MODULES).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { console.error('[CareHub] updateTrainingModule error:', error.message); return false; }
    return true;
}

async function deleteTrainingModule(id) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient.from(TABLES.TRAINING_MODULES).delete().eq('id', id);
    if (error) { console.error('[CareHub] deleteTrainingModule error:', error.message); return false; }
    return true;
}

async function getTrainingAssignments({ caregiverId = null, moduleId = null, status = null, dueBefore = null, overdue = null } = {}) {
    if (!supabaseClient) return [];
    let q = supabaseClient
        .from(TABLES.CAREGIVER_TRAINING_ASSIGNMENTS)
        .select('*, training_modules(*), caregivers(id, name, email)')
        .order('assigned_at', { ascending: false });
    if (caregiverId) q = q.eq('caregiver_id', caregiverId);
    if (moduleId)    q = q.eq('module_id', moduleId);
    if (status)      q = q.eq('status', status);
    if (dueBefore)   q = q.lte('due_date', dueBefore);
    if (overdue === true) {
        const now = new Date().toISOString();
        q = q.lt('due_date', now).neq('status', 'completed');
    }
    const { data, error } = await q;
    if (error) { console.error('[CareHub] getTrainingAssignments error:', error.message); return []; }
    return data || [];
}

async function assignTrainingModule({ moduleId, caregiverId, assignedBy = null, dueDate = null, notes = null, sendNotification = true }) {
    if (!supabaseClient) return null;
    const now = new Date().toISOString();
    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVER_TRAINING_ASSIGNMENTS)
        .upsert([{
            module_id: moduleId, caregiver_id: caregiverId,
            assigned_by: assignedBy, due_date: dueDate, notes,
            status: 'not_started', assigned_at: now
        }], { onConflict: 'module_id,caregiver_id' })
        .select().single();
    if (error) { console.error('[CareHub] assignTrainingModule error:', error.message); return null; }

    // Create notification for caregiver
    if (sendNotification && data) {
        const module = await getTrainingModuleById(moduleId);
        await createNotification({
            type: 'training_assigned',
            title: 'New Training Assigned',
            message: `You have been assigned: ${module?.title || 'a new training module'}${dueDate ? ` (Due: ${_formatDueDate(dueDate)})` : ''}`,
            caregiver_id: caregiverId,
            priority: dueDate && _isUrgentDue(dueDate) ? 'high' : 'normal',
            related_table: TABLES.CAREGIVER_TRAINING_ASSIGNMENTS,
            related_record_id: data.id
        });
    }

    return data;
}

async function updateTrainingAssignment(id, updates, { sendNotification = false, reason = null } = {}) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient.from(TABLES.CAREGIVER_TRAINING_ASSIGNMENTS)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) { console.error('[CareHub] updateTrainingAssignment error:', error.message); return false; }

    // Send notification if due date updated
    if (sendNotification && updates.due_date) {
        const assignment = await getTrainingAssignmentById(id);
        if (assignment) {
            await createNotification({
                type: 'training_due_date_updated',
                title: 'Training Due Date Updated',
                message: `The due date for "${assignment.training_modules?.title || 'your training'}" has been updated to ${_formatDueDate(updates.due_date)}${reason ? `. Reason: ${reason}` : ''}`,
                caregiver_id: assignment.caregiver_id,
                priority: _isUrgentDue(updates.due_date) ? 'high' : 'normal',
                related_table: TABLES.CAREGIVER_TRAINING_ASSIGNMENTS,
                related_record_id: id
            });
        }
    }

    return true;
}

async function markTrainingComplete(id, { completedBy = null, score = null } = {}) {
    if (!supabaseClient) return false;
    const now = new Date().toISOString();

    const assignment = await getTrainingAssignmentById(id);
    if (!assignment) return false;

    const { error } = await supabaseClient.from(TABLES.CAREGIVER_TRAINING_ASSIGNMENTS)
        .update({
            status: 'completed',
            completed_at: now,
            completed_by: completedBy,
            score: score
        })
        .eq('id', id);
    if (error) { console.error('[CareHub] markTrainingComplete error:', error.message); return false; }

    // Create notification for admin
    const session = getSession();
    const isAdmin = session && (session.role === 'admin_owner' || session.role === 'co_owner');
    if (!isAdmin) {
        await createNotification({
            type: 'training_completed',
            title: 'Training Completed',
            message: `${assignment.caregivers?.name || 'A caregiver'} completed "${assignment.training_modules?.title || 'training'}"`,
            recipient_role: 'admin_owner',
            priority: 'normal',
            related_table: TABLES.CAREGIVER_TRAINING_ASSIGNMENTS,
            related_record_id: id,
            caregiver_id: assignment.caregiver_id
        });
    }

    return true;
}

async function acknowledgeTraining(id, { completedBy = null } = {}) {
    if (!supabaseClient) return false;
    const now = new Date().toISOString();

    const assignment = await getTrainingAssignmentById(id);
    if (!assignment) return false;

    const { error } = await supabaseClient.from(TABLES.CAREGIVER_TRAINING_ASSIGNMENTS)
        .update({
            acknowledged_at: now,
            status: 'completed',
            completed_at: now,
            completed_by: completedBy
        })
        .eq('id', id);
    if (error) { console.error('[CareHub] acknowledgeTraining error:', error.message); return false; }

    // Create notification for admin
    const session = getSession();
    const isAdmin = session && (session.role === 'admin_owner' || session.role === 'co_owner');
    if (!isAdmin) {
        await createNotification({
            type: 'training_acknowledged',
            title: 'Training Acknowledged',
            message: `${assignment.caregivers?.name || 'A caregiver'} acknowledged "${assignment.training_modules?.title || 'training'}"`,
            recipient_role: 'admin_owner',
            priority: 'normal',
            related_table: TABLES.CAREGIVER_TRAINING_ASSIGNMENTS,
            related_record_id: id,
            caregiver_id: assignment.caregiver_id
        });
    }

    return true;
}

async function getTrainingAssignmentById(id) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVER_TRAINING_ASSIGNMENTS)
        .select('*, training_modules(*), caregivers(id, name, email)')
        .eq('id', id)
        .single();
    if (error) { console.error('[CareHub] getTrainingAssignmentById error:', error.message); return null; }
    return data;
}

async function getTrainingModuleById(id) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from(TABLES.TRAINING_MODULES)
        .select('*')
        .eq('id', id)
        .single();
    if (error) { console.error('[CareHub] getTrainingModuleById error:', error.message); return null; }
    return data;
}

async function updateTrainingStatusToInProgress(id) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient.from(TABLES.CAREGIVER_TRAINING_ASSIGNMENTS)
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', id);
    if (error) { console.error('[CareHub] updateTrainingStatusToInProgress error:', error.message); return false; }
    return true;
}

// ==================== ONBOARDING STEPS & PROGRESS ====================

async function getOnboardingSteps({ activeOnly = true, category = null } = {}) {
    if (!supabaseClient) return [];
    let q = supabaseClient
        .from(TABLES.ONBOARDING_STEPS)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    if (activeOnly) q = q.eq('active', true);
    if (category)   q = q.eq('category', category);
    const { data, error } = await q;
    if (error) { console.error('[CareHub] getOnboardingSteps error:', error.message); return []; }
    return data || [];
}

async function createOnboardingStep(step) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from(TABLES.ONBOARDING_STEPS)
        .insert([{ ...step, created_at: new Date().toISOString() }])
        .select()
        .single();
    if (error) { console.error('[CareHub] createOnboardingStep error:', error.message); return null; }
    return data;
}

async function updateOnboardingStep(id, updates) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient
        .from(TABLES.ONBOARDING_STEPS)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) { console.error('[CareHub] updateOnboardingStep error:', error.message); return false; }
    return true;
}

async function deleteOnboardingStep(id) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient.from(TABLES.ONBOARDING_STEPS).delete().eq('id', id);
    if (error) { console.error('[CareHub] deleteOnboardingStep error:', error.message); return false; }
    return true;
}

async function getOnboardingProgress(caregiverId) {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVER_ONBOARDING_PROGRESS)
        .select('*, onboarding_steps(*)')
        .eq('caregiver_id', caregiverId)
        .order('created_at', { ascending: true });
    if (error) { console.error('[CareHub] getOnboardingProgress error:', error.message); return []; }
    return data || [];
}

async function updateOnboardingProgress(caregiverId, stepId, updates, { sendNotification = false } = {}) {
    if (!supabaseClient) return false;
    const now = new Date().toISOString();
    const { data: existing } = await supabaseClient
        .from(TABLES.CAREGIVER_ONBOARDING_PROGRESS)
        .select('*')
        .eq('caregiver_id', caregiverId)
        .eq('onboarding_step_id', stepId)
        .maybeSingle();

    const row = {
        caregiver_id: caregiverId,
        onboarding_step_id: stepId,
        ...updates,
        updated_at: now
    };
    if (updates.status === 'completed' && !existing?.completed_at) {
        row.completed_at = now;
    }

    const { error } = await supabaseClient
        .from(TABLES.CAREGIVER_ONBOARDING_PROGRESS)
        .upsert([row], { onConflict: 'caregiver_id,onboarding_step_id' });
    if (error) { console.error('[CareHub] updateOnboardingProgress error:', error.message); return false; }

    // Send notification if step completed
    if (sendNotification && updates.status === 'completed') {
        const step = await getOnboardingStepById(stepId);
        const caregiver = await getCaregiverById(caregiverId);
        await createNotification({
            type: 'onboarding_step_completed',
            title: 'Onboarding Step Completed',
            message: `${caregiver?.name || 'Caregiver'} completed: ${step?.title || 'onboarding step'}`,
            recipient_role: 'admin_owner',
            priority: 'normal',
            related_table: TABLES.CAREGIVER_ONBOARDING_PROGRESS,
            related_record_id: `${caregiverId}-${stepId}`,
            caregiver_id: caregiverId
        });
    }

    return true;
}

async function getOnboardingStepById(id) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from(TABLES.ONBOARDING_STEPS)
        .select('*')
        .eq('id', id)
        .single();
    if (error) { console.error('[CareHub] getOnboardingStepById error:', error.message); return null; }
    return data;
}

async function getAllOnboardingProgress() {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVER_ONBOARDING_PROGRESS)
        .select('*, onboarding_steps(*), caregivers(id, name, email, status)')
        .order('updated_at', { ascending: false });
    if (error) { console.error('[CareHub] getAllOnboardingProgress error:', error.message); return []; }
    return data || [];
}

async function flagCaregiver(caregiverId, { reason, adminNotes = null, notify = true }) {
    if (!supabaseClient) return false;
    const now = new Date().toISOString();

    // Create or update a flagged status entry
    const { error } = await supabaseClient
        .from(TABLES.CAREGIVER_ONBOARDING_PROGRESS)
        .upsert([{
            caregiver_id: caregiverId,
            status: 'flagged',
            flagged_reason: reason,
            admin_notes: adminNotes,
            updated_at: now
        }], { onConflict: 'caregiver_id' });
    if (error) { console.error('[CareHub] flagCaregiver error:', error.message); return false; }

    // Create notification
    if (notify) {
        const caregiver = await getCaregiverById(caregiverId);
        await createNotification({
            type: 'caregiver_flagged',
            title: 'Caregiver Flagged',
            message: `${caregiver?.name || 'A caregiver'} has been flagged: ${reason}`,
            recipient_role: 'admin_owner',
            priority: 'high',
            related_table: TABLES.CAREGIVERS,
            related_record_id: caregiverId,
            caregiver_id: caregiverId
        });
    }

    return true;
}

async function unflagCaregiver(caregiverId) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient
        .from(TABLES.CAREGIVER_ONBOARDING_PROGRESS)
        .update({ status: 'not_started', flagged_reason: null, updated_at: new Date().toISOString() })
        .eq('caregiver_id', caregiverId);
    if (error) { console.error('[CareHub] unflagCaregiver error:', error.message); return false; }
    return true;
}

// ==================== TRAINING STATISTICS & DASHBOARD ====================

async function getCaregiverTrainingStats(caregiverId) {
    if (!supabaseClient) return null;

    const [assignments, steps] = await Promise.all([
        getTrainingAssignments({ caregiverId }),
        getOnboardingProgress(caregiverId)
    ]);

    const totalTraining = assignments.length;
    const completedTraining = assignments.filter(a => a.status === 'completed').length;
    const overdueTraining = assignments.filter(a => {
        if (a.status === 'completed') return false;
        if (!a.due_date) return false;
        return new Date(a.due_date) < new Date();
    }).length;

    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const flagged = steps.some(s => s.status === 'flagged');

    const nextDue = assignments
        .filter(a => a.status !== 'completed' && a.due_date)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

    return {
        training: {
            total: totalTraining,
            completed: completedTraining,
            overdue: overdueTraining,
            percentage: totalTraining > 0 ? Math.round((completedTraining / totalTraining) * 100) : 0,
            nextDue: nextDue?.due_date || null,
            nextDueModule: nextDue?.training_modules?.title || null
        },
        onboarding: {
            total: totalSteps,
            completed: completedSteps,
            percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
            flagged: flagged
        }
    };
}

async function getAllCaregiversTrainingStats() {
    if (!supabaseClient) return [];

    const caregivers = await getCaregivers();
    const stats = await Promise.all(
        caregivers.map(async (cg) => {
            const cgStats = await getCaregiverTrainingStats(cg.id);
            return {
                caregiver: cg,
                ...cgStats
            };
        })
    );

    return stats;
}

async function getOverdueTrainingAssignments() {
    if (!supabaseClient) return [];
    const now = new Date().toISOString();
    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVER_TRAINING_ASSIGNMENTS)
        .select('*, training_modules(*), caregivers(id, name, email)')
        .lt('due_date', now)
        .neq('status', 'completed')
        .order('due_date', { ascending: true });
    if (error) { console.error('[CareHub] getOverdueTrainingAssignments error:', error.message); return []; }
    return data || [];
}

async function getTrainingApproachingDue(days = 3) {
    if (!supabaseClient) return [];
    const now = new Date();
    const future = new Date(now);
    future.setDate(future.getDate() + days);

    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVER_TRAINING_ASSIGNMENTS)
        .select('*, training_modules(*), caregivers(id, name, email)')
        .gte('due_date', now.toISOString())
        .lte('due_date', future.toISOString())
        .neq('status', 'completed')
        .order('due_date', { ascending: true });
    if (error) { console.error('[CareHub] getTrainingApproachingDue error:', error.message); return []; }
    return data || [];
}

// ==================== UTILITY FUNCTIONS ====================

function _formatDueDate(dateString) {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''}`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days (${date.toLocaleDateString()})`;
}

function _isUrgentDue(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    return diffDays <= 2 && diffDays >= 0;
}

function _isOverdue(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    return date < now;
}

async function getOnboardingChecklist(caregiverId) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.from(TABLES.ONBOARDING_CHECKLIST)
        .select('*').eq('caregiver_id', caregiverId).single();
    if (error && error.code !== 'PGRST116') { console.error('[CareHub] getOnboardingChecklist error:', error.message); }
    return data || null;
}

async function upsertOnboardingChecklist(caregiverId, updates) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient.from(TABLES.ONBOARDING_CHECKLIST)
        .upsert([{ caregiver_id: caregiverId, ...updates, updated_at: new Date().toISOString() }],
                { onConflict: 'caregiver_id' });
    if (error) { console.error('[CareHub] upsertOnboardingChecklist error:', error.message); return false; }
    return true;
}

async function getAllOnboardingChecklists() {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient.from(TABLES.ONBOARDING_CHECKLIST)
        .select('*, caregivers(id, name, email, status)').order('created_at');
    if (error) { console.error('[CareHub] getAllOnboardingChecklists error:', error.message); return []; }
    return data || [];
}

async function getCaregiverResources({ category = null, activeOnly = true } = {}) {
    if (!supabaseClient) return [];
    let q = supabaseClient.from(TABLES.CAREGIVER_RESOURCES).select('*').order('is_pinned', { ascending: false }).order('sort_order').order('created_at');
    if (activeOnly) q = q.eq('is_active', true);
    if (category)   q = q.eq('category', category);
    const { data, error } = await q;
    if (error) { console.error('[CareHub] getCaregiverResources error:', error.message); return []; }
    return data || [];
}

async function createCaregiverResource(resource) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.from(TABLES.CAREGIVER_RESOURCES)
        .insert([{ ...resource, created_at: new Date().toISOString() }]).select().single();
    if (error) { console.error('[CareHub] createCaregiverResource error:', error.message); return null; }
    return data;
}

async function updateCaregiverResource(id, updates) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient.from(TABLES.CAREGIVER_RESOURCES)
        .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { console.error('[CareHub] updateCaregiverResource error:', error.message); return false; }
    return true;
}

async function deleteCaregiverResource(id) {
    if (!supabaseClient) return false;
    const { error } = await supabaseClient.from(TABLES.CAREGIVER_RESOURCES).delete().eq('id', id);
    if (error) { console.error('[CareHub] deleteCaregiverResource error:', error.message); return false; }
    return true;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getApplications,
        getApplicationById,
        updateApplicationStatus,
        getCareRequests,
        getCareRequestById,
        createCareRequest,
        updateCareRequestStatus,
        updateCareRequestAdminNotes,
        getCaregivers,
        getCaregiverById,
        createCaregiverFromApplication,
        updateCaregiver,
        getClients,
        getClientById,
        createClientFromCareRequest,
        updateClient,
        getSchedules,
        getScheduleById,
        createSchedule,
        updateSchedule,
        cancelSchedule,
        getTimesheets,
        getTimesheetById,
        createTimesheet,
        updateTimesheet,
        approveTimesheet,
        rejectTimesheet,
        getVisitUpdates,
        getVisitUpdateById,
        createVisitUpdate,
        updateVisitUpdate,
        approveVisitUpdate,
        rejectVisitUpdate,
        markVisitUpdateInternal,
        getTodaysSchedule,
        getRecentActivity,
        getDashboardAlerts,
        getPayrollExports,
        getApprovedTimesheetsForPayroll,
        createPayrollExport,
        getDashboardStats,
        getUnreadNotifications,
        getNotifications,
        getNotificationCount,
        createNotification,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        getSchedulesForMonth,
        getClientSchedulePreferences,
        saveClientSchedulePreferences,
        getCaregiverAvailability,
        getCaregiverAvailabilityBulk,
        saveCaregiverAvailability,
        getCaregiverUnavailableDates,
        addCaregiverUnavailableDate,
        removeCaregiverUnavailableDate,
        // Time-off requests
        getTimeOffRequests,
        getPendingTimeOffCount,
        createTimeOffRequest,
        reviewTimeOffRequest,
        cancelTimeOffRequest,
        checkCaregiverTimeOff,
        checkScheduleConflicts,
        getAvailableCaregivers,
        createRecurringSchedules,
        getTrainingModules,
        createTrainingModule,
        updateTrainingModule,
        deleteTrainingModule,
        getTrainingAssignments,
        assignTrainingModule,
        updateTrainingAssignment,
        markTrainingComplete,
        acknowledgeTraining,
        getTrainingAssignmentById,
        getTrainingModuleById,
        updateTrainingStatusToInProgress,
        getOnboardingChecklist,
        upsertOnboardingChecklist,
        getAllOnboardingChecklists,
        getOnboardingSteps,
        createOnboardingStep,
        updateOnboardingStep,
        deleteOnboardingStep,
        getOnboardingProgress,
        updateOnboardingProgress,
        getOnboardingStepById,
        getAllOnboardingProgress,
        flagCaregiver,
        unflagCaregiver,
        getCaregiverTrainingStats,
        getAllCaregiversTrainingStats,
        getOverdueTrainingAssignments,
        getTrainingApproachingDue,
        getCaregiverResources,
        createCaregiverResource,
        updateCaregiverResource,
        deleteCaregiverResource,
        // Client-Caregiver Assignments
        getClientCaregiverAssignments,
        getAssignmentById,
        createClientCaregiverAssignment,
        updateClientCaregiverAssignment,
        endClientCaregiverAssignment,
        getClientCaregivers,
        getCaregiverClients,
        hasActiveAssignment,
        getActiveAssignment,
        // Utility functions
        _formatDueDate,
        _isUrgentDue,
        _isOverdue
    };
}

// ==================== CLIENT-CAREGIVER ASSIGNMENTS ====================

/**
 * Get client-caregiver assignments with optional filtering
 * @param {Object} filters
 * @param {string} [filters.clientId]
 * @param {string} [filters.caregiverId]
 * @param {string} [filters.status] - 'active', 'backup', 'ended'
 * @param {boolean} [filters.activeOnly]
 * @param {number} [filters.limit=50]
 * @returns {Promise<Array>}
 */
async function getClientCaregiverAssignments({ clientId = null, caregiverId = null, status = null, activeOnly = false, limit = 50 } = {}) {
    if (!supabaseClient) return [];
    let q = supabaseClient
        .from(TABLES.CLIENT_CAREGIVER_ASSIGNMENTS)
        .select('*, clients(id, name, care_for, email, city), caregivers(id, name, email, phone)')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (clientId) q = q.eq('client_id', clientId);
    if (caregiverId) q = q.eq('caregiver_id', caregiverId);
    if (status) q = q.eq('status', status);
    if (activeOnly) q = q.eq('status', 'active');

    const { data, error } = await q;
    if (error) { console.error('[CareHub] getClientCaregiverAssignments error:', error.message); return []; }
    return data || [];
}

/**
 * Get single assignment by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function getAssignmentById(id) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from(TABLES.CLIENT_CAREGIVER_ASSIGNMENTS)
        .select('*, clients(id, name, care_for, email), caregivers(id, name, email, phone)')
        .eq('id', id)
        .single();
    if (error) { console.error('[CareHub] getAssignmentById error:', error.message); return null; }
    return data;
}

/**
 * Create a new client-caregiver assignment
 * @param {Object} assignment
 * @param {string} assignment.clientId
 * @param {string} assignment.caregiverId
 * @param {string} [assignment.status='active']
 * @param {string} [assignment.startDate]
 * @param {string} [assignment.endDate]
 * @param {string} [assignment.assignedBy]
 * @param {string} [assignment.notes]
 * @param {boolean} [sendNotification=true]
 * @returns {Promise<Object|null>}
 */
async function createClientCaregiverAssignment({ clientId, caregiverId, status = 'active', startDate = null, endDate = null, assignedBy = null, notes = null }, { sendNotification = true } = {}) {
    if (!supabaseClient) return null;

    const row = {
        client_id: clientId,
        caregiver_id: caregiverId,
        status,
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: endDate,
        assigned_by: assignedBy,
        notes,
        created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
        .from(TABLES.CLIENT_CAREGIVER_ASSIGNMENTS)
        .insert([row])
        .select()
        .single();

    if (error) {
        // Handle unique constraint violation (active assignment already exists)
        if (error.code === '23505') {
            console.warn('[CareHub] Active assignment already exists for this client-caregiver pair');
            return null;
        }
        console.error('[CareHub] createClientCaregiverAssignment error:', error.message);
        return null;
    }

    // Send notifications
    if (sendNotification && data) {
        const [client, caregiver] = await Promise.all([
            getClientById(clientId),
            getCaregiverById(caregiverId)
        ]);

        // Notify caregiver
        await createNotification({
            type: 'caregiver_assigned',
            title: 'New Client Assignment',
            message: `You have been assigned to care for ${client?.care_for || client?.name || 'a new client'}.${notes ? ` Notes: ${notes}` : ''}`,
            caregiver_id: caregiverId,
            priority: 'normal',
            related_table: TABLES.CLIENT_CAREGIVER_ASSIGNMENTS,
            related_record_id: data.id,
            client_id: clientId
        });

        // Notify client/family (if they have portal access)
        if (client?.email) {
            await createNotification({
                type: 'caregiver_assigned_family',
                title: 'Caregiver Assigned',
                message: `${caregiver?.name || 'A caregiver'} has been assigned to provide care.${notes ? ` Notes: ${notes}` : ''}`,
                client_id: clientId,
                priority: 'normal',
                related_table: TABLES.CLIENT_CAREGIVER_ASSIGNMENTS,
                related_record_id: data.id,
                caregiver_id: caregiverId
            });
        }
    }

    return data;
}

/**
 * Update an existing assignment
 * @param {string} id
 * @param {Object} updates
 * @param {boolean} [sendNotification=true]
 * @returns {Promise<boolean>}
 */
async function updateClientCaregiverAssignment(id, updates, { sendNotification = true } = {}) {
    if (!supabaseClient) return false;

    const { error } = await supabaseClient
        .from(TABLES.CLIENT_CAREGIVER_ASSIGNMENTS)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) { console.error('[CareHub] updateClientCaregiverAssignment error:', error.message); return false; }

    // Send notification if status changed
    if (sendNotification && updates.status) {
        const assignment = await getAssignmentById(id);
        if (assignment) {
            const typeMap = {
                'active': 'Assignment Activated',
                'backup': 'Backup Assignment Set',
                'ended': 'Assignment Ended'
            };

            await createNotification({
                type: 'assignment_status_changed',
                title: typeMap[updates.status] || 'Assignment Updated',
                message: `Your assignment for ${assignment.clients?.care_for || 'client'} has been updated to: ${updates.status}`,
                caregiver_id: assignment.caregiver_id,
                priority: 'normal',
                related_table: TABLES.CLIENT_CAREGIVER_ASSIGNMENTS,
                related_record_id: id,
                client_id: assignment.client_id
            });
        }
    }

    return true;
}

/**
 * End an assignment (set status to ended with end_date)
 * @param {string} id
 * @param {string} [reason]
 * @param {boolean} [sendNotification=true]
 * @returns {Promise<boolean>}
 */
async function endClientCaregiverAssignment(id, { reason = null, sendNotification = true } = {}) {
    if (!supabaseClient) return false;

    const today = new Date().toISOString().split('T')[0];
    const updates = {
        status: 'ended',
        end_date: today,
        notes: reason ? `Ended: ${reason}` : 'Assignment ended',
        updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient
        .from(TABLES.CLIENT_CAREGIVER_ASSIGNMENTS)
        .update(updates)
        .eq('id', id);

    if (error) { console.error('[CareHub] endClientCaregiverAssignment error:', error.message); return false; }

    if (sendNotification) {
        const assignment = await getAssignmentById(id);
        if (assignment) {
            await createNotification({
                type: 'assignment_ended',
                title: 'Assignment Ended',
                message: `Your assignment for ${assignment.clients?.care_for || 'client'} has ended.${reason ? ` Reason: ${reason}` : ''}`,
                caregiver_id: assignment.caregiver_id,
                priority: 'normal',
                related_table: TABLES.CLIENT_CAREGIVER_ASSIGNMENTS,
                related_record_id: id,
                client_id: assignment.client_id
            });
        }
    }

    return true;
}

/**
 * Get all active caregivers for a client
 * @param {string} clientId
 * @returns {Promise<Array>}
 */
async function getClientCaregivers(clientId) {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
        .from(TABLES.CLIENT_CAREGIVER_ASSIGNMENTS)
        .select('*, caregivers(id, name, email, phone, city, transportation)')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .or('end_date.is.null,end_date.gte.' + new Date().toISOString().split('T')[0]);

    if (error) { console.error('[CareHub] getClientCaregivers error:', error.message); return []; }
    return data || [];
}

/**
 * Get all active clients for a caregiver
 * @param {string} caregiverId
 * @returns {Promise<Array>}
 */
async function getCaregiverClients(caregiverId) {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
        .from(TABLES.CLIENT_CAREGIVER_ASSIGNMENTS)
        .select('*, clients(id, name, care_for, email, phone, city, address)')
        .eq('caregiver_id', caregiverId)
        .eq('status', 'active')
        .or('end_date.is.null,end_date.gte.' + new Date().toISOString().split('T')[0]);

    if (error) { console.error('[CareHub] getCaregiverClients error:', error.message); return []; }
    return data || [];
}

/**
 * Check if client-caregiver pair has active assignment
 * @param {string} clientId
 * @param {string} caregiverId
 * @returns {Promise<boolean>}
 */
async function hasActiveAssignment(clientId, caregiverId) {
    if (!supabaseClient) return false;
    const { data, error } = await supabaseClient
        .rpc('has_active_assignment', { p_client_id: clientId, p_caregiver_id: caregiverId });
    if (error) { console.error('[CareHub] hasActiveAssignment error:', error.message); return false; }
    return data || false;
}

/**
 * Get active assignment ID for a client-caregiver pair
 * @param {string} clientId
 * @param {string} caregiverId
 * @returns {Promise<string|null>}
 */
async function getActiveAssignment(clientId, caregiverId) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .rpc('get_active_assignment', { p_client_id: clientId, p_caregiver_id: caregiverId });
    if (error) { console.error('[CareHub] getActiveAssignment error:', error.message); return null; }
    return data;
}

// ==================== PAYROLL WORKFLOW ====================

/**
 * Get payroll exports with optional filtering
 * @param {Object} filters
 * @param {string} [filters.status]
 * @param {string} [filters.startDate]
 * @param {string} [filters.endDate]
 * @param {number} [filters.limit=50]
 * @returns {Promise<Array>}
 */
async function getPayrollExports({ status = null, startDate = null, endDate = null, limit = 50 } = {}) {
    if (!supabaseClient) return [];
    let q = supabaseClient
        .from(TABLES.PAYROLL_EXPORTS)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status) q = q.eq('status', status);
    if (startDate) q = q.gte('pay_period_start', startDate);
    if (endDate) q = q.lte('pay_period_end', endDate);

    const { data, error } = await q;
    if (error) { console.error('[CareHub] getPayrollExports error:', error.message); return []; }
    return data || [];
}

/**
 * Get single payroll export with items
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function getPayrollExportById(id) {
    if (!supabaseClient) return null;
    const { data: exportData, error: exportError } = await supabaseClient
        .from(TABLES.PAYROLL_EXPORTS)
        .select('*')
        .eq('id', id)
        .single();

    if (exportError) { console.error('[CareHub] getPayrollExportById error:', exportError.message); return null; }

    const { data: items, error: itemsError } = await supabaseClient
        .from(TABLES.PAYROLL_EXPORT_ITEMS)
        .select('*, caregivers(id, name, email)')
        .eq('payroll_export_id', id)
        .order('created_at', { ascending: true });

    if (itemsError) { console.error('[CareHub] getPayrollExportItems error:', itemsError.message); }

    return { ...exportData, items: items || [] };
}

/**
 * Create payroll export from approved timesheets
 * @param {Object} params
 * @param {string} params.startDate - Pay period start
 * @param {string} params.endDate - Pay period end
 * @param {string} params.exportType - gusto, csv, quickbooks
 * @param {string} params.createdBy - User ID
 * @returns {Promise<Object|null>}
 */
async function createPayrollExport({ startDate, endDate, exportType = 'gusto', createdBy }) {
    if (!supabaseClient) return null;

    // Get payroll summary for period
    const { data: summary, error: summaryError } = await supabaseClient
        .rpc('get_payroll_summary', { p_start_date: startDate, p_end_date: endDate });

    if (summaryError) { console.error('[CareHub] getPayrollSummary error:', summaryError.message); return null; }

    // Create export record
    const { data: exportRecord, error: exportError } = await supabaseClient
        .from(TABLES.PAYROLL_EXPORTS)
        .insert([{
            pay_period_start: startDate,
            pay_period_end: endDate,
            export_type: exportType,
            status: 'draft',
            total_hours: summary.reduce((sum, s) => sum + parseFloat(s.total_hours || 0), 0),
            caregiver_count: summary.length,
            exported_by: createdBy,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (exportError) { console.error('[CareHub] createPayrollExport error:', exportError.message); return null; }

    // Create export items for each caregiver
    const items = summary.map(s => ({
        payroll_export_id: exportRecord.id,
        caregiver_id: s.caregiver_id,
        regular_hours: s.regular_hours,
        overtime_hours: s.overtime_hours,
        total_hours: s.total_hours,
        mileage: s.mileage,
        visit_count: s.visit_count,
        status: 'pending'
    }));

    if (items.length > 0) {
        const { error: itemsError } = await supabaseClient
            .from(TABLES.PAYROLL_EXPORT_ITEMS)
            .insert(items);
        if (itemsError) { console.error('[CareHub] createPayrollItems error:', itemsError.message); }
    }

    return exportRecord;
}

/**
 * Update payroll export status and lock timesheets
 * @param {string} id
 * @param {string} status - draft, preview, exported, processed
 * @param {string} [processedBy]
 * @returns {Promise<boolean>}
 */
async function updatePayrollExportStatus(id, status, { processedBy = null } = {}) {
    if (!supabaseClient) return false;

    const updates = { status, updated_at: new Date().toISOString() };

    if (status === 'exported') {
        updates.exported_at = new Date().toISOString();
        updates.exported_by = processedBy;

        // Lock timesheets for this period
        const { data: exportData } = await supabaseClient
            .from(TABLES.PAYROLL_EXPORTS)
            .select('pay_period_start, pay_period_end')
            .eq('id', id)
            .single();

        if (exportData) {
            await supabaseClient.rpc('lock_timesheets_for_export', {
                p_start_date: exportData.pay_period_start,
                p_end_date: exportData.pay_period_end,
                p_export_id: id
            });
        }
    }

    if (status === 'processed') {
        updates.processed_at = new Date().toISOString();
    }

    const { error } = await supabaseClient
        .from(TABLES.PAYROLL_EXPORTS)
        .update(updates)
        .eq('id', id);

    if (error) { console.error('[CareHub] updatePayrollExportStatus error:', error.message); return false; }
    return true;
}

/**
 * Get timesheets pending approval
 * @param {Object} filters
 * @param {string} [filters.caregiverId]
 * @param {string} [filters.startDate]
 * @param {string} [filters.endDate]
 * @returns {Promise<Array>}
 */
async function getPendingTimesheets({ caregiverId = null, startDate = null, endDate = null } = {}) {
    if (!supabaseClient) return [];

    let q = supabaseClient
        .from(TABLES.TIMESHEETS)
        .select('*, caregivers(id, name), schedules!inner(date, client_id, clients!inner(care_for))')
        .in('status', ['submitted', 'pending'])
        .order('date', { ascending: false });

    if (caregiverId) q = q.eq('caregiver_id', caregiverId);
    if (startDate) q = q.gte('date', startDate);
    if (endDate) q = q.lte('date', endDate);

    const { data, error } = await q;
    if (error) { console.error('[CareHub] getPendingTimesheets error:', error.message); return []; }
    return data || [];
}

/**
 * Approve timesheet with overtime calculation
 * @param {string} timesheetId
 * @param {string} approvedBy - Admin user ID
 * @param {string} [notes]
 * @returns {Promise<boolean>}
 */
async function approveTimesheet(timesheetId, approvedBy, { notes = null } = {}) {
    if (!supabaseClient) return false;

    // Get timesheet to calculate overtime
    const { data: ts, error: tsError } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .select('caregiver_id, date, hours_worked, week_starting')
        .eq('id', timesheetId)
        .single();

    if (tsError || !ts) return false;

    // Calculate regular vs overtime
    const { data: otCalc, error: otError } = await supabaseClient
        .rpc('calculate_overtime', {
            p_caregiver_id: ts.caregiver_id,
            p_week_start: ts.week_starting || ts.date,
            p_hours: ts.hours_worked
        });

    if (otError) { console.error('[CareHub] calculateOvertime error:', otError.message); }

    const regularHours = otCalc?.regular_hours || ts.hours_worked;
    const overtimeHours = otCalc?.overtime_hours || 0;

    const { error } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .update({
            status: 'approved',
            approved_by: approvedBy,
            approved_at: new Date().toISOString(),
            regular_hours: regularHours,
            overtime_hours: overtimeHours,
            admin_notes: notes,
            updated_at: new Date().toISOString()
        })
        .eq('id', timesheetId);

    if (error) { console.error('[CareHub] approveTimesheet error:', error.message); return false; }

    // Notify caregiver
    const { data: timesheet } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .select('caregiver_id, date')
        .eq('id', timesheetId)
        .single();

    if (timesheet) {
        await createNotification({
            type: 'timesheet_approved',
            title: 'Timesheet Approved',
            message: `Your timesheet for ${timesheet.date} has been approved.`,
            caregiver_id: timesheet.caregiver_id,
            priority: 'normal',
            related_table: TABLES.TIMESHEETS,
            related_record_id: timesheetId
        });
    }

    return true;
}

/**
 * Reject timesheet with reason
 * @param {string} timesheetId
 * @param {string} rejectedBy - Admin user ID
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
async function rejectTimesheet(timesheetId, rejectedBy, reason) {
    if (!supabaseClient) return false;

    const { error } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .update({
            status: 'rejected',
            rejection_reason: reason,
            approved_by: rejectedBy,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', timesheetId);

    if (error) { console.error('[CareHub] rejectTimesheet error:', error.message); return false; }

    // Notify caregiver
    const { data: timesheet } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .select('caregiver_id, date')
        .eq('id', timesheetId)
        .single();

    if (timesheet) {
        await createNotification({
            type: 'timesheet_rejected',
            title: 'Timesheet Rejected',
            message: `Your timesheet for ${timesheet.date} has been rejected. Reason: ${reason}`,
            caregiver_id: timesheet.caregiver_id,
            priority: 'high',
            related_table: TABLES.TIMESHEETS,
            related_record_id: timesheetId
        });
    }

    return true;
}

/**
 * Request correction on timesheet
 * @param {string} timesheetId
 * @param {string} requestedBy - Admin user ID
 * @param {string} correctionNotes
 * @returns {Promise<boolean>}
 */
async function requestTimesheetCorrection(timesheetId, requestedBy, correctionNotes) {
    if (!supabaseClient) return false;

    const { error } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .update({
            status: 'correction_requested',
            correction_notes: correctionNotes,
            approved_by: requestedBy,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', timesheetId);

    if (error) { console.error('[CareHub] requestTimesheetCorrection error:', error.message); return false; }

    // Notify caregiver
    const { data: timesheet } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .select('caregiver_id, date')
        .eq('id', timesheetId)
        .single();

    if (timesheet) {
        await createNotification({
            type: 'timesheet_correction_needed',
            title: 'Timesheet Correction Needed',
            message: `Please correct and resubmit your timesheet for ${timesheet.date}. Note: ${correctionNotes}`,
            caregiver_id: timesheet.caregiver_id,
            priority: 'high',
            related_table: TABLES.TIMESHEETS,
            related_record_id: timesheetId
        });
    }

    return true;
}

/**
 * Clock in for visit
 * @param {string} scheduleId
 * @param {string} caregiverId
 * @param {Object} [location] - Optional GPS coordinates
 * @returns {Promise<Object|null>}
 */
async function clockIn(scheduleId, caregiverId, { lat = null, lng = null, accuracy = null } = {}) {
    if (!supabaseClient) return null;

    const now = new Date().toISOString();

    // Create clock event
    const { data: event, error: eventError } = await supabaseClient
        .from(TABLES.VISIT_CLOCK_EVENTS)
        .insert([{
            schedule_id: scheduleId,
            caregiver_id: caregiverId,
            event_type: 'clock_in',
            event_time: now,
            location_lat: lat,
            location_lng: lng,
            location_accuracy: accuracy
        }])
        .select()
        .single();

    if (eventError) { console.error('[CareHub] clockIn error:', eventError.message); return null; }

    // Update schedule status
    const { error: scheduleError } = await supabaseClient
        .from(TABLES.SCHEDULES)
        .update({
            lifecycle_status: 'in_progress',
            actual_start_time: now,
            gps_verified: !!(lat && lng),
            updated_at: now
        })
        .eq('id', scheduleId);

    if (scheduleError) { console.error('[CareHub] updateScheduleClockIn error:', scheduleError.message); }

    return event;
}

/**
 * Clock out for visit
 * @param {string} scheduleId
 * @param {string} caregiverId
 * @param {Object} [location] - Optional GPS coordinates
 * @param {string} [notes]
 * @returns {Promise<Object|null>}
 */
async function clockOut(scheduleId, caregiverId, { lat = null, lng = null, accuracy = null, notes = null } = {}) {
    if (!supabaseClient) return null;

    const now = new Date().toISOString();

    // Get clock in time to calculate duration
    const { data: clockIn } = await supabaseClient
        .from(TABLES.VISIT_CLOCK_EVENTS)
        .select('event_time')
        .eq('schedule_id', scheduleId)
        .eq('caregiver_id', caregiverId)
        .eq('event_type', 'clock_in')
        .order('event_time', { ascending: false })
        .limit(1)
        .single();

    let durationMinutes = null;
    if (clockIn) {
        const start = new Date(clockIn.event_time);
        const end = new Date(now);
        durationMinutes = Math.round((end - start) / 60000);
    }

    // Create clock out event
    const { data: event, error: eventError } = await supabaseClient
        .from(TABLES.VISIT_CLOCK_EVENTS)
        .insert([{
            schedule_id: scheduleId,
            caregiver_id: caregiverId,
            event_type: 'clock_out',
            event_time: now,
            location_lat: lat,
            location_lng: lng,
            location_accuracy: accuracy,
            notes
        }])
        .select()
        .single();

    if (eventError) { console.error('[CareHub] clockOut error:', eventError.message); return null; }

    // Update schedule status
    const { error: scheduleError } = await supabaseClient
        .from(TABLES.SCHEDULES)
        .update({
            lifecycle_status: 'completed',
            actual_end_time: now,
            actual_duration_minutes: durationMinutes,
            completion_notes: notes,
            gps_verified: !!(lat && lng),
            updated_at: now
        })
        .eq('id', scheduleId);

    if (scheduleError) { console.error('[CareHub] updateScheduleClockOut error:', scheduleError.message); }

    return { ...event, duration_minutes: durationMinutes };
}

/**
 * Get clock events for a schedule
 * @param {string} scheduleId
 * @returns {Promise<Array>}
 */
async function getClockEvents(scheduleId) {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
        .from(TABLES.VISIT_CLOCK_EVENTS)
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('event_time', { ascending: true });
    if (error) { console.error('[CareHub] getClockEvents error:', error.message); return []; }
    return data || [];
}

/**
 * Validate timesheet for conflicts
 * @param {Object} timesheet
 * @returns {Promise<Array>} - Array of conflict warnings
 */
async function validateTimesheet(timesheet) {
    if (!supabaseClient) return [];
    const conflicts = [];

    // Check 1: Hours match scheduled duration
    if (timesheet.schedule_ids && timesheet.schedule_ids.length > 0) {
        const { data: schedules } = await supabaseClient
            .from(TABLES.SCHEDULES)
            .select('id, start_time, end_time, actual_duration_minutes')
            .in('id', timesheet.schedule_ids);

        if (schedules) {
            let scheduledMinutes = 0;
            for (const s of schedules) {
                if (s.actual_duration_minutes) {
                    scheduledMinutes += s.actual_duration_minutes;
                } else {
                    // Calculate from start/end times
                    const [startH, startM] = s.start_time.split(':').map(Number);
                    const [endH, endM] = s.end_time.split(':').map(Number);
                    scheduledMinutes += ((endH * 60 + endM) - (startH * 60 + startM));
                }
            }

            const submittedHours = timesheet.hours_worked || 0;
            const submittedMinutes = submittedHours * 60;
            const variance = Math.abs(submittedMinutes - scheduledMinutes);

            if (variance > 15) { // 15 minutes tolerance
                conflicts.push({
                    type: 'duration_mismatch',
                    severity: 'warning',
                    message: `Submitted hours (${submittedHours}h) differ from scheduled duration (${Math.round(scheduledMinutes/60*10)/10}h)`
                });
            }
        }
    }

    // Check 2: Overlapping timesheets
    const { data: overlapping } = await supabaseClient
        .from(TABLES.TIMESHEETS)
        .select('id, date, hours_worked')
        .eq('caregiver_id', timesheet.caregiver_id)
        .eq('date', timesheet.date)
        .neq('id', timesheet.id || '00000000-0000-0000-0000-000000000000')
        .in('status', ['submitted', 'pending', 'approved']);

    if (overlapping && overlapping.length > 0) {
        const totalHours = overlapping.reduce((sum, t) => sum + parseFloat(t.hours_worked || 0), 0) + parseFloat(timesheet.hours_worked || 0);
        if (totalHours > 16) {
            conflicts.push({
                type: 'excessive_hours',
                severity: 'error',
                message: `Total hours for this day (${totalHours}h) exceeds 16-hour safety limit`
            });
        }
    }

    // Check 3: Excessive mileage
    if (timesheet.mileage && timesheet.mileage > 100) {
        conflicts.push({
            type: 'high_mileage',
            severity: 'warning',
            message: `Mileage (${timesheet.mileage} miles) seems high for a single day`
        });
    }

    // Check 4: Visit not completed but timesheet submitted
    if (timesheet.schedule_ids) {
        const { data: incomplete } = await supabaseClient
            .from(TABLES.SCHEDULES)
            .select('id, lifecycle_status')
            .in('id', timesheet.schedule_ids)
            .not('lifecycle_status', 'eq', 'completed');

        if (incomplete && incomplete.length > 0) {
            conflicts.push({
                type: 'incomplete_visit',
                severity: 'error',
                message: `${incomplete.length} visit(s) not marked as completed`
            });
        }
    }

    return conflicts;
}

/**
 * Export payroll to CSV format (Gusto-compatible)
 * @param {string} exportId
 * @returns {Promise<string|null>} - CSV content
 */
async function exportPayrollToCSV(exportId) {
    if (!supabaseClient) return null;

    const { data: exportData } = await getPayrollExportById(exportId);
    if (!exportData) return null;

    // Gusto CSV format
    const headers = ['Employee ID', 'Employee Name', 'Regular Hours', 'Overtime Hours', 'Mileage', 'Mileage Reimbursement', 'Total Pay'];

    const rows = exportData.items.map(item => [
        item.caregiver_id,
        item.caregivers?.name || 'Unknown',
        item.regular_hours,
        item.overtime_hours,
        item.mileage,
        item.mileage_reimbursement,
        item.total_pay
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csv;
}

// Global exports for browser use
if (typeof window !== 'undefined') {
    window.getTrainingAssignments = getTrainingAssignments;
    window.assignTrainingModule = assignTrainingModule;
    window.updateTrainingAssignment = updateTrainingAssignment;
    window.markTrainingComplete = markTrainingComplete;
    window.acknowledgeTraining = acknowledgeTraining;
    window.getTrainingAssignmentById = getTrainingAssignmentById;
    window.getTrainingModuleById = getTrainingModuleById;
    window.updateTrainingStatusToInProgress = updateTrainingStatusToInProgress;
    window.getOnboardingSteps = getOnboardingSteps;
    window.createOnboardingStep = createOnboardingStep;
    window.updateOnboardingStep = updateOnboardingStep;
    window.deleteOnboardingStep = deleteOnboardingStep;
    window.getOnboardingProgress = getOnboardingProgress;
    window.updateOnboardingProgress = updateOnboardingProgress;
    window.getOnboardingStepById = getOnboardingStepById;
    window.getAllOnboardingProgress = getAllOnboardingProgress;
    window.flagCaregiver = flagCaregiver;
    window.unflagCaregiver = unflagCaregiver;
    window.getCaregiverTrainingStats = getCaregiverTrainingStats;
    window.getAllCaregiversTrainingStats = getAllCaregiversTrainingStats;
    window.getOverdueTrainingAssignments = getOverdueTrainingAssignments;
    window.getTrainingApproachingDue = getTrainingApproachingDue;
    window._formatDueDate = _formatDueDate;
    window._isUrgentDue = _isUrgentDue;
    window._isOverdue = _isOverdue;
    // Time-off requests
    window.getTimeOffRequests = getTimeOffRequests;
    window.getPendingTimeOffCount = getPendingTimeOffCount;
    window.createTimeOffRequest = createTimeOffRequest;
    window.reviewTimeOffRequest = reviewTimeOffRequest;
    window.cancelTimeOffRequest = cancelTimeOffRequest;
    window.checkCaregiverTimeOff = checkCaregiverTimeOff;
    // Client-Caregiver Assignments
    window.getClientCaregiverAssignments = getClientCaregiverAssignments;
    window.getAssignmentById = getAssignmentById;
    window.createClientCaregiverAssignment = createClientCaregiverAssignment;
    window.updateClientCaregiverAssignment = updateClientCaregiverAssignment;
    window.endClientCaregiverAssignment = endClientCaregiverAssignment;
    window.getClientCaregivers = getClientCaregivers;
    window.getCaregiverClients = getCaregiverClients;
    window.hasActiveAssignment = hasActiveAssignment;
    window.getActiveAssignment = getActiveAssignment;
    // Payroll Workflow
    window.getPayrollExports = getPayrollExports;
    window.getPayrollExportById = getPayrollExportById;
    window.createPayrollExport = createPayrollExport;
    window.updatePayrollExportStatus = updatePayrollExportStatus;
    window.getPendingTimesheets = getPendingTimesheets;
    window.approveTimesheet = approveTimesheet;
    window.rejectTimesheet = rejectTimesheet;
    window.requestTimesheetCorrection = requestTimesheetCorrection;
    window.clockIn = clockIn;
    window.clockOut = clockOut;
    window.getClockEvents = getClockEvents;
    window.validateTimesheet = validateTimesheet;
    window.exportPayrollToCSV = exportPayrollToCSV;
}
