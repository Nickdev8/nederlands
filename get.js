// loader.js

(() => {
    const SCRIPT_URL = 'https://38406.hosts2.ma-cloud.nl/taalblokkenai/main.js';

    /**
     * Fetches the remote script as plain text.
     * @returns {Promise<string>}
     */
    async function fetchRemoteScript() {
        const res = await fetch(SCRIPT_URL, { cache: 'no-cache' });
        if (!res.ok) {
            throw new Error(`Failed to load script (${res.status}): ${res.statusText}`);
        }
        return res.text();
    }

    /**
     * Executes a string of JavaScript code in the page’s global context.
     * @param {string} code
     */
    function executeScript(code) {
        // Option A: eval in this scope
        // eval(code);

        // Option B: inject a <script> tag into <head> (global scope)
        const scriptEl = document.createElement('script');
        scriptEl.type = 'text/javascript';
        scriptEl.text = code;
        document.head.appendChild(scriptEl);
    }

    // Kick things off
    fetchRemoteScript()
        .then(code => {
            console.log(`✅ Successfully fetched script from ${SCRIPT_URL}`);
            executeScript(code);
            console.log(`🚀 Script executed.`);
        })
        .catch(err => {
            console.error(`❌ Error loading or executing script:`, err);
        });

})();
