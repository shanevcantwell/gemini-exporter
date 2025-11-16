/**
 * File: src/types/Evidence.js
 * Purpose: Type definitions for evidence file structure (ADR-009)
 *
 * Provides TypeScript-style JSDoc annotations for:
 * - Evidence file format
 * - Structured data (exchanges, messages)
 * - Integrity proofs
 * - Chain of custody
 *
 * These types enable:
 * - IDE autocomplete
 * - JSDoc type checking
 * - Documentation generation
 * - LLM code inference
 */

/**
 * @typedef {Object} ThinkingStage
 * @property {string} stage_name - Name of thinking stage (from bold header)
 * @property {string} text - Content of thinking stage
 */

/**
 * @typedef {Object} Message
 * @property {number} message_index - Global message index (across all exchanges)
 * @property {('User'|'Gemini'|'Claude'|'ChatGPT')} speaker - Speaker identifier
 * @property {('user_input'|'thinking'|'assistant_response')} message_type - Message type
 * @property {string|null} timestamp - ISO 8601 timestamp (null if not available)
 * @property {string|null} text - Message text content (null for thinking messages)
 * @property {Array<ThinkingStage>|null} thinking_stages - Thinking stages (null unless message_type === 'thinking')
 */

/**
 * @typedef {Object} Exchange
 * @property {number} exchange_index - Exchange index (0-based)
 * @property {string} [container_id] - DOM container ID for timestamp matching (optional)
 * @property {Array<Message>} messages - Messages in this exchange (2-3 messages: user + [thinking] + response)
 */

/**
 * @typedef {Object} DerivationMetadata
 * @property {string} parsed_from - Source of parsed data ('raw_html')
 * @property {string} parser_version - Parser version (semver)
 * @property {string} parsed_at - ISO 8601 timestamp of parsing
 * @property {number} parsing_duration_ms - Time taken to parse (milliseconds)
 */

/**
 * @typedef {Object} StructuredData
 * @property {string} conversation_id - Platform-specific conversation ID
 * @property {string} title - Conversation title
 * @property {string} url - Source URL
 * @property {number} exchange_count - Number of user-system exchange pairs
 * @property {number} message_count - Total messages (includes thinking messages)
 * @property {Array<Exchange>} exchanges - Array of exchanges
 * @property {DerivationMetadata} derivation - Metadata about parsing process
 */

/**
 * @typedef {Object} IntegrityProof
 * @property {string} sha256_raw_html - SHA-256 hash of raw HTML (64 hex chars)
 * @property {string} sha256_structured_json - SHA-256 hash of structured data (64 hex chars)
 * @property {string} algorithm - Hash algorithm used ('SHA-256')
 * @property {string} computed_at - ISO 8601 timestamp when hashes were computed
 * @property {number} raw_html_size_bytes - Size of raw HTML in bytes
 * @property {number} [computation_duration_ms] - Time taken to compute hashes (optional)
 */

/**
 * @typedef {Object} PlatformInfo
 * @property {string} name - Platform name ('gemini', 'claude', 'chatgpt', etc.)
 * @property {string} version - Platform version ('2.5', '3.0', etc.)
 * @property {string} adapter_version - Adapter version (semver)
 */

/**
 * @typedef {Object} CollectorInfo
 * @property {string} tool - Tool name ('forensic-conversation-exporter')
 * @property {string} version - Tool version (semver)
 * @property {string} source_url - Repository URL
 * @property {string} commit_hash - Git commit hash (short form, 7 chars)
 */

/**
 * @typedef {Object} SourceInfo
 * @property {string} platform - Platform identifier with version ('gemini-2.5')
 * @property {string} url - Source URL
 * @property {string} conversation_id - Conversation ID
 * @property {string} conversation_title - Conversation title
 */

/**
 * @typedef {Object} EnvironmentInfo
 * @property {string} user_agent - Browser user agent string
 * @property {string} browser - Browser name and version
 * @property {string} [os] - Operating system (optional)
 * @property {string} timezone - IANA timezone identifier
 */

/**
 * @typedef {Object} ExtractionParameters
 * @property {boolean} thinking_blocks_expanded - Whether thinking blocks were expanded
 * @property {string} expansion_strategy - Strategy used for expansion (from ADR-008)
 * @property {number} expansion_count - Number of items expanded
 * @property {boolean} lazy_load_complete - Whether all lazy content was loaded
 * @property {boolean} verification_passed - Whether post-extraction verification passed
 */

