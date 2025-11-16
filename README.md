# Gemini Conversation Exporter

**Status: PRE-ALPHA TESTING** - Working but unoptimized

Chrome extension that exports Google Gemini conversations to structured JSON with complete thinking block capture.

## Current Status

✅ **WORKING** - Achieved 100% thinking block capture (56/56 in test conversation)
⚠️ **PRE-ALPHA** - Performance not optimized (est. 11 hours for 658 conversations)
🔬 **TESTING** - Full batch export in progress to validate capture rate across all conversations

## Key Features

- **100% Thinking Block Capture**: Overcomes DOM virtualization to capture all thinking stages
- **Stable Container IDs**: Survives DOM recreation during lazy-loading
- **Incremental Scrolling**: Uses `scrollIntoView()` to trigger Gemini's lazy-loading per exchange
- **Race Condition Prevention**: Waits for export completion before switching conversations
- **Structured JSON Export**: Each conversation exported as standalone JSON file
- **Auto-Click Batch Export**: Automatically exports all conversations in sequence

## Installation

1. Clone repository:
   ```bash
   git clone https://github.com/shanevcantwell/gemini-exporter.git
   cd gemini-exporter
   ```

2. Load extension in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `gemini-exporter` directory

3. Navigate to `https://gemini.google.com`

## Usage

### Single Conversation Export

1. Open any Gemini conversation
2. Press `Ctrl+Shift+E` (or `Cmd+Shift+E` on Mac)
3. Check console for progress
4. JSON file downloads automatically

### Batch Export (All Conversations)

1. Open Gemini conversation list page
2. Open browser console (F12)
3. Run:
   ```javascript
   startAutoClick(0)  // Start from first conversation
   ```
4. Extension will:
   - Click each conversation in sequence
   - Wait 5s for page load
   - Export conversation (~60s per conversation)
   - Move to next conversation
   - Continue until all exported

**Export location:** `./data/gemini_export/XXXX_Title_ConversationID/`

## Performance

**Current timing (per conversation):**
- Page load: 5s
- Thinking block expansion: ~30-50s (depends on exchange count)
- Export + save: ~5s
- **Total: ~60s per conversation**

**Batch export estimate:**
- 658 conversations × 60s = ~11 hours

⚠️ **Note**: Performance optimization planned for v3.0 refactor

## How It Works

### DOM Virtualization Solution

Gemini uses virtual scrolling that keeps only ~10 exchanges in DOM. The exporter overcomes this by:

1. **Incremental Expansion**: Finds one thinking block button at a time
2. **Scroll Into View**: Calls `scrollIntoView()` on each button, triggering Gemini to load that exchange
3. **Immediate Extraction**: Extracts thinking stages before DOM virtualizes away
4. **Stable IDs**: Uses first 100 chars of text as container ID (survives DOM recreation)
5. **Map Storage**: Stores extracted thinking in Map keyed by stable ID
6. **Continue Until End**: Scrolls through entire conversation, expanding/extracting each block

### Key Technical Insights

- **Direct scrollTop manipulation doesn't trigger lazy-loading**
- **scrollIntoView() DOES trigger lazy-loading** (forces that section into viewport)
- **DOM elements as Map keys fail with virtualization** (elements recreated, references break)
- **String-based stable IDs survive virtualization** (content-based, not DOM-based)

## Troubleshooting

**Q: Only getting 10 exchanges instead of all?**
A: Reload extension in `chrome://extensions` and refresh Gemini page

**Q: Exports interrupting mid-scroll?**
A: Fixed in latest version - auto-click now waits for export completion

**Q: Thinking blocks showing as null?**
A: Check console for expansion errors - may need to increase delays

## Files Created

### 1. `src/strategies/ExpansionStrategy.js` (224 lines)
**Status:** ✅ **COMPLETE** - Ready to use

**What it provides:**
- `ExpansionStrategy` base class (interface)
- `ButtonClickStrategy` - Clicks "Show thinking" buttons (complete implementation)
- `AlwaysVisibleStrategy` - For platforms where thinking is always visible
- `NoThinkingStrategy` - Fallback for platforms without thinking
- `ExpansionError` - Custom error type

**What works:**
- All concrete strategies are fully implemented
- Button clicking with scroll-into-view
- Duplicate container tracking (prevents re-expansion)
- Verification with configurable thresholds
- Performance optimized (100ms delays vs 500ms)

**Usage:**
```javascript
const strategy = new ButtonClickStrategy(
  'button[data-test-id="thoughts-header-button"]',
  'hide thinking'
);

if (await strategy.isApplicable()) {
  const count = await strategy.expand();
  const verified = await strategy.verifyExpansion();
  console.log(`Expanded ${count} thinking blocks, verified: ${verified}`);
}
```

