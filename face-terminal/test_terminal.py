import base64
from pathlib import Path
import tempfile
import unittest

import numpy as np

from terminal import LocalStore, Terminal, TerminalError, envelope, normalize_url


class TestKeyring:
    def __init__(self):
        self.data = {}

    def set_password(self, service, account, value):
        self.data[service, account] = value

    def get_password(self, service, account):
        return self.data.get((service, account))

    def delete_password(self, service, account):
        del self.data[service, account]


class TerminalTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.keyring = TestKeyring()
        self.store = LocalStore(Path(self.directory.name), self.keyring)
        self.private, _ = self.store.keys(create=True)

    def test_template_is_encrypted_bound_to_enrollment_and_revocable(self):
        feature = np.full(128, 1 / np.sqrt(128), dtype="<f4")
        self.store.save("teacher-a", feature)
        self.assertEqual(self.store.load("teacher-a").tobytes(), feature.tobytes())
        self.assertNotIn(feature.tobytes(), self.store.path.read_bytes())
        with self.store.db() as db:
            db.execute("UPDATE templates SET id='teacher-b' WHERE id='teacher-a'")
        self.assertIsNone(self.store.load("teacher-b"))
        self.store.prune(set())
        with self.store.db() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM templates").fetchone()[0], 0)
        self.store.erase()
        self.assertFalse(self.keyring.data)

    def test_signature_binds_operation_payload_identity_time_and_request(self):
        result = envelope("roster", "id", self.private, {}, timestamp=100, request_id="request")
        message = b"workforce-face-v1\nroster\nid\n100\nrequest\ne30"
        self.private.public_key().verify(base64.urlsafe_b64decode(result["signature"] + "=="), message)

    def test_terminal_revocation_erases_local_key_and_templates(self):
        crm = "https://crm.example"
        self.store.bind(crm, "id")
        terminal = Terminal(self.store, crm)

        def revoked(*args):
            raise TerminalError("revoked", 410)

        terminal.post = revoked
        with self.assertRaises(TerminalError):
            terminal.roster()
        self.assertIsNone(terminal.terminal_id)
        self.assertIsNone(self.store.binding())
        self.assertFalse(self.keyring.data)

    def test_crm_endpoint_has_no_credentials_path_or_cleartext(self):
        self.assertEqual(normalize_url("https://crm.example/"), "https://crm.example")
        for url in ["http://crm.example", "https://crm.example/workforce", "https://a:b@crm.example", "https://crm.example/?secret=1"]:
            with self.assertRaises(TerminalError):
                normalize_url(url)


if __name__ == "__main__":
    unittest.main()
