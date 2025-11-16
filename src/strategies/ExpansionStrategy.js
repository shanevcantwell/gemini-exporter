/**
 * File: src/strategies/ExpansionStrategy.js
 * Purpose: Strategy pattern for thinking block expansion (ADR-008)
 *
 * Each strategy encapsulates a different method of revealing hidden content.
 * Strategies are tried in order until one succeeds.
 */

/**
 * Abstract base class for expansion strategies.
 * All concrete strategies must implement these methods.
 */
class ExpansionStrategy {
  /**
   * @returns {string} Strategy name for logging
   */
  getName() {
    throw new Error('ExpansionStrategy.getName() must be implemented');
  }

  /**
   * Check if this strategy is applicable to the current page.
   * @returns {Promise<boolean>} True if this strategy can be used
   */
  async isApplicable() {
    throw new Error('ExpansionStrategy.isApplicable() must be implemented');
  }

  /**
   * Expand all thinking blocks using this strategy.
   * @returns {Promise<number>} Number of items expanded
   * @throws {ExpansionError} If expansion fails
   */
  async expand() {
    throw new Error('ExpansionStrategy.expand() must be implemented');
  }

  /**
   * Verify that all content has been revealed.
   * @param {number} successThreshold - Minimum success rate (0.0-1.0), default 1.0 (100%)
   * @returns {Promise<boolean>} True if verification passes
   */
  async verifyExpansion(successThreshold = 1.0) {
    throw new Error('ExpansionStrategy.verifyExpansion() must be implemented');
  }
}

/**
 * Strategy for platforms with clickable expand/collapse buttons.
 * Currently used for Gemini's "Show thinking" / "Hide thinking" buttons.
 */
class ButtonClickStrategy extends ExpansionStrategy {
  /**
   * @param {string} buttonSelector - CSS selector for thinking block buttons
   * @param {string} expandedText - Text that appears when block is expanded (e.g., "hide thinking")
   * @param {Object} options - Additional configuration
   * @param {number} options.maxPasses - Maximum expansion passes to prevent infinite loops
   * @param {number} options.scrollDelay - Delay after scrollIntoView (ms)
   * @param {number} options.clickDelay - Delay after clicking button (ms)
   */
  constructor(buttonSelector, expandedText = 'hide thinking', options = {}) {
    super();
    this.buttonSelector = buttonSelector;
    this.expandedText = expandedText.toLowerCase();
    this.maxPasses = options.maxPasses || 10;
    this.scrollDelay = options.scrollDelay || 100;  // Reduced from 500ms for performance
    this.clickDelay = options.clickDelay || 100;    // Reduced from 500ms for performance
  }

  getName() {
    return 'ButtonClick';
  }

  async isApplicable() {
    const buttons = document.querySelectorAll(this.buttonSelector);
    return buttons.length > 0;
  }

  async expand() {
    let expandedCount = 0;
    const expandedContainers = new Set();

    for (let pass = 0; pass < this.maxPasses; pass++) {
      const buttons = Array.from(document.querySelectorAll(this.buttonSelector));

      // Filter to only unexpanded buttons
      const buttonsToExpand = buttons.filter(btn => {
        const text = btn.textContent.toLowerCase();
        if (text.includes(this.expandedText)) return false;

        // Check if container already expanded (by ID or data-id)
        const container = btn.closest('[data-message-container], .conversation-container');
        const containerId = container?.id || container?.getAttribute('data-id');
        if (containerId && expandedContainers.has(containerId)) {
          return false;
        }
        return true;
      });

      if (buttonsToExpand.length === 0) {
        console.log(`✓ ButtonClickStrategy: No more buttons to expand after ${pass} passes`);
        break;
      }

      console.log(`ButtonClickStrategy pass ${pass + 1}: Expanding ${buttonsToExpand.length} buttons`);

      for (const button of buttonsToExpand) {
        // Scroll button into view (instant, not smooth, for performance)
        button.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, this.scrollDelay));

        // Click button
        button.click();

        // Track expanded container
        const container = button.closest('[data-message-container], .conversation-container');
        const containerId = container?.id || container?.getAttribute('data-id') || `temp-${expandedCount}`;
        expandedContainers.add(containerId);
        expandedCount++;

        // Wait for expansion to complete
        await new Promise(resolve => setTimeout(resolve, this.clickDelay));
      }
    }

    console.log(`✓ ButtonClickStrategy: Expanded ${expandedCount} thinking blocks`);
    return expandedCount;
  }

  async verifyExpansion(successThreshold = 1.0) {
    const buttons = Array.from(document.querySelectorAll(this.buttonSelector));
    if (buttons.length === 0) {
      // No buttons found - either all expanded or no thinking blocks
      return true;
    }

    const unexpanded = buttons.filter(btn =>
      !btn.textContent.toLowerCase().includes(this.expandedText)
    );

    const expansionRate = 1 - (unexpanded.length / buttons.length);

    if (expansionRate < successThreshold) {
      throw new ExpansionError(
        `Expansion verification failed: ${unexpanded.length}/${buttons.length} buttons remain unexpanded (${(expansionRate * 100).toFixed(1)}% success rate, threshold ${(successThreshold * 100).toFixed(0)}%)`
      );
    }

    console.log(`✓ ButtonClickStrategy verification passed: ${buttons.length - unexpanded.length}/${buttons.length} expanded`);
    return true;
  }
}

/**
 * Fallback strategy for platforms where thinking content is always visible.
 * Used when no expansion mechanism is needed.
 */
class AlwaysVisibleStrategy extends ExpansionStrategy {
  getName() {
    return 'AlwaysVisible';
  }

  async isApplicable() {
    // Check if there are thinking blocks but no expand buttons
    const thinkingBlocks = document.querySelectorAll('[data-thinking-block], [class*="thinking"]');
    const expandButtons = document.querySelectorAll('[data-expand-thinking], button[data-test-id*="thought"]');
    return thinkingBlocks.length > 0 && expandButtons.length === 0;
  }

  async expand() {
    const thinkingBlocks = document.querySelectorAll('[data-thinking-block], [class*="thinking"]');
    console.log(`✓ AlwaysVisibleStrategy: ${thinkingBlocks.length} thinking blocks already visible`);
    return thinkingBlocks.length;
  }

  async verifyExpansion() {
    return true; // Always verified since content is always visible
  }
}

/**
 * Fallback strategy for platforms without thinking blocks.
 * Always succeeds with 0 expansions.
 */
class NoThinkingStrategy extends ExpansionStrategy {
  getName() {
    return 'NoThinking';
  }

  async isApplicable() {
    return true; // Always applicable as final fallback
  }

  async expand() {
    console.log('✓ NoThinkingStrategy: No thinking blocks found on this platform');
    return 0;
  }

  async verifyExpansion() {
    return true; // Always verified
  }
}

/**
 * Custom error for expansion failures.
 * Includes strategy name for debugging.
 */
class ExpansionError extends Error {
  constructor(message, strategy = null) {
    super(message);
    this.name = 'ExpansionError';
    this.strategy = strategy;
    this.forensic = true; // Flag for forensic error handling
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExpansionStrategy,
    ButtonClickStrategy,
    AlwaysVisibleStrategy,
    NoThinkingStrategy,
    ExpansionError
  };
}
