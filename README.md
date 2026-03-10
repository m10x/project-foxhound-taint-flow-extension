# Foxhound Taint Flow Monitor

A Firefox browser extension for monitoring and visualizing taint flows from SAP Project Foxhound.

## Screenshots

**Overview**
<img width="1201" height="323" alt="image" src="https://github.com/user-attachments/assets/0828bc44-26d0-4b77-aa9d-9d8d29009edb" />

**Details**
<img width="1202" height="1006" alt="image" src="https://github.com/user-attachments/assets/b44f1cb3-6521-4a28-a07c-e5309b349292" />


## Features

- 🦊 Automatic detection of `__taintreport` events
- 📊 Clear overview of all taint flows
- 🔍 Filterable list by URL, operation, or taint data
- ✅ Optional *Unique* mode that only shows the first occurrence of each `(sink string, sink operation, source string, source operation)` combination
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

## Usage

Get familiar with Foxhound and this extension by using the DOM XSS Exercises at [DomGoat](https://domgo.at/cxss/example/1?payload=abcd&sp=x#12345)

## Structure of Taint Reports

Each taint report contains:
- **URL**: The page on which the taint flow was detected
- **Timestamp**: When the flow was detected
- **Tainted Source String**: Best-effort reconstruction of where the taint
  originated (filename/argument/other string), also with highlighting
- **Operations**: For both sink and source the corresponding operation name
  (e.g. `innerHTML`, `document.referrer`) is shown next to the strings
- **Flow Path**: Complete path from source through all operations to the sink
  - 🔴 **SOURCE**: Origin of the taint data (e.g. `location.hash`, `document.referrer`)
  - 🔵 **OPERATION**: Transformations (e.g. `substr`, `concat`, `unescape`)
  - 🟡 **SINK**: Endpoint where the data is used (e.g. `innerHTML`)

## Development

The extension uses the Manifest V2 format for maximum compatibility with Firefox. The architecture:

1. **Injected Script** listens for `__taintreport` events in the page context
2. **Content Script** forwards the events to the background script
3. **Background Script** stores the reports and updates the badge
4. **Popup** displays the reports in a user-friendly interface

### Files

- `manifest.json`: Extension configuration
- `content.js`: Content script for communication with the webpage
- `injected.js`: Injected script for listening to `__taintreport` events
- `background.js`: Background script for storing reports
- `popup.html`: HTML for the popup interface
- `popup.js`: JavaScript for the popup functionality
