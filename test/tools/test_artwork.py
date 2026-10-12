import importlib.util
import json
from pathlib import Path
import struct
import unittest
import zlib

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('verify_genesis', ROOT / 'script/verify_genesis.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def chunk(kind, payload):
    return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))


def tiny_png():
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b'\0\xff\0\0')) + chunk(b'IEND', b''))


class ArtworkVerificationTest(unittest.TestCase):
    def test_report_covers_every_contract_filename_with_actual_png_results(self):
        report = json.loads((ROOT / 'docs/genesis-verification.json').read_text())
        self.assertEqual(report['cid'], module.CID)
        self.assertEqual(report['verified'], 77)
        self.assertEqual([r['filename'] for r in report['images']], [f'genesis-{n:02d}.png' for n in range(1, 78)])
        self.assertEqual(len({r['sha256'] for r in report['images']}), 77)
        for record in report['images']:
            self.assertTrue(record['ok'])
            self.assertEqual(record['status'], 200)
            self.assertEqual(record['contentType'], 'image/png')
            self.assertEqual(record['url'], module.BASE + record['filename'])
            self.assertGreater(record['bytes'], 32)
            self.assertGreater(record['width'], 0)
            self.assertGreater(record['height'], 0)
            self.assertRegex(record['sha256'], r'^[a-f0-9]{64}$')

    def test_png_validation_accepts_valid_and_rejects_corrupt_or_nonimage_payloads(self):
        png = tiny_png()
        self.assertEqual(module.png_dimensions(png), (1, 1))
        for invalid in [b'<html>Gateway error</html>', png[:-12], png[:20] + b'\xff' + png[21:]]:
            with self.assertRaises((ValueError, struct.error, zlib.error)):
                module.png_dimensions(invalid)


if __name__ == '__main__':
    unittest.main()
