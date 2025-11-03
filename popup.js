let isExporting = false;

// Auto-click toggle
document.getElementById('autoClickToggle').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes('gemini.google.com')) {
    document.getElementById('status').textContent = 'Please open Gemini first!';
    e.target.checked = false;
    return;
  }

  const startIndex = parseInt(document.getElementById('startIndex').value) || 0;

  chrome.tabs.sendMessage(tab.id, {
    action: 'toggleAutoClick',
    enabled: enabled,
    startIndex: startIndex
  }, (response) => {
    if (response && response.success) {
      document.getElementById('status').textContent = enabled
        ? `Auto-click ENABLED - Starting from conversation ${startIndex}. Will click every 15-25 seconds.`
        : 'Auto-click disabled';

      // Disable manual auto-export when auto-click is enabled
      if (enabled) {
        document.getElementById('autoExportToggle').checked = false;
        document.getElementById('autoExportToggle').disabled = true;
      } else {
        document.getElementById('autoExportToggle').disabled = false;
      }
    }
  });
});

// Auto-export toggle
document.getElementById('autoExportToggle').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes('gemini.google.com')) {
    document.getElementById('status').textContent = 'Please open Gemini first!';
    e.target.checked = false;
    return;
  }

  chrome.tabs.sendMessage(tab.id, {
    action: 'toggleAutoExport',
    enabled: enabled
  }, (response) => {
    if (response && response.success) {
      document.getElementById('status').textContent = enabled
        ? 'Auto-export ENABLED - Click conversations to export them'
        : 'Auto-export disabled';

      // Disable auto-click when manual auto-export is enabled
      if (enabled) {
        document.getElementById('autoClickToggle').checked = false;
        document.getElementById('autoClickToggle').disabled = true;
      } else {
        document.getElementById('autoClickToggle').disabled = false;
      }
    }
  });
});

// Export current conversation button
document.getElementById('exportCurrentBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes('gemini.google.com')) {
    document.getElementById('status').textContent = 'Please open Gemini first!';
    return;
  }

  document.getElementById('status').textContent = 'Exporting current conversation...';

  chrome.tabs.sendMessage(tab.id, { action: 'exportCurrent' }, (response) => {
    if (response && response.success) {
      document.getElementById('status').textContent = 'Exported! Check console and Downloads folder.';
    } else {
      document.getElementById('status').textContent = 'Error: ' + (response?.error || 'Unknown error');
    }
  });
});

// Batch export button
document.getElementById('exportBtn').addEventListener('click', async () => {
  if (isExporting) return;
  
  const exportBtn = document.getElementById('exportBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const status = document.getElementById('status');
  const startIndex = parseInt(document.getElementById('startIndex').value) || 0;
  
  isExporting = true;
  exportBtn.disabled = true;
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('gemini.google.com')) {
    status.textContent = 'Please open Gemini first!';
    isExporting = false;
    exportBtn.disabled = false;
    return;
  }
  
  status.textContent = `Starting export from conversation ${startIndex}...`;
  
  chrome.runtime.sendMessage({ 
    action: 'startExport', 
    tabId: tab.id,
    startIndex: startIndex
  }, (response) => {
    if (response && response.success) {
      status.textContent = 'Export started! Check console for progress.';
    } else {
      status.textContent = 'Error: ' + (response?.error || 'Unknown error');
      isExporting = false;
      exportBtn.disabled = false;
    }
  });
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'cancelExport' });
  document.getElementById('status').textContent = 'Cancelling export...';
  document.getElementById('exportBtn').disabled = false;
  isExporting = false;
});

// Listen for progress updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'exportProgress') {
    document.getElementById('status').innerHTML =
      `Exported: ${message.current}/${message.total}<br>` +
      `<span class="progress">${message.currentTitle}</span>`;
  } else if (message.type === 'exportComplete') {
    document.getElementById('status').innerHTML =
      `Complete! Exported ${message.total} conversations<br>` +
      `<span class="progress">Check ~/Downloads/gemini_export/</span>`;
    document.getElementById('exportBtn').disabled = false;
    isExporting = false;
  } else if (message.type === 'autoClickProgress') {
    document.getElementById('status').innerHTML =
      `Auto-clicking: ${message.current}/${message.total}<br>` +
      `<span class="progress">${message.currentTitle}</span>`;
  } else if (message.type === 'autoClickComplete') {
    document.getElementById('status').innerHTML =
      `Auto-click complete! Processed ${message.total} conversations.<br>` +
      `<span class="progress">Check ~/Downloads/gemini_export/</span>`;
    document.getElementById('autoClickToggle').checked = false;
    document.getElementById('autoExportToggle').disabled = false;
  } else if (message.type === 'autoClickError') {
    // Show error but don't stop - just log it
    console.error('Auto-click error:', message.message);
    document.getElementById('status').innerHTML =
      `⚠️ Error at conversation ${message.index + 1}<br>` +
      `<span class="progress" style="color: #d9534f;">${message.message}</span><br>` +
      `<span class="progress">Continuing with next conversation...</span>`;
  }
});