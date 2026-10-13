#!/usr/bin/env python3
"""Regenerate the committed presentation previews from 77 previously downloaded original PNGs.
Requires Pillow only for asset regeneration; the production build never uses Python/Pillow/network.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('originals', type=Path)
args = parser.parse_args()
source = json.loads((ROOT / 'docs/genesis-verification.json').read_text())
output = ROOT / 'website/artwork/genesis'
output.mkdir(parents=True, exist_ok=True)
entries = []
# Validate every original BEFORE replacing any presentation file.
for record in source['images']:
    data = (args.originals / record['filename']).read_bytes()
    if hashlib.sha256(data).hexdigest() != record['sha256']:
        raise SystemExit('Original hash mismatch: ' + record['filename'])
for record in source['images']:
    image = Image.open(args.originals / record['filename']).convert('RGB')
    image.thumbnail((360, 360))
    target = output / record['filename'].replace('.png', '.webp')
    image.save(target, 'WEBP', quality=72, method=6)
    entries.append({'file': target.name, 'originalSha256': record['sha256'],
                    'previewSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                    'width': image.width, 'height': image.height})
(ROOT / 'docs/artwork-previews.json').write_text(json.dumps({
    'method': 'Pillow thumbnail, 360px maximum, WebP quality 72. Authentic original artwork; presentation previews only. Original immutable PNGs remain at the contract IPFS CID.',
    'cid': source['cid'], 'images': entries,
}, indent=2) + '\n')
print('77 authenticated previews regenerated; NFT metadata and originals are unchanged.')
