/**
 * File: examples/integration-example.js
 * Purpose: Example showing how all scaffolded files integrate
 *
 * This is a working example of the complete extraction flow.
 * Copy this into exportController.js and fill in the TODO sections.
 */

// Import all scaffolded modules
// (In real implementation, use proper ES6 imports or script tags)

/**
 * Complete extraction flow integrating all patterns.
 * This is the high-level orchestrator for hybrid evidence collection.
 *
 * @param {Object} options - Extraction options
 * @returns {Promise<Evidence>} Complete evidence object
 */
async function extractHybridEvidence(options = {}) {
  console.log('=== Starting Hybrid Evidence Extraction ===');

  try {
    // ============================================
    // STEP 1: Expand Thinking Blocks (ADR-008)
    // ============================================
    console.log('\n[1/7] Expanding thinking blocks...');

    const selector = new ExpansionStrategySelector();

    // Register strategies in priority order (ADR-008)
    selector.registerStrategy(
      new ButtonClickStrategy(
        'button[data-test-id="thoughts-header-button"]',
        'hide thinking',
        { maxPasses: 10, scrollDelay: 100, clickDelay: 100 }
      )
    );
    selector.registerStrategy(new AlwaysVisibleStrategy());
    selector.registerStrategy(new NoThinkingStrategy());

    // Execute with automatic fallback
    const expansionResult = await selector.executeExpansion(0.95); // 95% success threshold

    console.log(`✓ Expanded ${expansionResult.expandedCount} thinking blocks using ${expansionResult.strategy}`);

    // Wait for DOM to settle after expansion
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ============================================
    // STEP 2: Extract Raw HTML (ADR-001, ADR-009)
    // ============================================
    console.log('\n[2/7] Extracting raw HTML...');

    const rawHTML = extractRawHTML({
      containerSelector: 'main',
      includeContainer: true
    });

    // Verify extraction
    const htmlVerification = verifyRawHTML(rawHTML, {
      minLength: 500
    });

    if (!htmlVerification.valid) {
      throw new Error(`Raw HTML verification failed: ${htmlVerification.errors.join(', ')}`);
    }

    const htmlMetadata = getHTMLMetadata(rawHTML);
    console.log(`✓ Extracted ${htmlMetadata.size_bytes} bytes (${htmlMetadata.line_count} lines)`);

    // ============================================
    // STEP 3: Parse DOM → Structured JSON (ADR-009)
    // ============================================
    console.log('\n[3/7] Parsing DOM to structured JSON...');

    // TODO: Implement parseDOM() in src/extraction/domParser.js
    // This is where your existing v2.0 extraction logic goes
    const structuredData = await parseDOM(document.querySelector('main'));

    console.log(`✓ Parsed ${structuredData.exchange_count} exchanges, ${structuredData.message_count} messages`);

    // ============================================
    // STEP 4: Generate Integrity Proofs (ADR-002)
    // ============================================
    console.log('\n[4/7] Generating integrity proofs...');

    const integrity = await generateIntegrityProof(rawHTML, structuredData);

    console.log(`✓ Generated hashes in ${integrity.computation_duration_ms}ms`);
    console.log(`  Raw HTML: ${integrity.sha256_raw_html.substring(0, 16)}...`);
    console.log(`  Structured: ${integrity.sha256_structured_json.substring(0, 16)}...`);

    // ============================================
    // STEP 5: Generate Chain of Custody (ADR-003)
    // ============================================
    console.log('\n[5/7] Generating chain of custody...');

    // TODO: Implement generateChainOfCustody() in src/integrity/chainOfCustody.js
    const chainOfCustody = generateChainOfCustody({
      expansionStrategy: expansionResult.strategy,
      expansionCount: expansionResult.expandedCount,
      verificationPassed: expansionResult.verified
    });

    console.log(`✓ Chain of custody generated`);

    // ============================================
    // STEP 6: Create Evidence Object (ADR-009)
    // ============================================
    console.log('\n[6/7] Creating evidence object...');

    const evidence = createEvidence({
      rawHTML: rawHTML,
      structuredData: structuredData,
      integrity: integrity,
      platform: {
        name: 'gemini',
        version: '2.5',
        adapter_version: '3.0.0'
      },
      chainOfCustody: chainOfCustody
    });

    // Validate evidence structure
    const validation = validateEvidence(evidence);
    if (!validation.valid) {
      throw new Error(`Evidence validation failed: ${validation.errors.join(', ')}`);
    }

    console.log(`✓ Evidence object created: ${evidence.evidence_id}`);

    // ============================================
    // STEP 7: Save Evidence File (ADR-007, ADR-009)
    // ============================================
    console.log('\n[7/7] Saving evidence file...');

    // TODO: Implement atomic file write
    await saveEvidenceFile(evidence);

    console.log(`✓ Evidence saved`);
    console.log('\n=== Extraction Complete ===');

    return evidence;

  } catch (error) {
    console.error('\n✗ Extraction failed:', error);
    throw error;
  }
}

