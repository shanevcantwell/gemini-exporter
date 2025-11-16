// New approach: Expand and extract thinking blocks in batches while scrolling
// This overcomes DOM virtualization by extracting content immediately after expansion

async function expandAndExtractAllThinkingBlocks() {
  const main = document.querySelector('main');
  if (!main) {
    console.error('Main element not found');
    return { thinkingBlocksMap: new Map(), totalExtracted: 0 };
  }

  const thinkingBlocksMap = new Map(); // Map: conversation-container-id -> thinking content
  let totalExtracted = 0;

  console.log('=== Starting batch expansion with scroll ===');

  // Get total scroll height to know when we're done
  const totalHeight = main.scrollHeight;
  const viewportHeight = main.clientHeight;

  // Scroll to absolute top first
  main.scrollTop = 0;
  await new Promise(resolve => setTimeout(resolve, 1000));

  let currentScrollPosition = 0;
  let batchNumber = 1;
  const processedContainers = new Set(); // Track by actual DOM element reference

  while (currentScrollPosition < totalHeight) {
    console.log(`\n--- Batch ${batchNumber} (scroll position: ${currentScrollPosition}/${totalHeight}) ---`);

    // Find all thinking buttons currently visible in viewport
    const allButtons = Array.from(document.querySelectorAll('button[data-test-id="thoughts-header-button"]'));

    // Filter to only buttons in current viewport and not yet processed
    const visibleButtons = allButtons.filter(btn => {
      const rect = btn.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.top < viewportHeight * 1.5; // Include slightly below viewport

      const container = btn.closest('.conversation-container');
      const alreadyProcessed = processedContainers.has(container);

      return isVisible && !alreadyProcessed && btn.textContent.toLowerCase().includes('show thinking');
    });

    console.log(`  Found ${visibleButtons.length} unprocessed thinking blocks in viewport`);

    // Expand and extract each button in this batch
    for (let i = 0; i < visibleButtons.length; i++) {
      const button = visibleButtons[i];
      const container = button.closest('.conversation-container');

      if (!container) continue;

      try {
        // Scroll button into view
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 300));

        console.log(`  [${i + 1}/${visibleButtons.length}] Expanding thinking block...`);

        // Click to expand
        button.click();

        // Wait for expansion and verify
        let expandedContent = null;
        for (let retry = 0; retry < 10; retry++) {
          await new Promise(resolve => setTimeout(resolve, 500));

          expandedContent = container.querySelector('[class*="thoughts-content-expanded"]');
          if (expandedContent && expandedContent.textContent.trim().length > 50) {
            break;
          }
          expandedContent = null;
        }

        if (expandedContent) {
          // IMMEDIATELY extract thinking stages before scrolling away
          const stages = extractThinkingStages(expandedContent);

          if (stages && stages.length > 0) {
            // Generate container ID
            const containerId = container.id || container.getAttribute('data-id') ||
                               `container-${container.getBoundingClientRect().top}-${Date.now()}`;

            thinkingBlocksMap.set(containerId, {
              container_element: container, // Store reference to match later
              thinking_stages: stages,
              extracted_at_batch: batchNumber
            });

            totalExtracted++;
            console.log(`    ✓ Extracted ${stages.length} thinking stages`);
          } else {
            console.warn(`    ⚠ Expansion succeeded but extraction failed`);
          }

          processedContainers.add(container);
        } else {
          console.warn(`    ⚠ Failed to expand thinking block`);
        }

      } catch (e) {
        console.error(`    Error processing button:`, e);
      }
    }

    // Scroll down to next batch
    const scrollIncrement = viewportHeight * 0.8; // 80% of viewport to have some overlap
    currentScrollPosition += scrollIncrement;
    main.scrollTop = currentScrollPosition;

    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for new content to render

    // Safety check: if no buttons found in last few batches, we might be done
    if (visibleButtons.length === 0) {
      console.log(`  No buttons in viewport, scrolling to find more...`);
      batchNumber++;

      // If we've scrolled past the content, break
      if (currentScrollPosition > totalHeight + viewportHeight) {
        console.log(`  Reached end of content`);
        break;
      }

      continue;
    }

    batchNumber++;

    // Safety limit
    if (batchNumber > 100) {
      console.warn('Safety limit reached (100 batches)');
      break;
    }
  }

  console.log(`\n=== Batch expansion complete ===`);
  console.log(`Total thinking blocks extracted: ${totalExtracted}`);
  console.log(`Batches processed: ${batchNumber - 1}`);

  return { thinkingBlocksMap, totalExtracted };
}

// Helper function (already exists in content.js, copying here for reference)
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
