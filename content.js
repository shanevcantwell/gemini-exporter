// content.js - Fixed conversation detection
let shouldCancel = false;
let autoExportEnabled = false;
let lastExportedConversationId = null;
let autoClickEnabled = false;
let autoClickInterval = null;
let currentClickIndex = 0;

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
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    console.log('Keyboard shortcut triggered, exporting current conversation...');
    exportCurrentConversation();
  }
});

async function exportCurrentConversation(sequenceIndex = null) {
  try {
    const result = await extractCurrentConversation();
    if (result.success) {
      lastExportedConversationId = result.id;

      // Send to background script for download
      chrome.runtime.sendMessage({
        action: 'downloadConversation',
        data: result,
        sequenceIndex: sequenceIndex  // Pass index for auto-click mode
      });

      console.log('✓ Exported:', result.title, sequenceIndex !== null ? `(#${sequenceIndex})` : '');
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
      exportCurrentConversation()
        .then(() => sendResponse({ success: true }))
        .catch(error => {
          console.error('Error exporting:', error);
          sendResponse({ success: false, error: error.message });
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
function startAutoClick(startIndex = 0) {
  console.log(`Starting auto-click from index ${startIndex}`);
  currentClickIndex = startIndex;
  autoClickEnabled = true;
  autoExportEnabled = true; // Enable auto-export when auto-clicking
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
    if (!button) return null;
    
    const jslog = button.getAttribute('jslog');
    if (!jslog) return null;
    
    const match = jslog.match(/"(c_[a-f0-9]{16})"/);
    
    if (match && match[1]) {
      return match[1];
    }
    
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
      }
    }
    
    console.log(`Successfully extracted ${conversations.length} conversations`);
    
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
      }
    }

    console.log(`After ${scrollCount} scrolls: ${conversations.length} total conversations loaded`);

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

async function expandThinkingBlocks() {
  // Find all thinking block expand buttons using reliable selectors
  let expandedCount = 0;
  let buttons = [];

  // Try to find buttons with the most reliable selector first
  buttons = document.querySelectorAll('button[data-test-id="thoughts-header-button"]');

  // Fallback: find buttons inside model-thoughts containers
  if (buttons.length === 0) {
    const thoughtContainers = document.querySelectorAll('[data-test-id="model-thoughts"]');
    console.log(`Found ${thoughtContainers.length} model-thoughts containers`);
    buttons = [];
    thoughtContainers.forEach(container => {
      const button = container.querySelector('button');
      if (button) buttons.push(button);
    });
  }

  // Another fallback: look for buttons with "Show thinking" or "Hide thinking" text
  if (buttons.length === 0) {
    const allButtons = document.querySelectorAll('button');
    buttons = Array.from(allButtons).filter(btn => {
      const text = btn.textContent.toLowerCase();
      return text.includes('show thinking') || text.includes('hide thinking');
    });
  }

  console.log(`Found ${buttons.length} thinking block buttons to process`);

  for (const button of buttons) {
    try {
      const buttonText = button.textContent.toLowerCase();

      // Only click if it says "Show thinking" (not "Hide thinking")
      if (buttonText.includes('show thinking')) {
        console.log('Expanding thinking block');
        button.click();
        expandedCount++;
        await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay between expansions
      } else {
        console.log('Thinking block already expanded (shows "Hide thinking")');
      }
    } catch (e) {
      console.error('Error expanding button:', e);
    }
  }

  console.log(`Expanded ${expandedCount} thinking blocks`);
  return expandedCount;
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