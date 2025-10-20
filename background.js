// background.js - With start index and numbered files
let isExporting = false;
let shouldCancel = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startExport') {
    startExport(message.tabId, message.startIndex || 0).then(sendResponse);
    return true;
  } else if (message.action === 'cancelExport') {
    shouldCancel = true;
    isExporting = false;
    sendResponse({ success: true });
  }
});

async function startExport(tabId, startIndex) {
  if (isExporting) {
    return { success: false, error: 'Export already in progress' };
  }
  
  isExporting = true;
  shouldCancel = false;
  
  try {
    console.log(`Step 1: Extracting conversation list (starting from ${startIndex})...`);
    const result = await chrome.tabs.sendMessage(tabId, { 
      action: 'extractConversations' 
    });
    
    if (!result.success) {
      isExporting = false;
      return { success: false, error: result.error };
    }
    
    const allConversations = result.conversations;
    
    // Apply start index
    const conversations = allConversations.slice(startIndex);
    
    console.log(`Found ${allConversations.length} total conversations, exporting ${conversations.length} from index ${startIndex}`);
    
    if (conversations.length === 0) {
      isExporting = false;
      return { success: false, error: 'No conversations to export from that index' };
    }
    
    let exported = 0;
    
    for (let i = 0; i < conversations.length; i++) {
      if (shouldCancel) {
        console.log('Export cancelled by user');
        break;
      }
      
      const conv = conversations[i];
      const globalIndex = startIndex + i;  // Actual position in full list
      
      console.log(`[${i+1}/${conversations.length}] (Global #${globalIndex}) ${conv.title}`);
      
      try {
        chrome.runtime.sendMessage({
          type: 'exportProgress',
          current: i + 1,
          total: conversations.length,
          currentTitle: conv.title
        });
      } catch (e) {}
      
      let clickResult;
      try {
        clickResult = await chrome.tabs.sendMessage(tabId, {
          action: 'clickConversationByIndex',
          index: conv.index  // Use original index for clicking
        });
      } catch (error) {
        console.error(`Failed to click conversation ${i}:`, error);
        continue;
      }
      
      if (!clickResult || !clickResult.success) {
        console.error(`Click failed for conversation ${i}`);
        continue;
      }
      
      console.log(`Clicked conversation, URL: ${clickResult.url}`);
      
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      let contentResult;
      try {
        contentResult = await chrome.tabs.sendMessage(tabId, {
          action: 'extractConversation'
        });
      } catch (error) {
        console.error(`Failed to extract conversation ${i}:`, error);
        continue;
      }
      
      if (contentResult && contentResult.success && contentResult.markdown) {
        const header = `# ${contentResult.title}\n\n` +
                      `**Conversation ID:** ${contentResult.id}\n` +
                      `**URL:** ${conv.url}\n` +
                      `**Position:** ${globalIndex + 1} of ${allConversations.length}\n\n` +
                      `---\n\n`;
        
        const markdown = header + contentResult.markdown;
        
        const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(markdown);
        
        // Format: 0001_sanitized_title_id.md
        const paddedIndex = String(globalIndex).padStart(4, '0');
        const cleanTitle = sanitizeFilename(conv.title || `conversation_${i}`);
        const filename = `${paddedIndex}_${cleanTitle}_${contentResult.id}.md`;
        
        try {
          await chrome.downloads.download({
            url: dataUrl,
            filename: `gemini_export/${filename}`,
            saveAs: false
          });
          
          exported++;
          console.log(`✓ Exported: ${filename}`);
        } catch (downloadError) {
          console.error(`Download failed for ${filename}:`, downloadError);
        }
      } else {
        console.error(`No content extracted for conversation ${i}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    try {
      chrome.runtime.sendMessage({
        type: 'exportComplete',
        total: exported
      });
    } catch (e) {}
    
    isExporting = false;
    console.log(`Export complete: ${exported}/${conversations.length} conversations`);
    return { success: true, exported: exported };
    
  } catch (error) {
    console.error('Export error:', error);
    isExporting = false;
    return { success: false, error: error.message };
  }
}

function sanitizeFilename(name) {
  return name
    .replace(/[^a-z0-9\s-]/gi, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 40);  // Shorter to leave room for number prefix
}