let isExporting = false;

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
  }
});