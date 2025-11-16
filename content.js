// content.js - Fixed conversation detection
let shouldCancel = false;
let autoExportEnabled = false;
let lastExportedConversationId = null;
let autoClickEnabled = false;
let autoClickInterval = null;
let currentClickIndex = 0;
let isManualExportInProgress = false;

// Watch for URL changes to auto-export conversations
let lastUrl = window.location.href;
setInterval(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl && autoExportEnabled) {
    lastUrl = currentUrl;

    // Check if we're on a conversation page
    const conversationId = window.location.pathname.match(/\/app\/([^/?]+)/)?.[1];
    if (conversationId && conversationId !== lastExportedConversationId) {
      console.log('New conversation detected, auto-exporting:', conversationId);

      // Wait for content to load, then export (increased to 5s for better title loading)
      setTimeout(() => {
        // Pass sequence index if in auto-click mode
        const sequenceIndex = autoClickEnabled ? (currentClickIndex - 1) : null;
        exportCurrentConversation(sequenceIndex);
      }, 5000);
    }
  } else {
    lastUrl = currentUrl;
  }
}, 1000);

// Keyboard shortcut: Ctrl+Shift+E (or Cmd+Shift+E on Mac)
let isExportingViaKeyboard = false;
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
    e.preventDefault();

    // Debounce: ignore if already exporting
    if (isExportingViaKeyboard) {
      console.log('Export already in progress, ignoring keyboard shortcut');
      return;
    }

    console.log('Keyboard shortcut triggered, exporting current conversation...');
    isExportingViaKeyboard = true;

    exportCurrentConversation()
      .finally(() => {
        isExportingViaKeyboard = false;
      });
  }
});

