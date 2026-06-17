// SeniorSitters CareHub - Training Hub (Level 1 Orientation)
// ===========================================================

(function(){
    'use strict';

    const MODULE_ID = 'level_1_orientation';
    const MODULE_NAME = 'Level 1 Orientation';

    const SECTIONS = [
        { id: 'welcome_video', title: 'Welcome Video', description: 'Welcome to SeniorSitters. This short orientation explains who we are, what we do, and how caregivers use CareHub.' },
        { id: 'company_mission', title: 'Company Mission', description: 'SeniorSitters is a family-owned, non-medical companion care company serving seniors and families throughout Northeast Ohio. We support dignity, independence, companionship, and family peace of mind.' },
        { id: 'scope_do', title: 'Scope: What We Do', description: 'Companionship\nFriendly conversation\nGames, puzzles, reading, hobbies\nErrands and grocery support\nAppointment accompaniment\nCommunity outings\nMeal reminders and light meal help\nLight household support\nFamily updates\nRespite support' },
        { id: 'scope_not', title: 'Scope: What We Do NOT Do', description: 'No medical care\nNo medication administration\nNo injections\nNo wound care\nNo diagnosis\nNo nursing services\nNo emergency medical services\nNo heavy lifting outside company policy\nNo accepting money, loans, or personal gifts from clients' },
        { id: 'professional_expectations', title: 'Professional Expectations', description: 'Arrive on time\nDress professionally\nSpeak respectfully\nFollow the care plan\nMaintain confidentiality\nReport concerns promptly\nComplete visit documentation\nCommunicate schedule issues early' },
        { id: 'carehub_overview', title: 'CareHub Overview', description: 'Dashboard\nSchedule\nClient notes\nTimesheets\nMileage\nVisit updates\nMessages or announcements\nProfile and availability' },
        { id: 'visit_workflow', title: 'Before, During, and After Visits', description: 'Before visit:\n- Check schedule\n- Review client notes\n- Confirm location/time\n- Prepare for outing if applicable\n\nDuring visit:\n- Provide companionship\n- Follow client preferences and care plan\n- Observe concerns\n- Stay within non-medical scope\n\nAfter visit:\n- Submit visit update\n- Submit timesheet\n- Submit approved mileage\n- Report urgent concerns' },
        { id: 'confidentiality', title: 'Confidentiality and Boundaries', description: 'Client information is private\nDo not share addresses, phone numbers, health details, family matters, photos, or personal information\nDo not post about clients on social media\nDo not accept private side payments\nDo not give personal medical, legal, or financial advice' },
        { id: 'emergency', title: 'Emergency and Concern Reporting', description: 'For medical emergencies, call 911 first\nThen notify SeniorSitters management\nReport falls, confusion, unsafe home conditions, missed visits, client distress, family concerns, or suspected abuse/neglect immediately' }
    ];

    const QUIZ_QUESTIONS = [
        { id: 'q1', q: 'Is SeniorSitters a medical care provider?', choices: ['Yes','No'], answer: 1 },
        { id: 'q2', q: 'Can caregivers administer medication?', choices: ['Yes','No'], answer: 1 },
        { id: 'q3', q: 'When should visit updates be submitted?', choices: ['Before each visit','During visit','After each visit','Weekly'], answer: 2 },
        { id: 'q4', q: 'What should a caregiver do first in a medical emergency?', choices: ['Notify SeniorSitters management','Call 911','Wait for family','Transport client to hospital'], answer: 1 },
        { id: 'q5', q: 'Where should caregivers submit hours worked?', choices: ['Email admin','Paper timesheets','Timesheets in CareHub','Direct deposit form'], answer: 2 },
        { id: 'q6', q: 'Can caregivers post client photos or details online?', choices: ['Yes','No'], answer: 1 },
        { id: 'q7', q: 'What should caregivers review before a visit?', choices: ['Schedule and client notes','Only the address','Pay rate','Nothing'], answer: 0 },
        { id: 'q8', q: 'What type of care does SeniorSitters provide?', choices: ['Medical nursing care','Non-medical companion care','Surgical care','Pharmacy services'], answer: 1 }
    ];

    // Minimum passing percentage
    const PASS_PERCENT = 80;

    // Utilities
    function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function showAlert(msg, type) {
        if (typeof window.showAlert === 'function') return window.showAlert(msg, type);
        if (typeof window.showToast === 'function') return window.showToast(msg, type === 'error' ? 'error' : 'success');
        try { alert(msg); } catch (e) { console.log(type || 'info', msg); }
    }

    // Flag to prevent re-entrant renders
    let _rendering = false;

    // Render the training hub module
    async function renderTrainingHubPage() {
        // Prevent recursive re-entry
        if (_rendering) return;
        _rendering = true;

        // Require auth/role — but do NOT redirect away from training-hub
        const role = typeof getCurrentRole === 'function' ? getCurrentRole() : null;
        const allowed = ['admin_owner','co_owner','caregiver'];
        if (!role || !allowed.includes(role)) {
            _rendering = false;
            return;
        }

        const main = document.getElementById('mainContent');
        main.innerHTML = `
            <div class="training-hub animate-fade-in">
                <div class="th-header">
                    <h2>Training Hub</h2>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <div class="th-subtitle">Module: ${MODULE_NAME} — Audience: New SeniorSitters caregivers</div>
                        ${isOwner() || isCoOwner() ? '<button class="btn btn-secondary" id="thAdminViewBtn">Admin: View All Progress</button>' : ''}
                    </div>
                </div>
                <div class="th-layout" style="display:grid;grid-template-columns:320px 1fr;gap:16px;align-items:start;">
                    <aside class="th-sidebar">
                        <div class="th-progress-card th-module-card">
                            <h3>Progress</h3>
                            <div id="thProgressList"></div>
                            <div style="margin-top:12px;">
                                <button class="btn btn-primary" id="thStartQuizBtn">Start Quiz</button>
                                <div id="thQuizStatus" style="margin-top:8px;font-size:13px;color:var(--text-secondary);"></div>
                            </div>
                        </div>
                    </aside>

                    <section class="th-main">
                        <div id="thSections" class="th-module-grid"></div>
                        <div id="thQuizCard" style="margin-top:16px; display:none;"></div>
                        <div id="thResultCard" style="margin-top:16px; display:none;"></div>
                    </section>
                </div>
            </div>
        `;

        // Load existing progress
        const session = getSession();
        const userId = (session && session.id) ? session.id : (session && session.email ? session.email : null);
        let progress = null;
        try {
            progress = await window.getTrainingProgress(userId, MODULE_ID);
        } catch (e) { console.warn('Could not load training progress', e); }

        const sectionProgress = (progress && progress.section_progress) ? progress.section_progress : {};

        // Render section cards
        const container = document.getElementById('thSections');
        const progressList = document.getElementById('thProgressList');

        SECTIONS.forEach(sec => {
            const done = !!sectionProgress[sec.id];
            const card = document.createElement('div');
            card.className = 'th-module-card';
            card.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;">
                    <div class="th-module-icon"><i class="ph ph-book"></i></div>
                    <div style="flex:1;">
                        <div style="font-weight:600">${escHtml(sec.title)}</div>
                        <div class="th-content-body">${escHtml(sec.description)}</div>
                    </div>
                    <div style="margin-left:12px;text-align:right;min-width:110px;">
                        <button class="btn btn-secondary btn-sm th-mark-complete" data-section="${sec.id}" ${done? 'disabled':''}>${done? 'Completed':'Mark Complete'}</button>
                    </div>
                </div>
            `;
            container.appendChild(card);

            // Progress list entry
            const li = document.createElement('div');
            li.className = 'th-checklist-row' + (done? ' th-checklist-done':'');
            li.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><span class="th-status-dot" style="background:${done? '#16a34a':'#d1d5db'}"></span><div style="font-size:14px;">${escHtml(sec.title)}</div></div>`;
            progressList.appendChild(li);
        });

        // Hook mark complete buttons
        container.querySelectorAll('.th-mark-complete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sectionId = btn.dataset.section;
                btn.disabled = true;
                btn.textContent = 'Completed';
                const now = new Date().toISOString();
                sectionProgress[sectionId] = { completed_at: now };
                await saveProgress({ section_progress: sectionProgress, userId });
                // Update sidebar dot in-place — no full re-render
                const allDots = document.querySelectorAll('#thProgressList .th-checklist-row .th-status-dot');
                const secIndex = SECTIONS.findIndex(s => s.id === sectionId);
                if (secIndex >= 0 && allDots[secIndex]) {
                    allDots[secIndex].style.background = '#16a34a';
                    allDots[secIndex].closest('.th-checklist-row')?.classList.add('th-checklist-done');
                }
            });
        });

        // Quiz button
        document.getElementById('thStartQuizBtn').addEventListener('click', () => {
            showQuizCard();
        });

        // Admin view button
        const adminBtn = document.getElementById('thAdminViewBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                if (typeof renderTrainingAdmin === 'function') {
                    renderTrainingAdmin();
                } else {
                    showAlert('Admin view not available.','error');
                }
            });
        }

        // Show quiz status
        const quizStatus = document.getElementById('thQuizStatus');
        if (quizStatus) {
            if (progress && progress.status === 'passed') {
                quizStatus.innerHTML = `Module completed &bull; Score: ${progress.score}%`;
                showCertificate(progress.score);
            } else if (progress && progress.status === 'failed') {
                quizStatus.innerHTML = `Quiz attempted &bull; Last score: ${progress.score}% &bull; Attempts: ${progress.attempts || 0}`;
            } else if (progress && progress.attempts) {
                quizStatus.innerHTML = `Quiz attempts: ${progress.attempts}`;
            }
        }

        _rendering = false;
    }

    async function saveProgress({ section_progress = {}, userId }) {
        const session = getSession();
        const uid = (session && session.id) ? session.id : (session && session.email ? session.email : userId);
        if (!uid) return;
        const now = new Date().toISOString();
        const payload = {
            user_id: uid,
            module_id: MODULE_ID,
            module_name: MODULE_NAME,
            section_progress: section_progress,
            last_accessed_at: now,
            started_at: now
        };
        try {
            await window.upsertTrainingProgress(payload);
        } catch (e) {
            console.error('Error saving training progress', e);
            showAlert('Could not save training progress. Your progress will not be lost — try again when online.','error');
        }
    }

    function showQuizCard() {
        const quizCard = document.getElementById('thQuizCard');
        quizCard.style.display = 'block';
        quizCard.innerHTML = `
            <div class="th-resource-card">
                <h3>Level 1 Quiz</h3>
                <div id="quizQuestions"></div>
                <div style="margin-top:12px;display:flex;gap:8px;align-items:center;"><button class="btn btn-primary" id="submitQuizBtn">Submit Quiz</button><div id="quizMessage" style="font-size:13px;color:var(--text-secondary);"></div></div>
            </div>
        `;

        const qContainer = document.getElementById('quizQuestions');
        QUIZ_QUESTIONS.forEach((q,i) => {
            const qDiv = document.createElement('div');
            qDiv.style.marginBottom = '12px';
            qDiv.innerHTML = `<div style="font-weight:600;margin-bottom:6px;">${i+1}. ${escHtml(q.q)}</div>`;
            q.choices.forEach((c,ci) => {
                const id = `quiz_${q.id}_${ci}`;
                qDiv.innerHTML += `<label style="display:block;margin-bottom:4px;"><input type="radio" name="${q.id}" value="${ci}" /> ${escHtml(c)}</label>`;
            });
            qContainer.appendChild(qDiv);
        });

        document.getElementById('submitQuizBtn').addEventListener('click', async () => {
            const answers = {};
            let answeredCount = 0;
            QUIZ_QUESTIONS.forEach(q => {
                const val = document.querySelector(`input[name="${q.id}"]:checked`);
                if (val) { answers[q.id] = parseInt(val.value,10); answeredCount++; }
            });
            if (answeredCount < QUIZ_QUESTIONS.length) {
                document.getElementById('quizMessage').textContent = 'Please answer all questions before submitting.';
                return;
            }

            // Grade
            let correct = 0;
            QUIZ_QUESTIONS.forEach(q => { if (answers[q.id] === q.answer) correct++; });
            const score = Math.round((correct / QUIZ_QUESTIONS.length) * 100);
            const passed = score >= PASS_PERCENT;

            // Save result
            const session = getSession();
            const uid = (session && session.id) ? session.id : (session && session.email ? session.email : null);
            if (!uid) {
                showAlert('You must be signed in to submit the quiz','error');
                return;
            }

            // Fetch existing progress to update attempts
            let prev = null;
            try { prev = await window.getTrainingProgress(uid, MODULE_ID); } catch(e) { prev = null; }
            const attempts = ((prev && prev.attempts) ? prev.attempts : 0) + 1;
            const now = new Date().toISOString();
            const payload = {
                user_id: uid,
                module_id: MODULE_ID,
                module_name: MODULE_NAME,
                status: passed ? 'passed' : 'failed',
                score: score,
                attempts: attempts,
                started_at: prev && prev.started_at ? prev.started_at : now,
                completed_at: passed ? now : null,
                last_accessed_at: now,
                section_progress: prev && prev.section_progress ? prev.section_progress : {}
            };

            const res = await window.upsertTrainingProgress(payload);
            if (!res) {
                showAlert('Could not save quiz results. Please try again.','error');
                return;
            }

            // Show results in-place — no full re-render (prevents loop)
            const quizCard = document.getElementById('thQuizCard');
            if (quizCard) quizCard.style.display = 'none';
            const resultCard = document.getElementById('thResultCard');
            resultCard.style.display = 'block';
            resultCard.innerHTML = `
                <div class="th-resource-card">
                    <h3>Quiz Results</h3>
                    <div style="font-size:16px;font-weight:600;margin-bottom:8px;">You scored ${score}% — ${passed ? 'Pass' : 'Fail'}</div>
                    <div style="margin-bottom:12px;color:var(--text-secondary)">Correct: ${correct} / ${QUIZ_QUESTIONS.length}</div>
                    ${passed ? '<div class="th-badge th-badge-required">Certificate Earned</div>' : '<div style="color:#b45309">You may retake the quiz.</div>'}
                    <div style="margin-top:12px;"><button class="btn btn-primary" id="retakeQuizBtn">Retake Quiz</button></div>
                </div>
            `;

            // Update quiz status label in-place
            const qs = document.getElementById('thQuizStatus');
            if (qs) qs.innerHTML = passed
                ? `Module completed &bull; Score: ${score}%`
                : `Quiz attempted &bull; Last score: ${score}% &bull; Attempts: ${attempts}`;

            if (passed) showCertificate(score);

            document.getElementById('retakeQuizBtn').addEventListener('click', () => {
                showQuizCard();
                resultCard.style.display = 'none';
            });
        });
    }

    function showCertificate(score) {
        const certHtml = `
            <div class="th-resource-card" style="margin-top:16px;background:linear-gradient(90deg,#ffffff,#f7fffb);">
                <h3>Completion Certificate</h3>
                <div style="font-size:18px;font-weight:700;color:var(--status-approved);">${MODULE_NAME} — Completed</div>
                <div style="margin-top:8px;color:var(--text-secondary)">Score: ${score}%</div>
                <div style="margin-top:12px">Congratulations! You have completed the Level 1 Orientation.</div>
            </div>
        `;
        const rc = document.getElementById('thResultCard');
        if (rc) { rc.innerHTML = certHtml; rc.style.display = 'block'; }
    }

    // Export as a distinct name — app.js owns 'renderTrainingHub' for the
    // new DB-driven Training Hub. This file's Level-1 orientation page is
    // exposed as renderTrainingHubPage so loadPage('training-hub') can call
    // whichever version is appropriate.
    window.renderTrainingHubPage = renderTrainingHubPage;

    // Only set renderTrainingHub if app.js has NOT already defined it
    // (app.js loads AFTER training-hub.js, so this will be overwritten — that's fine).
    if (typeof window.renderTrainingHub === 'undefined') {
        window.renderTrainingHub = renderTrainingHubPage;
    }

})();
