/**
 * Forensic Exporter v3.0 - Integration Layer
 *
 * Bridges scaffolding implementation with Zod schema validation
 * Combines:
 * - Implementation files from scaffolding (expansion, extraction, hashing)
 * - Validation files from Zod schemas (runtime validation, invariants)
 *
 * This file orchestrates the complete hybrid evidence extraction flow.
 */

// === Scaffolding Implementations ===
// These will be imported once files are moved to src/
// import { ExpansionStrategySelector, ButtonClickStrategy, AlwaysVisibleStrategy, NoThinkingStrategy } from './strategies/';
// import { extractRawHTML, verifyRawHTML, getHTMLMetadata } from './extraction/rawHtmlExtractor';
// import { generateIntegrityProof, verifyIntegrity } from './integrity/hashGenerator';

// === Zod Schema Validation ===
import {
  validateEvidence,
  validateEvidenceSafe,
  verifyEvidenceFile
} from './schema/index.js';

/**
 * Complete hybrid evidence extraction with validation.
 *
 * This is the main entry point for forensic evidence collection.
 * Implements:
 * - ADR-001: Raw HTML Preservation
 * - ADR-002: Cryptographic Integrity Proofs
 * - ADR-003: Chain of Custody Metadata
 * - ADR-007: Atomic Extraction with Invariants
 * - ADR-008: Strategy Pattern for Thinking Block Expansion
 * - ADR-009: Hybrid Evidence Format
 *
 * @param {Object} options - Extraction options
 * @param {string} options.containerSelector - DOM selector for main content (default: 'main')
 * @param {string} options.buttonSelector - Thinking block button selector
 * @param {number} options.successThreshold - Expansion verification threshold (default: 0.95)
 * @returns {Promise<Evidence>} Validated evidence object
 * @throws {Error} If extraction or validation fails
 */
