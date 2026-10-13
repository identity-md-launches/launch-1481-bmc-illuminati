from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class WebsiteRoutesTest(unittest.TestCase):
    def test_document_root_serves_preserved_home_and_dedicated_mint_route(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
        thread = threading.Thread(target=server.serve_forever, kwargs={'poll_interval': 0.01}, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_address[1]}'
        try:
            with urllib.request.urlopen(base + '/') as response:
                home = response.read().decode()
                self.assertIn('./site.js', home)
                self.assertIn('./mint-nav.js', home)
            with urllib.request.urlopen(base + '/mint') as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.url, base + '/mint/')
                mint = response.read().decode()
                self.assertIn('Mint your BMC Pass', mint)
                self.assertIn('id="mint-genesis" class="btn" type="button" disabled', mint)
            for file in ['mint-client.js', 'app.js', 'config.js', 'pass-abi.js', 'bmc-abi.js', 'styles.css',
                         'assets/legacy-runtime.js', 'assets/index-CPnoBN9P.css', 'favicon.svg', 'og.png']:
                with urllib.request.urlopen(base + '/' + file) as response:
                    self.assertEqual(response.status, 200, file)
                    self.assertGreater(len(response.read()), 0, file)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
