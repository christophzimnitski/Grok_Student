import { ChatApp } from './ChatApp.js';

function bootApp() {
    // Boot up the application and attach it to the window for debugging if needed
    window.app = new ChatApp();
}
// Ensure the DOM is fully loaded before trying to query elements
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApp);
} else {
    bootApp();
}

