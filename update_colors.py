#!/usr/bin/env python3
"""
Update enemy color palettes to Stardew Valley style:
- Pure black outlines (#000000)
- Warm, saturated colors
"""

import re

# Read the file
with open('/workspace/work/roguelite-game/frontend/src/sprites.ts', 'r') as f:
    content = f.read()

# Replace common dark outline colors with pure black
outline_replacements = [
    ('#78716c', '#000000'),  # gray outline → black
    ('#292524', '#000000'),  # dark brown → black
    ('#4a3428', '#000000'),  # dark brown outline → black
    ('#57534e', '#000000'),  # stone brown → black (keep some for shadows)
    ('#4a5028', '#000000'),  # dark green-brown → black
    ('#5a3a1f', '#000000'),  # dark eyes → black
]

# Apply outline color replacements in color array comments
for old_color, new_color in outline_replacements:
    # Replace in outline positions (typically "1 - outline")
    content = re.sub(
        f"'{old_color}',\\s+//\\s*1\\s*-\\s*outline",
        f"'{new_color}',     // 1 - outline (pure black)",
        content
    )
    content = re.sub(
        f"'{old_color}',\\s+//\\s*1\\s*-\\s*bone shadow",
        f"'{new_color}',     // 1 - outline (pure black)",
        content
    )

# Warm up gray colors - shift toward browns/warmer tones
warm_replacements = [
    ('#e7e5e4', '#e8dcc0'),  # bone white → warm cream
]

for old_color, new_color in warm_replacements:
    content = content.replace(old_color, new_color)

# Write back
with open('/workspace/work/roguelite-game/frontend/src/sprites.ts', 'w') as f:
    f.write(content)

print("✓ Updated enemy color palettes to Stardew Valley style")
print("  - Pure black outlines")
print("  - Warmer, saturated colors")