### 2. `src/strategies/StrategySelector.js` (125 lines)
**Status:** ✅ **COMPLETE** - Ready to use

**What it provides:**
- `ExpansionStrategySelector` class
- Strategy registration and fallback chain
- `selectStrategy()` - Choose best strategy without executing
- `executeExpansion()` - Execute with automatic fallback

**What works:**
- Registers strategies in priority order
- Tries each strategy until one succeeds
- Graceful degradation on failure
- Detailed logging of attempts

**Usage:**
```javascript
const selector = new ExpansionStrategySelector();

// Register in priority order (first = highest priority)
selector.registerStrategy(new ButtonClickStrategy('button[data-test-id="thoughts-header-button"]'));
selector.registerStrategy(new AlwaysVisibleStrategy());
selector.registerStrategy(new NoThinkingStrategy());

// Execute with fallback
const result = await selector.executeExpansion();
console.log(`Strategy ${result.strategy} expanded ${result.expandedCount} items`);
```

### 3. `src/extraction/rawHtmlExtractor.js` (145 lines)
**Status:** ✅ **COMPLETE** - Ready to use

**What it provides:**
- `extractRawHTML()` - Extract outerHTML from container
- `verifyRawHTML()` - Sanity checks on extracted HTML
- `getHTMLMetadata()` - Size, line count, root element info

**What works:**
- Extracts from configurable selector (default: 'main')
- Validates container exists and has content
- Provides metadata for chain of custody
- Optional verification checks

**Usage:**
```javascript
// Extract raw HTML
const rawHTML = extractRawHTML({ containerSelector: 'main' });

// Verify extraction
const verification = verifyRawHTML(rawHTML, {
  minLength: 500,
  requiredElements: ['data-message-id']
});

if (!verification.valid) {
  console.error('Extraction failed:', verification.errors);
}

// Get metadata
const metadata = getHTMLMetadata(rawHTML);
console.log(`Extracted ${metadata.size_bytes} bytes`);
```

### 4. `src/integrity/hashGenerator.js` (193 lines)
**Status:** ✅ **COMPLETE** - Ready to use

**What it provides:**
- `generateHash()` - SHA-256 hash of string
- `canonicalJSON()` - Deterministic JSON serialization
- `generateObjectHash()` - Hash JavaScript object
- `generateIntegrityProof()` - Complete integrity proof for evidence file
- `verifyIntegrity()` - Re-hash and verify

**What works:**
- SHA-256 via Web Crypto API
- Canonical JSON (sorted keys, no whitespace)
- Complete integrity proof generation
- Verification with detailed error messages

**Critical feature:** Uses canonical JSON to prevent hash mismatches across languages/systems.

**Usage:**
```javascript
// Generate integrity proof (ADR-009)
const integrity = await generateIntegrityProof(rawHTML, structuredData);

// Later, verify integrity
const verification = await verifyIntegrity(
  rawHTML,
  structuredData,
  storedIntegrity
);

if (!verification.valid) {
  throw new Error('Evidence tampered!');
}
```

### 5. `src/types/Evidence.js` (290 lines)
**Status:** ✅ **COMPLETE** - Ready to use

**What it provides:**
- Complete TypeScript-style JSDoc type definitions
- `Evidence` type (top-level evidence file)
- `StructuredData`, `Exchange`, `Message`, `ThinkingStage` types
- `IntegrityProof`, `ChainOfCustody` types
- `createEvidence()` - Factory function
- `validateEvidence()` - Structure validation

**What works:**
- Full type safety via JSDoc
- IDE autocomplete for all evidence fields
- Factory function for creating evidence objects
- Validation function for checking structure

**Usage:**
```javascript
/**
 * @type {import('./types/Evidence').Evidence}
 */
const evidence = createEvidence({
  rawHTML: rawHTML,
  structuredData: structured,
  integrity: integrityProof,
  platform: { name: 'gemini', version: '2.5', adapter_version: '3.0.0' },
  chainOfCustody: custody
});

// Validate before saving
const validation = validateEvidence(evidence);
if (!validation.valid) {
  throw new Error(`Invalid evidence: ${validation.errors.join(', ')}`);
}
```

## What's NOT Included (You Need to Implement)

These scaffolded files handle the **foundational patterns** but don't include platform-specific logic:

### Need to Implement Next (Week 1, Day 3-4):

1. **`src/extraction/domParser.js`** (~100 lines)
   - Orchestrates parsing of DOM → structured JSON
   - Calls exchangeExtractor, messageExtractor, thinkingBlockParser
   - This is where your existing v2.0 logic goes (refactored)

2. **`src/extraction/exchangeExtractor.js`** (~120 lines)
   - Finds exchange containers in DOM
   - Extracts exchange boundaries
   - Returns array of Exchange objects

