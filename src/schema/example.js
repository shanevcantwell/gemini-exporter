/**
 * Schema Usage Examples
 *
 * Demonstrates how to use forensic evidence schemas in practice
 * Part of ADR-009: Hybrid Evidence Format
 */

import {
  validateEvidence,
  validateEvidenceSafe,
  verifyEvidenceFile,
  computeSHA256
} from './index.js';

/**
 * Example 1: Creating Evidence During Extraction
 *
 * This shows how the exporter creates evidence with all required fields
 */
export async function createEvidence(conversationData) {
  // Extract raw HTML
  const rawHTML = document.querySelector('main').outerHTML;

  // Parse DOM into structured data
  const structuredData = parseConversation(rawHTML);

  // Generate integrity proofs
  const sha256RawHTML = await computeSHA256(rawHTML);
  const sha256StructuredJSON = await computeSHA256(
    JSON.stringify(structuredData.exchanges)
  );

  // Build complete evidence object
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
        parsing_duration_ms: 234
      }
    },

    // Integrity proofs
    integrity: {
      sha256_raw_html: sha256RawHTML,
      sha256_structured_json: sha256StructuredJSON,
      algorithm: 'SHA-256',
      computed_at: new Date().toISOString()
    },

    // Chain of custody
    chain_of_custody: {
      collection: {
        timestamp: new Date().toISOString(),
        collector: {
          tool: 'forensic-conversation-exporter',
          version: '3.0.0',
          source_url: 'https://github.com/shanevcantwell/gemini-exporter',
          commit_hash: 'abc1234'
        },
        source: {
          platform: 'gemini-2.5',
          url: window.location.href,
          conversation_id: conversationData.id,
          conversation_title: conversationData.title
        },
        environment: {
          user_agent: navigator.userAgent,
          browser: 'Chrome 131.0.0.0',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        extraction_parameters: {
          thinking_blocks_expanded: true,
          expansion_strategy: 'ButtonClick',
          expansion_count: 8,
          lazy_load_complete: true,
          verification_passed: true
        }
      },
      storage: {
        initial_location: `~/Downloads/gemini_${conversationData.id}_${timestamp()}.json`,
        format: 'forensic-evidence-v3-hybrid',
        compression: 'none'
      }
    }
  };

  // Validate before returning
  try {
    const validatedEvidence = validateEvidence(evidence);
    console.log('✓ Evidence validation passed:', validatedEvidence.evidence_id);
    return validatedEvidence;
  } catch (error) {
    console.error('✗ Evidence validation failed:', error.issues);
    throw error;
  }
}

/**
 * Example 2: Validating Evidence (Safe Parse)
 *
 * Use this when loading evidence files - won't throw exceptions
 */
export function loadEvidenceFile(jsonData) {
  const result = validateEvidenceSafe(jsonData);

  if (result.success) {
    console.log('✓ Evidence loaded successfully');
    console.log('  ID:', result.data.evidence_id);
    console.log('  Platform:', result.data.platform.name);
    console.log('  Exchanges:', result.data.structured_data.exchange_count);
    console.log('  Messages:', result.data.structured_data.message_count);
    return result.data;
  } else {
    console.error('✗ Invalid evidence file');
    result.error.issues.forEach((issue, i) => {
      console.error(`  ${i + 1}. ${issue.path.join('.')}: ${issue.message}`);
    });
    return null;
  }
}

/**
 * Example 3: Verifying Evidence Integrity
 *
 * Complete forensic verification workflow
 */
export async function verifyEvidence(evidenceFile) {
  console.log('Starting evidence verification...');

  const result = await verifyEvidenceFile(evidenceFile);

  if (result.valid) {
    console.log('✓ VERIFICATION PASSED');
    console.log('  Evidence ID:', result.evidence_id);
    console.log('  Format:', result.format_version);
    console.log('  Verified at:', result.verified_at);
    console.log('');
    console.log('Evidence is authentic and untampered.');
    console.log('Chain of custody is intact.');
    return true;
  } else {
    console.error('✗ VERIFICATION FAILED');
    console.error('  Error:', result.error);

    if (result.expected && result.computed) {
      console.error('  Expected hash:', result.expected);
      console.error('  Computed hash:', result.computed);
    }

    if (result.details) {
      console.error('  Details:', result.details);
    }

    console.error('');
    console.error('WARNING: Evidence may have been tampered with.');
    console.error('Do not use this evidence for legal purposes.');
    return false;
  }
}

