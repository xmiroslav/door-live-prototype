import ctypes.util
from pathlib import Path
import subprocess
import sys
import unittest


@unittest.skipUnless(sys.platform == 'linux' and ctypes.util.find_library('seccomp'),
                     'Linux/libseccomp isolation test')
class NetworkIsolationTests(unittest.TestCase):
    def test_child_cannot_create_ipv4_or_ipv6_sockets(self):
        program = '''import errno, os, socket
assert os.environ['ORT_DISABLE_TELEMETRY'] == '1'
rejected = 0
for family in (socket.AF_INET, socket.AF_INET6):
    try:
        socket.socket(family, socket.SOCK_STREAM)
    except OSError as error:
        assert error.errno == errno.ENETUNREACH
        rejected += 1
assert rejected == 2
print('network blocked')
'''
        result = subprocess.run([sys.executable, str(Path(__file__).with_name('run_without_network.py')),
                                 sys.executable, '-c', program], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('network blocked', result.stdout)


if __name__ == '__main__':
    unittest.main()
