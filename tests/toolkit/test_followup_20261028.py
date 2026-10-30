"""Offline follow-up regressions for bundled toolkit code; no SDK, services or credentials."""
import os
import secrets
import shlex
import shutil
import socket
import subprocess
import sys
import tempfile
import textwrap
import threading
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WITH_SERVER_PATH = ROOT / 'skills/webapp-testing/scripts/with_server.py'
STOP_SERVER_PATH = ROOT / 'skills/brainstorming/scripts/stop-server.sh'


def free_port():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        return probe.getsockname()[1]


class WithServerPipeTests(unittest.TestCase):
    def test_verbose_server_output_cannot_block_readiness(self):
        port = free_port()
        with tempfile.TemporaryDirectory() as temp:
            server = Path(temp) / 'verbose_server.py'
            # Writes far more than an OS pipe buffer before binding, then exits on its own.
            server.write_text(textwrap.dedent(f"""
                import socket, sys, time
                sys.stdout.write('o' * (1 << 20)); sys.stdout.flush()
                sys.stderr.write('e' * (1 << 20)); sys.stderr.flush()
                listener = socket.socket()
                listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                listener.bind(('127.0.0.1', {port}))
                listener.listen()
                time.sleep(15)
            """))
            server_cmd = f'exec {shlex.quote(sys.executable)} -I {shlex.quote(str(server))}'
            result = subprocess.run(
                [sys.executable, '-I', str(WITH_SERVER_PATH), '--server', server_cmd,
                 '--port', str(port), '--timeout', '5', '--',
                 sys.executable, '-I', '-c', 'print("FOLLOWUP_COMMAND_RAN")'],
                capture_output=True, text=True, timeout=60,
                env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'},
            )
        self.assertNotIn('Server failed to start', result.stderr)
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        self.assertIn('FOLLOWUP_COMMAND_RAN', result.stdout)


@unittest.skipUnless(os.name == 'posix' and shutil.which('bash'), 'needs bash')
class StopServerCleanupTests(unittest.TestCase):
    """Run stop-server.sh with its literal /tmp ephemeral root mapped to a private temp dir."""

    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.addCleanup(self._temp.cleanup)
        self.base = Path(self._temp.name)
        self.ephemeral = self.base / 'eph'
        self.ephemeral.mkdir()
        self.script = self.base / 'stop-server.sh'
        self.script.write_text(STOP_SERVER_PATH.read_text().replace('/tmp', str(self.ephemeral)))

    def make_session(self, directory):
        (directory / 'state').mkdir(parents=True)
        (directory / 'content').mkdir()
        sentinel = directory / 'content' / 'SENTINEL'
        sentinel.write_text('keep')
        return sentinel

    def stop(self, real_session, session_arg):
        server_id = secrets.token_hex(16)
        child = subprocess.Popen([sys.executable, '-I', '-c', 'import time; time.sleep(30)',
                                  f'--brainstorm-server-id={server_id}'])
        # Reap the synthetic server as soon as it exits so `kill -0` does not see a zombie.
        reaper = threading.Thread(target=child.wait, daemon=True)
        reaper.start()
        try:
            (real_session / 'state' / 'server.pid').write_text(f'{child.pid}\n')
            (real_session / 'state' / 'server-instance-id').write_text(f'{server_id}\n')
            result = subprocess.run(['bash', str(self.script), session_arg],
                                    capture_output=True, text=True, timeout=30)
            self.assertIn('"stopped"', result.stdout, result.stderr)
        finally:
            if child.poll() is None:
                child.kill()
            reaper.join(timeout=10)

    def test_ephemeral_session_is_still_removed(self):
        session = self.ephemeral / 'brainstorm-1'
        self.make_session(session)
        self.stop(session, str(session))
        self.assertFalse(session.exists())

    def test_dotdot_segment_cannot_delete_persistent_session(self):
        persistent = self.base / 'project' / '.superpowers' / 'brainstorm' / 'sess'
        sentinel = self.make_session(persistent)
        self.stop(persistent, f'{self.ephemeral}/../project/.superpowers/brainstorm/sess')
        self.assertTrue(sentinel.exists(), 'Persistent session outside the ephemeral root was deleted')

    def test_symlink_cannot_redirect_delete_outside_ephemeral_root(self):
        outside = self.base / 'outside'
        sentinel = self.make_session(outside)
        (self.ephemeral / 'link').symlink_to(outside, target_is_directory=True)
        self.stop(outside, f'{self.ephemeral}/link/')
        self.assertTrue(sentinel.exists(), 'Symlink target outside the ephemeral root was emptied')


if __name__ == '__main__':
    unittest.main()
