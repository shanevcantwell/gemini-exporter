#!/usr/bin/env python3
"""
Diagnostic script for thinking block extraction issues
Analyzes all exported JSON files to detect:
1. Missing thinking blocks
2. Duplicated thinking content in responses
3. Extraction statistics
"""

import json
import glob
import os
from collections import defaultdict
from pathlib import Path


def analyze_file(filepath):
    """Analyze a single JSON export for thinking block issues."""
    with open(filepath) as f:
        data = json.load(f)

    stats = {
        'file': os.path.basename(filepath),
        'export_date': data.get('export_timestamp', 'unknown'),
        'export_version': data.get('export_version', 'unknown'),
        'exchange_count': data.get('exchange_count', 0),
        'message_count': data.get('message_count', 0),
        'thinking_messages': 0,
        'thinking_with_stages': 0,
        'thinking_without_stages': 0,
        'responses_with_thinking_text': 0,
        'exchanges_with_thinking': 0,
        'exchanges_without_thinking': 0,
        'issues': []
    }

    # Keywords that indicate thinking block content
    thinking_keywords = [
        "I'm thinking", "I'm now thinking", "I'm focusing",
        "My current thinking", "Clarifying", "Analyzing",
        "Developing", "Crafting", "Simplifying",
        "I've been thinking", "I am thinking"
    ]

    for ex_idx, exchange in enumerate(data.get('exchanges', [])):
        has_thinking = False
        thinking_stages = []

        for msg in exchange.get('messages', []):
            msg_type = msg.get('message_type')

            if msg_type == 'thinking':
                stats['thinking_messages'] += 1
                has_thinking = True

                stages = msg.get('thinking_stages')
                if stages and len(stages) > 0:
                    stats['thinking_with_stages'] += 1
                    thinking_stages = [s.get('stage_name', '') for s in stages]
                else:
                    stats['thinking_without_stages'] += 1
                    stats['issues'].append(
                        f"Exchange {ex_idx}: Thinking message has no stages"
                    )

            elif msg_type == 'assistant_response':
                text = msg.get('text', '')

                # Check if response contains thinking stage names (duplication)
                if thinking_stages:
                    stage_text_found = any(
                        stage_name in text
                        for stage_name in thinking_stages
                        if stage_name
                    )
                    if stage_text_found:
                        stats['responses_with_thinking_text'] += 1
                        stats['issues'].append(
                            f"Exchange {ex_idx}: Response contains duplicate thinking text"
                        )

                # Check if response contains thinking keywords
                elif any(keyword in text for keyword in thinking_keywords):
                    # Only flag if there's NO thinking message in this exchange
                    if not has_thinking:
                        stats['issues'].append(
                            f"Exchange {ex_idx}: Response has thinking keywords but no thinking message"
                        )

        if has_thinking:
            stats['exchanges_with_thinking'] += 1
        else:
            stats['exchanges_without_thinking'] += 1

    return stats


def print_summary(all_stats):
    """Print summary of issues across all files."""
    print("\n" + "="*80)
    print("THINKING BLOCK DIAGNOSTIC SUMMARY")
    print("="*80)

    total_files = len(all_stats)
    files_with_issues = sum(1 for s in all_stats if s['issues'])

    print(f"\nFiles analyzed: {total_files}")
    print(f"Files with issues: {files_with_issues}")

    # Group by issue type
    missing_thinking = [s for s in all_stats if s['thinking_messages'] == 0]
    duplicate_thinking = [s for s in all_stats if s['responses_with_thinking_text'] > 0]
    empty_stages = [s for s in all_stats if s['thinking_without_stages'] > 0]

    print(f"\n--- Issue Breakdown ---")
    print(f"Files with NO thinking blocks: {len(missing_thinking)}")
    print(f"Files with DUPLICATE thinking: {len(duplicate_thinking)}")
    print(f"Files with EMPTY thinking stages: {len(empty_stages)}")

    # Show export version breakdown
    version_stats = defaultdict(lambda: {'total': 0, 'with_thinking': 0, 'with_duplicates': 0})
    for s in all_stats:
        version = s['export_version']
        version_stats[version]['total'] += 1
        if s['thinking_messages'] > 0:
            version_stats[version]['with_thinking'] += 1
        if s['responses_with_thinking_text'] > 0:
            version_stats[version]['with_duplicates'] += 1

    print(f"\n--- By Export Version ---")
    for version, stats in sorted(version_stats.items()):
        print(f"{version}:")
        print(f"  Total: {stats['total']}")
        print(f"  With thinking: {stats['with_thinking']}")
        print(f"  With duplicates: {stats['with_duplicates']}")

    # Detail files with issues
    if files_with_issues > 0:
        print(f"\n--- Files With Issues ---")
        for s in all_stats:
            if s['issues']:
                print(f"\n{s['file']} ({s['export_date']}):")
                print(f"  Export version: {s['export_version']}")
                print(f"  Thinking messages: {s['thinking_messages']}")
                print(f"  With stages: {s['thinking_with_stages']}")
                print(f"  Duplicate responses: {s['responses_with_thinking_text']}")
                print(f"  Issues ({len(s['issues'])}):")
                for issue in s['issues'][:5]:  # Show first 5 issues
                    print(f"    - {issue}")
                if len(s['issues']) > 5:
                    print(f"    ... and {len(s['issues']) - 5} more")


def main():
    import sys

    if len(sys.argv) > 1:
        search_path = sys.argv[1]
    else:
        # Default to semantic-chunker data directory
        search_path = "../semantic-chunker/data/compare_extracts/*.json"

    print(f"Searching: {search_path}")
    files = glob.glob(search_path, recursive=True)

    if not files:
        print(f"No JSON files found in {search_path}")
        return

    print(f"Found {len(files)} files")

    all_stats = []
    for filepath in sorted(files):
        print(f"Analyzing {os.path.basename(filepath)}...", end=' ')
        stats = analyze_file(filepath)
        all_stats.append(stats)
        print("Done")

    print_summary(all_stats)

    # Save detailed report
    report_file = "thinking_blocks_diagnostic_report.json"
    with open(report_file, 'w') as f:
        json.dump(all_stats, f, indent=2)

    print(f"\n{'='*80}")
    print(f"Detailed report saved to: {report_file}")
    print("="*80)


if __name__ == '__main__':
    main()
