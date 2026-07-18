// Shared in-app dialog/toast helpers, replacing every native confirm()/
// alert() call across the app (the "localhost says ..." popup nobody wants).
// Loaded as a plain global script — window.confirmDialog / window.showToast.
(function () {
    function showToast(message, type) {
        const el = document.createElement('div');
        el.className = `alert alert-${type || 'info'}`;
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    function confirmDialog(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'ui-modal-overlay';

            const box = document.createElement('div');
            box.className = 'ui-modal';
            box.innerHTML =
                '<p class="ui-modal-message"></p>' +
                '<div class="ui-modal-actions">' +
                '<button type="button" class="btn btn-outline ui-modal-cancel">Cancel</button>' +
                '<button type="button" class="btn btn-danger ui-modal-confirm">Confirm</button>' +
                '</div>';
            box.querySelector('.ui-modal-message').textContent = message;
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            function close(result) {
                overlay.remove();
                resolve(result);
            }

            box.querySelector('.ui-modal-cancel').addEventListener('click', () => close(false));
            box.querySelector('.ui-modal-confirm').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });
            document.addEventListener('keydown', function onKey(e) {
                if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
            });
        });
    }

    function promptDialog(message, defaultValue) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'ui-modal-overlay';

            const box = document.createElement('div');
            box.className = 'ui-modal';
            box.innerHTML =
                '<p class="ui-modal-message"></p>' +
                '<input type="text" class="form-control ui-modal-input" />' +
                '<div class="ui-modal-actions">' +
                '<button type="button" class="btn btn-outline ui-modal-cancel">Cancel</button>' +
                '<button type="button" class="btn btn-primary ui-modal-confirm">OK</button>' +
                '</div>';
            box.querySelector('.ui-modal-message').textContent = message;
            const input = box.querySelector('.ui-modal-input');
            input.value = defaultValue || '';
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            input.focus();

            function close(result) {
                overlay.remove();
                resolve(result);
            }

            box.querySelector('.ui-modal-cancel').addEventListener('click', () => close(null));
            box.querySelector('.ui-modal-confirm').addEventListener('click', () => close(input.value));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') close(input.value);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(null);
            });
            document.addEventListener('keydown', function onKey(e) {
                if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(null); }
            });
        });
    }

    window.showToast = showToast;
    window.confirmDialog = confirmDialog;
    window.promptDialog = promptDialog;
})();
