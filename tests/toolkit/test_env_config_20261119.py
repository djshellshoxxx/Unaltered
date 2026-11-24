"""Offline .env interoperability and literal-value security regressions."""
import io
from contextlib import chdir
import json
import os
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "shared/scripts"
READERS = (
    ("inspect_juce_project.py", "parse_env_file"),
    ("setup_updates.py", "parse_env"),
    ("auto_update_doctor.py", "parse_env"),
    ("bump_version.py", "read_env_file"),
)


class EnvInteroperabilityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path = self.root / ".env"

    def test_readers_preserve_generated_shell_escapes_as_literal_values(self):
        self.path.write_text('DEVELOPER_NAME="Maker \\$name \\`text\\` \\"quoted\\" \\\\ path"\n'
                             'SINGLE=\'  keep "quotes"  \'\n'
                             'RAW=value=with=equals\n', encoding="utf-8")
        expected = 'Maker $name `text` "quoted" \\ path'
        for filename, function in READERS:
            with self.subTest(reader=filename):
                parsed = runpy.run_path(str(SCRIPTS / filename))[function](self.path)
                self.assertEqual(parsed["DEVELOPER_NAME"], expected)
                self.assertEqual(parsed["SINGLE"], '  keep "quotes"  ')
                self.assertEqual(parsed["RAW"], "value=with=equals")

    def test_readers_never_expand_commands_or_environment(self):
        self.path.write_text('VALUE="$(touch must-not-exist) $HOME `touch also-not-created`"\n', encoding="utf-8")
        expected = '$(touch must-not-exist) $HOME `touch also-not-created`'
        with chdir(self.root):
            for filename, function in READERS:
                with self.subTest(reader=filename):
                    parsed = runpy.run_path(str(SCRIPTS / filename))[function](self.path)
                    self.assertEqual(parsed["VALUE"], expected)
        self.assertFalse((self.root / "must-not-exist").exists())
        self.assertFalse((self.root / "also-not-created").exists())

    def test_release_note_reader_decodes_key_without_network_or_evaluation(self):
        self.path.write_text('OPENROUTER_KEY_PRIVATE="SYNTHETIC\\$KEY"\n', encoding="utf-8")
        module = runpy.run_path(str(SCRIPTS / "generate_release_notes.py"))
        captured = []

        def response(request, **_kwargs):
            captured.append(request.get_header("Authorization"))
            return io.BytesIO(json.dumps({"choices": [{"message": {"content": "local fixture"}}]}).encode())

        with patch("urllib.request.urlopen", side_effect=response):
            self.assertEqual(module["generate_ai_release_notes"]("fixture", "1.0.0", str(self.root)), "local fixture")
        self.assertEqual(captured, ["Bearer SYNTHETIC$KEY"])

    @unittest.skipUnless(os.name == "posix" and shutil.which("sh"), "requires POSIX shell")
    def test_updater_rewrite_cannot_turn_data_into_shell_commands(self):
        self.path.write_text("AUTO_UPDATE_MODE='$(touch rewrite-marker)'\n"
                             'AUTO_UPDATE_EDDSA_PUBLIC_KEY=synthetic\n', encoding="utf-8")
        before = subprocess.run(["sh", "-c", '. "$1"; printf "%s" "$AUTO_UPDATE_MODE"', "_", str(self.path)],
                                cwd=self.root, capture_output=True, text=True, timeout=10)
        self.assertEqual(before.returncode, 0, before.stderr)
        self.assertEqual(before.stdout, "$(touch rewrite-marker)")
        self.assertFalse((self.root / "rewrite-marker").exists())
        command = [sys.executable, "-I", str(SCRIPTS / "setup_updates.py"),
                   "--project-root", str(self.root), "--skip-download"]
        result = subprocess.run(command, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        loaded = subprocess.run(["sh", "-c", '. "$1"; printf "%s" "$AUTO_UPDATE_MODE"', "_", str(self.path)],
                                cwd=self.root, capture_output=True, text=True, timeout=10)
        self.assertEqual(loaded.returncode, 0, loaded.stderr)
        self.assertFalse((self.root / "rewrite-marker").exists(), "updater rewrote inert data as executable shell text")
        self.assertEqual(loaded.stdout, "$(touch rewrite-marker)")

    def test_updater_preserves_safe_bare_flags_and_literal_round_trip(self):
        module = runpy.run_path(str(SCRIPTS / "setup_updates.py"))
        values = {"ENABLE_AUTO_UPDATE": "FALSE", "AUTO_UPDATE_MODE": 'quoted "value" $literal \\ file'}
        module["write_env"](self.path, values)
        self.assertIn("ENABLE_AUTO_UPDATE=FALSE\n", self.path.read_text())
        self.assertEqual(module["parse_env"](self.path), values)

    def test_updater_rejects_multiline_values_before_changing_file(self):
        original = "# untouched\nENABLE_AUTO_UPDATE=FALSE\n"
        self.path.write_text(original)
        module = runpy.run_path(str(SCRIPTS / "setup_updates.py"))
        with self.assertRaises(ValueError):
            module["write_env"](self.path, {"AUTO_UPDATE_MODE": "public\nOTHER=value"})
        self.assertEqual(self.path.read_text(), original)

    def test_updater_preserves_unicode_separators_inside_literal_values(self):
        module = runpy.run_path(str(SCRIPTS / "setup_updates.py"))
        for separator in ("\u0085", "\u2028", "\u2029"):
            with self.subTest(separator=repr(separator)):
                original = f'DEVELOPER_NAME="One{separator}Two"\nENABLE_AUTO_UPDATE=FALSE\n'
                self.path.write_text(original, encoding="utf-8")
                module["write_env"](self.path, {"ENABLE_AUTO_UPDATE": "FALSE"})
                self.assertEqual(self.path.read_text(encoding="utf-8"), original)
                self.assertEqual(module["parse_env"](self.path)["DEVELOPER_NAME"], f"One{separator}Two")

    @unittest.skipUnless(os.name == "posix", "requires a controllable C locale")
    def test_version_writer_preserves_utf8_configuration_in_non_utf8_locale(self):
        original = 'DEVELOPER_NAME="\u674e \u0418\u0432\u0430\u043d"\nVERSION_PATCH=1\n'
        self.path.write_text(original, encoding="utf-8")
        cmake = self.root / "CMakeLists.txt"
        cmake.write_text('# \u674e \u0418\u0432\u0430\u043d\nproject(Example VERSION 1.0.1)\n', encoding="utf-8")
        code = (
            "import runpy, sys; "
            "module = runpy.run_path(sys.argv[1]); "
            "version = dict(major=1, minor=0, patch=2, build=3); "
            "module['update_version_in_env'](sys.argv[2], version); "
            "module['update_cmake_version'](sys.argv[3], version)"
        )
        result = subprocess.run(
            [sys.executable, "-X", "utf8=0", "-c", code, str(SCRIPTS / "bump_version.py"),
             str(self.path), str(self.root)], capture_output=True, text=True, encoding="utf-8", timeout=10,
            env={**os.environ, "LC_ALL": "C", "PYTHONCOERCECLOCALE": "0"},
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        module = runpy.run_path(str(SCRIPTS / "env_config.py"))
        self.assertEqual(module["parse_env"](self.path)["DEVELOPER_NAME"], "\u674e \u0418\u0432\u0430\u043d")
        self.assertIn("VERSION_PATCH=2\n", self.path.read_text(encoding="utf-8"))
        self.assertEqual(cmake.read_text(encoding="utf-8"), '# \u674e \u0418\u0432\u0430\u043d\nproject(Example VERSION 1.0.2)\n')

    def test_appcast_treats_project_text_as_xml_text(self):
        module = runpy.run_path(str(SCRIPTS / "setup_updates.py"))
        title = 'Amp & <enclosure url="https://example.invalid/extra"/>'
        version = "1.0 & preview"
        appcast = self.root / "appcast.xml"
        module["ensure_appcast"](appcast, title, version)
        tree = ElementTree.parse(appcast)
        self.assertEqual(tree.findtext("channel/title"), title)
        self.assertEqual(tree.findtext("channel/item/title"), f"Version {version}")
        self.assertEqual(tree.findall(".//enclosure"), [])


if __name__ == "__main__":
    unittest.main()
