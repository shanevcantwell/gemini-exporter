/**
 * File: src/strategies/StrategySelector.js
 * Purpose: Select and execute expansion strategies with fallback chain (ADR-008)
 *
 * Tries strategies in priority order until one succeeds.
 * Provides graceful degradation when primary strategy fails.
 */

/**
 * Manages registration and selection of expansion strategies.
 * Implements fallback chain pattern for resilient expansion.
 */
class ExpansionStrategySelector {
  constructor() {
    /**
     * @type {Array<ExpansionStrategy>}
     * Strategies in priority order (first = highest priority)
     */
    this.strategies = [];
  }

  /**
   * Register a strategy in the fallback chain.
   * Strategies are tried in registration order.
   *
   * @param {ExpansionStrategy} strategy - Strategy to register
   */
  registerStrategy(strategy) {
    this.strategies.push(strategy);
    console.log(`Registered expansion strategy: ${strategy.getName()}`);
  }

  /**
   * Select the first applicable strategy.
   * Used when you want to know which strategy will be used without executing it.
   *
   * @returns {Promise<ExpansionStrategy>} First applicable strategy
   * @throws {Error} If no applicable strategy found
   */
  async selectStrategy() {
    for (const strategy of this.strategies) {
      try {
        if (await strategy.isApplicable()) {
          console.log(`Selected expansion strategy: ${strategy.getName()}`);
          return strategy;
        }
      } catch (error) {
        console.warn(`Strategy ${strategy.getName()} failed applicability check:`, error);
        // Continue to next strategy
      }
    }

    throw new Error('No applicable expansion strategy found. This should not happen if NoThinkingStrategy is registered.');
  }

  /**
   * Execute expansion using first applicable strategy.
   * Implements fallback chain: if a strategy fails verification, tries next strategy.
   *
   * @param {number} verificationThreshold - Success rate threshold (0.0-1.0)
   * @returns {Promise<Object>} Expansion result
   * @returns {string} result.strategy - Strategy name that succeeded
   * @returns {number} result.expandedCount - Number of items expanded
   * @returns {boolean} result.verified - Whether expansion was verified
   * @throws {Error} If all strategies fail
   */
  async executeExpansion(verificationThreshold = 1.0) {
    const attemptedStrategies = [];

    for (const strategy of this.strategies) {
      try {
        // Check if strategy is applicable
        if (!(await strategy.isApplicable())) {
          console.log(`⊘ Strategy ${strategy.getName()} not applicable, trying next...`);
          continue;
        }

        console.log(`▶ Attempting expansion with ${strategy.getName()} strategy...`);

        // Execute expansion
        const expandedCount = await strategy.expand();

        // Verify expansion
        const verified = await strategy.verifyExpansion(verificationThreshold);

        if (verified) {
          console.log(`✓ Expansion successful with ${strategy.getName()}: ${expandedCount} items expanded`);
          return {
            strategy: strategy.getName(),
            expandedCount: expandedCount,
            verified: true
          };
        } else {
          // Verification failed, try next strategy
          console.warn(`⚠ ${strategy.getName()} completed but verification failed, trying next strategy...`);
          attemptedStrategies.push({
            name: strategy.getName(),
            error: 'Verification failed'
          });
        }

      } catch (error) {
        console.warn(`✗ ${strategy.getName()} failed:`, error.message);
        attemptedStrategies.push({
          name: strategy.getName(),
          error: error.message
        });
        // Try next strategy
      }
    }

    // All strategies failed
    const errorSummary = attemptedStrategies
      .map(s => `${s.name}: ${s.error}`)
      .join('; ');

    throw new Error(
      `All expansion strategies failed. Attempted: ${errorSummary || 'none'}`
    );
  }

  /**
   * Get list of registered strategies (for debugging/logging).
   * @returns {Array<string>} Strategy names in priority order
   */
  getRegisteredStrategies() {
    return this.strategies.map(s => s.getName());
  }

  /**
   * Clear all registered strategies.
   * Useful for testing or reconfiguration.
   */
  clearStrategies() {
    this.strategies = [];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExpansionStrategySelector };
}