/**
 * Example 4: Extracting Specific Data from Evidence
 *
 * Downstream analysis tools consume structured_data
 */
export function analyzeEvidence(evidence) {
  const { structured_data } = evidence;

  console.log('Conversation Analysis:');
  console.log('  Title:', structured_data.title);
  console.log('  ID:', structured_data.conversation_id);
  console.log('  Exchanges:', structured_data.exchange_count);
  console.log('  Messages:', structured_data.message_count);
  console.log('');

  // Count message types
  let userMessages = 0;
  let assistantMessages = 0;
  let thinkingMessages = 0;

  for (const exchange of structured_data.exchanges) {
    for (const message of exchange.messages) {
      if (message.message_type === 'user_input') userMessages++;
      else if (message.message_type === 'assistant_response') assistantMessages++;
      else if (message.message_type === 'thinking') thinkingMessages++;
    }
  }

  console.log('Message Breakdown:');
  console.log('  User inputs:', userMessages);
  console.log('  Assistant responses:', assistantMessages);
  console.log('  Thinking blocks:', thinkingMessages);
  console.log('');

  // Analyze thinking stages
  if (thinkingMessages > 0) {
    console.log('Thinking Block Analysis:');
    const thinkingStages = [];

    for (const exchange of structured_data.exchanges) {
      for (const message of exchange.messages) {
        if (message.message_type === 'thinking' && message.thinking_stages) {
          thinkingStages.push(...message.thinking_stages);
        }
      }
    }

    console.log('  Total thinking stages:', thinkingStages.length);

    if (thinkingStages.length > 0) {
      console.log('  Stage names:');
      const uniqueStageNames = [...new Set(thinkingStages.map(s => s.stage_name))];
      uniqueStageNames.forEach(name => {
        const count = thinkingStages.filter(s => s.stage_name === name).length;
        console.log(`    - ${name}: ${count}x`);
      });
    }
  }

  return {
    userMessages,
    assistantMessages,
    thinkingMessages,
    totalStages: thinkingMessages
  };
}

/**
 * Example 5: Error Handling with Detailed Messages
 */
export function validateWithDetailedErrors(data) {
  const result = validateEvidenceSafe(data);

  if (!result.success) {
    console.error('Validation failed with the following errors:\n');

    result.error.issues.forEach((issue, index) => {
      console.error(`Error ${index + 1}:`);
      console.error('  Path:', issue.path.join(' → '));
      console.error('  Problem:', issue.message);
      console.error('  Code:', issue.code);

      if (issue.expected) {
        console.error('  Expected:', issue.expected);
      }

      if (issue.received) {
        console.error('  Received:', issue.received);
      }

      console.error('');
    });

    return null;
  }

  return result.data;
}

/**
 * Helper: Parse conversation (placeholder - actual implementation in adapter)
 */
function parseConversation(rawHTML) {
  // This would be implemented by platform adapter
  // Returns structured data matching StructuredDataSchema
  return {
    conversation_id: 'c_example123',
    title: 'Example Conversation',
    url: 'https://gemini.google.com/app/c_example123',
    exchange_count: 1,
    message_count: 2,
    exchanges: [
      {
        exchange_index: 0,
        container_id: 'example-container',
        messages: [
          {
            message_index: 0,
            speaker: 'User',
            message_type: 'user_input',
            timestamp: null,
            text: 'Example user message',
            thinking_stages: null
          },
          {
            message_index: 1,
            speaker: 'Gemini',
            message_type: 'assistant_response',
            timestamp: null,
            text: 'Example assistant response',
            thinking_stages: null
          }
        ]
      }
    ]
  };
}

/**
 * Helper: Generate timestamp for filenames
 */
function timestamp() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minute = String(now.getUTCMinutes()).padStart(2, '0');
  const second = String(now.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hour}${minute}${second}`;
}
