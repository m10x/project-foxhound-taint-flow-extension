// Content script to inject the taint listener into the page
(function() {
  // Inject the script that will listen for taint events
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  // Listen for messages from the injected script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    
    if (event.data.type === 'TAINT_REPORT') {
      // Forward the taint report to the background script
      chrome.runtime.sendMessage({
        type: 'TAINT_REPORT',
        data: event.data.report,
        url: window.location.href,
        timestamp: Date.now()
      });
    }
  });
})();