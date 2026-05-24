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

/**
 * Create a notification
 * @param {Object} notification 
 * @returns {Promise<Object|null>}
 */
async function createNotification(notification) {
    if (!supabaseClient) return null;

    const notificationData = {
        ...notification,
        read: false,
        created_at: new Date().toISOString()
    };

    if (window.DEBUG) console.log('[CareHub] Creating notification:', notificationData);

    const { data, error } = await supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .insert([notificationData])
        .select()
        .single();

    if (error) {
        console.error('[CareHub] ERROR creating notification:', error);
        console.error('[CareHub] Error code:', error.code);
        console.error('[CareHub] Error message:', error.message);
        console.error('[CareHub] Error details:', error.details);

        // Check for missing column errors
        if (error.message && error.message.includes('column')) {
            const columnMatch = error.message.match(/column "([^"]+)"/);
            if (columnMatch) {
                console.error(`[CareHub] MISSING COLUMN: notifications table needs column "${columnMatch[1]}"`);
            }
        }

        return null;
    }

    if (window.DEBUG) console.log('[CareHub] Notification created successfully:', data);
    return data;
}

/**
 * Get unread notifications
 * @returns {Promise<Array>}
 */
async function getUnreadNotifications() {
    if (!supabaseClient) return [];

    // Non-admin roles: only surface notifications relevant to their own records.
    // Notifications table must have optional caregiver_id and client_id columns.
    // Global notifications (no id attached) are only shown to full-access roles.
    const isFullAccess = window.RoleFilter ? window.RoleFilter._isFullAccess() : true;

    let query = supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .select('*')
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(20);

    if (!isFullAccess && window.getCurrentRole) {
        const role = window.getCurrentRole();
        if (role === 'caregiver') {
            const caregiverId = window.RoleFilter ? window.RoleFilter.getCurrentCaregiverId() : null;
            if (!caregiverId) return [];
            // Notifications where caregiver_id matches OR the notification is addressed to them
            query = query.or(`caregiver_id.eq.${caregiverId},related_type.eq.caregiver`);
        } else if (role === 'client_family') {
            const clientId = window.RoleFilter ? window.RoleFilter.getCurrentClientId() : null;
            if (!clientId) return [];
            query = query.or(`client_id.eq.${clientId},related_type.eq.client`);
        } else {
            return [];
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }

    // JS-level safety net for notifications
    if (!isFullAccess) {
        const role = window.getCurrentRole ? window.getCurrentRole() : null;
        const caregiverId = window.RoleFilter ? window.RoleFilter.getCurrentCaregiverId() : null;
        const clientId    = window.RoleFilter ? window.RoleFilter.getCurrentClientId()    : null;
        return (data || []).filter(n => {
            if (role === 'caregiver')    return !n.caregiver_id || String(n.caregiver_id) === String(caregiverId);
            if (role === 'client_family') return !n.client_id    || String(n.client_id)    === String(clientId);
            return false;
        }).slice(0, 10);
    }

    return (data || []).slice(0, 10);
}

/**
 * Mark notification as read
 * @param {string} id 
 * @returns {Promise<boolean>}
 */
async function markNotificationRead(id) {
    if (!supabaseClient) return false;
    
    const { error } = await supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .update({ read: true, updated_at: new Date().toISOString() })
        .eq('id', id);
    
    if (error) {
        console.error('Error marking notification read:', error);
        return false;
    }
    
    return true;
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
        createNotification,
        getSchedulesForMonth
    };
}
