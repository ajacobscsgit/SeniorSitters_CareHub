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
    
    const updates = {
        status: status,
        admin_notes: notes,
        updated_at: new Date().toISOString()
    };
    
    if (status === 'approved') {
        updates.approved_at = new Date().toISOString();
    }
    
    const { error } = await supabaseClient
        .from(TABLES.APPLICATIONS)
        .update(updates)
        .eq('id', id);
    
    if (error) {
        console.error('Error updating application:', error);
        return false;
    }
    
    return true;
}

// ==================== CARE REQUESTS ====================

/**
 * Get all care requests with optional filtering
 * @param {Object} filters 
 * @returns {Promise<Array>}
 */
async function getCareRequests(filters = {}) {
    if (!supabaseClient) return [];
    
    let query = supabaseClient
        .from(TABLES.CARE_REQUESTS)
        .select('*')
        .order('created_at', { ascending: false });
    
    if (filters.status) {
        query = query.eq('status', filters.status);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching care requests:', error);
        return [];
    }
    
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

/**
 * Update care request status
 * @param {string} id 
 * @param {string} status 
 * @param {string} notes 
 * @returns {Promise<boolean>}
 */
async function updateCareRequestStatus(id, status, notes = '') {
    if (!supabaseClient) return false;
    
    const updates = {
        status: status,
        admin_notes: notes,
        updated_at: new Date().toISOString()
    };
    
    if (status === 'approved') {
        updates.approved_at = new Date().toISOString();
    }
    
    const { error } = await supabaseClient
        .from(TABLES.CARE_REQUESTS)
        .update(updates)
        .eq('id', id);
    
    if (error) {
        console.error('Error updating care request:', error);
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
    if (!supabaseClient) return [];
    
    let query = supabaseClient
        .from(TABLES.CAREGIVERS)
        .select('*')
        .order('created_at', { ascending: false });
    
    if (filters.status) {
        query = query.eq('status', filters.status);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching caregivers:', error);
        return [];
    }
    
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
    
    // Map actual application fields to caregiver fields
    const caregiver = {
        name: application.full_name,
        phone: application.phone,
        email: application.email,
        city: application.city,
        availability: application.availability,
        transportation: application.transportation,
        willing_outings: application.willing_outings,
        application_id: application.id,
        status: 'onboarding',
        pay_rate: 17,
        background_check_status: 'pending',
        training_status: 'pending',
        documents_status: 'pending',
        welcome_package_status: 'not_sent',
        notes: `Created from application ${application.id}.\n\nExperience: ${application.experience || 'Not provided'}\n\nWhy work with seniors: ${application.why_work_with_seniors || 'Not provided'}`,
        created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabaseClient
        .from(TABLES.CAREGIVERS)
        .insert([caregiver])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating caregiver:', error);
        return null;
    }
    
    // Create notification
    await createNotification({
        type: 'caregiver_created',
        title: 'New Caregiver Onboarding',
        message: `${caregiver.name} has been added as a new caregiver (onboarding).`,
        related_id: data.id,
        related_type: 'caregiver'
    });
    
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
    
    updates.updated_at = new Date().toISOString();
    
    const { error } = await supabaseClient
        .from(TABLES.CAREGIVERS)
        .update(updates)
        .eq('id', id);
    
    if (error) {
        console.error('Error updating caregiver:', error);
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
    
    const client = {
        first_name: careRequest.first_name,
        last_name: careRequest.last_name,
        email: careRequest.email,
        phone: careRequest.phone,
        address: careRequest.address,
        city: careRequest.city,
        state: careRequest.state,
        zip: careRequest.zip,
        status: 'active',
        care_request_id: careRequest.id,
        care_needs: careRequest.care_needs || '',
        schedule_preference: careRequest.schedule_preference || '',
        budget_range: careRequest.budget_range || '',
        start_date: careRequest.start_date,
        notes: `Created from care request ${careRequest.id}. ${careRequest.additional_notes || ''}`,
        created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabaseClient
        .from(TABLES.CLIENTS)
        .insert([client])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating client:', error);
        return null;
    }
    
    // Create notification
    await createNotification({
        type: 'client_created',
        title: 'New Client Added',
        message: `${client.first_name} ${client.last_name} has been added as a new client.`,
        related_id: data.id,
        related_type: 'client'
    });
    
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
    
    const { data, error } = await supabaseClient
        .from(TABLES.NOTIFICATIONS)
        .insert([notificationData])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating notification:', error);
        return null;
    }
    
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
            supabaseClient.from(TABLES.CARE_REQUESTS).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getApplications,
        getApplicationById,
        updateApplicationStatus,
        getCareRequests,
        getCareRequestById,
        updateCareRequestStatus,
        getCaregivers,
        getCaregiverById,
        createCaregiverFromApplication,
        updateCaregiver,
        getClients,
        getClientById,
        createClientFromCareRequest,
        updateClient,
        getDashboardStats,
        getUnreadNotifications,
        createNotification
    };
}
