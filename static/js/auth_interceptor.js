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
    const response = await originalFetch(resource, config);
    if (response.status === 401) {
        const path = window.location.pathname;
        if (path === '/login') {
            return response;
        }
        localStorage.removeItem('token');
        window.location.href = '/login';
        return response;
    }
    return response;
};
