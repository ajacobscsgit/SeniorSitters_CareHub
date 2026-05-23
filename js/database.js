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
            console.log('Supabase client initialized successfully');
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
        console.log('[CareHub] Initializing Supabase on DOMContentLoaded');
        supabaseClient = initSupabase();
    } else {
        console.log('[CareHub] Supabase already initialized');
    }
    
    // Expose to window for direct testing
    window.carehubSupabase = supabaseClient;
    console.log('[CareHub] Exposed to window.carehubSupabase for testing');
});

// ==================== APPLICATIONS ====================

/**
 * Get all applications with optional filtering
 * @param {Object} filters - Optional filters (status, etc.)
 * @returns {Promise<Array>}
 */
async function getApplications(filters = {}) {
    console.log('[CareHub] === Fetching Applications ===');
    console.log('[CareHub] Supabase client exists:', !!supabaseClient);
    
    if (!supabaseClient) {
        console.error('[CareHub] ERROR: Supabase client not initialized');
        return [];
    }
    
    console.log('[CareHub] Table:', TABLES.APPLICATIONS);
    console.log('[CareHub] Filters:', JSON.stringify(filters));
    
    // Select actual columns from applications table
    let query = supabaseClient
        .from(TABLES.APPLICATIONS)
        .select('id, full_name, phone, email, city, availability, transportation, willing_outings, experience, why_work_with_seniors, resume_url, status, admin_notes, denial_reason, interview_datetime, created_at')
        .order('created_at', { ascending: false });
    
    // Only filter if a specific status is requested
    if (filters.status) {
        query = query.eq('status', filters.status);
        console.log('[CareHub] Filtering by status:', filters.status);
    } else {
        console.log('[CareHub] No status filter - fetching ALL applications');
    }
    
    console.log('[CareHub] Executing Supabase query...');
    const { data, error } = await query;
    
    if (error) {
        console.error('[CareHub] ERROR fetching applications:', error);
        console.error('[CareHub] Error details:', JSON.stringify(error));
        return [];
    }
    
    console.log('[CareHub] SUCCESS - Applications returned:', data ? data.length : 0);
    console.log('[CareHub] Data:', data);
    
    return data || [];
}

// Direct test function as requested
async function testDirectQuery() {
    console.log('[CareHub] === Direct Query Test ===');
    console.log('[CareHub] Using window.carehubSupabase:', !!window.carehubSupabase);
    
    if (!window.carehubSupabase) {
        console.error('[CareHub] window.carehubSupabase not available');
        return;
    }
    
    const { data, error } = await window.carehubSupabase
        .from(TABLES.APPLICATIONS)
        .select("*")
        .order("created_at", { ascending: false });
    
    console.log("Applications direct query:", data, error);
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

    console.log(`[CareHub] Updating application ${id} to status: ${status}`);

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

    console.log(`[CareHub] Application ${id} updated to ${status} successfully`);
    return true;
}

// ==================== CARE REQUESTS ====================

/**
 * Get all care requests with optional filtering
 * @param {Object} filters 
 * @returns {Promise<Array>}
 */
async function getCareRequests(filters = {}) {
    console.log('[CareHub] === Fetching Care Requests ===');
    console.log('[CareHub] Filters:', JSON.stringify(filters));

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
        console.log('[CareHub] Filtering by status:', filters.status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[CareHub] ERROR fetching care requests:', error);
        return [];
    }

    console.log('[CareHub] SUCCESS - Care requests returned:', data ? data.length : 0);
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

    console.log(`[CareHub] Updating care request ${id} to status: ${status}`);

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

    console.log(`[CareHub] Care request ${id} updated to ${status} successfully`);
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
    console.log('[CareHub] === Fetching Caregivers ===');
    console.log('[CareHub] Filters:', JSON.stringify(filters));

    if (!supabaseClient) {
        console.error('[CareHub] ERROR: Supabase client not initialized');
        return [];
    }

    let query = supabaseClient
        .from(TABLES.CAREGIVERS)
        .select('*')
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
        console.log('[CareHub] Filtering by status:', filters.status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[CareHub] ERROR fetching caregivers:', error);
        return [];
    }

    console.log('[CareHub] SUCCESS - Caregivers returned:', data ? data.length : 0);
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

    console.log('[CareHub] Creating caregiver from application:', application.id, application.full_name);

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
        pay_rate: 17,
        background_check_status: 'pending',
        training_status: 'pending',
        documents_status: 'pending',
        welcome_package_status: 'not_sent',
        // Admin notes for onboarding tracking
        notes: '',
        created_at: new Date().toISOString()
    };

    console.log('[CareHub] Inserting caregiver:', caregiver);

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

    console.log('[CareHub] Caregiver created successfully:', data);

    // Create notification
    console.log('[CareHub] Creating notification for new caregiver...');
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

    console.log('[CareHub] updateCaregiver called with id:', id);

    // Whitelist only columns that exist in caregivers table
    const allowedColumns = [
        'status',
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

    console.log('[CareHub] Filtered updates object:', filteredUpdates);

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

    console.log('[CareHub] Caregiver updated successfully');
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

    console.log('[CareHub] Creating client from care request:', careRequest.id, careRequest.requester_name);

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

    console.log('[CareHub] Inserting client:', client);

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

    console.log('[CareHub] Client created successfully:', data);

    // Update care request status to converted_to_client
    console.log('[CareHub] Updating care request status to converted_to_client...');
    const statusUpdated = await updateCareRequestStatus(careRequest.id, 'converted_to_client');
    if (!statusUpdated) {
        console.warn('[CareHub] Failed to update care request status, but client was created');
        return null;
    }

    // Create notification
    console.log('[CareHub] Creating notification for new client...');
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

    console.log('[CareHub] Creating notification:', notificationData);

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

    console.log('[CareHub] Notification created successfully:', data);
    return data;
}

