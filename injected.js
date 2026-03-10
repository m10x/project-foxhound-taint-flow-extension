// This script runs in the page context to listen for taint events
(function() {
  // Prevent multiple injections
  if (window.foxhoundTaintMonitorInjected) {
    return;
  }
  window.foxhoundTaintMonitorInjected = true;
    
  window.addEventListener("__taintreport", (report) => {
    
    // Send the report to the content script
    window.postMessage({
      type: 'TAINT_REPORT',
      report: {
        detail: report.detail,
        str: report.detail.str,
        taint: report.detail.str.taint
      }
    }, '*');
  });
})();