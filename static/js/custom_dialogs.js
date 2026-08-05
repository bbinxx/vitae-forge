// custom_dialogs.js
// Overrides native alert, confirm, prompt with custom modals that return Promises.

window._customDialogResolvers = {};

function createDialogOverlay() {
    let overlay = document.getElementById('custom-dialog-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'custom-dialog-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:999999;display:none;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
        
        const modal = document.createElement('div');
        modal.className = 'modal-content';
        modal.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;width:100%;max-width:400px;box-shadow:0 10px 30px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:16px;';
        
        const message = document.createElement('div');
        message.id = 'custom-dialog-message';
        message.style.cssText = 'font-size:14px;color:var(--text-primary);line-height:1.5;white-space:pre-wrap;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'custom-dialog-input';
        input.className = 'form-control';
        input.style.cssText = 'width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-main);color:var(--text-primary);display:none;';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;margin-top:8px;';
        
        const btnCancel = document.createElement('button');
        btnCancel.id = 'custom-dialog-cancel';
        btnCancel.className = 'btn btn-secondary';
        btnCancel.textContent = 'Cancel';
        
        const btnOk = document.createElement('button');
        btnOk.id = 'custom-dialog-ok';
        btnOk.className = 'btn btn-primary';
        btnOk.textContent = 'OK';
        
        btnCancel.onclick = () => closeCustomDialog(false);
        btnOk.onclick = () => {
            const isPrompt = document.getElementById('custom-dialog-input').style.display !== 'none';
            if (isPrompt) {
                closeCustomDialog(document.getElementById('custom-dialog-input').value);
            } else {
                closeCustomDialog(true);
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') btnOk.click();
            if (e.key === 'Escape') btnCancel.click();
        };

        buttonContainer.appendChild(btnCancel);
        buttonContainer.appendChild(btnOk);
        
        modal.appendChild(message);
        modal.appendChild(input);
        modal.appendChild(buttonContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }
    return overlay;
}

function showCustomDialog(type, msg, defaultText = '') {
    return new Promise(resolve => {
        const overlay = createDialogOverlay();
        window._customDialogResolver = resolve;
        
        document.getElementById('custom-dialog-message').innerHTML = msg.replace(/\n/g, '<br>');
        
        const input = document.getElementById('custom-dialog-input');
        const btnCancel = document.getElementById('custom-dialog-cancel');
        const btnOk = document.getElementById('custom-dialog-ok');
        
        if (type === 'alert') {
            input.style.display = 'none';
            btnCancel.style.display = 'none';
        } else if (type === 'confirm') {
            input.style.display = 'none';
            btnCancel.style.display = 'block';
        } else if (type === 'prompt') {
            input.style.display = 'block';
            input.value = defaultText || '';
            btnCancel.style.display = 'block';
        }
        
        overlay.style.display = 'flex';
        
        if (type === 'prompt') {
            input.focus();
        } else {
            btnOk.focus();
        }
    });
}

function closeCustomDialog(result) {
    const overlay = document.getElementById('custom-dialog-overlay');
    if (overlay) overlay.style.display = 'none';
    if (window._customDialogResolver) {
        window._customDialogResolver(result);
        window._customDialogResolver = null;
    }
}

window.alert = async function(msg) {
    await showCustomDialog('alert', msg);
};

window.confirm = async function(msg) {
    return await showCustomDialog('confirm', msg);
};

window.prompt = async function(msg, defaultText) {
    const res = await showCustomDialog('prompt', msg, defaultText);
    return res === false ? null : res;
};