/**
 * Parse DOM into structured JSON format.
 * This is the main parsing orchestrator.
 *
 * TODO: Implement this function in src/extraction/domParser.js
 * Refactor your existing v2.0 extraction logic into this function.
 *
 * @param {HTMLElement} mainElement - Main conversation container
 * @returns {Promise<StructuredData>} Structured conversation data
 */
async function parseDOM(mainElement) {
  // TODO: Extract conversation metadata
  const conversationId = extractConversationId(); // From URL or DOM
  const title = extractTitle(); // From header or sidebar
  const url = window.location.href;

  // TODO: Extract exchanges
  // const exchanges = await extractExchanges(mainElement);

  // TODO: Build structured data object
  const structuredData = {
    conversation_id: conversationId,
    title: title,
    url: url,
    exchange_count: 0, // TODO: Calculate
    message_count: 0,  // TODO: Calculate
    exchanges: [],     // TODO: Populate
    derivation: {
      parsed_from: 'raw_html',
      parser_version: '3.0.0',
      parsed_at: new Date().toISOString(),
      parsing_duration_ms: 0 // TODO: Measure
    }
  };

  return structuredData;
}

/**
 * Generate chain of custody metadata.
 *
 * TODO: Implement this function in src/integrity/chainOfCustody.js
 *
 * @param {Object} extractionParams - Extraction parameters
 * @returns {ChainOfCustody} Complete chain of custody
 */
function generateChainOfCustody(extractionParams) {
  // TODO: Capture environment info
  const userAgent = navigator.userAgent;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // TODO: Build chain of custody object
  const chainOfCustody = {
    collection: {
      timestamp: new Date().toISOString(),
      collector: {
        tool: 'forensic-conversation-exporter',
        version: '3.0.0',
        source_url: 'https://github.com/shanevcantwell/gemini-exporter',
        commit_hash: 'abc1234' // TODO: Get from build
      },
      source: {
        platform: 'gemini-2.5',
        url: window.location.href,
        conversation_id: '', // TODO: Extract
        conversation_title: '' // TODO: Extract
      },
      environment: {
        user_agent: userAgent,
        browser: '', // TODO: Parse from UA
        timezone: timezone
      },
      extraction_parameters: {
        thinking_blocks_expanded: extractionParams.expansionCount > 0,
        expansion_strategy: extractionParams.expansionStrategy,
        expansion_count: extractionParams.expansionCount,
        lazy_load_complete: true, // TODO: Track
        verification_passed: extractionParams.verificationPassed
      }
    },
    storage: {
      initial_location: '', // TODO: Get from download path
      format: 'forensic-evidence-v3-hybrid',
      compression: 'none'
    }
  };

  return chainOfCustody;
}

/**
 * Save evidence file atomically (ADR-007).
 *
 * TODO: Implement atomic file write
 * - Write to temporary file
 * - Validate write succeeded
 * - Atomic rename to final location
 *
 * @param {Evidence} evidence - Complete evidence object
 */
async function saveEvidenceFile(evidence) {
  // TODO: Generate filename
  const filename = `gemini_${evidence.structured_data.conversation_id}_${new Date().toISOString().replace(/:/g, '-')}.json`;

  // TODO: Convert to JSON string
  const jsonString = JSON.stringify(evidence, null, 2);

  // TODO: Save file (use Chrome downloads API)
  // chrome.downloads.download({
  //   url: URL.createObjectURL(new Blob([jsonString], { type: 'application/json' })),
  //   filename: filename,
  //   saveAs: false
  // });

  console.log(`Evidence would be saved as: ${filename}`);
}

// ============================================
// Example Usage
// ============================================

/**
 * Run extraction (call this from browser console for testing).
 */
async function testExtraction() {
  try {
    const evidence = await extractHybridEvidence();
    console.log('Extraction succeeded!');
    console.log('Evidence ID:', evidence.evidence_id);
    console.log('Exchange count:', evidence.structured_data.exchange_count);
  } catch (error) {
    console.error('Extraction failed:', error);
  }
}

// For testing in browser console:
// testExtraction();
