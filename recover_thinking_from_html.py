#!/usr/bin/env python3
"""
Recover thinking blocks from raw HTML in export files

When extractThinkingStages() fails to parse thinking blocks,
this script can extract them from the raw_html field.
"""

import json
import sys
import re
from pathlib import Path
from bs4 import BeautifulSoup


def extract_thinking_from_html(raw_html):
    """
    Extract thinking blocks from raw HTML.

    Returns list of thinking blocks with their content.
    """
    soup = BeautifulSoup(raw_html, 'html.parser')

    thinking_blocks = []

    # Find all thinking block containers
    # Try multiple possible selectors
    containers = (
        soup.find_all(attrs={'data-test-id': 'model-thoughts'}) or
        soup.find_all(class_=lambda x: x and 'thinking' in x.lower()) or
        soup.find_all(class_=lambda x: x and 'thought' in x.lower())
    )

    for idx, container in enumerate(containers):
        # Extract stages from container
        stages = extract_stages_from_container(container)

        if stages:
            thinking_blocks.append({
                'block_index': idx,
                'stages': stages,
                'raw_text': container.get_text(strip=True)
            })

    return thinking_blocks


def extract_stages_from_container(container):
    """
    Extract thinking stages from a thinking block container.

    Looks for bold/strong headers followed by content.
    """
    stages = []

    # Get all text blocks
    elements = container.find_all(['p', 'div'])

    current_stage = None

    for el in elements:
        text = el.get_text(strip=True)
        if not text:
            continue

        # Check if this is a stage header (bold/strong text)
        bold = el.find(['strong', 'b'])

        if bold:
            bold_text = bold.get_text(strip=True)

            # If the element is ONLY the bold text, it's a header
            if text == bold_text:
                # Save previous stage
                if current_stage and current_stage['text'].strip():
                    stages.append(current_stage)

                # Start new stage
                current_stage = {
                    'stage_name': bold_text,
                    'text': ''
                }
            elif current_stage:
                # Bold text within content - add to current stage
                current_stage['text'] += '\n\n' + text
        elif current_stage:
            # Regular content - add to current stage
            current_stage['text'] += '\n\n' + text

    # Save final stage
    if current_stage and current_stage['text'].strip():
        stages.append(current_stage)

    # Clean up stage text
    for stage in stages:
        stage['text'] = stage['text'].strip()

    return stages


def recover_thinking_blocks(input_file, output_file=None):
    """
    Recover thinking blocks from export file's raw HTML.
    """
    print(f"Processing: {input_file}")

    with open(input_file) as f:
        data = json.load(f)

    if 'raw_html' not in data:
        print("  ⚠️  No raw_html field found - this export doesn't have raw HTML")
        return

    raw_html = data['raw_html']
    print(f"  Raw HTML size: {len(raw_html):,} bytes")

    # Extract thinking blocks from raw HTML
    thinking_blocks = extract_thinking_from_html(raw_html)

    print(f"  Found {len(thinking_blocks)} thinking blocks in raw HTML")

    # Count current thinking blocks in structured data
    current_thinking = sum(
        1 for ex in data.get('exchanges', [])
        for msg in ex.get('messages', [])
        if msg.get('message_type') == 'thinking' and msg.get('thinking_stages')
    )

    print(f"  Current thinking blocks in JSON: {current_thinking}")
    print(f"  Missing from JSON: {len(thinking_blocks) - current_thinking}")

    if len(thinking_blocks) > current_thinking:
        print(f"  ✓ Can recover {len(thinking_blocks) - current_thinking} thinking blocks!")

        # TODO: Match thinking blocks to exchanges and update JSON
        # This requires more sophisticated matching logic

        # For now, just save the extracted thinking blocks separately
        recovery_data = {
            'source_file': str(input_file),
            'recovered_thinking_blocks': thinking_blocks,
            'recovery_stats': {
                'total_found': len(thinking_blocks),
                'current_in_json': current_thinking,
                'newly_recovered': len(thinking_blocks) - current_thinking
            }
        }

        if not output_file:
            output_file = Path(input_file).with_suffix('.recovered.json')

        with open(output_file, 'w') as f:
            json.dump(recovery_data, f, indent=2)

        print(f"  Saved recovery data to: {output_file}")
    else:
        print("  ℹ️  All thinking blocks already captured in JSON")


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Recover thinking blocks from raw HTML in export files'
    )
    parser.add_argument(
        'files',
        nargs='+',
        help='Export file(s) to process'
    )
    parser.add_argument(
        '--output-dir',
        help='Output directory for recovered data'
    )

    args = parser.parse_args()

    for file_path in args.files:
        output_path = None
        if args.output_dir:
            filename = Path(file_path).name
            output_path = Path(args.output_dir) / f"{Path(filename).stem}.recovered.json"

        try:
            recover_thinking_blocks(file_path, output_path)
        except Exception as e:
            print(f"  ✗ Error: {e}")


if __name__ == '__main__':
    main()
