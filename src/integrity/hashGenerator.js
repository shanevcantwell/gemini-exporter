/**
 * File: src/integrity/hashGenerator.js
 * Purpose: Generate cryptographic integrity proofs (ADR-002, ADR-009)
 *
 * Provides SHA-256 hashing with deterministic JSON serialization
 * to ensure hash verification works correctly across systems.
 *
 * Critical: Uses canonical JSON to prevent hash mismatches due to
 * key ordering differences between JavaScript and other languages.
 */

/**
 * Generate SHA-256 hash of a string.
 *
 * @param {string} data - Data to hash
 * @returns {Promise<string>} Hex-encoded hash (64 characters)
 */
async function generateHash(data) {
  if (typeof data !== 'string') {
    throw new Error('generateHash expects a string input');
  }

  // Encode string as UTF-8 bytes
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  // Compute SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Convert JavaScript object to canonical JSON string.
 * Ensures deterministic serialization for consistent hashing.
 *
 * Rules:
 * - Keys sorted alphabetically at all levels
 * - No whitespace (compact format)
 * - Consistent handling of special values (null, undefined)
 *
 * @param {Object} obj - Object to serialize
 * @returns {string} Canonical JSON string
 */
function canonicalJSON(obj) {
  // Handle primitives
  if (obj === null) return 'null';
  if (obj === undefined) return 'null'; // Treat undefined as null
  if (typeof obj !== 'object') return JSON.stringify(obj);

  // Handle arrays
  if (Array.isArray(obj)) {
    const items = obj.map(item => canonicalJSON(item));
    return `[${items.join(',')}]`;
  }

  // Handle objects - sort keys
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => {
    const value = canonicalJSON(obj[key]);
    return `"${key}":${value}`;
  });

  return `{${pairs.join(',')}}`;
}

/**
 * Generate SHA-256 hash of a JavaScript object.
 * Uses canonical JSON serialization to ensure deterministic hashing.
 *
 * @param {Object} obj - Object to hash
 * @returns {Promise<string>} Hex-encoded hash (64 characters)
 */
async function generateObjectHash(obj) {
  const canonicalStr = canonicalJSON(obj);
  return await generateHash(canonicalStr);
}

/**
 * Generate complete integrity proof for evidence file (ADR-009).
 *
 * @param {string} rawHTML - Raw HTML from extraction
 * @param {Object} structuredData - Parsed structured data
 * @returns {Promise<Object>} Complete integrity proof
 * @returns {string} integrity.sha256_raw_html - Hash of raw HTML
 * @returns {string} integrity.sha256_structured_json - Hash of structured data
 * @returns {string} integrity.algorithm - Algorithm used (SHA-256)
 * @returns {string} integrity.computed_at - ISO 8601 timestamp
 * @returns {number} integrity.raw_html_size_bytes - Size of raw HTML in bytes
 */
async function generateIntegrityProof(rawHTML, structuredData) {
  const startTime = Date.now();

  // Hash raw HTML
  const sha256_raw_html = await generateHash(rawHTML);

  // Hash structured data (using canonical JSON)
  const sha256_structured_json = await generateObjectHash(structuredData);

  // Calculate sizes
  const raw_html_size_bytes = new Blob([rawHTML]).size;

  const integrityProof = {
    sha256_raw_html,
    sha256_structured_json,
    algorithm: 'SHA-256',
    computed_at: new Date().toISOString(),
    raw_html_size_bytes,
    computation_duration_ms: Date.now() - startTime
  };

  console.log(`✓ Integrity proof generated in ${integrityProof.computation_duration_ms}ms`);
  console.log(`  Raw HTML hash: ${sha256_raw_html.substring(0, 16)}...`);
  console.log(`  Structured JSON hash: ${sha256_structured_json.substring(0, 16)}...`);

  return integrityProof;
}

/**
 * Verify integrity proof by recomputing hashes.
 * Used by downstream tools to verify evidence hasn't been tampered with.
 *
 * @param {string} rawHTML - Raw HTML to verify
 * @param {Object} structuredData - Structured data to verify
 * @param {Object} storedIntegrity - Integrity proof from evidence file
 * @returns {Promise<Object>} Verification result
 * @returns {boolean} result.valid - Whether verification passed
 * @returns {Object} result.checks - Individual check results
 */
async function verifyIntegrity(rawHTML, structuredData, storedIntegrity) {
  const checks = {
    raw_html_hash: false,
    structured_json_hash: false
  };

  // Recompute raw HTML hash
  const computedRawHash = await generateHash(rawHTML);
  checks.raw_html_hash = (computedRawHash === storedIntegrity.sha256_raw_html);

  // Recompute structured JSON hash
  const computedStructuredHash = await generateObjectHash(structuredData);
  checks.structured_json_hash = (computedStructuredHash === storedIntegrity.sha256_structured_json);

  const valid = checks.raw_html_hash && checks.structured_json_hash;

  if (!valid) {
    console.error('✗ Integrity verification failed:');
    if (!checks.raw_html_hash) {
      console.error('  Raw HTML hash mismatch');
      console.error(`    Expected: ${storedIntegrity.sha256_raw_html}`);
      console.error(`    Computed: ${computedRawHash}`);
    }
    if (!checks.structured_json_hash) {
      console.error('  Structured JSON hash mismatch');
      console.error(`    Expected: ${storedIntegrity.sha256_structured_json}`);
      console.error(`    Computed: ${computedStructuredHash}`);
    }
  } else {
    console.log('✓ Integrity verification passed');
  }

  return { valid, checks };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateHash,
    canonicalJSON,
    generateObjectHash,
    generateIntegrityProof,
    verifyIntegrity
  };
}