3. **`src/extraction/messageExtractor.js`** (~80 lines)
   - Extracts messages from exchange container
   - Identifies speaker (User vs Gemini)
   - Determines message type (user_input, thinking, assistant_response)

4. **`src/extraction/thinkingBlockParser.js`** (~80 lines)
   - Parses thinking block content
   - Extracts thinking stages (from bold headers)
   - Returns array of ThinkingStage objects

5. **`src/adapters/GeminiAdapter.js`** (~150 lines)
   - Platform-specific adapter for Gemini
   - Integrates expansion strategies
   - Handles Gemini-specific DOM structure
   - See ADR-005 for interface

6. **`src/integrity/chainOfCustody.js`** (~60 lines)
   - Generates chain of custody metadata
   - Captures environment info (browser, timezone)
   - Records extraction parameters
   - See ADR-003 for structure

7. **`src/background/exportController.js`** (~120 lines)
   - Orchestrates entire extraction flow
   - Calls: expansion → extract HTML → parse DOM → generate integrity → save
   - Implements atomic extraction (ADR-007)

## How These Files Integrate

```javascript
// Example integration (pseudocode):
import { ExpansionStrategySelector, ButtonClickStrategy } from './strategies/';
import { extractRawHTML } from './extraction/rawHtmlExtractor';
import { generateIntegrityProof } from './integrity/hashGenerator';
import { createEvidence } from './types/Evidence';

async function exportConversation() {
  // 1. Expand thinking blocks (ADR-008)
  const selector = new ExpansionStrategySelector();
  selector.registerStrategy(new ButtonClickStrategy('button[data-test-id="thoughts-header-button"]'));
  const expansion = await selector.executeExpansion();

  // 2. Extract raw HTML (ADR-001)
  const rawHTML = extractRawHTML();

  // 3. Parse DOM → JSON (ADR-009) - YOU NEED TO IMPLEMENT
  const structured = await parseDOM(document.querySelector('main'));

  // 4. Generate integrity proof (ADR-002)
  const integrity = await generateIntegrityProof(rawHTML, structured);

  // 5. Create evidence object (ADR-009)
  const evidence = createEvidence({
    rawHTML,
    structuredData: structured,
    integrity,
    platform: { name: 'gemini', version: '2.5', adapter_version: '3.0.0' },
    chainOfCustody: generateChainOfCustody(expansion) // YOU NEED TO IMPLEMENT
  });

  // 6. Save evidence file
  await saveEvidenceFile(evidence);
}
```

## Testing the Scaffolded Files

All 5 files are **runnable in browser console** for testing:

```javascript
// In browser console on gemini.google.com:

// Test expansion strategy
const strategy = new ButtonClickStrategy('button[data-test-id="thoughts-header-button"]');
const count = await strategy.expand();
console.log(`Expanded ${count} thinking blocks`);

// Test raw HTML extraction
const rawHTML = extractRawHTML();
console.log(`Extracted ${rawHTML.length} chars`);

// Test hash generation
const hash = await generateHash(rawHTML);
console.log(`SHA-256: ${hash}`);
```

## Next Steps

**Week 1, Day 3-4:** Implement DOM parsing
1. Create `domParser.js` (orchestrator)
2. Refactor your existing v2.0 extraction logic into:
   - `exchangeExtractor.js`
   - `messageExtractor.js`
   - `thinkingBlockParser.js`

**Week 1, Day 5:** Test hybrid extraction
1. Integrate all pieces in `exportController.js`
2. Test with 10 conversations
3. Validate evidence structure

**Week 2:** Platform adapters + forensics (see main implementation plan)

## File Organization

```
src/
├── strategies/
│   ├── ExpansionStrategy.js          ✅ COMPLETE
│   └── StrategySelector.js           ✅ COMPLETE
│
├── extraction/
│   ├── rawHtmlExtractor.js           ✅ COMPLETE
│   ├── domParser.js                  ⏳ TODO
│   ├── exchangeExtractor.js          ⏳ TODO
│   ├── messageExtractor.js           ⏳ TODO
│   └── thinkingBlockParser.js        ⏳ TODO
│
├── integrity/
│   ├── hashGenerator.js              ✅ COMPLETE
│   └── chainOfCustody.js             ⏳ TODO
│
├── types/
│   └── Evidence.js                   ✅ COMPLETE
│
├── adapters/                         ⏳ TODO (Week 2)
├── background/                       ⏳ TODO (Week 2)
└── core/                             ⏳ TODO (Week 2)
```

## Notes

- All files use CommonJS exports for browser compatibility
- No external dependencies (uses Web APIs only)
- All functions have complete JSDoc documentation
- Ready for TypeScript migration (just rename .js → .ts)
- Files kept under 300 lines (broad & shallow structure)

## Questions?

If you need clarification on any scaffolded function or want me to implement any of the TODO files, let me know!