/**
 * @typedef {Object} CollectionMetadata
 * @property {string} timestamp - ISO 8601 timestamp of collection
 * @property {CollectorInfo} collector - Tool information
 * @property {SourceInfo} source - Source platform information
 * @property {EnvironmentInfo} environment - Browser environment
 * @property {ExtractionParameters} extraction_parameters - Extraction parameters
 */

/**
 * @typedef {Object} StorageInfo
 * @property {string} initial_location - Initial file path
 * @property {string} format - Evidence format identifier ('forensic-evidence-v3-hybrid')
 * @property {string} compression - Compression algorithm ('none', 'gzip', etc.)
 */

/**
 * @typedef {Object} ChainOfCustody
 * @property {CollectionMetadata} collection - Collection metadata
 * @property {StorageInfo} storage - Storage information
 * @property {Array<Object>} [access_log] - Access log (optional, for future use)
 */

/**
 * @typedef {Object} Evidence
 * @property {string} evidence_id - UUID v4 evidence identifier
 * @property {string} format_version - Evidence format version ('3.0-hybrid')
 * @property {PlatformInfo} platform - Platform information
 * @property {string} exported_at - ISO 8601 timestamp of export
 * @property {string} raw_html - Complete raw HTML (forensic layer)
 * @property {StructuredData} structured_data - Parsed structured data (analysis layer)
 * @property {IntegrityProof} integrity - Cryptographic integrity proofs
 * @property {ChainOfCustody} chain_of_custody - Chain of custody metadata
 */

/**
 * Create a new Evidence object with required fields.
 * This is a factory function that ensures all required fields are present.
 *
 * @param {Object} params - Evidence parameters
 * @param {string} params.rawHTML - Raw HTML from extraction
 * @param {StructuredData} params.structuredData - Parsed structured data
 * @param {IntegrityProof} params.integrity - Integrity proof
 * @param {PlatformInfo} params.platform - Platform information
 * @param {ChainOfCustody} params.chainOfCustody - Chain of custody
 * @returns {Evidence} Complete evidence object
 */
function createEvidence({ rawHTML, structuredData, integrity, platform, chainOfCustody }) {
  return {
    evidence_id: crypto.randomUUID(),
    format_version: '3.0-hybrid',
    platform: platform,
    exported_at: new Date().toISOString(),
    raw_html: rawHTML,
    structured_data: structuredData,
    integrity: integrity,
    chain_of_custody: chainOfCustody
  };
}

/**
 * Validate evidence structure.
 * Checks that all required fields are present and have correct types.
 *
 * @param {Evidence} evidence - Evidence object to validate
 * @returns {Object} Validation result
 * @returns {boolean} result.valid - Whether evidence is valid
 * @returns {Array<string>} result.errors - Validation errors (empty if valid)
 */
function validateEvidence(evidence) {
  const errors = [];

  // Check required top-level fields
  const requiredFields = [
    'evidence_id',
    'format_version',
    'platform',
    'exported_at',
    'raw_html',
    'structured_data',
    'integrity',
    'chain_of_custody'
  ];

  for (const field of requiredFields) {
    if (!(field in evidence)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check format version
  if (evidence.format_version && !evidence.format_version.startsWith('3.0')) {
    errors.push(`Unsupported format version: ${evidence.format_version}`);
  }

  // Check raw HTML is non-empty
  if (evidence.raw_html && evidence.raw_html.length === 0) {
    errors.push('raw_html is empty');
  }

  // Check structured data has exchanges
  if (evidence.structured_data && !Array.isArray(evidence.structured_data.exchanges)) {
    errors.push('structured_data.exchanges must be an array');
  }

  // Check integrity proofs are present
  if (evidence.integrity) {
    if (!evidence.integrity.sha256_raw_html) {
      errors.push('Missing integrity.sha256_raw_html');
    }
    if (!evidence.integrity.sha256_structured_json) {
      errors.push('Missing integrity.sha256_structured_json');
    }
  }

  const valid = errors.length === 0;

  if (!valid) {
    console.error('Evidence validation failed:', errors);
  }

  return { valid, errors };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createEvidence,
    validateEvidence
  };
}
