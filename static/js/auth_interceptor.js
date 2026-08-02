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
    if (response.status === 401 && !window.location.pathname.includes('/login')) {
        // Redirect to login or handle unauthorized
        window.location.href = '/login';
    }
    return response;
};
