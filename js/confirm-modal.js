/**
 * CareHub Confirmation Modal System
 * Professional in-app modals to replace browser confirm() and prompt()
 * 
 * Types: confirm, prompt, info
 */

(function() {
    'use strict';

    let modalOverlay = null;
    let isOpen = false;
    let resolvePromise = null;

    /**
     * Initialize modal container
     */
    function initModal() {
        if (modalOverlay) return;

        modalOverlay = document.createElement('div');
        modalOverlay.id = 'confirm-modal-overlay';
        modalOverlay.className = 'modal-overlay';
        modalOverlay.setAttribute('role', 'dialog');
        modalOverlay.setAttribute('aria-modal', 'true');
        modalOverlay.style.display = 'none';

        document.body.appendChild(modalOverlay);

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                closeModal(false);
            }
        });

        // Close on backdrop click
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal(false);
            }
        });
    }

    /**
     * Show confirmation modal
     * @param {object} options - Modal options
     * @returns {Promise<boolean>} User's choice
     */
    function showConfirm(options = {}) {
        initModal();

        const {
            title = 'Confirm Action',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            confirmClass = 'btn-primary',
            cancelClass = 'btn-secondary',
            icon = 'ph-question',
            iconColor = 'var(--primary)',
            danger = false
        } = options;

        if (danger) {
            confirmClass = 'btn-danger';
            icon = 'ph-warning';
            iconColor = 'var(--danger, #dc2626)';
        }

        return new Promise((resolve) => {
            resolvePromise = resolve;
            isOpen = true;

            modalOverlay.innerHTML = `
                <div class="confirm-modal" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-message">
                    <div class="confirm-modal-header">
                        <div class="confirm-modal-icon" style="color: ${iconColor}">
                            <i class="ph ${icon}"></i>
                        </div>
                        <h3 id="confirm-title" class="confirm-modal-title">${escapeHtml(title)}</h3>
                    </div>
                    <div class="confirm-modal-body">
                        <p id="confirm-message" class="confirm-modal-message">${escapeHtml(message)}</p>
                    </div>
                    <div class="confirm-modal-footer">
                        <button class="btn ${cancelClass}" id="confirm-cancel-btn">${escapeHtml(cancelText)}</button>
                        <button class="btn ${confirmClass}" id="confirm-ok-btn">${escapeHtml(confirmText)}</button>
                    </div>
                </div>
            `;

            modalOverlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            // Focus management
            const confirmBtn = modalOverlay.querySelector('#confirm-ok-btn');
            const cancelBtn = modalOverlay.querySelector('#confirm-cancel-btn');

            // Event handlers
            confirmBtn.addEventListener('click', () => closeModal(true));
            cancelBtn.addEventListener('click', () => closeModal(false));

            // Auto-focus confirm button
            setTimeout(() => confirmBtn.focus(), 100);
        });
    }

    /**
     * Show prompt modal (text input)
     * @param {object} options - Modal options
     * @returns {Promise<string|null>} User input or null if cancelled
     */
    function showPrompt(options = {}) {
        initModal();

        const {
            title = 'Enter Information',
            message = '',
            placeholder = '',
            defaultValue = '',
            confirmText = 'Submit',
            cancelText = 'Cancel',
            required = false,
            multiline = false,
            icon = 'ph-pencil-simple',
            iconColor = 'var(--primary)'
        } = options;

        return new Promise((resolve) => {
            resolvePromise = resolve;
            isOpen = true;

            const inputType = multiline ? 'textarea' : 'input';
            const inputAttrs = multiline 
                ? `rows="4" placeholder="${escapeHtml(placeholder)}"` 
                : `type="text" placeholder="${escapeHtml(placeholder)}"`;

            modalOverlay.innerHTML = `
                <div class="confirm-modal confirm-modal-prompt" role="alertdialog" aria-labelledby="prompt-title" aria-describedby="prompt-message">
                    <div class="confirm-modal-header">
                        <div class="confirm-modal-icon" style="color: ${iconColor}">
                            <i class="ph ${icon}"></i>
                        </div>
                        <h3 id="prompt-title" class="confirm-modal-title">${escapeHtml(title)}</h3>
                    </div>
                    <div class="confirm-modal-body">
                        ${message ? `<p id="prompt-message" class="confirm-modal-message">${escapeHtml(message)}</p>` : ''}
                        <${inputType} id="prompt-input" class="form-input" ${inputAttrs} value="${escapeHtml(defaultValue)}">${multiline ? '</textarea>' : ''}
                        ${required ? '<span class="input-required">Required</span>' : ''}
                    </div>
                    <div class="confirm-modal-footer">
                        <button class="btn btn-secondary" id="prompt-cancel-btn">${escapeHtml(cancelText)}</button>
                        <button class="btn btn-primary" id="prompt-ok-btn">${escapeHtml(confirmText)}</button>
                    </div>
                </div>
            `;

            modalOverlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            const input = modalOverlay.querySelector('#prompt-input');
            const confirmBtn = modalOverlay.querySelector('#prompt-ok-btn');
            const cancelBtn = modalOverlay.querySelector('#prompt-cancel-btn');

            // Event handlers
            confirmBtn.addEventListener('click', () => {
                const value = input.value.trim();
                if (required && !value) {
                    input.classList.add('input-error');
                    input.focus();
                    return;
                }
                closeModal(value);
            });

            cancelBtn.addEventListener('click', () => closeModal(null));

            // Submit on Enter (for single line)
            if (!multiline) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        confirmBtn.click();
                    }
                });
            }

            // Focus input
            setTimeout(() => {
                input.focus();
                if (defaultValue) {
                    input.select();
                }
            }, 100);
        });
    }

    /**
     * Show info modal (no buttons, just OK)
     * @param {object} options - Modal options
     * @returns {Promise<void>}
     */
    function showInfo(options = {}) {
        initModal();

        const {
            title = 'Information',
            message = '',
            okText = 'OK',
            icon = 'ph-info',
            iconColor = 'var(--primary)'
        } = options;

        return new Promise((resolve) => {
            resolvePromise = () => resolve();
            isOpen = true;

            modalOverlay.innerHTML = `
                <div class="confirm-modal" role="alertdialog" aria-labelledby="info-title" aria-describedby="info-message">
                    <div class="confirm-modal-header">
                        <div class="confirm-modal-icon" style="color: ${iconColor}">
                            <i class="ph ${icon}"></i>
                        </div>
                        <h3 id="info-title" class="confirm-modal-title">${escapeHtml(title)}</h3>
                    </div>
                    <div class="confirm-modal-body">
                        <p id="info-message" class="confirm-modal-message">${escapeHtml(message)}</p>
                    </div>
                    <div class="confirm-modal-footer" style="justify-content: center;">
                        <button class="btn btn-primary" id="info-ok-btn">${escapeHtml(okText)}</button>
                    </div>
                </div>
            `;

            modalOverlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            const okBtn = modalOverlay.querySelector('#info-ok-btn');
            okBtn.addEventListener('click', () => closeModal(true));

            setTimeout(() => okBtn.focus(), 100);
        });
    }

    /**
     * Close modal and resolve promise
     * @param {*} result - Result to return
     */
    function closeModal(result) {
        if (!isOpen) return;

        isOpen = false;
        modalOverlay.style.display = 'none';
        document.body.style.overflow = '';

        if (resolvePromise) {
            resolvePromise(result);
            resolvePromise = null;
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text
     * @returns {string}
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose globally
    window.CareHubConfirm = {
        confirm: showConfirm,
        prompt: showPrompt,
        info: showInfo
    };

})();
