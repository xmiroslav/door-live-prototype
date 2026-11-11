import hashlib
import tempfile
import unittest
from pathlib import Path
from yolox_preflight import verify_checkpoint

class CheckpointIntegrityTests(unittest.TestCase):
    def test_accepts_matching_bytes(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'weights.pth'
            p.write_bytes(b'official fixture')
            self.assertEqual(verify_checkpoint(p, hashlib.sha256(p.read_bytes()).hexdigest()), p)

    def test_rejects_changed_checkpoint_before_deserialization(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'weights.pth'
            p.write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'SHA256'):
                verify_checkpoint(p, '0' * 64)

    def test_missing_checkpoint_fails_without_random_fallback(self):
        with self.assertRaises(FileNotFoundError):
            verify_checkpoint(Path('/no/such/weights.pth'), '0' * 64)

if __name__ == '__main__':
    unittest.main()
