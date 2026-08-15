/**
 * auth_interceptor.js
 * Universal Fetch Interceptor for Authentication & Error Handling.
 */

const originalFetch = window.fetch;
window.fetch = async function() {
    let [resource, config] = arguments;
    if (!config) {
        config = {};
    }
    if (!config.headers) {
        config.headers = {};
    }
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await originalFetch(resource, config);
        
        if (response.status === 401 && !window.location.pathname.includes('/login')) {
            if (window.notify) {
                window.notify.warning('Session expired. Redirecting to login...', 'Authentication Notice');
            }
            setTimeout(() => { window.location.href = '/login'; }, 1000);
        } else if (response.status === 422 || response.status === 400) {
            const clone = response.clone();
            clone.json().then(data => {
                const msg = data.detail || (data.errors && data.errors[0] ? data.errors[0].msg : null);
                if (msg && window.notify && !config.silentError) {
                    window.notify.warning(msg, 'Validation Warning');
                }
            }).catch(() => {});
        } else if (response.status >= 500) {
            const clone = response.clone();
            clone.json().then(data => {
                if (data.detail && window.notify && !config.silentError) {
                    window.notify.showErrorDialog('Server Error', data.detail, response.status);
                }
            }).catch(() => {
                if (window.notify && !config.silentError) {
                    window.notify.error(`Server error (HTTP ${response.status})`, 'Server Error');
                }
            });
        }
        return response;
    } catch (err) {
        if (window.notify && !config.silentError) {
            window.notify.warning('Failed to connect to server. Check your network or backend status.', 'Network Error');
        }
        throw err;
    }
};