/**
 * Get unread notifications
 * @returns {Promise<Array>}
 */
async function getUnreadNotifications() {
    if (!supabaseClient) return [];
    
    const { data, error } = await supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .select('*')
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
    
    return data || [];
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
 * Get dashboard statistics
 * @returns {Promise<Object>}
 */
async function getDashboardStats() {
    if (!supabaseClient) {
        return {
            newApplications: 0,
            pendingCareRequests: 0,
            totalCaregivers: 0,
            totalClients: 0,
            onboardingCaregivers: 0
        };
    }
    
    try {
        // Get counts in parallel
        const [
            { count: newApplications },
            { count: pendingCareRequests },
            { count: totalCaregivers },
            { count: totalClients },
            { count: onboardingCaregivers }
        ] = await Promise.all([
            supabaseClient.from(TABLES.APPLICATIONS).select('*', { count: 'exact', head: true }).eq('status', 'new'),
            supabaseClient.from(TABLES.CARE_REQUESTS).select('*', { count: 'exact', head: true }).eq('status', 'new'),
            supabaseClient.from(TABLES.CAREGIVERS).select('*', { count: 'exact', head: true }),
            supabaseClient.from(TABLES.CLIENTS).select('*', { count: 'exact', head: true }),
            supabaseClient.from(TABLES.CAREGIVERS).select('*', { count: 'exact', head: true }).eq('status', 'onboarding')
        ]);
        
        return {
            newApplications: newApplications || 0,
            pendingCareRequests: pendingCareRequests || 0,
            totalCaregivers: totalCaregivers || 0,
            totalClients: totalClients || 0,
            onboardingCaregivers: onboardingCaregivers || 0
        };
    } catch (e) {
        console.error('Error fetching dashboard stats:', e);
        return {
            newApplications: 0,
            pendingCareRequests: 0,
            totalCaregivers: 0,
            totalClients: 0,
            onboardingCaregivers: 0
        };
    }
}

// ==================== SCHEDULES ====================

/**
 * Get all schedules with optional filters
 * @param {Object} filters - Optional filters (date_from, date_to, status, caregiver_id, client_id)
 * @returns {Promise<Array>}
 */
async function getSchedules(filters = {}) {
    if (!supabaseClient) return [];

    let query = supabaseClient
        .from(TABLES.SCHEDULES)
        .select(`
            *,
            caregiver:caregivers!caregiver_id(name),
            client:clients!client_id(name, care_for)
        `)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

    if (filters.date_from) {
        query = query.gte('date', filters.date_from);
    }
    if (filters.date_to) {
        query = query.lte('date', filters.date_to);
    }
    if (filters.status) {
        query = query.eq('status', filters.status);
    }
    if (filters.caregiver_id) {
        query = query.eq('caregiver_id', filters.caregiver_id);
    }
    if (filters.client_id) {
        query = query.eq('client_id', filters.client_id);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[CareHub] Error fetching schedules:', error);
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

    console.log('[CareHub] Creating schedule:', schedule);

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

    console.log('[CareHub] Schedule created successfully:', data);
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

    console.log('[CareHub] updateSchedule called with id:', id);

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

    console.log('[CareHub] Filtered updates object:', filteredUpdates);

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

    console.log('[CareHub] Schedule updated successfully');
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

    console.log('[CareHub] Cancelling schedule:', id);

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

    console.log('[CareHub] Schedule cancelled successfully');
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
        getDashboardStats,
        getUnreadNotifications,
        createNotification
    };
}
