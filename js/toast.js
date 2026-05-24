/**
 * CareHub Toast Notification System
 * Professional in-app notifications to replace browser alert()
 * 
 * Types: success, error, warning, info
 * Auto-dismiss: success/info (5s), error (8s), warning (6s)
 */

(function() {
    'use strict';

    // Toast container
    let toastContainer = null;
    let toastId = 0;
    const activeToasts = new Map();

    // Default durations (ms)
    const DURATIONS = {
        success: 5000,
        error: 8000,
        warning: 6000,
        info: 5000
    };

    // Icons (Phosphor)
    const ICONS = {
        success: 'ph-check-circle',
        error: 'ph-x-circle',
        warning: 'ph-warning',
        info: 'ph-info'
    };

    /**
     * Initialize toast container
     */
    function initToastContainer() {
        if (toastContainer) return;

        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        toastContainer.setAttribute('aria-live', 'polite');
        toastContainer.setAttribute('aria-atomic', 'true');
        
        document.body.appendChild(toastContainer);
    }

    /**
     * Show a toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type: success, error, warning, info
     * @param {object} options - Optional settings
     * @returns {string} Toast ID
     */
    function showToast(message, type = 'info', options = {}) {
        initToastContainer();

        const id = `toast-${++toastId}`;
        const duration = options.duration || DURATIONS[type] || DURATIONS.info;
        const showClose = options.showClose !== false;

        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="ph ${ICONS[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            ${showClose ? `
                <button class="toast-close" aria-label="Close notification">
                    <i class="ph ph-x"></i>
                </button>
            ` : ''}
            <div class="toast-progress">
                <div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div>
            </div>
        `;

        // Add to container
        toastContainer.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });

        // Store reference
        activeToasts.set(id, {
            element: toast,
            timeout: null
        });

        // Close button handler
        if (showClose) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => dismissToast(id));
        }

        // Auto dismiss
        const timeout = setTimeout(() => dismissToast(id), duration);
        activeToasts.get(id).timeout = timeout;

        // Limit max toasts
        if (activeToasts.size > 5) {
            const firstId = activeToasts.keys().next().value;
            dismissToast(firstId);
        }

        return id;
    }

    /**
     * Dismiss a toast
     * @param {string} id - Toast ID
     */
    function dismissToast(id) {
        const toast = activeToasts.get(id);
        if (!toast) return;

        clearTimeout(toast.timeout);
        toast.element.classList.remove('toast-show');
        toast.element.classList.add('toast-hide');

        setTimeout(() => {
            if (toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
            activeToasts.delete(id);
        }, 300);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text
     * @returns {string}
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Convenience methods
    const toast = {
        success: (message, options) => showToast(message, 'success', options),
        error: (message, options) => showToast(message, 'error', options),
        warning: (message, options) => showToast(message, 'warning', options),
        info: (message, options) => showToast(message, 'info', options),
        dismiss: dismissToast,
        // Clear all toasts
        clear: () => {
            activeToasts.forEach((toast, id) => dismissToast(id));
        }
    };

    // Expose globally
    window.CareHubToast = toast;
    window.showToast = showToast;

})();
