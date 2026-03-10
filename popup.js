document.addEventListener('DOMContentLoaded', function() {
  const reportsContainer = document.getElementById('reportsContainer');
  const noReports = document.getElementById('noReports');
  const reportCount = document.getElementById('reportCount');
  const filterInput = document.getElementById('filterInput');
  const clearBtn = document.getElementById('clearBtn');
  const openInTabBtn = document.getElementById('openInTabBtn');
  const uniqueCheckbox = document.getElementById('uniqueCheckbox');
  
  let allReports = [];
  let filteredReports = [];
  let expandedReports = new Set(); // Track which reports are expanded
  let uniqueFlowsOnly = false;
  let seenFlowCombinations = new Set();
  
  // Helper function to highlight tainted parts in any string
  // Limits context length around the tainted part and maximum length of the tainted part itself
  function highlightTaintedPart(text, taintedPart, highlightClass) {
    if (!text || !taintedPart) return escapeHtml(text || '');
    
    const textStr = String(text);
    const taintedIndex = textStr.indexOf(taintedPart);
    if (taintedIndex === -1) {
      return escapeHtml(textStr);
    }

    const MAX_CONTEXT = 200;
    const MAX_TAINTED = 5000;

    // Determine context window around the tainted part
    const taintedEndIndex = taintedIndex + taintedPart.length;
    const start = Math.max(0, taintedIndex - MAX_CONTEXT);
    const end = Math.min(textStr.length, taintedEndIndex + MAX_CONTEXT);

    let beforeRaw = textStr.substring(start, taintedIndex);
    let afterRaw = textStr.substring(taintedEndIndex, end);

    // If we cut off the beginning or end, indicate it with ellipsis
    if (start > 0) {
      beforeRaw = '…' + beforeRaw;
    }
    if (end < textStr.length) {
      afterRaw = afterRaw + '…';
    }

    // Limit length of the tainted part itself, shortening the middle if necessary
    let taintedDisplay = taintedPart;
    if (taintedDisplay.length > MAX_TAINTED) {
      const half = Math.floor(MAX_TAINTED / 2);
      const startPart = taintedDisplay.slice(0, half);
      const endPart = taintedDisplay.slice(taintedDisplay.length - half);
      taintedDisplay = `${startPart}…${endPart}`;
    }

    const before = escapeHtml(beforeRaw);
    const tainted = escapeHtml(taintedDisplay);
    const after = escapeHtml(afterRaw);

    return `${before}<span class="${highlightClass}">${tainted}</span>${after}`;
  }
  
  function loadReports() {
    chrome.runtime.sendMessage({type: 'GET_REPORTS'}, function(response) {
      // Full reload (e.g. on popup open or after "Clear")
      allReports = response.reports || [];
      filterReports();
    });
  }

  // Incremental refresh: only appends new reports without replacing existing DOM nodes
  function refreshReportsIncremental() {
    chrome.runtime.sendMessage({type: 'GET_REPORTS'}, function(response) {
      const newReports = response.reports || [];
      
      // If there is no base data yet, perform one full load
      if (allReports.length === 0 && newReports.length > 0) {
        allReports = newReports;
        filterReports();
        return;
      }

      // Map existing IDs to detect only truly new reports
      const existingIds = new Set(allReports.map(r => r.id));
      const addedReports = [];

      newReports.forEach(report => {
        if (!existingIds.has(report.id)) {
          allReports.push(report);
          addedReports.push(report);
        }
      });

      if (addedReports.length === 0) {
        return; // nothing new -> keep DOM and selections unchanged
      }

      const filterText = filterInput.value.toLowerCase();

      addedReports.forEach(report => {
        // Check whether the report matches the current filter
        const searchText = JSON.stringify(report).toLowerCase();
        const passesFilter = !filterText || searchText.includes(filterText);

        if (!passesFilter) {
          return;
        }

        filteredReports.push(report);

        // Hide "no reports" placeholder as soon as we display something
        noReports.style.display = 'none';

        const reportElement = createReportElement(report);
        reportsContainer.appendChild(reportElement);

        // Restore expanded state if necessary
        if (expandedReports.has(report.id)) {
          const details = document.getElementById(`details-${report.id}`);
          if (details) {
            reportElement.classList.add('expanded');
            details.classList.add('visible');
          }
        }
      });

      // After adding all matching reports, update the counter with current visible count
      const hasFilter = filterText.trim() !== '' || uniqueFlowsOnly;
      const total = allReports.length;
      const visible = filteredReports.length;
      reportCount.textContent = hasFilter
        ? `${total} reports (${visible} shown)`
        : `${total} reports`;
    });
  }
  
  function updateDisplay() {
    const total = allReports.length;
    const visible = filteredReports.length;
    const hasFilter = filterInput.value.trim() !== '' || uniqueFlowsOnly;
    reportCount.textContent = hasFilter
      ? `${total} reports (${visible} shown)`
      : `${total} reports`;
    
    if (filteredReports.length === 0) {
      reportsContainer.innerHTML = '';
      reportsContainer.appendChild(noReports);
      return;
    }
    
    noReports.style.display = 'none';
    reportsContainer.innerHTML = '';
    
    filteredReports.forEach(report => {
      const reportElement = createReportElement(report);
      reportsContainer.appendChild(reportElement);
      
      // Restore expanded state if it was previously expanded
      if (expandedReports.has(report.id)) {
        const details = document.getElementById(`details-${report.id}`);
        reportElement.classList.add('expanded');
        details.classList.add('visible');
      }
    });
  }
  
  function createReportElement(report) {
    const div = document.createElement('div');
    div.className = 'report-item';
    div.dataset.reportId = report.id;
    
    // Build taint summary for ALL flows of this report
    let taintSummaryHtml = '';
    if (report.taint && report.taint.length > 0) {
      const taintedString = report.str ? report.str.value || report.str : 'Unknown';
      
      report.taint.forEach((taintItem, index) => {
        // Get the tainted part from sink
        let taintedPart = '';
        if (taintedString && taintItem.begin !== undefined && taintItem.end !== undefined) {
          taintedPart = taintedString.substring(taintItem.begin, taintItem.end);
        }
        
        // Create highlighted sink string (yellow highlighting)
        let sinkStringHtml = highlightTaintedPart(taintedString, taintedPart, 'sink-highlight');
        // Determine sink operation from flow (flow is usually sink -> ... -> source)
        let sinkOperation = 'N/A';
        if (taintItem.flow && taintItem.flow.length > 0) {
          const first = taintItem.flow[0];
          const second = taintItem.flow.length > 1 ? taintItem.flow[1] : null;
          const firstIsWrapperSink = first && first.arguments && first.arguments.includes('ReportTaintSink');
          const sinkFlowItem = firstIsWrapperSink && second ? second : first;
          sinkOperation = (sinkFlowItem && sinkFlowItem.operation) ? String(sinkFlowItem.operation) : 'N/A';
        }
        
        // Get source string from flow and highlight the tainted part
        let sourceStringHtml = 'N/A';
        let sourceOperation = 'N/A';
        if (taintItem.flow && taintItem.flow.length > 0) {
          // Find the source operation (where source: true)
          const sourceFlow = taintItem.flow.find(flowItem => flowItem.source === true);
          if (sourceFlow) {
            sourceOperation = sourceFlow.operation ? String(sourceFlow.operation) : 'N/A';
            let foundHighlight = false;
            let bestMatch = null;
            
            // First check filename
            if (sourceFlow.location && sourceFlow.location.filename) {
              const filename = sourceFlow.location.filename;
              if (taintedPart && filename.indexOf(taintedPart) !== -1) {
                sourceStringHtml = highlightTaintedPart(filename, taintedPart, 'source-highlight');
                foundHighlight = true;
              } else if (!bestMatch) {
                bestMatch = filename;
              }
            }
            
            // Then check all arguments if not found in filename
            if (!foundHighlight && sourceFlow.arguments && sourceFlow.arguments.length > 0) {
              for (let i = 0; i < sourceFlow.arguments.length; i++) {
                const arg = String(sourceFlow.arguments[i] || '');
                if (arg && taintedPart && arg.indexOf(taintedPart) !== -1) {
                  sourceStringHtml = highlightTaintedPart(arg, taintedPart, 'source-highlight');
                  foundHighlight = true;
                  break;
                }
                // Keep track of the first non-empty argument as fallback
                if (!bestMatch && arg.trim()) {
                  bestMatch = arg;
                }
              }
            }
            
            // If not found anywhere, show the best available string
            if (!foundHighlight && bestMatch) {
              sourceStringHtml = escapeHtml(bestMatch);
            }
          }
        }
        
        const sinkLabel = index === 0 ? 'Tainted Sink:' : `<br>Tainted Sink ${index + 1}:`;
        const sourceLabel = index === 0 ? 'Tainted Source:' : `Tainted Source ${index + 1}:`;
        
        taintSummaryHtml += `
          <div class="taint-info">
            <span class="taint-label">${sinkLabel}</span> 
            <span class="taint-string">${sinkStringHtml}</span><span class="taint-label"> (${escapeHtml(sinkOperation)})</span>
          </div>
          <div class="taint-extract">
            <span class="taint-label">${sourceLabel}</span>
            <span class="taint-string">${sourceStringHtml}</span><span class="taint-label"> (${escapeHtml(sourceOperation)})</span>
          </div>
        `;
      });
    }
    
    div.innerHTML = `
      <div class="report-header clickable-header" data-report-id="${report.id}">
        <div class="report-url" title="${report.url}">${report.url}</div>
        <div class="report-time">${new Date(report.timestamp).toLocaleTimeString()}</div>
      </div>
      <div class="taint-summary clickable-header" data-report-id="${report.id}">
        ${taintSummaryHtml}
      </div>
      <div class="report-details" id="details-${report.id}">
        ${createDetailedView(report)}
      </div>
    `;
    
    // Add click handler only to the header elements
    const clickableHeaders = div.querySelectorAll('.clickable-header');
    clickableHeaders.forEach(header => {
      header.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent event bubbling
        const details = document.getElementById(`details-${report.id}`);
        const isExpanded = div.classList.contains('expanded');
        
        if (isExpanded) {
          // Collapse this report
          div.classList.remove('expanded');
          details.classList.remove('visible');
          expandedReports.delete(report.id);
        } else {
          // Expand this report
          div.classList.add('expanded');
          details.classList.add('visible');
          expandedReports.add(report.id);
        }
      });
    });
    
    return div;
  }
  
  function createDetailedView(report) {
    let html = '';
    
    // Add separate tainted parts section with color highlighting
    if (report.taint && report.taint.length > 0) {
      report.taint.forEach((taintItem, index) => {
        const taintedString = report.str ? report.str.value || report.str : '';
        
        // Get the tainted part from sink
        let taintedPart = '';
        if (taintedString && taintItem.begin !== undefined && taintItem.end !== undefined) {
          taintedPart = taintedString.substring(taintItem.begin, taintItem.end);
        }
        
        // Create highlighted sink string (yellow highlighting)
        let sinkStringHtml = highlightTaintedPart(taintedString, taintedPart, 'sink-highlight');
        // Determine sink operation from flow (flow is usually sink -> ... -> source)
        let sinkOperation = 'N/A';
        if (taintItem.flow && taintItem.flow.length > 0) {
          const first = taintItem.flow[0];
          const second = taintItem.flow.length > 1 ? taintItem.flow[1] : null;
          const firstIsWrapperSink = first && first.arguments && first.arguments.includes('ReportTaintSink');
          const sinkFlowItem = firstIsWrapperSink && second ? second : first;
          sinkOperation = (sinkFlowItem && sinkFlowItem.operation) ? String(sinkFlowItem.operation) : 'N/A';
        }
        
        // Get source string from flow and highlight the tainted part
        let sourceStringHtml = 'N/A';
        let sourceOperation = 'N/A';
        if (taintItem.flow && taintItem.flow.length > 0) {
          // Find the source operation (where source: true)
          const sourceFlow = taintItem.flow.find(flowItem => flowItem.source === true);
          if (sourceFlow) {
            sourceOperation = sourceFlow.operation ? String(sourceFlow.operation) : 'N/A';
            let foundHighlight = false;
            let bestMatch = null;
            
            // First check filename
            if (sourceFlow.location && sourceFlow.location.filename) {
              const filename = sourceFlow.location.filename;
              if (taintedPart && filename.indexOf(taintedPart) !== -1) {
                sourceStringHtml = highlightTaintedPart(filename, taintedPart, 'source-highlight');
                foundHighlight = true;
              } else if (!bestMatch) {
                bestMatch = filename;
              }
            }
            
            // Then check all arguments if not found in filename
            if (!foundHighlight && sourceFlow.arguments && sourceFlow.arguments.length > 0) {
              for (let i = 0; i < sourceFlow.arguments.length; i++) {
                const arg = String(sourceFlow.arguments[i] || '');
                if (arg && taintedPart && arg.indexOf(taintedPart) !== -1) {
                  sourceStringHtml = highlightTaintedPart(arg, taintedPart, 'source-highlight');
                  foundHighlight = true;
                  break;
                }
                // Keep track of the first non-empty argument as fallback
                if (!bestMatch && arg.trim()) {
                  bestMatch = arg;
                }
              }
            }
            
            // If not found anywhere, show the best available string
            if (!foundHighlight && bestMatch) {
              sourceStringHtml = escapeHtml(bestMatch);
            }
          }
        }
        
        html += `
          <div class="taint-strings-section">
            <h4>Taint Flow ${index + 1}:</h4>
            <div class="taint-string-item">
              <span class="taint-label">Tainted Sink:</span>
              <span class="taint-string-content">${sinkStringHtml}</span><span class="taint-label"> (${escapeHtml(sinkOperation)})</span>
            </div>
            <br>
            <div class="taint-string-item">
              <span class="taint-label">Tainted Source:</span>
              <span class="taint-string-content">${sourceStringHtml}</span><span class="taint-label"> (${escapeHtml(sourceOperation)})</span>
            </div>
          </div>
        `;
        
        // Flow Details with highlighted args
        html += `<h4>Flow Details ${index + 1}:</h4>`;
        
        if (taintItem.flow && taintItem.flow.length > 0) {
          // Reverse the flow to show source -> sink order
          const reversedFlow = [...taintItem.flow].reverse();
          
          reversedFlow.forEach((flowItem, flowIndex) => {
            const isSource = flowItem.source;
            
            // Check if this is a sink - but not if it has ReportTaintSink
            let isSink = false;
            if (flowIndex === reversedFlow.length - 1) {
              // If this is the last element, it's normally the sink
              // But not if it contains ReportTaintSink
              if (!(flowItem.arguments && flowItem.arguments.includes('ReportTaintSink'))) {
                isSink = true;
              }
            } else if (flowIndex === reversedFlow.length - 2) {
              // If this is the second-to-last element, check if the last one has ReportTaintSink
              const lastElement = reversedFlow[reversedFlow.length - 1];
              if (lastElement.arguments && lastElement.arguments.includes('ReportTaintSink')) {
                isSink = true; // This is the real sink
              }
            }
            
            // Create clickable location link if location exists
            let locationHtml = 'Unknown location';
            if (flowItem.location && flowItem.location.filename) {
              const filename = flowItem.location.filename;
              const line = flowItem.location.line || 1;
              const pos = flowItem.location.pos || 0;
              const viewSourceUrl = `view-source:${filename}#line${line}`;
              locationHtml = `<a href="${viewSourceUrl}" target="_blank" class="location-link" title="Open in view-source at line ${line}, position ${pos}">${filename}:${line}:${pos}</a>`;
            }
            
            html += `
              <div class="flow-item" style="border-left-color: ${isSource ? '#e74c3c' : isSink ? '#f39c12' : '#3498db'}">
                <div class="flow-operation">
                  ${isSource ? '🔴 SOURCE: ' : isSink ? '🟡 SINK: ' : '🔵 OP: '}${flowItem.operation}
                </div>
                <div class="flow-location">
                  ${locationHtml}
                </div>
                ${flowItem.arguments && flowItem.arguments.length > 0 ? 
                  `<div style="color: #666; font-size: 9px;">
                    <div style="margin-bottom: 2px;">Args:</div>
                    ${flowItem.arguments.map((arg, argIndex) => 
                      `<div style="margin-left: 10px; margin-bottom: 1px;">
                        <span style="color: #999;">[${argIndex}]:</span> 
                        <span style="font-family: monospace;">"${highlightTaintedPart(arg, taintedPart, 'sink-highlight')}"</span>
                      </div>`
                    ).join('')}
                  </div>` : ''}
              </div>
            `;
          });
        }
      });
    }
    
    html += '<h4>Raw Report:</h4>';
    html += `<pre style="background: white; padding: 5px; overflow-x: auto; font-size: 9px;">${escapeHtml(JSON.stringify(report, null, 2))}</pre>`;
    
    return html;
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function filterReports() {
    const filterText = filterInput.value.toLowerCase();
    filteredReports = [];
    seenFlowCombinations.clear();
    
    allReports.forEach(report => {
      const searchText = JSON.stringify(report).toLowerCase();
      const passesFilter = !filterText || searchText.includes(filterText);
      if (!passesFilter) {
        return;
      }

      if (uniqueFlowsOnly && report.taint && report.taint.length > 0) {
        const taintedString = report.str ? report.str.value || report.str : 'Unknown';
        let hasNewCombination = false;

        for (let i = 0; i < report.taint.length; i++) {
          const taintItem = report.taint[i];

          // Derive sink-related data
          let taintedPart = '';
          if (taintedString && taintItem.begin !== undefined && taintItem.end !== undefined) {
            taintedPart = taintedString.substring(taintItem.begin, taintItem.end);
          }
          const sinkStringHtml = highlightTaintedPart(taintedString, taintedPart, 'sink-highlight');

          let sinkOperation = 'N/A';
          if (taintItem.flow && taintItem.flow.length > 0) {
            const first = taintItem.flow[0];
            const second = taintItem.flow.length > 1 ? taintItem.flow[1] : null;
            const firstIsWrapperSink = first && first.arguments && first.arguments.includes('ReportTaintSink');
            const sinkFlowItem = firstIsWrapperSink && second ? second : first;
            sinkOperation = (sinkFlowItem && sinkFlowItem.operation) ? String(sinkFlowItem.operation) : 'N/A';
          }

          // Derive source-related data
          let sourceStringHtml = 'N/A';
          let sourceOperation = 'N/A';
          if (taintItem.flow && taintItem.flow.length > 0) {
            const sourceFlow = taintItem.flow.find(flowItem => flowItem.source === true);
            if (sourceFlow) {
              sourceOperation = sourceFlow.operation ? String(sourceFlow.operation) : 'N/A';
              let foundHighlight = false;
              let bestMatch = null;

              if (sourceFlow.location && sourceFlow.location.filename) {
                const filename = sourceFlow.location.filename;
                if (taintedPart && filename.indexOf(taintedPart) !== -1) {
                  sourceStringHtml = highlightTaintedPart(filename, taintedPart, 'source-highlight');
                  foundHighlight = true;
                } else if (!bestMatch) {
                  bestMatch = filename;
                }
              }

              if (!foundHighlight && sourceFlow.arguments && sourceFlow.arguments.length > 0) {
                for (let j = 0; j < sourceFlow.arguments.length; j++) {
                  const arg = String(sourceFlow.arguments[j] || '');
                  if (arg && taintedPart && arg.indexOf(taintedPart) !== -1) {
                    sourceStringHtml = highlightTaintedPart(arg, taintedPart, 'source-highlight');
                    foundHighlight = true;
                    break;
                  }
                  if (!bestMatch && arg.trim()) {
                    bestMatch = arg;
                  }
                }
              }

              if (!foundHighlight && bestMatch) {
                sourceStringHtml = escapeHtml(bestMatch);
              }
            }
          }

          const comboKey = JSON.stringify([sinkStringHtml, sinkOperation, sourceStringHtml, sourceOperation]);
          if (!seenFlowCombinations.has(comboKey)) {
            seenFlowCombinations.add(comboKey);
            hasNewCombination = true;
          }
        }

        if (!hasNewCombination) {
          return; // no new unique flow combinations in this report
        }
      }

      filteredReports.push(report);
    });
    
    updateDisplay();
  }
  
  // Event listeners
  filterInput.addEventListener('input', filterReports);
  
  if (uniqueCheckbox) {
    uniqueCheckbox.addEventListener('change', function() {
      uniqueFlowsOnly = uniqueCheckbox.checked;
      filterReports();
    });
  }
  
  clearBtn.addEventListener('click', function() {
    if (confirm('Clear all taint reports?')) {
      chrome.runtime.sendMessage({type: 'CLEAR_REPORTS'}, function() {
        expandedReports.clear(); // Clear expanded state when clearing reports
        loadReports();
      });
    }
  });
  
  openInTabBtn.addEventListener('click', function() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html')
    });
    // Close the popup after opening in tab
    window.close();
  });
  
  // Load reports on popup open
  loadReports();
  
  // Refresh every 2 seconds while popup is open (incremental to preserve selections and text search)
  setInterval(refreshReportsIncremental, 2000);
});