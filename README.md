# Foxhound Taint Flow Monitor

A Firefox browser extension for monitoring and visualizing taint flows from SAP Project Foxhound.

## Features

- 🦊 Automatic detection of `__taintreport` events
- 📊 Clear overview of all taint flows
- 🔍 Filterable list by URL, operation, or taint data
- 📱 Detailed view with the complete flow path (Source → Operations → Sink)
- 🕒 Timestamp for each report
- 🧹 Option to delete all reports
- 🔢 Badge showing the number of detected taint flows

## Installation

### Permanent Installation (XPI)
1. Download XPI from releases or zip yourself: `zip foxhound-taint-monitor.xpi *.json *.js *.html *.png`
2. Open Firefox and go to `about:debugging`
3. Click the gear icon, select "Install Add-on From File" and select the XPI file

### Temporary Installation (Developer)
1. Open Firefox and go to `about:debugging`
2. Click on "This Firefox"
3. Click on "Load Temporary Add-on..."
4. Select the `manifest.json` file from this folder
5. The extension will be installed and the Foxhound icon will appear in the toolbar

## Structure of Taint Reports

Each taint report contains:
- **URL**: The page on which the taint flow was detected
- **Timestamp**: When the flow was detected
- **Tainted String**: The affected string with highlighted regions
- **Flow Path**: Complete path from source through all operations to the sink
  - 🔴 **SOURCE**: Origin of the taint data (e.g. `location.hash`)
  - 🔵 **OPERATION**: Transformations (e.g. `substr`, `concat`, `unescape`)
  - 🟡 **SINK**: Endpoint where the data is used (e.g. `innerHTML`)

## Files

- `manifest.json`: Extension configuration
- `content.js`: Content script for communication with the webpage
- `injected.js`: Injected script for listening to `__taintreport` events
- `background.js`: Background script for storing reports
- `popup.html`: HTML for the popup interface
- `popup.js`: JavaScript for the popup functionality

## Development

The extension uses the Manifest V2 format for maximum compatibility with Firefox. The architecture:

1. **Injected Script** listens for `__taintreport` events in the page context
2. **Content Script** forwards the events to the background script
3. **Background Script** stores the reports and updates the badge
4. **Popup** displays the reports in a user-friendly interface

## Notes

- The extension stores a maximum of 100 reports in memory
- Reports are automatically refreshed in the popup every 2 seconds
- The extension only works on pages that are instrumented with Foxhound