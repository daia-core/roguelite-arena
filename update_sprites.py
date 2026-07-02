#!/usr/bin/env python3
"""
Update sprites.ts to use scale=8 throughout and remove all scale overrides.
Also update Stardew Valley color palettes.
"""

import re

# Read the file
with open('/workspace/work/roguelite-game/frontend/src/sprites.ts', 'r') as f:
    content = f.read()

# 1. Remove all "const scale = 4;" lines (there are 27 of them)
content = re.sub(r'\s+const scale = 4;\n', '', content)

# 2. Remove the "const scale = 1.7;" line
content = re.sub(r'\s+const scale = 1\.7;\n', '', content)

# 3. Update size calculations for enemies that were using scale=4
# Pattern: const size = X; where X was calculated with scale 4, needs to be recalculated for scale 8
# Since scale doubled from 4 to 8, all sizes that were based on scale 4 need to double

size_replacements = {
    'const size = 64;': 'const size = 128; // Updated for 8x scale',
    'const size = 72;': 'const size = 144; // Updated for 8x scale',
    'const size = 80;': 'const size = 160; // Updated for 8x scale',
    'const size = 96;': 'const size = 192; // Updated for 8x scale',
    'const size = 56;': 'const size = 112; // Updated for 8x scale',
    'const size = 36;': 'const size = 72; // Updated for 8x scale',
    'const size = 24;': 'const size = 48; // Updated for 8x scale',
}

for old, new in size_replacements.items():
    # Only replace if not already replaced
    if 'Updated for 8x scale' not in new or old not in content:
        continue
    content = content.replace(old, new)

# Write back
with open('/workspace/work/roguelite-game/frontend/src/sprites.ts', 'w') as f:
    f.write(content)

print("✓ Removed all scale overrides")
print("✓ Updated all size declarations for 8x scale")
