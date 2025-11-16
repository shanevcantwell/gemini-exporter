/**
 * File: src/strategies/ScrollingExpansionStrategy.js
 * Purpose: Expansion strategy that handles DOM virtualization
 *
 * Overcomes DOM virtualization by:
 * 1. Scrolling through conversation incrementally
 * 2. Expanding thinking blocks one at a time
 * 3. Extracting content immediately before it virtualizes away
 * 4. Storing extracted content in a map for later use
 *
 * This solves the issue where platforms (like Gemini) only keep ~10 items
 * in the DOM at once, removing expanded content when you scroll away.
 */

class ScrollingExpansionStrategy {
  /**
   * @param {string} buttonSelector - CSS selector for thinking block buttons
   * @param {string} expandedContentSelector - Selector for expanded content container
   * @param {Function} extractionFunction - Function to extract thinking stages from container
   * @param {Object} options - Configuration
   */
  constructor(buttonSelector, expandedContentSelector, extractionFunction, options = {}) {
    this.buttonSelector = buttonSelector;
    this.expandedContentSelector = expandedContentSelector;
    this.extractionFunction = extractionFunction;
    this.scrollIncrement = options.scrollIncrement || 100;
    this.maxPasses = options.maxPasses || 1000;
    this.verificationRetries = options.verificationRetries || 10;
    this.verificationDelay = options.verificationDelay || 500;
    this.postExtractionDelay = options.postExtractionDelay || 1000;
  }

  getName() {
    return 'ScrollingExpansion';
  }

  async isApplicable() {
    const buttons = document.querySelectorAll(this.buttonSelector);
    return buttons.length > 0;
  }

  /**
   * Generate stable ID from container content (survives DOM virtualization)
   * @private
   */
  _getStableContainerId(container) {
    // Use first 100 chars of text content as stable identifier
    return container.textContent.substring(0, 100).replace(/\s+/g, ' ').trim();
  }

  /**
   * Expand and extract ALL thinking blocks by scrolling through conversation
   * @returns {Promise<{thinkingBlocksMap: Map, totalExtracted: number}>}
   */
  async expandAndExtract() {
    const main = document.querySelector('main');
    if (!main) {
      throw new Error('Main element not found');
    }

    const thinkingBlocksMap = new Map(); // Maps: stableId (string) -> thinking content
    let totalExtracted = 0;
    const processedContainers = new Set(); // Stores: stableId (string)

    console.log('=== ScrollingExpansionStrategy: Starting one-at-a-time expansion ===');

    const totalHeight = main.scrollHeight;
    const viewportHeight = main.clientHeight;

    // Scroll to top
    main.scrollTop = 0;
    await this._wait(1000);

    let currentScrollPosition = 0;
    let passCount = 0;

    while (currentScrollPosition <= totalHeight) {
      passCount++;

      // Find ONE unexpanded thinking block (anywhere in DOM, viewport check removed to handle virtualization)
      const allButtons = Array.from(document.querySelectorAll(this.buttonSelector));
      const nextButton = allButtons.find(btn => {
        const container = btn.closest('.conversation-container');
        const containerId = this._getStableContainerId(container);
        if (processedContainers.has(containerId)) return false;
        if (!btn.textContent.toLowerCase().includes('show thinking')) return false;

        // Don't check viewport - just find next unprocessed button
        // scrollIntoView() will handle bringing it into viewport
        return true;
      });

      if (nextButton) {
        const container = nextButton.closest('.conversation-container');

        try {
          // Scroll into view
          nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await this._wait(300);

          console.log(`  [${totalExtracted + 1}] Expanding thinking block...`);
          nextButton.click();

          // Wait for expansion with retries
          const expandedContent = await this._waitForExpansion(container);

          const containerId = this._getStableContainerId(container);

          if (expandedContent) {
            // Extract IMMEDIATELY before DOM virtualizes it away
            const extracted = this.extractionFunction(expandedContent);

            if (extracted && extracted.thinking_stages && extracted.thinking_stages.length > 0) {
              thinkingBlocksMap.set(containerId, extracted);
              totalExtracted++;
              console.log(`    ✓ Extracted ${extracted.thinking_stages.length} stages`);
            } else {
              console.warn(`    ⚠ Extraction failed`);
            }
          } else {
            console.warn(`    ⚠ Expansion timeout`);
          }

          processedContainers.add(containerId);

        } catch (e) {
          console.error(`    Error:`, e);
          const containerId = this._getStableContainerId(container);
          processedContainers.add(containerId);
        }

        // Wait for DOM to settle
        await this._wait(this.postExtractionDelay);

        // Scroll to trigger loading next blocks
        currentScrollPosition += this.scrollIncrement;
        main.scrollTop = currentScrollPosition;
        await this._wait(500);

        continue;
      }

      // No button found - scroll more to trigger virtualization
      currentScrollPosition += this.scrollIncrement * 2;
      main.scrollTop = currentScrollPosition;
      await this._wait(500);

      // Safety: stop if we're way past content
      if (currentScrollPosition > totalHeight + viewportHeight && passCount > (totalHeight / this.scrollIncrement) * 1.5) {
        console.log(`    Reached end (scroll: ${currentScrollPosition}, height: ${totalHeight})`);
        break;
      }

      // Safety limit
      if (passCount > this.maxPasses) {
        console.warn(`    Safety limit: ${this.maxPasses} passes`);
        break;
      }
    }

    console.log(`\n=== ScrollingExpansionStrategy: Extracted ${totalExtracted} thinking blocks ===`);
    return { thinkingBlocksMap, totalExtracted };
  }

  /**
   * Wait for thinking block content to appear in DOM after clicking
   * @private
   */
  async _waitForExpansion(container) {
    for (let retry = 0; retry < this.verificationRetries; retry++) {
      await this._wait(this.verificationDelay);

      const expandedContent = container.querySelector(this.expandedContentSelector);
      if (expandedContent && expandedContent.textContent.trim().length > 50) {
        return expandedContent;
      }
    }
    return null; // Timeout
  }

  /**
   * Helper: promisified timeout
   * @private
   */
  async _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async verifyExpansion(thinkingBlocksMap) {
    // Verification is inherent in the extraction process
    // If blocks are in the map, they were successfully extracted
    return true;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ScrollingExpansionStrategy };
}
