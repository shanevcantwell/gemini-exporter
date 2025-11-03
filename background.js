// background.js - With start index and numbered files
let isExporting = false;
let shouldCancel = false;
let exportedCount = 0;
let exportedConversations = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startExport') {
    startExport(message.tabId, message.startIndex || 0).then(sendResponse);
    return true;
  } else if (message.action === 'cancelExport') {
    shouldCancel = true;
    isExporting = false;
    sendResponse({ success: true });
  } else if (message.action === 'downloadConversation') {
    downloadSingleConversation(message.data, message.sequenceIndex).then(sendResponse);
    return true;
  }
});

async function downloadSingleConversation(data, sequenceIndex = null) {
  try {
    // Skip if already exported
    if (exportedConversations.has(data.id)) {
      console.log('Already exported:', data.title);
      return { success: true, skipped: true };
    }

    // Use sequenceIndex if provided (auto-click mode), otherwise use exportedCount (manual mode)
    const index = sequenceIndex !== null ? sequenceIndex : exportedCount;
    const paddedIndex = String(index).padStart(4, '0');
    const cleanTitle = sanitizeFilename(data.title || `conversation_${index}`);
    const folderName = `${paddedIndex}_${cleanTitle}_${data.id}`;

    let markdown = data.markdown;

    // Download images
    if (data.images && data.images.length > 0) {
      console.log(`Downloading ${data.images.length} images...`);

      for (let imgIndex = 0; imgIndex < data.images.length; imgIndex++) {
        const img = data.images[imgIndex];
        const imgFilename = `image_${String(imgIndex + 1).padStart(3, '0')}.png`;

        try {
          if (img.dataUrl) {
            await chrome.downloads.download({
              url: img.dataUrl,
              filename: `gemini_export/${folderName}/images/${imgFilename}`,
              saveAs: false
            });
          } else if (img.originalSrc) {
            try {
              await chrome.downloads.download({
                url: img.originalSrc,
                filename: `gemini_export/${folderName}/images/${imgFilename}`,
                saveAs: false
              });
            } catch (e) {
              console.log(`⚠ Could not download image ${imgIndex + 1}`);
            }
          }

          // Replace image references in markdown
          const localPath = `./images/${imgFilename}`;
          const altText = img.alt || `Image ${imgIndex + 1}`;

          if (img.originalSrc) {
            markdown = markdown.replace(
              new RegExp(img.originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              localPath
            );
          }

          if (!markdown.includes(localPath)) {
            markdown += `\n\n![${altText}](${localPath})\n`;
          }
        } catch (error) {
          console.error(`Error downloading image ${imgIndex + 1}:`, error);
        }
      }
    }

    const header = `# ${data.title}\n\n` +
                  `**Conversation ID:** ${data.id}\n` +
                  `**URL:** https://gemini.google.com/app/${data.id}\n` +
                  `**Export Number:** ${index + 1}\n` +
                  `**Images:** ${data.images ? data.images.length : 0}\n\n` +
                  `---\n\n`;

    const finalMarkdown = header + markdown;
    const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(finalMarkdown);
    const filename = `${folderName}.md`;

    await chrome.downloads.download({
      url: dataUrl,
      filename: `gemini_export/${folderName}/${filename}`,
      saveAs: false
    });

    exportedConversations.add(data.id);

    // Only increment exportedCount in manual mode (when sequenceIndex is null)
    if (sequenceIndex === null) {
      exportedCount++;
    }

    console.log(`✓ Exported #${index + 1}: ${filename} (${data.images ? data.images.length : 0} images)`);

    return { success: true, count: index + 1 };
  } catch (error) {
    console.error('Download error:', error);
    return { success: false, error: error.message };
  }
}

async function startExport(tabId, startIndex) {
  if (isExporting) {
    return { success: false, error: 'Export already in progress' };
  }

  isExporting = true;
  shouldCancel = false;

  try {
    console.log(`Starting export from index ${startIndex}...`);
    console.log(`Using incremental scrolling - will scroll as needed to reach target conversations`);

    let allConversations = [];
    let scrollAttempts = 0;
    const maxScrollAttempts = 100; // Prevent infinite loops

    // Scroll until we have enough conversations to reach startIndex
    while (allConversations.length <= startIndex && scrollAttempts < maxScrollAttempts) {
      console.log(`Scrolling to load more conversations (currently have ${allConversations.length}, need at least ${startIndex + 1})...`);

      const result = await chrome.tabs.sendMessage(tabId, {
        action: 'scrollAndGetConversations',
        scrollCount: 5
      });

      if (!result.success) {
        isExporting = false;
        return { success: false, error: result.error };
      }

      allConversations = result.conversations;
      scrollAttempts++;

      // If we can't scroll more and still don't have enough, stop
      if (!result.canScrollMore && allConversations.length <= startIndex) {
        isExporting = false;
        return {
          success: false,
          error: `Only ${allConversations.length} conversations found, cannot start at index ${startIndex}`
        };
      }

      // If we can't scroll more, we've loaded everything
      if (!result.canScrollMore) {
        console.log(`Reached end of conversation list at ${allConversations.length} conversations`);
        break;
      }
    }

    console.log(`Loaded ${allConversations.length} conversations, starting export from index ${startIndex}`);

    let exported = 0;
    let currentConversationIndex = startIndex;
    let canScrollMore = true;

    // Export loop - will continue scrolling as needed
    while (currentConversationIndex < allConversations.length || canScrollMore) {
      if (shouldCancel) {
        console.log('Export cancelled by user');
        break;
      }

      // If we've reached the end of loaded conversations, scroll for more
      if (currentConversationIndex >= allConversations.length && canScrollMore) {
        console.log(`Scrolling to load more conversations (currently have ${allConversations.length})...`);

        const result = await chrome.tabs.sendMessage(tabId, {
          action: 'scrollAndGetConversations',
          scrollCount: 5
        });

        if (!result.success) {
          console.error('Failed to scroll for more conversations:', result.error);
          break;
        }

        allConversations = result.conversations;
        canScrollMore = result.canScrollMore;

        if (currentConversationIndex >= allConversations.length) {
          console.log('No more conversations to export');
          break;
        }
      }

      if (currentConversationIndex >= allConversations.length) {
        break;
      }

      const conv = allConversations[currentConversationIndex];
      const totalKnown = allConversations.length;
      const remaining = totalKnown - currentConversationIndex;

      console.log(`[${currentConversationIndex + 1}/${totalKnown}${canScrollMore ? '+' : ''}] ${conv.title}`);
      
      try {
        chrome.runtime.sendMessage({
          type: 'exportProgress',
          current: currentConversationIndex + 1,
          total: totalKnown,
          currentTitle: conv.title
        });
      } catch (e) {}
      
      // Click the conversation in sidebar to trigger Google's SPA router
      // Direct navigation doesn't work - Google requires actual user interaction
      try {
        console.log(`Clicking conversation in sidebar: ${conv.title}`);
        const clickResult = await chrome.tabs.sendMessage(tabId, {
          action: 'clickConversationByIndex',
          index: currentConversationIndex
        });

        if (!clickResult.success) {
          console.error(`Failed to click conversation: ${clickResult.error}`);
          currentConversationIndex++;
          continue;
        }

        // Wait for click and navigation to complete
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify the conversation actually loaded by checking the URL and content
        let loaded = false;
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const tab = await chrome.tabs.get(tabId);
          const urlMatches = tab.url.includes(conv.id);

          // Try to ping the content script to see if page has content
          try {
            const checkResult = await chrome.tabs.sendMessage(tabId, {
              action: 'extractConversationId'
            });

            if (checkResult && checkResult.id === conv.id) {
              console.log(`✓ Conversation loaded after ${attempt + 1} attempts`);
              loaded = true;
              break;
            }
          } catch (e) {
            // Content script not ready yet
          }
        }

        if (!loaded) {
          console.error(`Conversation ${conv.id} did not load properly, skipping`);
          currentConversationIndex++;
          continue;
        }

        // Extra wait for content to fully render
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to navigate to conversation ${currentConversationIndex}:`, error);
        currentConversationIndex++;
        continue;
      }

      let contentResult;
      try {
        contentResult = await chrome.tabs.sendMessage(tabId, {
          action: 'extractConversation'
        });
      } catch (error) {
        console.error(`Failed to extract conversation ${currentConversationIndex}:`, error);
        currentConversationIndex++;
        continue;
      }

      if (contentResult && contentResult.success && contentResult.markdown) {
        const paddedIndex = String(currentConversationIndex).padStart(4, '0');
        const cleanTitle = sanitizeFilename(conv.title || `conversation_${currentConversationIndex}`);
        const folderName = `${paddedIndex}_${cleanTitle}_${contentResult.id}`;

        // Download images first
        let markdown = contentResult.markdown;
        if (contentResult.images && contentResult.images.length > 0) {
          console.log(`Downloading ${contentResult.images.length} images...`);

          for (let imgIndex = 0; imgIndex < contentResult.images.length; imgIndex++) {
            const img = contentResult.images[imgIndex];
            const imgFilename = `image_${String(imgIndex + 1).padStart(3, '0')}.png`;

            try {
              if (img.dataUrl) {
                // Download from data URL
                await chrome.downloads.download({
                  url: img.dataUrl,
                  filename: `gemini_export/${folderName}/images/${imgFilename}`,
                  saveAs: false
                });
                console.log(`  ✓ Downloaded image ${imgIndex + 1}/${contentResult.images.length}`);
              } else if (img.originalSrc) {
                // Try to download from original URL
                try {
                  await chrome.downloads.download({
                    url: img.originalSrc,
                    filename: `gemini_export/${folderName}/images/${imgFilename}`,
                    saveAs: false
                  });
                  console.log(`  ✓ Downloaded image ${imgIndex + 1}/${contentResult.images.length} from URL`);
                } catch (e) {
                  console.log(`  ⚠ Could not download image ${imgIndex + 1}, keeping URL reference`);
                }
              }

              // Replace image references in markdown
              const localPath = `./images/${imgFilename}`;
              const altText = img.alt || `Image ${imgIndex + 1}`;

              // Try to find and replace the image reference
              // This is a simple approach - might need refinement
              if (img.originalSrc) {
                markdown = markdown.replace(
                  new RegExp(img.originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                  localPath
                );
              }

              // Also add image references at the end if not already in markdown
              if (!markdown.includes(localPath)) {
                markdown += `\n\n![${altText}](${localPath})\n`;
              }
            } catch (error) {
              console.error(`Error downloading image ${imgIndex + 1}:`, error);
            }
          }
        }

        const header = `# ${contentResult.title}\n\n` +
                      `**Conversation ID:** ${contentResult.id}\n` +
                      `**URL:** ${conv.url}\n` +
                      `**Position:** ${currentConversationIndex + 1} of ${totalKnown}${canScrollMore ? '+' : ''}\n` +
                      `**Images:** ${contentResult.images ? contentResult.images.length : 0}\n\n` +
                      `---\n\n`;

        const finalMarkdown = header + markdown;

        const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(finalMarkdown);

        // Format: 0001_sanitized_title_id.md
        const filename = `${folderName}.md`;

        try {
          await chrome.downloads.download({
            url: dataUrl,
            filename: `gemini_export/${folderName}/${filename}`,
            saveAs: false
          });

          exported++;
          console.log(`✓ Exported: ${filename} (${contentResult.images ? contentResult.images.length : 0} images)`);
        } catch (downloadError) {
          console.error(`Download failed for ${filename}:`, downloadError);
        }
      } else {
        console.error(`No content extracted for conversation ${currentConversationIndex}`);
      }

      // Move to next conversation
      currentConversationIndex++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    try {
      chrome.runtime.sendMessage({
        type: 'exportComplete',
        total: exported
      });
    } catch (e) {}

    isExporting = false;
    const totalProcessed = currentConversationIndex - startIndex;
    console.log(`Export complete: ${exported} successfully exported out of ${totalProcessed} processed`);
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