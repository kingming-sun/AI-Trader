// API Configuration
// Auto-detects API endpoints based on environment

(function() {
    // Detect if running on Render or local
    const isRender = window.location.hostname !== 'localhost' && 
                     window.location.hostname !== '127.0.0.1';
    
    // Get current origin
    const origin = window.location.origin;
    
    // API base URLs
    // On Render, use proxy path (same origin)
    // On local, use direct localhost URLs
    const API_CONFIG = {
        strategyApi: isRender 
            ? `${origin}/api-proxy/strategy`
            : 'http://localhost:8005',
        configApi: isRender
            ? `${origin}/api-proxy/config`
            : 'http://localhost:8004'
    };
    
    // Make config available globally
    window.API_CONFIG = API_CONFIG;
    
    console.log('🌐 API Configuration:', API_CONFIG);
    console.log('📍 Environment:', isRender ? 'Render (Production)' : 'Local (Development)');
})();

