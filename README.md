# Gemini Conversation Exporter

A Chrome extension to export Google Gemini conversations to markdown files with images.

## Status

**✅ Fully tested and working** - Successfully exported 663+ conversations with proper titles, images, and metadata.

**⚠️ UI brittleness warning**: This extension relies on Gemini's DOM structure, which Google may change without notice. If exports stop working after a Gemini update, the selectors in `content.js` may need updating.

## Features

- **Auto-click mode**: Automatically iterates through conversations with human-like random delays (15-25s)
- **Batch export**: Export all conversations or start from a specific index
- **Manual export**: Export current conversation with Ctrl+Shift+E
- **Smart title extraction**: Pulls actual conversation titles from sidebar with retry logic
- **Image download**: Saves all conversation images to `./images/` subdirectories
- **Thinking blocks**: Automatically expands and includes Claude's thinking blocks
- **Error recovery**: Continues on errors rather than stopping entire batch
- **Proper sequencing**: Files numbered correctly (0000, 0001, etc.)

## Installation

1. Clone this repo
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `gemini-exporter` directory
6. Navigate to Google Gemini and open the extension popup

## Usage

### Auto-click Mode (Recommended for bulk export)
1. Check "Auto-click mode" in the extension popup
2. Set starting conversation number (default: 0)
3. Click "Export All Conversations (Batch)"
4. **Keep your desktop unlocked** - Chrome suspends tabs when locked
5. Let it run (15-25s per conversation)

### Manual Mode
1. Enable "Manual auto-export mode"
2. Manually click through conversations in Gemini
3. Each conversation auto-exports as you view it
4. Or press Ctrl+Shift+E to export current conversation

### Single Conversation
Click "Export Current Conversation" button or press Ctrl+Shift+E

## Export Format

```
gemini_export/
├── 0000_Conversation_Title_abc123def456/
│   ├── 0000_Conversation_Title_abc123def456.md
│   └── images/
│       ├── image_001.png
│       ├── image_002.png
│       └── image_003.png
├── 0001_Another_Conversation_xyz789/
│   ├── 0001_Another_Conversation_xyz789.md
│   └── images/
│       └── image_001.png
```

## Known Limitations

- **Sidebar content** appears in exported markdown (minor formatting issue, can be post-processed)
- **No timestamps** in export (timestamps can be added via Google Takeout data cross-indexing)
- **Desktop must stay unlocked** during overnight runs (Chrome limitation)
- **DOM dependency** - Google may change Gemini's HTML structure at any time

## Contributing

This extension is fully functional but could use improvements:

- **Better sidebar filtering** to remove "Recent" conversation list from exports
- **Timestamp extraction** from browser storage or API responses
- **Turn-by-turn parsing** to add `## User` / `## Assistant` headers
- **Robustness improvements** for DOM changes
- **Better error reporting** in the UI

Feel free to fork, improve, and submit PRs. Or open an issue if you need help or find bugs after a Gemini update.

## Technical Notes

- **Title extraction**: Tries main header → sidebar → document.title with 10 retries
- **Image handling**: Converts to data URLs when possible, downloads via background script
- **Thinking blocks**: Expands via `button[data-test-id="thoughts-header-button"]`
- **Conversation detection**: Uses `div.conversation-items-container` and `jslog` attributes

## License

MIT - use freely, no warranties provided

## Author

Built with Claude Code assistance for personal data archival needs.
