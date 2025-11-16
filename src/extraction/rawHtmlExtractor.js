/**
 * File: src/extraction/rawHtmlExtractor.js
 * Purpose: Extract raw HTML from conversation container (ADR-001, ADR-009)
 *
 * Captures the complete outerHTML of the main conversation container
 * after all thinking blocks have been expanded and lazy content loaded.
 *
 * Forensic considerations:
 * - Raw HTML is captured EXACTLY as rendered
 * - No filtering, cleaning, or transformation
 * - Includes all duplicate containers (Gemini renders duplicates)
 * - Preserves all attributes, classes, data-* attributes
 */

/**
 * Extract raw HTML from the main conversation container.
 *
 * @param {Object} options - Extraction options
 * @param {string} options.containerSelector - CSS selector for main container (default: 'main')
 * @param {boolean} options.includeContainer - Include container element itself (default: true)
 * @returns {string} Raw HTML string
 * @throws {Error} If container not found or HTML extraction fails
 */
function extractRawHTML(options = {}) {
  const {
    containerSelector = 'main',
    includeContainer = true
  } = options;

  // Find main conversation container
  const container = document.querySelector(containerSelector);

  if (!container) {
    throw new Error(`Raw HTML extraction failed: Container not found (selector: ${containerSelector})`);
  }

  // Verify container has content
  if (!container.textContent || container.textContent.trim().length === 0) {
    throw new Error(`Raw HTML extraction failed: Container is empty (selector: ${containerSelector})`);
  }

  // Extract HTML
  const rawHTML = includeContainer ? container.outerHTML : container.innerHTML;

  // Verify extraction succeeded
  if (!rawHTML || rawHTML.length === 0) {
    throw new Error('Raw HTML extraction failed: Extracted HTML is empty');
  }

  console.log(`✓ Raw HTML extracted: ${rawHTML.length} characters from <${container.tagName.toLowerCase()}>`);

  return rawHTML;
}

/**
 * Verify raw HTML contains expected content.
 * Used as sanity check before proceeding to parsing.
 *
 * @param {string} rawHTML - Raw HTML to verify
 * @param {Object} checks - Verification checks to perform
 * @param {number} checks.minLength - Minimum HTML length (default: 500 chars)
 * @param {Array<string>} checks.requiredElements - Elements that must be present (default: [])
 * @param {Array<string>} checks.forbiddenContent - Content that should not be present (default: [])
 * @returns {Object} Verification result
 * @returns {boolean} result.valid - Whether verification passed
 * @returns {Array<string>} result.warnings - Non-critical issues found
 * @returns {Array<string>} result.errors - Critical issues found
 */
function verifyRawHTML(rawHTML, checks = {}) {
  const {
    minLength = 500,
    requiredElements = [],
    forbiddenContent = []
  } = checks;

  const warnings = [];
  const errors = [];

  // Check minimum length
  if (rawHTML.length < minLength) {
    errors.push(`HTML too short: ${rawHTML.length} chars (minimum: ${minLength})`);
  }

  // Check for required elements (if specified)
  for (const element of requiredElements) {
    if (!rawHTML.includes(element)) {
      warnings.push(`Missing expected element: ${element}`);
    }
  }

  // Check for forbidden content (if specified)
  for (const content of forbiddenContent) {
    if (rawHTML.includes(content)) {
      errors.push(`Found forbidden content: ${content}`);
    }
  }

  // Check for common extraction issues
  if (rawHTML.includes('data:image/svg+xml') || rawHTML.includes('data:image/png')) {
    // Inline images present - this is expected, not an error
    console.log('Note: Raw HTML contains inline images');
  }

  const valid = errors.length === 0;

  if (!valid) {
    console.error('✗ Raw HTML verification failed:', errors);
  } else if (warnings.length > 0) {
    console.warn('⚠ Raw HTML verification passed with warnings:', warnings);
  } else {
    console.log('✓ Raw HTML verification passed');
  }

  return { valid, warnings, errors };
}

/**
 * Get metadata about extracted HTML.
 * Useful for chain of custody and debugging.
 *
 * @param {string} rawHTML - Raw HTML to analyze
 * @returns {Object} HTML metadata
 * @returns {number} metadata.size_bytes - Size in bytes (UTF-8)
 * @returns {number} metadata.char_count - Character count
 * @returns {number} metadata.line_count - Line count
 * @returns {string} metadata.root_element - Root element tag name
 */
function getHTMLMetadata(rawHTML) {
  // Calculate size in bytes (UTF-8)
  const size_bytes = new Blob([rawHTML]).size;

  // Count lines
  const line_count = rawHTML.split('\n').length;

  // Extract root element tag
  const rootMatch = rawHTML.match(/^<(\w+)/);
  const root_element = rootMatch ? rootMatch[1] : 'unknown';

  return {
    size_bytes,
    char_count: rawHTML.length,
    line_count,
    root_element
  };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractRawHTML,
    verifyRawHTML,
    getHTMLMetadata
  };
}