async function exportCurrentConversation(sequenceIndex = null) {
  try {
    // Use new structured extraction
    const result = await extractStructuredConversation();

    if (result.success) {
      const conversation = result.conversation;
      lastExportedConversationId = conversation.conversation_id;

      // Send to background script for download
      chrome.runtime.sendMessage({
        action: 'downloadConversationJSON',
        conversation: conversation,
        sequenceIndex: sequenceIndex  // Pass index for auto-click mode
      });

      console.log('✓ Exported:', conversation.title,
                  `(${conversation.exchange_count} exchanges, ${conversation.message_count} messages)`,
                  sequenceIndex !== null ? `#${sequenceIndex}` : '');
    } else {
      console.error('✗ Export failed:', result.error);

      // Send error notification if in auto-click mode
      if (sequenceIndex !== null) {
        try {
          chrome.runtime.sendMessage({
            type: 'autoClickError',
            message: `Export failed for conversation ${sequenceIndex + 1}: ${result.error}`,
            index: sequenceIndex
          });
        } catch (e) {
          // Popup might be closed
        }
      }
    }
  } catch (error) {
    console.error('✗ Error exporting conversation:', error);

    // Send error notification if in auto-click mode
    if (sequenceIndex !== null) {
      try {
        chrome.runtime.sendMessage({
          type: 'autoClickError',
          message: `Unexpected export error for conversation ${sequenceIndex + 1}: ${error.message}`,
          index: sequenceIndex
        });
      } catch (e) {
        // Popup might be closed
      }
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.action);

  try {
    if (message.action === 'extractConversations') {
      extractAllConversations()
        .then(sendResponse)
        .catch(error => {
          console.error('Error in extractAllConversations:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    } else if (message.action === 'extractConversation') {
      extractCurrentConversation()
        .then(sendResponse)
        .catch(error => {
          console.error('Error in extractCurrentConversation:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    } else if (message.action === 'extractConversationId') {
      // Extract and return the current conversation ID for verification
      try {
        const conversationId = window.location.pathname.match(/\/app\/([^/?]+)/)?.[1] || null;
        console.log('Current conversation ID:', conversationId);
        sendResponse({ success: true, id: conversationId });
      } catch (error) {
        console.error('Error extracting conversation ID:', error);
        sendResponse({ success: false, id: null });
      }
    } else if (message.action === 'navigateToConversation') {
      // Navigate from within page context to trigger Google's SPA router
      try {
        console.log('Navigating to:', message.url);
        window.location.href = message.url;
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error navigating:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else if (message.action === 'clickConversationByIndex') {
      clickConversationByIndex(message.index)
        .then(sendResponse)
        .catch(error => {
          console.error('Error in clickConversationByIndex:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    } else if (message.action === 'cancel') {
      shouldCancel = true;
      sendResponse({ success: true });
    } else if (message.action === 'toggleAutoExport') {
      autoExportEnabled = message.enabled;
      console.log('Auto-export mode:', autoExportEnabled ? 'ENABLED' : 'DISABLED');
      sendResponse({ success: true, enabled: autoExportEnabled });
    } else if (message.action === 'exportCurrent') {
      // Debounce: prevent multiple simultaneous manual exports
      if (isManualExportInProgress) {
        console.log('Manual export already in progress, ignoring button click');
        sendResponse({ success: false, error: 'Export already in progress' });
        return true;
      }

      isManualExportInProgress = true;
      exportCurrentConversation()
        .then(() => sendResponse({ success: true }))
        .catch(error => {
          console.error('Error exporting:', error);
          sendResponse({ success: false, error: error.message });
        })
        .finally(() => {
          isManualExportInProgress = false;
        });
      return true;
    } else if (message.action === 'scrollAndGetConversations') {
      // Scroll incrementally and return current conversations
      scrollAndGetConversations(message.scrollCount || 5)
        .then(sendResponse)
        .catch(error => {
          console.error('Error in scrollAndGetConversations:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    } else if (message.action === 'toggleAutoClick') {
      if (message.enabled) {
        startAutoClick(message.startIndex || 0);
      } else {
        stopAutoClick();
      }
      sendResponse({ success: true, enabled: autoClickEnabled });
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// Auto-click functions
async function startAutoClick(startIndex = 0) {
  console.log(`Starting auto-click from index ${startIndex}`);
  currentClickIndex = startIndex;
  autoClickEnabled = true;
  autoExportEnabled = true; // Enable auto-export when auto-clicking

  // Click the FIRST conversation immediately (no delay)
  await clickNextConversation();

  // THEN schedule subsequent clicks with delays
  scheduleNextClick();
}

function stopAutoClick() {
  console.log('Stopping auto-click');
  autoClickEnabled = false;
  if (autoClickInterval) {
    clearTimeout(autoClickInterval);
    autoClickInterval = null;
  }
}

function scheduleNextClick() {
  if (!autoClickEnabled) return;

  // Random delay between 15-25 seconds
  const delay = 15000 + Math.random() * 10000;
  console.log(`Next click in ${Math.round(delay/1000)} seconds...`);

  autoClickInterval = setTimeout(async () => {
    await clickNextConversation();
    scheduleNextClick(); // Schedule the next one
  }, delay);
}

async function clickNextConversation() {
  if (!autoClickEnabled) return;

  try {
    // Get currently loaded conversations
    let items = document.querySelectorAll('div.conversation-items-container');
    console.log(`Current index: ${currentClickIndex}, loaded items: ${items.length}`);

    // Check if we need to scroll for more conversations
    if (currentClickIndex >= items.length) {
      console.log('Reached end of loaded conversations, scrolling for more...');

      const result = await scrollAndGetConversations(5);

      if (!result.success) {
        console.error('Failed to scroll:', result.error);
        stopAutoClick();
        return;
      }

      if (!result.canScrollMore) {
        console.log('No more conversations to load, auto-click complete!');

        // Send completion message
        try {
          chrome.runtime.sendMessage({
            type: 'autoClickComplete',
            total: currentClickIndex
          });
        } catch (e) {
          // Popup might be closed
        }

        stopAutoClick();
        return;
      }

      // Wait for new conversations to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Re-query items after scrolling
      items = document.querySelectorAll('div.conversation-items-container');
      console.log(`After scrolling, now have ${items.length} items loaded`);

      if (currentClickIndex >= items.length) {
        console.log('Still not enough items after scrolling, stopping');
        stopAutoClick();
        return;
      }
    }

    // Click the conversation at current index
    console.log(`Auto-clicking conversation ${currentClickIndex + 1}...`);

    // Get conversation title for progress display
    const item = items[currentClickIndex];
    const titleEl = item?.querySelector('div.conversation-title');
    const title = titleEl ? titleEl.textContent.trim() : `Conversation ${currentClickIndex + 1}`;

    // Send progress update to popup
    try {
      chrome.runtime.sendMessage({
        type: 'autoClickProgress',
        current: currentClickIndex + 1,
        total: items.length,
        currentTitle: title
      });
    } catch (e) {
      // Popup might be closed
    }

    const result = await clickConversationByIndex(currentClickIndex);

    if (result.success) {
      console.log(`✓ Successfully clicked conversation ${currentClickIndex + 1}: ${title}`);
      currentClickIndex++;
    } else {
      console.error(`✗ Failed to click conversation ${currentClickIndex}:`, result.error);

      // Send error notification to popup
      try {
        chrome.runtime.sendMessage({
          type: 'autoClickError',
          message: `Failed to click conversation ${currentClickIndex + 1}: ${result.error}`,
          index: currentClickIndex
        });
      } catch (e) {
        // Popup might be closed
      }

      // Try to continue with next one anyway
      currentClickIndex++;
    }
  } catch (error) {
    console.error('✗ Unexpected error in clickNextConversation:', error);

    // Send error notification
    try {
      chrome.runtime.sendMessage({
        type: 'autoClickError',
        message: `Unexpected error at conversation ${currentClickIndex + 1}: ${error.message}`,
        index: currentClickIndex
      });
    } catch (e) {
      // Popup might be closed
    }

    // Continue anyway - don't let one error stop the entire process
    currentClickIndex++;
  }
}

function extractConversationId(item) {
  try {
    const button = item.querySelector('div[role="button"]');
    if (!button) {
      console.warn('extractConversationId: No button found in item');
      return null;
    }

    // Method 1: Try jslog attribute with relaxed regex
    const jslog = button.getAttribute('jslog');
    if (jslog) {
      // More permissive pattern: accept any hex ID after c_, not just lowercase 16 chars
      const match = jslog.match(/"(c_[a-fA-F0-9]{12,})"/);

      if (match && match[1]) {
        return match[1];
      }

      // Alternative pattern without quotes
      const match2 = jslog.match(/c_[a-fA-F0-9]{12,}/);
      if (match2) {
        return match2[0];
      }

      console.warn('extractConversationId: jslog exists but no ID matched:', jslog.substring(0, 100));
    }

    // Method 2: Try extracting from href attribute
    const link = item.querySelector('a[href*="/app/"]');
    if (link) {
      const href = link.getAttribute('href');
      const hrefMatch = href.match(/\/app\/([a-fA-F0-9]+)/);
      if (hrefMatch && hrefMatch[1]) {
        console.log('extractConversationId: Extracted from href:', hrefMatch[1]);
        return hrefMatch[1];
      }
    }

    // Method 3: Try data attributes
    const dataId = item.getAttribute('data-conversation-id') ||
                   item.getAttribute('data-id') ||
                   button.getAttribute('data-conversation-id');
    if (dataId) {
      console.log('extractConversationId: Extracted from data attribute:', dataId);
      return dataId;
    }

    // Log failure with context
    const titleEl = item.querySelector('div.conversation-title');
    const title = titleEl ? titleEl.textContent.trim().substring(0, 50) : 'Unknown';
    console.warn(`extractConversationId: Failed to extract ID for: "${title}"`);

    return null;
  } catch (error) {
    console.error('Error extracting conversation ID:', error);
    return null;
  }
}

async function clickConversationByIndex(index) {
  console.log(`Clicking conversation at index ${index}`);
  
  try {
    const items = document.querySelectorAll('div.conversation-items-container');
    
    if (index >= items.length) {
      return { 
        success: false, 
        error: `Conversation ${index} not found (only ${items.length} items)` 
      };
    }
    
    const item = items[index];
    const button = item.querySelector('div[role="button"]');
    
    if (!button) {
      return { success: false, error: 'Button not found in item' };
    }
    
    console.log('Clicking button for:', item.querySelector('.conversation-title')?.textContent);
    button.click();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newUrl = window.location.href;
    
    // Check if we navigated to a conversation (not on landing page)
    const hasConvId = !newUrl.endsWith('/app') && 
                      !newUrl.endsWith('/app/') && 
                      newUrl.includes('/app/');
    
    console.log('After click, URL:', newUrl);
    console.log('Has conversation ID:', hasConvId);
    
    return { 
      success: hasConvId, 
      url: newUrl,
      error: hasConvId ? null : 'URL did not change to conversation'
    };
  } catch (error) {
    console.error('Error clicking conversation:', error);
    return { success: false, error: error.message };
  }
}

async function extractAllConversations() {
  console.log('Starting conversation extraction...');

  try {
    // Try multiple selectors for the sidebar (Google changes class names frequently)
    const sidebarSelectors = [
      'infinite-scroller',  // The actual scrollable custom element
      '.gb_0d',  // Old selector
      'div[class*="conversation-list"]',
      'nav[aria-label*="onversation"]',
      'aside',
      '[role="navigation"]',
      // Look for scrollable container that contains conversation items
      'div:has(div.conversation-items-container)'
    ];

    let sidebar = null;
    for (const selector of sidebarSelectors) {
      try {
        sidebar = document.querySelector(selector);
        if (sidebar && sidebar.querySelector('div.conversation-items-container')) {
          console.log(`Found sidebar using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // :has() selector might not work in all browsers, continue
        continue;
      }
    }

    // Validate that the sidebar is actually scrollable
    if (sidebar && sidebar.scrollHeight <= sidebar.clientHeight) {
      console.log('Found sidebar but it is not scrollable, searching for scrollable child...');

      // Look for scrollable descendants
      const allDescendants = sidebar.querySelectorAll('*');
      let scrollableElement = null;

      for (const el of allDescendants) {
        if (el.scrollHeight > el.clientHeight) {
          // This element can scroll - check if it contains conversation items
          if (el.querySelector('div.conversation-items-container')) {
            scrollableElement = el;
            console.log('Found scrollable child element:', el.tagName, el.className);
            break;
          }
        }
      }

      if (scrollableElement) {
        sidebar = scrollableElement;
      }
    }

    // If still not found, find the parent of conversation items
    if (!sidebar || sidebar.scrollHeight <= sidebar.clientHeight) {
      const firstItem = document.querySelector('div.conversation-items-container');
      if (firstItem) {
        // Find the scrollable parent by checking scrollHeight
        let parent = firstItem.parentElement;
        while (parent && parent !== document.body) {
          if (parent.scrollHeight > parent.clientHeight) {
            sidebar = parent;
            console.log('Found sidebar by traversing from conversation item (scrollable)');
            break;
          }
          parent = parent.parentElement;
        }
      }
    }

    if (!sidebar || sidebar.scrollHeight <= sidebar.clientHeight) {
      return { success: false, error: 'Scrollable sidebar not found. Please make sure you are on the Gemini chat page with conversations visible.' };
    }

    console.log('Found sidebar, starting scroll to load all conversations...');
    console.log('This may take a while for large conversation histories. Please wait...');

    // Debug: Log sidebar info
    console.log('Sidebar element:', sidebar.tagName, sidebar.className);
    console.log('Sidebar scrollHeight:', sidebar.scrollHeight);
    console.log('Sidebar clientHeight:', sidebar.clientHeight);
    console.log('Sidebar scrollTop (before):', sidebar.scrollTop);

    let previousCount = 0;
    let stallCount = 0;
    const maxStalls = 15; // Stop after 15 stalls (30 seconds of no new items with 2s intervals)
    let scrollAttempts = 0;
    const maxScrollAttempts = 500; // Should be plenty for even very large histories

    while (stallCount < maxStalls && scrollAttempts < maxScrollAttempts) {
      // Store old scroll value for debugging
      const oldScrollTop = sidebar.scrollTop;

      // Scroll to bottom to trigger lazy loading
      sidebar.scrollTop = sidebar.scrollHeight;

      // Debug on first attempt
      if (scrollAttempts === 0) {
        console.log('Sidebar scrollTop (after):', sidebar.scrollTop);
        console.log('Did scroll position change?', oldScrollTop !== sidebar.scrollTop);
        console.log('scrollHeight:', sidebar.scrollHeight, 'clientHeight:', sidebar.clientHeight);
        console.log('Can scroll?', sidebar.scrollHeight > sidebar.clientHeight);
      }

      // Wait longer for batch loading (conversations load ~20 at a time)
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds per scroll

      const items = document.querySelectorAll('div.conversation-items-container');
      const currentCount = items.length;

      console.log(`Scroll attempt ${scrollAttempts + 1}: Found ${currentCount} conversations (was ${previousCount})`);

      if (currentCount === previousCount) {
        stallCount++;
        console.log(`No new conversations loaded (stall ${stallCount}/${maxStalls})`);
      } else {
        const newCount = currentCount - previousCount;
        stallCount = 0;
        previousCount = currentCount;
        console.log(`✓ Loaded ${newCount} new conversations (total: ${currentCount})`);
      }

      scrollAttempts++;
    }

    console.log(`✓ Scrolling complete after ${scrollAttempts} attempts. Total conversations found: ${previousCount}`);

    const items = document.querySelectorAll('div.conversation-items-container');
    const conversations = [];
    const skipped = [];

    console.log(`Processing ${items.length} conversation items`);

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const titleEl = item.querySelector('div.conversation-title');
      const title = titleEl ? titleEl.textContent.trim() : `Conversation ${index + 1}`;

      const id = extractConversationId(item);

      if (id) {
        conversations.push({
          id: id,
          title: title,
          url: `https://gemini.google.com/app/${id}`,
          index: index
        });
      } else {
        skipped.push({ index, title: title.substring(0, 60) });
      }
    }

    console.log(`Successfully extracted ${conversations.length} conversations, ${skipped.length} skipped`);
    if (skipped.length > 0) {
      console.warn('⚠️ Failed to extract IDs for the following conversations:');
      skipped.forEach(s => console.warn(`  [${s.index}] ${s.title}`));
    }
    
    return { 
      success: true, 
      conversations: conversations 
    };
  } catch (error) {
    console.error('Error in extractAllConversations:', error);
    return { success: false, error: error.message };
  }
}

async function scrollAndGetConversations(scrollCount = 5) {
  console.log(`Scrolling ${scrollCount} times to load more conversations...`);

  try {
    // Find sidebar using same logic as extractAllConversations
    const sidebarSelectors = [
      'infinite-scroller',
      '.gb_0d',
      'div[class*="conversation-list"]',
      'nav[aria-label*="onversation"]',
      'aside',
      '[role="navigation"]'
    ];

    let sidebar = null;
    for (const selector of sidebarSelectors) {
      try {
        sidebar = document.querySelector(selector);
        if (sidebar && sidebar.querySelector('div.conversation-items-container')) {
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Validate scrollable
    if (sidebar && sidebar.scrollHeight <= sidebar.clientHeight) {
      const allDescendants = sidebar.querySelectorAll('*');
      for (const el of allDescendants) {
        if (el.scrollHeight > el.clientHeight && el.querySelector('div.conversation-items-container')) {
          sidebar = el;
          break;
        }
      }
    }

    // Fallback: find scrollable parent
    if (!sidebar || sidebar.scrollHeight <= sidebar.clientHeight) {
      const firstItem = document.querySelector('div.conversation-items-container');
      if (firstItem) {
        let parent = firstItem.parentElement;
        while (parent && parent !== document.body) {
          if (parent.scrollHeight > parent.clientHeight) {
            sidebar = parent;
            break;
          }
          parent = parent.parentElement;
        }
      }
    }

    if (!sidebar || sidebar.scrollHeight <= sidebar.clientHeight) {
      return { success: false, error: 'Scrollable sidebar not found' };
    }

    // Scroll incrementally
    for (let i = 0; i < scrollCount; i++) {
      sidebar.scrollTop = sidebar.scrollHeight;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Get currently loaded conversations
    const items = document.querySelectorAll('div.conversation-items-container');
    const conversations = [];
    const skipped = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const titleEl = item.querySelector('div.conversation-title');
      const title = titleEl ? titleEl.textContent.trim() : `Conversation ${index + 1}`;
      const id = extractConversationId(item);

      if (id) {
        conversations.push({
          id: id,
          title: title,
          url: `https://gemini.google.com/app/${id}`,
          index: index
        });
      } else {
        skipped.push({ index, title: title.substring(0, 60) });
      }
    }

    console.log(`After ${scrollCount} scrolls: ${items.length} items found, ${conversations.length} IDs extracted, ${skipped.length} skipped`);
    if (skipped.length > 0) {
      console.warn('⚠️ Skipped conversations (no ID extracted):');
      skipped.forEach(s => console.warn(`  [${s.index}] ${s.title}`));
    }

    return {
      success: true,
      conversations: conversations,
      canScrollMore: sidebar.scrollTop + sidebar.clientHeight < sidebar.scrollHeight
    };
  } catch (error) {
    console.error('Error in scrollAndGetConversations:', error);
    return { success: false, error: error.message };
  }
}

// Helper: Generate stable ID from container content (survives DOM virtualization)
function getStableContainerId(container) {
  // Use first 100 chars of text content as stable identifier
  // This survives virtualization since text content is recreated identically
  return container.textContent.substring(0, 100).replace(/\s+/g, ' ').trim();
}

// NEW: Expand and extract thinking blocks ONE AT A TIME while scrolling through entire conversation
async function expandAndExtractAllThinkingBlocks() {
  const main = document.querySelector('main');
  if (!main) {
    console.error('Main element not found');
    return { thinkingBlocksMap: new Map(), totalExtracted: 0 };
  }

  const thinkingBlocksMap = new Map(); // Maps: stableId (string) -> thinking data
  let totalExtracted = 0;
  const processedContainers = new Set(); // Stores: stableId (string)

  console.log('=== Starting one-at-a-time expansion with scroll ===');

  const totalHeight = main.scrollHeight;
  const viewportHeight = main.clientHeight;
  const scrollIncrement = 100; // Small increments to trigger virtualization

  // Scroll to absolute top
  main.scrollTop = 0;
  await new Promise(resolve => setTimeout(resolve, 1000));

  let currentScrollPosition = 0;
  let passCount = 0;

  while (currentScrollPosition <= totalHeight) {
    passCount++;

    // Find ONE unexpanded thinking block (anywhere in DOM, viewport check removed to handle virtualization)
    const allButtons = Array.from(document.querySelectorAll('button[data-test-id="thoughts-header-button"]'));
    const nextButton = allButtons.find(btn => {
      const container = btn.closest('.conversation-container');
      if (!container) return false; // Skip if button not in a container
      const containerId = getStableContainerId(container);
      if (processedContainers.has(containerId)) return false;
      if (!btn.textContent.toLowerCase().includes('show thinking')) return false;

      // Don't check viewport - just find next unprocessed button
      // scrollIntoView() will handle bringing it into viewport
      return true;
    });

    if (nextButton) {
      const container = nextButton.closest('.conversation-container');

      try {
        // Scroll it into view (instant to avoid animation timing issues)
        nextButton.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log(`[${totalExtracted + 1}] Expanding thinking block...`);
        nextButton.click();

        // Wait for expansion
        let expandedContent = null;
        for (let retry = 0; retry < 10; retry++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          expandedContent = container.querySelector('[class*="thoughts-content-expanded"]');
          if (expandedContent && expandedContent.textContent.trim().length > 50) break;
          expandedContent = null;
        }

        const containerId = getStableContainerId(container);

        if (expandedContent) {
          // Extract IMMEDIATELY before scrolling away
          const stages = extractThinkingStages(expandedContent);
          if (stages && stages.length > 0) {
            thinkingBlocksMap.set(containerId, { thinking_stages: stages });
            totalExtracted++;
            console.log(`  ✓ Extracted ${stages.length} stages`);
          }
        } else {
          console.warn(`  ⚠ Expansion failed`);
        }

        processedContainers.add(containerId);

      } catch (e) {
        console.error(`  Error:`, e);
        const containerId = getStableContainerId(container);
        processedContainers.add(containerId); // Mark as processed to avoid infinite loop
      }

      // Wait for DOM to settle before moving to next block
      await new Promise(resolve => setTimeout(resolve, 1000));

      // After processing, scroll down to trigger loading next buttons into DOM
      currentScrollPosition += scrollIncrement;
      main.scrollTop = currentScrollPosition;
      await new Promise(resolve => setTimeout(resolve, 500));

      // Continue searching from new position
      continue;
    }

    // No button found in viewport range - scroll down more to trigger virtualization
    currentScrollPosition += scrollIncrement * 2; // Scroll more when no button found
    main.scrollTop = currentScrollPosition;
    await new Promise(resolve => setTimeout(resolve, 500));

    // Safety: if we've scrolled way past content and found nothing for a while, break
    if (currentScrollPosition > totalHeight + viewportHeight && passCount > (totalHeight / scrollIncrement) * 1.5) {
      console.log(`Reached end (scroll: ${currentScrollPosition}, height: ${totalHeight})`);
      break;
    }

    // Safety limit
    if (passCount > 1000) {
      console.warn('Safety limit: 1000 passes');
      break;
    }
  }

  console.log(`\n=== Extraction complete: ${totalExtracted} thinking blocks ===`);
  return { thinkingBlocksMap, totalExtracted };
}

// OLD: Single-pass expansion (doesn't handle DOM virtualization)
async function expandThinkingBlocks_OLD() {
  // Keep expanding thinking blocks until no more unexpanded buttons are found
  let expandedCount = 0;
  let totalProcessed = 0;
  let passNumber = 1;
  const maxPasses = 10;  // Safety limit
  const expandedContainers = new Set();  // Track which containers we've expanded

  while (passNumber <= maxPasses) {
    // Find buttons that need expanding (say "Show thinking")
    let buttonsToExpand = [];

    // Try to find buttons with the most reliable selector first
    const allButtons = Array.from(document.querySelectorAll('button[data-test-id="thoughts-header-button"]'));

    // Fallback: find buttons inside model-thoughts containers
    if (allButtons.length === 0) {
      const thoughtContainers = document.querySelectorAll('[data-test-id="model-thoughts"]');
      thoughtContainers.forEach(container => {
        const button = container.querySelector('button');
        if (button) allButtons.push(button);
      });
    }

    // Another fallback: look for buttons with "Show thinking" or "Hide thinking" text
    if (allButtons.length === 0) {
      const allButtonElements = document.querySelectorAll('button');
      allButtons.push(...Array.from(allButtonElements).filter(btn => {
        const text = btn.textContent.toLowerCase();
        return text.includes('show thinking') || text.includes('hide thinking');
      }));
    }

    // Filter to only unexpanded buttons that we haven't processed yet
    buttonsToExpand = allButtons.filter(btn => {
      const text = btn.textContent.toLowerCase();
      if (!text.includes('show thinking')) return false;

      // Check if we've already processed this container
      const container = btn.closest('.conversation-container');
      const containerId = container?.id || container?.getAttribute('data-id');
      if (containerId && expandedContainers.has(containerId)) {
        return false;  // Skip already processed
      }
      return true;
    });

    console.log(`Pass ${passNumber}: Found ${allButtons.length} total buttons, ${buttonsToExpand.length} new unexpanded`);

    // End condition: No more unexpanded buttons found
    if (buttonsToExpand.length === 0) {
      console.log(`✓ Expansion complete after ${passNumber - 1} passes. Expanded ${expandedCount} thinking blocks.`);
      break;
    }

    // Expand all buttons found in this pass
    for (let i = 0; i < buttonsToExpand.length; i++) {
      const button = buttonsToExpand[i];
      totalProcessed++;

      try {
        // Get container ID to track
        const container = button.closest('.conversation-container');
        const containerId = container?.id || container?.getAttribute('data-id') || `temp-${totalProcessed}`;

        // Scroll into view to ensure rendering
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`  Expanding thinking block ${totalProcessed} (pass ${passNumber}, ${i + 1}/${buttonsToExpand.length})`);
        button.click();

        // Verify expansion (retry up to 10 times)
        let verified = false;
        for (let retry = 0; retry < 10; retry++) {
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check if content appeared - look for thoughts-content-expanded class specifically
          const thoughtsContentExpanded = container?.querySelector('[class*="thoughts-content-expanded"]');

          if (thoughtsContentExpanded && thoughtsContentExpanded.textContent.trim().length > 50) {
            verified = true;
            console.log(`  ✓ Verified thinking block ${totalProcessed} (expanded content found)`);
            expandedCount++;
            break;
          }
        }

        if (verified) {
          // Only mark as processed if expansion was verified
          expandedContainers.add(containerId);
        } else {
          console.warn(`  ⚠ Failed to verify thinking block ${totalProcessed} - will retry on next pass`);
        }
      } catch (e) {
        console.error(`  Error expanding button ${totalProcessed}:`, e);
      }
    }

    // Wait before next pass to let any new content render
    await new Promise(resolve => setTimeout(resolve, 1000));
    passNumber++;
  }

  return expandedCount;
}

// Helper: Extract thinking stages from container
function extractThinkingStages(container) {
  const stages = [];

  // Get all paragraphs and divs that might contain stage content
  const elements = container.querySelectorAll('p, div');
  let currentStage = null;

  for (const el of elements) {
    // Skip empty elements
    if (!el.textContent.trim()) continue;

    // Check if element is a stage header (contains bold/strong text as the entire content)
    const boldEl = el.querySelector('strong, b');
    const trimmedText = el.textContent.trim();

    if (boldEl && trimmedText === boldEl.textContent.trim() && trimmedText.length > 0) {
      // This is a stage header - save previous stage if exists
      if (currentStage && currentStage.text.trim()) {
        stages.push(currentStage);
      }

      // Start new stage
      currentStage = {
        stage_name: boldEl.textContent.trim(),
        text: ''
      };
    } else if (currentStage && trimmedText.length > 0) {
      // This is stage content - add to current stage
      currentStage.text += (currentStage.text ? '\n\n' : '') + trimmedText;
    }
  }

  // Don't forget the last stage
  if (currentStage && currentStage.text.trim()) {
    stages.push(currentStage);
  }

  return stages.length > 0 ? stages : null;
}

// Helper: Extract response text excluding thinking block
function extractResponseText(geminiEl, excludeThinking = true) {
  const clone = geminiEl.cloneNode(true);

  // Remove thinking container from clone if requested
  if (excludeThinking) {
    const thinkingContainers = clone.querySelectorAll('[data-test-id="model-thoughts"]');
    thinkingContainers.forEach(tc => tc.remove());

    // Also remove thinking buttons
    const thinkingButtons = clone.querySelectorAll('button[data-test-id="thoughts-header-button"]');
    thinkingButtons.forEach(tb => tb.remove());
  }

  // Remove other UI elements
  const uiElements = clone.querySelectorAll('button, [role="button"]');
  uiElements.forEach(el => {
    // Keep code copy buttons and similar, but remove others
    if (!el.closest('pre, code')) {
      el.remove();
    }
  });

  return clone.textContent.trim();
}

// Helper: Extract clean text content from an element
function extractTextContent(element) {
  if (!element) return '';

  const clone = element.cloneNode(true);

  // Remove buttons and other UI elements
  const uiElements = clone.querySelectorAll('button:not(pre button), [role="button"]:not(pre [role="button"])');
  uiElements.forEach(el => el.remove());

  return clone.textContent.trim();
}

// Main structured extraction function (DOM → JSON)
async function extractStructuredConversation() {
  console.log('=== Starting Structured Conversation Extraction ===');

  try {
    // Step 1: Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    let chatLoaded = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const main = document.querySelector('main');
      if (main && main.textContent.length > 500) {
        console.log(`Chat loaded after ${attempt + 1} attempts, ${main.textContent.length} chars`);
        chatLoaded = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!chatLoaded) {
      return { success: false, error: 'Chat failed to load after 10 attempts' };
    }

    // Step 2: Extract conversation ID and title
    const conversationId = window.location.pathname.match(/\/app\/([^/?]+)/)?.[1] || 'unknown';
    console.log('Conversation ID:', conversationId);

    // Use existing title extraction logic
    const titleResult = await extractTitle();
    const title = titleResult || 'Untitled';

    // Step 3: Scroll to load all lazy-loaded exchanges
    // IMPORTANT: Gemini conversations open at the BOTTOM and lazy-load UP as you scroll
    console.log('Loading all exchanges via scroll...');
    const main = document.querySelector('main');
    if (main) {
      const initialContainers = main.querySelectorAll('.conversation-container').length;
      console.log(`Initial: ${initialContainers} containers`);

      // Scroll UP to load older exchanges (lazy-loading triggers as we scroll up)
      let previousCount = initialContainers;
      let stableCount = 0;
      const maxScrollAttempts = 15;

      for (let i = 0; i < maxScrollAttempts; i++) {
        main.scrollTop = 0;  // Scroll to top
        await new Promise(resolve => setTimeout(resolve, 800));

        const currentCount = main.querySelectorAll('.conversation-container').length;
        console.log(`  Scroll ${i + 1}: ${currentCount} containers`);

        // If count hasn't changed for 2 iterations, we've loaded everything
        if (currentCount === previousCount) {
          stableCount++;
          if (stableCount >= 2) {
            console.log(`✓ All exchanges loaded (stable at ${currentCount})`);
            break;
          }
        } else {
          stableCount = 0;
        }
        previousCount = currentCount;
      }
    }

    // Step 4: Expand and extract ALL thinking blocks with batched scrolling
    console.log('Expanding and extracting thinking blocks...');
    const { thinkingBlocksMap, totalExtracted } = await expandAndExtractAllThinkingBlocks();
    console.log(`Extracted ${totalExtracted} thinking blocks across all batches`);

    // Step 4b: Capture raw HTML after expansion (for other content)
    console.log('Capturing raw HTML for forensic evidence (before scroll virtualization)...');
    const rawHTML = main ? main.outerHTML : '';
    console.log(`  Raw HTML captured: ${rawHTML.length.toLocaleString()} characters`);

    // Step 4c: Scroll to bottom to ensure final exchanges are re-rendered (prevent virtual scroll de-rendering)
    if (main) {
      console.log('Scrolling to bottom to ensure final exchanges are rendered...');
      main.scrollTop = main.scrollHeight;
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Then scroll back up to ensure all content is in DOM
      main.scrollTop = 0;
      await new Promise(resolve => setTimeout(resolve, 1000));
      main.scrollTop = main.scrollHeight;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 4d: (rawHTML already captured above before scrolling)
    if (!main) {
      return { success: false, error: 'Main element not found' };
    }

    // Step 5: Extract exchanges from DOM using conversation-container as parent

    // Find all conversation containers (each wraps one complete turn)
    const conversationContainers = Array.from(main.querySelectorAll('.conversation-container'));
    console.log(`Found ${conversationContainers.length} conversation containers`);

    const exchanges = [];
    let messageIndex = 0;

    // Process each conversation container as one exchange
    for (let containerIndex = 0; containerIndex < conversationContainers.length; containerIndex++) {
      const container = conversationContainers[containerIndex];
      const exchangeMessages = [];

      // Extract container ID for timestamp merging with Google Takeout data
      const containerId = container.id || null;

      console.log(`\n=== Processing container ${containerIndex} (ID: ${containerId}) ===`);

      // Extract ALL user-query-container elements (including nested duplicates)
      const userContainers = Array.from(container.querySelectorAll('.user-query-container'));
      console.log(`  Found ${userContainers.length} user containers (raw, including duplicates)`);

      for (let userIdx = 0; userIdx < userContainers.length; userIdx++) {
        const userContainer = userContainers[userIdx];
        const userText = extractTextContent(userContainer);

        if (userText && userText.length > 0) {
          exchangeMessages.push({
            message_index: messageIndex++,
            speaker: 'User',
            message_type: 'user_input',
            timestamp: null,
            text: userText,
            thinking_stages: null,
            duplicate_index: userIdx,  // Track which duplicate this is
            dom_tag: userContainer.tagName.toLowerCase(),
            dom_classes: Array.from(userContainer.classList).join(' ')
          });
          console.log(`    User message ${userIdx}: ${userText.substring(0, 50)}...`);
        }
      }

      // Use pre-extracted thinking blocks from map (already extracted during batch expansion)
      // Use stable ID for lookup (survives DOM virtualization)
      const stableId = getStableContainerId(container);
      const preExtractedThinking = thinkingBlocksMap.get(stableId);

      if (preExtractedThinking && preExtractedThinking.thinking_stages) {
        exchangeMessages.push({
          message_index: messageIndex++,
          speaker: 'Gemini',
          message_type: 'thinking',
          timestamp: null,
          text: null,
          thinking_stages: preExtractedThinking.thinking_stages
        });
        console.log(`    Thinking: ${preExtractedThinking.thinking_stages.length} stages (pre-extracted)`);
      } else {
        // No thinking block for this container (or extraction failed)
        const thinkingButton = container.querySelector('button[data-test-id="thoughts-header-button"]');
        if (thinkingButton) {
          console.log(`    Thinking button present but not extracted (may have failed expansion)`);
        }
      }

      // Extract ALL markdown-main-panel elements (raw, no deduplication)
      const markdownPanels = Array.from(container.querySelectorAll('.markdown-main-panel'));
      console.log(`  Found ${markdownPanels.length} markdown panels (raw, including duplicates)`);

      for (let panelIdx = 0; panelIdx < markdownPanels.length; panelIdx++) {
        const panel = markdownPanels[panelIdx];
        const clone = panel.cloneNode(true);

        // Remove thinking content from clone to avoid duplication
        const thinkingContainers = clone.querySelectorAll('[class*="model-thoughts"], [class*="thinking"], [class*="thought"]');
        thinkingContainers.forEach(tc => tc.remove());

        // Also remove thinking buttons
        const thinkingButtons = clone.querySelectorAll('button[data-test-id="thoughts-header-button"]');
        thinkingButtons.forEach(tb => tb.remove());

        // Remove other UI elements
        const uiElements = clone.querySelectorAll('button:not(pre button), [role="button"]:not(pre [role="button"])');
        uiElements.forEach(el => el.remove());

        const responseText = clone.textContent.trim();

        if (responseText && responseText.length > 0) {
          exchangeMessages.push({
            message_index: messageIndex++,
            speaker: 'Gemini',
            message_type: 'assistant_response',
            timestamp: null,
            text: responseText,
            thinking_stages: null,
            duplicate_index: panelIdx  // Track which duplicate this is
          });
          console.log(`    Response ${panelIdx}: ${responseText.substring(0, 50)}...`);
        } else {
          console.log(`    Response ${panelIdx}: EMPTY (likely streaming duplicate)`);
        }
      }

      // Create exchange with all raw messages from this container
      if (exchangeMessages.length > 0) {
        exchanges.push({
          exchange_index: containerIndex,
          container_id: containerId,  // DOM element ID for timestamp merging
          messages: exchangeMessages,
          raw_user_container_count: userContainers.length,
          raw_markdown_panel_count: markdownPanels.length
        });
      }
    }

    console.log(`\n=== Extraction Summary ===`);
    console.log(`Extracted ${exchanges.length} exchanges with ${messageIndex} total messages`);

    // Step 5: Build complete conversation object
    const conversation = {
      conversation_id: conversationId,
      title: title,
      url: window.location.href,
      export_timestamp: new Date().toISOString(),
      export_version: '2.0-raw',
      export_type: 'raw',
      export_note: 'Raw DOM extraction with all duplicates preserved. Post-processing required to deduplicate and clean data.',

      // Forensic evidence (ADR-001: Raw HTML Preservation)
      raw_html: rawHTML,
      raw_html_size_bytes: rawHTML.length,

      // Structured data
      exchange_count: exchanges.length,
      message_count: messageIndex,
      exchanges: exchanges
    };

    console.log('=== Structured Extraction Complete ===');

    return {
      success: true,
      conversation: conversation
    };

  } catch (error) {
    console.error('Error in extractStructuredConversation:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper: Extract title (re-use existing logic)
async function extractTitle() {
  const conversationId = window.location.pathname.match(/\/app\/([^/?]+)/)?.[1] || 'unknown';

  // Helper function to check if title is valid
  const isValidTitle = (title) => {
    if (!title || title.trim().length === 0) return false;
    const normalized = title.toLowerCase().trim();
    const invalidTitles = ['untitled', 'google', 'recent', 'gemini', 'new conversation'];
    return !invalidTitles.includes(normalized) && title.trim().length > 0;
  };

  // Helper function to try extracting title from various sources
  const tryExtractTitle = () => {
    // Try 1: Find conversation title in the main content area
    const conversationHeader = document.querySelector('main h1, main h2, main [role="heading"]');
    if (conversationHeader && conversationHeader.textContent.trim().length > 0) {
      const candidate = conversationHeader.textContent.trim();
      if (isValidTitle(candidate)) {
        return candidate;
      }
    }

    // Try 2: Find the conversation in the sidebar by matching the ID
    const sidebarItems = document.querySelectorAll('div.conversation-items-container');
    for (const item of sidebarItems) {
      const button = item.querySelector('div[role="button"]');
      if (button) {
        const jslog = button.getAttribute('jslog');
        if (jslog && jslog.includes(conversationId)) {
          item.scrollIntoView({ block: 'nearest', behavior: 'auto' });
          const titleEl = item.querySelector('div.conversation-title');
          if (titleEl) {
            const candidate = titleEl.textContent.trim();
            if (isValidTitle(candidate)) {
              return candidate;
            }
          }
          break;
        }
      }
    }

    // Try 3: document.title as last resort (but still validate it)
    const docTitle = document.title.replace(' - Gemini', '').replace('Gemini', '').trim();
    if (isValidTitle(docTitle)) {
      return docTitle;
    }

    return null;
  };

  // Retry loop: try up to 10 times with 1-second delays
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = tryExtractTitle();
    if (result) {
      console.log(`✓ Got valid title on attempt ${attempt + 1}: "${result}"`);
      return result;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.warn('⚠ Failed to extract valid title after 10 attempts, using "Untitled"');
  return 'Untitled';
}

async function extractCurrentConversation() {
  console.log('Extracting current conversation...');
  
  try {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let chatLoaded = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const main = document.querySelector('main');
      if (main && main.textContent.length > 500) {
        console.log(`Chat loaded after ${attempt + 1} attempts, ${main.textContent.length} chars`);
        chatLoaded = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const conversationId = window.location.pathname.match(/\/app\/([^/?]+)/)?.[1] || 'unknown';
    console.log('Conversation ID:', conversationId);

    // Helper function to check if title is valid
    const isValidTitle = (title) => {
      if (!title || title.trim().length === 0) return false;
      const normalized = title.toLowerCase().trim();
      const invalidTitles = ['untitled', 'google', 'recent', 'gemini', 'new conversation'];
      return !invalidTitles.includes(normalized) && title.trim().length > 0;
    };

    // Helper function to try extracting title from various sources
    const tryExtractTitle = () => {
      // Try 1: Find conversation title in the main content area
      const conversationHeader = document.querySelector('main h1, main h2, main [role="heading"]');
      if (conversationHeader && conversationHeader.textContent.trim().length > 0) {
        const candidate = conversationHeader.textContent.trim();
        if (isValidTitle(candidate)) {
          console.log('✓ Title from main header:', candidate);
          return { title: candidate, source: 'main header' };
        }
      }

      // Try 2: Find the conversation in the sidebar by matching the ID
      const sidebarItems = document.querySelectorAll('div.conversation-items-container');
      for (const item of sidebarItems) {
        const button = item.querySelector('div[role="button"]');
        if (button) {
          const jslog = button.getAttribute('jslog');
          if (jslog && jslog.includes(conversationId)) {
            // Scroll item into view to ensure it's rendered
            item.scrollIntoView({ block: 'nearest', behavior: 'auto' });

            const titleEl = item.querySelector('div.conversation-title');
            if (titleEl) {
              const candidate = titleEl.textContent.trim();
              if (isValidTitle(candidate)) {
                console.log('✓ Title from sidebar:', candidate);
                return { title: candidate, source: 'sidebar' };
              } else {
                console.log('⚠ Sidebar title invalid:', candidate);
              }
            }
            break;
          }
        }
      }

      // Try 3: document.title as last resort (but still validate it)
      const docTitle = document.title.replace(' - Gemini', '').replace('Gemini', '').trim();
      if (isValidTitle(docTitle)) {
        console.log('⚠ Title from document.title:', docTitle);
        return { title: docTitle, source: 'document.title' };
      }

      return null;
    };

    // Retry loop: try up to 10 times with 1-second delays
    let title = 'Untitled';
    let titleSource = 'none';

    console.log('Attempting to extract title with retry logic...');
    for (let attempt = 0; attempt < 10; attempt++) {
      const result = tryExtractTitle();

      if (result && result.title) {
        title = result.title;
        titleSource = result.source;
        console.log(`✓ Got valid title on attempt ${attempt + 1} from ${titleSource}: "${title}"`);
        break;
      } else {
        console.log(`Attempt ${attempt + 1}/10: No valid title found, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (title === 'Untitled') {
      console.error('⚠ Failed to extract valid title after 10 attempts, using "Untitled"');
    }
    
    const main = document.querySelector('main');
    if (!main) {
      return { success: false, error: 'Main element not found' };
    }
    
    // Expand all thinking blocks before extraction
    console.log('Expanding thinking blocks...');
    const expandedCount = await expandThinkingBlocks();
    console.log(`Expanded ${expandedCount} thinking blocks, waiting for content to load...`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for expansions to complete
    
    const clone = main.cloneNode(true);

    console.log(`Before cleanup, clone has ${clone.textContent.length} chars`);

    // Don't remove anything - just extract what's there
    // Google's structure should already isolate the conversation content in <main>
    // Removing elements risks deleting actual conversation content

    console.log(`After cleanup (none), clone has ${clone.textContent.length} chars`);

    if (clone.textContent.length < 200) {
      console.error('Content too small after extraction');
      console.error('Main element innerHTML:', main.innerHTML.substring(0, 500));
      return {
        success: false,
        error: `Only extracted ${clone.textContent.length} characters`
      };
    }
    
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      hr: '---',
      bulletListMarker: '-'
    });
    
    turndownService.addRule('codeBlock', {
      filter: function(node) {
        return node.nodeName === 'PRE' || 
               (node.nodeName === 'CODE' && node.parentNode.nodeName !== 'PRE');
      },
      replacement: function(content, node) {
        if (node.nodeName === 'PRE') {
          const code = node.querySelector('code');
          const language = code ? (code.className.match(/language-(\w+)/) || [])[1] : '';
          return '\n```' + (language || '') + '\n' + content + '\n```\n';
        }
        return '`' + content + '`';
      }
    });
    
    // Extract images before converting to markdown
    const images = [];
    const imgElements = main.querySelectorAll('img');

    console.log(`Found ${imgElements.length} img elements`);

    for (let i = 0; i < imgElements.length; i++) {
      const img = imgElements[i];
      const src = img.src || img.getAttribute('src');

      if (!src || src.startsWith('data:')) continue; // Skip data URLs and missing srcs

      // Only capture actual image files (not UI elements like avatars)
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)/i;
      const isImageFile = imageExtensions.test(src) ||
                          src.includes('image/') ||
                          img.naturalWidth > 0; // Has dimensions = real image

      // Skip small images (likely avatars/icons) and known avatar domains
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      const isSmallImage = width < 100 || height < 100;
      const isAvatar = src.includes('googleusercontent.com/a/') ||
                       src.includes('/avatar/') ||
                       src.includes('profile-photo');

      if (isImageFile && !isSmallImage && !isAvatar) {
        try {
          // Convert to data URL to avoid CORS issues
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.naturalWidth || img.width || 800;
          canvas.height = img.naturalHeight || img.height || 600;

          try {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');

            images.push({
              index: i,
              originalSrc: src,
              dataUrl: dataUrl,
              alt: img.alt || `Image ${i + 1}`,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height
            });

            console.log(`Captured image ${i + 1}: ${src.substring(0, 60)}...`);
          } catch (e) {
            // CORS error - try to save the URL anyway
            console.log(`CORS error for image ${i + 1}, saving URL: ${src.substring(0, 60)}...`);
            images.push({
              index: i,
              originalSrc: src,
              dataUrl: null, // Will download via background script
              alt: img.alt || `Image ${i + 1}`,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height
            });
          }
        } catch (e) {
          console.error(`Error capturing image ${i + 1}:`, e);
        }
      }
    }

    console.log(`Captured ${images.length} images`);

    const markdown = turndownService.turndown(clone.innerHTML);

    console.log(`Final markdown: ${markdown.length} characters`);

    return {
      success: true,
      markdown: markdown,
      title: title,
      id: conversationId,
      images: images
    };
  } catch (error) {
    console.error('Error in extractCurrentConversation:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

console.log('Gemini Exporter content script loaded');