export async function extractHybridEvidence(options = {}) {
  const {
    containerSelector = 'main',
    buttonSelector = 'button[data-test-id="thoughts-header-button"]',
    successThreshold = 0.95
  } = options;

  console.log('=== Forensic Evidence Extraction v3.0 ===');
  console.log('Architecture: ADR-009 Hybrid Format');
  console.log('');

  try {
    // ============================================
    // STEP 1: Expand Thinking Blocks (ADR-008)
    // ============================================
    console.log('[1/7] Expanding thinking blocks...');

    const selector = new ExpansionStrategySelector();

    // Register strategies in priority order
    selector.registerStrategy(
      new ButtonClickStrategy(buttonSelector, 'hide thinking', {
        maxPasses: 10,
        scrollDelay: 100,
        clickDelay: 100
      })
    );
    selector.registerStrategy(new AlwaysVisibleStrategy());
    selector.registerStrategy(new NoThinkingStrategy());

    // Execute with fallback
    const expansionResult = await selector.executeExpansion(successThreshold);

    console.log(`✓ Strategy: ${expansionResult.strategy}`);
    console.log(`✓ Expanded: ${expansionResult.expandedCount} blocks`);
    console.log(`✓ Verified: ${expansionResult.verified}`);

    // Wait for DOM to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // ============================================
    // STEP 2: Extract Raw HTML (ADR-001)
    // ============================================
    console.log('\n[2/7] Extracting raw HTML...');

    const rawHTML = extractRawHTML({
      containerSelector,
      includeContainer: true
    });

    // Verify extraction succeeded
    const htmlVerification = verifyRawHTML(rawHTML, {
      minLength: 500
    });

    if (!htmlVerification.valid) {
      throw new Error(`Raw HTML verification failed: ${htmlVerification.errors.join(', ')}`);
    }

    const htmlMetadata = getHTMLMetadata(rawHTML);
    console.log(`✓ Extracted: ${htmlMetadata.size_bytes.toLocaleString()} bytes`);
    console.log(`✓ Lines: ${htmlMetadata.line_count.toLocaleString()}`);

    // ============================================
    // STEP 3: Parse DOM → Structured JSON (ADR-009)
    // ============================================
    console.log('\n[3/7] Parsing DOM to structured JSON...');

    // TODO: Implement parseDOM() in src/extraction/domParser.js
    // This will call exchangeExtractor, messageExtractor, thinkingBlockParser
    const structuredData = await parseDOM(document.querySelector(containerSelector));

    console.log(`✓ Exchanges: ${structuredData.exchange_count}`);
    console.log(`✓ Messages: ${structuredData.message_count}`);

    // ============================================
    // STEP 4: Validate Structured Data (Zod)
    // ============================================
    console.log('\n[4/7] Validating structured data...');

    // Import validation from Zod schemas
    const { validateStructuredDataSafe } = await import('./schema/index.js');
    const structuredValidation = validateStructuredDataSafe(structuredData);

    if (!structuredValidation.success) {
      console.error('❌ Structured data validation failed:');
      structuredValidation.error.issues.forEach((issue, i) => {
        console.error(`  ${i + 1}. ${issue.path.join('.')}: ${issue.message}`);
      });
      throw new Error('Structured data validation failed - see errors above');
    }

    console.log('✓ Structured data valid');
    console.log(`✓ Invariants: exchange indices sequential, message counts match`);

    // ============================================
    // STEP 5: Generate Integrity Proofs (ADR-002)
    // ============================================
    console.log('\n[5/7] Generating integrity proofs...');

    const integrity = await generateIntegrityProof(rawHTML, structuredData);

    console.log(`✓ Computed in: ${integrity.computation_duration_ms}ms`);
    console.log(`✓ Raw HTML hash: ${integrity.sha256_raw_html.substring(0, 16)}...`);
    console.log(`✓ Structured hash: ${integrity.sha256_structured_json.substring(0, 16)}...`);

    // ============================================
    // STEP 6: Generate Chain of Custody (ADR-003)
    // ============================================
    console.log('\n[6/7] Generating chain of custody...');

    // TODO: Implement generateChainOfCustody() in src/integrity/chainOfCustody.js
    const chainOfCustody = generateChainOfCustody({
      expansionStrategy: expansionResult.strategy,
      expansionCount: expansionResult.expandedCount,
      verified: expansionResult.verified,
      conversationId: structuredData.conversation_id,
      conversationTitle: structuredData.title
    });

    console.log('✓ Chain of custody generated');

    // ============================================
    // STEP 7: Create & Validate Evidence (ADR-009)
    // ============================================
    console.log('\n[7/7] Creating evidence object...');

    const evidence = {
      // Metadata
      evidence_id: crypto.randomUUID(),
      format_version: '3.0-hybrid',
      platform: {
        name: 'gemini',
        version: '2.5',
        adapter_version: '3.0.0'
      },
      exported_at: new Date().toISOString(),

      // Forensic layer
      raw_html: rawHTML,

      // Analysis layer
      structured_data: {
        ...structuredData,
        derivation: {
          parsed_from: 'raw_html',
          parser_version: '3.0.0',
          parsed_at: new Date().toISOString(),
          parsing_duration_ms: 0 // TODO: Track actual parsing time
        }
      },

      // Integrity proofs
      integrity,

      // Chain of custody
      chain_of_custody: chainOfCustody
    };

    // Validate complete evidence structure with Zod
    console.log('Validating complete evidence structure...');

    try {
      const validatedEvidence = validateEvidence(evidence);
      console.log('✓ Evidence structure valid');
      console.log(`✓ Evidence ID: ${validatedEvidence.evidence_id}`);
      return validatedEvidence;
    } catch (validationError) {
      console.error('❌ Evidence validation failed:');
      if (validationError.issues) {
        validationError.issues.forEach((issue, i) => {
          console.error(`  ${i + 1}. ${issue.path.join('.')}: ${issue.message}`);
        });
      }
      throw new Error('Evidence validation failed - see errors above');
    }

  } catch (error) {
    console.error('\n❌ Extraction failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

/**
 * Verify existing evidence file integrity.
 *
 * Complete forensic verification workflow:
 * 1. Validate schema structure
 * 2. Verify raw HTML hash
 * 3. Verify structured JSON hash
 * 4. Check all invariants
 *
 * @param {Object} evidenceFile - Evidence object to verify
 * @returns {Promise<Object>} Verification result
 */
export async function verifyEvidence(evidenceFile) {
  console.log('=== Evidence Verification ===');

  const result = await verifyEvidenceFile(evidenceFile);

  if (result.valid) {
    console.log('✓ VERIFICATION PASSED');
    console.log(`  Evidence ID: ${result.evidence_id}`);
    console.log(`  Format: ${result.format_version}`);
    console.log(`  Verified at: ${result.verified_at}`);
    console.log('');
    console.log('Evidence is authentic and untampered.');
  } else {
    console.error('❌ VERIFICATION FAILED');
    console.error(`  Error: ${result.error}`);
    if (result.details) {
      console.error('  Details:', result.details);
    }
    console.error('');
    console.error('WARNING: Evidence may have been tampered with.');
  }

  return result;
}

/**
 * Save evidence file with atomic write.
 * Implements ADR-007: All-or-nothing write.
 *
 * @param {Evidence} evidence - Validated evidence object
 * @param {string} filename - Output filename
 * @returns {Promise<string>} Saved file path
 */
export async function saveEvidenceFile(evidence, filename) {
  // TODO: Implement atomic file save
  // For now, this is a placeholder

  const jsonString = JSON.stringify(evidence, null, 2);

  console.log('Saving evidence file...');
  console.log(`  Filename: ${filename}`);
  console.log(`  Size: ${jsonString.length.toLocaleString()} bytes`);

  // In browser extension, this would use chrome.downloads API
  // For now, just return the JSON string

  return jsonString;
}

/**
 * Placeholder for parseDOM implementation.
 * TODO: Move to src/extraction/domParser.js
 */
async function parseDOM(mainElement) {
  throw new Error('parseDOM not yet implemented - see src/extraction/domParser.js');
}

/**
 * Placeholder for generateChainOfCustody implementation.
 * TODO: Move to src/integrity/chainOfCustody.js
 */
function generateChainOfCustody(params) {
  throw new Error('generateChainOfCustody not yet implemented - see src/integrity/chainOfCustody.js');
}

// Re-export validation functions for convenience
export {
  validateEvidence,
  validateEvidenceSafe,
  verifyEvidenceFile
} from './schema/index.js';
