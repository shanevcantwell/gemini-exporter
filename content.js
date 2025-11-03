// content.js - Fixed conversation detection
let shouldCancel = false;

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
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ success: false, error: error.message });
  }
});

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
    
    let title = document.title.replace(' - Gemini', '').replace('Gemini', '').trim() || 'Untitled';
    console.log('Title:', title);
    
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
    
    // Remove sidebar and UI chrome
    const removeSelectors = [
      '.gb_0d',              // Sidebar
      'nav',                 // Navigation
      'header',              // Headers
      '[class*="sidebar"]',  // Any sidebar variants
      '[class*="navigation"]'
    ];
    
    removeSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    console.log(`After cleanup, clone has ${clone.textContent.length} chars`);
    
    if (clone.textContent.length < 200) {
      console.error('Content too small after extraction');
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
    
    const markdown = turndownService.turndown(clone.innerHTML);
    
    console.log(`Final markdown: ${markdown.length} characters`);
    
    return { 
      success: true, 
      markdown: markdown,
      title: title,
      id: conversationId
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