// Admin Training Progress Viewer
// ==============================
(function(){
    'use strict';

    async function renderTrainingAdmin() {
        if (!requireRole(['admin_owner','co_owner'])) return;
        const main = document.getElementById('mainContent');
        main.innerHTML = `
            <div class="training-admin animate-fade-in">
                <div class="th-header">
                    <h2>Training Progress — Admin</h2>
                    <div class="th-subtitle">All caregivers' Level 1 Orientation status</div>
                </div>
                <div style="margin-top:12px;display:flex;gap:8px;align-items:center;">
                    <select id="taFilter"><option value="all">All</option><option value="passed">Passed</option><option value="in_progress">In Progress</option><option value="failed">Failed</option><option value="not_started">Not Started</option></select>
                    <input id="taSearch" placeholder="Search name or email" style="padding:8px;border:1px solid var(--border-light);border-radius:8px;flex:1;" />
                    <button class="btn btn-primary" id="taReload">Reload</button>
                </div>
                <div id="taList" style="margin-top:12px;display:grid;gap:12px;"></div>
            </div>
        `;

        document.getElementById('taReload').addEventListener('click', loadList);
        document.getElementById('taFilter').addEventListener('change', loadList);
        document.getElementById('taSearch').addEventListener('input', debounce(loadList, 250));

        await loadList();
    }

    async function loadList() {
        const filter = document.getElementById('taFilter').value;
        const q = document.getElementById('taSearch').value.trim().toLowerCase();
        const container = document.getElementById('taList');
        container.innerHTML = 'Loading...';

        // Fetch caregivers
        const caregivers = await getCaregivers();
        // For each caregiver, fetch profile and training progress
        const rows = [];
        for (const cg of caregivers) {
            const profile = await window.getProfileByCaregiverId(cg.id);
            const userId = profile && profile.id ? profile.id : null;
            const progress = userId ? await window.getTrainingProgress(userId, 'level_1_orientation') : null;
            const status = progress ? (progress.status || 'in_progress') : 'not_started';
            const score = progress && typeof progress.score === 'number' ? progress.score : null;
            const attempts = progress && progress.attempts ? progress.attempts : 0;
            const sections = progress && progress.section_progress ? Object.keys(progress.section_progress).length : 0;
            rows.push({ caregiver: cg, profile, status, score, attempts, sections, started_at: progress && progress.started_at, completed_at: progress && progress.completed_at, last_accessed_at: progress && progress.last_accessed_at });
        }

        // Filter/search
        let filtered = rows.filter(r => {
            if (filter === 'passed' && r.status !== 'passed') return false;
            if (filter === 'in_progress' && r.status === 'not_started') return false;
            if (filter === 'failed' && r.status !== 'failed') return false;
            if (filter === 'not_started' && r.status !== 'not_started') return false;
            if (q) {
                const hay = `${r.caregiver.name || ''} ${r.caregiver.email || ''} ${r.profile?.email || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<div class="th-resource-card">No matching caregivers</div>';
            return;
        }

        container.innerHTML = '';
        filtered.forEach(r => {
            const card = document.createElement('div');
            card.className = 'th-resource-card';
            card.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;gap:12px;align-items:center;">
                        <div style="width:48px;height:48px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center"><i class="ph ph-user"></i></div>
                        <div>
                            <div style="font-weight:600">${esc(r.caregiver.name)} <span style="color:var(--text-secondary);font-weight:500">${esc(r.caregiver.email||'')}</span></div>
                            <div style="font-size:13px;color:var(--text-secondary)">Profile: ${esc(r.profile?.email||'--')}</div>
                        </div>
                    </div>
                    <div style="text-align:right;min-width:220px;">
                        <div><strong>Status:</strong> ${escStatus(r.status)}</div>
                        <div><strong>Score:</strong> ${r.score===null?'-':r.score+'%'}</div>
                        <div><strong>Attempts:</strong> ${r.attempts}</div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function esc(s){ return String(s||''); }
    function escStatus(s){
        if (s === 'not_started') return 'Not Started';
        if (s === 'in_progress') return 'In Progress';
        if (s === 'passed') return 'Passed';
        if (s === 'failed') return 'Failed';
        return s;
    }

    function debounce(fn, wait){ let t; return function(){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,arguments),wait); }}

    window.renderTrainingAdmin = renderTrainingAdmin;

})();
