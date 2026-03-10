// Background script to store taint reports
let taintReports = [];
let reportIds = new Set(); // Track report IDs to prevent duplicates

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TAINT_REPORT') {
    // Create a unique ID based on content and timestamp
    const reportContent = JSON.stringify(message.data);
    const uniqueId = `${message.url}_${reportContent}_${message.timestamp}`;
    
    // Check if we already have this report
    if (reportIds.has(uniqueId)) {
      console.log('Duplicate taint report ignored:', uniqueId);
      return;
    }
    
    // Add the report to our storage
    const report = {
      id: Date.now() + Math.random(),
      uniqueId: uniqueId,
      ...message.data,
      url: message.url,
      timestamp: message.timestamp,
      tabId: sender.tab.id
    };
    
    taintReports.push(report); // Add to end (oldest first)
    reportIds.add(uniqueId);
    
    // Keep only last 100 reports to prevent memory issues
    if (taintReports.length > 100) {
      const removedReport = taintReports.shift();
      reportIds.delete(removedReport.uniqueId);
    }
    
    console.log('Taint report stored:', report);
    
    // Update badge to show total number of reports across all tabs
    updateBadge();
  }
  
  if (message.type === 'GET_REPORTS') {
    sendResponse({reports: taintReports});
  }
  
  if (message.type === 'CLEAR_REPORTS') {
    taintReports = [];
    reportIds.clear();
    updateBadge();
    sendResponse({success: true});
  }
});

function updateBadge() {
  const totalReports = taintReports.length;
  
  if (totalReports === 0) {
    chrome.browserAction.setBadgeText({text: ''});
  } else if (totalReports > 99) {
    chrome.browserAction.setBadgeText({text: '99+'});
  } else {
    chrome.browserAction.setBadgeText({text: totalReports.toString()});
  }
  
  // Set badge color based on number of reports
  if (totalReports > 0) {
    chrome.browserAction.setBadgeBackgroundColor({color: '#e74c3c'}); // Red for alerts
  }
}