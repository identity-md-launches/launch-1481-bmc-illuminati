#!/usr/bin/env python3
"""Read and validate every contract-named Genesis PNG. No substitution, no dependencies."""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import struct
import sys
import urllib.request
import zlib

CID = "bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u"
BASE = "https://silver-active-lungfish-941.mypinata.cloud/ipfs/" + CID + "/"


def png_dimensions(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not PNG data")
    offset, size, compressed, ended = 8, None, bytearray(), False
    while offset < len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        crc = struct.unpack_from(">I", data, offset + 8 + length)[0]
        if zlib.crc32(kind + payload) != crc:
            raise ValueError("invalid PNG chunk CRC")
        if kind == b"IHDR":
            size = struct.unpack_from(">II", payload)
            if min(size) <= 0:
                raise ValueError("empty image")
        if kind == b"IDAT":
            compressed.extend(payload)
        offset += 12 + length
        if kind == b"IEND":
            ended = True
            break
    if not size or not ended or not zlib.decompress(compressed):
        raise ValueError("incomplete PNG")
    return size


def verify(number):
    filename = f"genesis-{number:02d}.png"
    record = {"artworkId": number, "filename": filename, "url": BASE + filename}
    try:
        request = urllib.request.Request(record["url"], headers={"User-Agent": "BMC-artwork-verification/1"})
        with urllib.request.urlopen(request, timeout=45) as response:
            record.update(status=response.status, contentType=response.headers.get_content_type())
            data = response.read()
        if record["status"] != 200 or record["contentType"] != "image/png":
            raise ValueError("expected HTTP 200 image/png")
        width, height = png_dimensions(data)
        record.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), width=width, height=height, ok=True)
    except Exception as error:
        record.update(ok=False, error=str(error))
    return record


def main():
    output = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/genesis-verification.json")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        records = list(pool.map(verify, range(1, 78)))
    report = {"checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "cid": CID, "gateway": BASE, "verified": sum(r["ok"] for r in records), "images": records}
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(f'{report["verified"]}/77 PNGs verified; report: {output}')
    for result in records:
        if not result["ok"]:
            print(result["filename"], result["error"])
    return 0 if report["verified"] == 77 else 1


if __name__ == "__main__":
    raise SystemExit(main())
