/**
 * notification_system.js
 * Universal Error & Warning Notification System for Resume Studio.
 * Handles Toasts, Modals, System Warnings, Network Errors, and Unhandled Rejections.
 */

class NotificationSystem {
    constructor() {
        this.container = null;
        this.initContainer();
        this.initGlobalListeners();
    }

    initContainer() {
        if (document.getElementById('global-toast-container')) {
            this.container = document.getElementById('global-toast-container');
            return;
        }
        const container = document.createElement('div');
        container.id = 'global-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 420px;
            width: calc(100vw - 40px);
            pointer-events: none;
        `;
        document.body.appendChild(container);
        this.container = container;
    }

    initGlobalListeners() {
        // Global JS Error listener
        window.addEventListener('error', (event) => {
            if (event.filename && event.filename.includes('extension')) return; // Ignore browser extension errors
            this.warning(`Runtime Notice: ${event.message}`, 'Script Warning');
        });

        // Global Unhandled Promise Rejection listener
        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason ? (event.reason.message || String(event.reason)) : 'Unhandled promise rejection';
            if (reason.includes('ResizeObserver') || reason.includes('canceled')) return;
            this.warning(`Async Operation Warning: ${reason}`, 'Async Warning');
        });

        // Network Status Listeners
        window.addEventListener('offline', () => {
            this.warning('Network connection lost. You are currently offline.', 'Network Status');
        });
        window.addEventListener('online', () => {
            this.success('Network connection restored.', 'Network Status');
        });
    }

    showToast(message, type = 'info', title = '', duration = 4500) {
        this.initContainer();

        const toast = document.createElement('div');
        toast.className = `sys-toast sys-toast-${type}`;
        toast.style.cssText = `
            pointer-events: auto;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
            background: var(--bg-card, #1e1e2e);
            border: 1.5px solid var(--border, #313244);
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
            color: var(--text-primary, #cdd6f4);
            font-family: inherit;
            font-size: 13px;
            line-height: 1.4;
            opacity: 0;
            transform: translateX(30px);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        const iconMap = {
            error: { icon: 'error', color: '#ef4444', border: '#ef4444' },
            warning: { icon: 'warning', color: '#f59e0b', border: '#f59e0b' },
            success: { icon: 'check_circle', color: '#10b981', border: '#10b981' },
            info: { icon: 'info', color: '#3b82f6', border: '#3b82f6' }
        };

        const config = iconMap[type] || iconMap.info;
        toast.style.borderColor = config.border;

        toast.innerHTML = `
            <span class="material-symbols-outlined" style="color:${config.color};font-size:20px;margin-top:1px">${config.icon}</span>
            <div style="flex:1;min-width:0">
                ${title ? `<div style="font-weight:600;font-size:13px;margin-bottom:2px;color:var(--text-primary,#fff)">${this.escapeHtml(title)}</div>` : ''}
                <div style="color:var(--text-muted,#bac2de);word-break:break-word">${this.escapeHtml(message)}</div>
            </div>
            <button class="sys-toast-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:0;display:flex;align-items:center;">
                <span class="material-symbols-outlined" style="font-size:16px">close</span>
            </button>
        `;

        const closeBtn = toast.querySelector('.sys-toast-close');
        closeBtn.onclick = () => this.dismissToast(toast);

        this.container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        if (duration > 0) {
            setTimeout(() => this.dismissToast(toast), duration);
        }
    }

    dismissToast(toast) {
        if (!toast || toast._dismissed) return;
        toast._dismissed = true;
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        setTimeout(() => toast.remove(), 300);
    }

    error(message, title = 'Error') {
        this.showToast(message, 'error', title, 6000);
    }

    warning(message, title = 'Warning') {
        this.showToast(message, 'warning', title, 5000);
    }

    success(message, title = 'Success') {
        this.showToast(message, 'success', title, 3500);
    }

    info(message, title = 'Notice') {
        this.showToast(message, 'info', title, 4000);
    }

    // Modal Error System for detailed diagnostics
    showErrorDialog(title, details, code = 500) {
        let modal = document.getElementById('sys-error-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'sys-error-modal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999999;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
            modal.innerHTML = `
                <div style="background:var(--bg-card,#1e1e2e);border:1.5px solid #ef4444;border-radius:12px;width:90%;max-width:540px;padding:24px;box-shadow:0 20px 40px rgba(0,0,0,0.6);display:flex;flex-direction:column;gap:16px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span class="material-symbols-outlined" style="color:#ef4444;font-size:24px">report_problem</span>
                        <h3 id="sys-err-title" style="margin:0;font-size:16px;font-weight:600;color:var(--text-primary,#fff);flex:1">System Alert</h3>
                        <span id="sys-err-code" style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.2);color:#ef4444;font-family:monospace">HTTP 500</span>
                    </div>
                    <div id="sys-err-body" style="font-size:13px;color:var(--text-muted);background:var(--bg-main,#11111b);padding:12px;border-radius:8px;border:1px solid var(--border);max-height:220px;overflow-y:auto;font-family:monospace;white-space:pre-wrap;line-height:1.4"></div>
                    <div style="display:flex;justify-content:flex-end;gap:10px;">
                        <button id="sys-err-copy" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;display:flex;align-items:center;gap:4px">
                            <span class="material-symbols-outlined" style="font-size:14px">content_copy</span> Copy Diagnostics
                        </button>
                        <button id="sys-err-close" class="btn btn-primary" style="font-size:12px;padding:6px 16px">Dismiss</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('sys-err-title').textContent = title || 'System Error';
        document.getElementById('sys-err-code').textContent = `CODE ${code}`;
        document.getElementById('sys-err-body').textContent = typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details);

        const copyBtn = document.getElementById('sys-err-copy');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(`[${title}] (Code ${code})\n${typeof details === 'object' ? JSON.stringify(details, null, 2) : details}`);
            this.success('Error diagnostics copied to clipboard');
        };

        const closeBtn = document.getElementById('sys-err-close');
        closeBtn.onclick = () => { modal.style.display = 'none'; };

        modal.style.display = 'flex';
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }
}

window.notify = new NotificationSystem();
window.toast = (msg, type = 'info') => {
    if (type === 'error') window.notify.error(msg);
    else if (type === 'warning' || type === 'warn') window.notify.warning(msg);
    else if (type === 'success') window.notify.success(msg);
    else window.notify.info(msg);
};
