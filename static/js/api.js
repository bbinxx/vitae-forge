export const api = {
    async fetchConfig() {
        const res = await fetch('/get-config');
        if (res.status === 401) { return {}; }
        return await res.json();
    },
    async saveConfig(state) {
        const res = await fetch('/save-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });
        return res.ok;
    },
    async fetchFiles() {
        const res = await fetch('/list-files');
        if (res.status === 401) { return []; }
        return await res.json();
    },
    async uploadPhoto(file) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/upload-photo', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },
    async uploadPdfToCloud(filename) {
        const res = await fetch(`/upload/${filename}`);
        return await res.json();
    },
    async buildRole(role, onLineReceived) {
        const res = await fetch(`/build/${role}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            onLineReceived(decoder.decode(value));
        }
    },
    async scrapeJobUrl(url) {
        const res = await fetch('/applications/scrape-job-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Scrape failed');
        return data;
    }
};
