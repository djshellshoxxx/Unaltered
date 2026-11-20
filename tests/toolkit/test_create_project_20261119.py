"""Offline starter-generator safety regressions; no SDK, network, or credentials."""
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CREATE_PROJECT = ROOT / "shared/scripts/create_project.py"


class CreateProjectTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.starter = self.base / "starter"
        self.make_starter(self.starter)
        self.parent = self.base / "projects"
        self.destination = self.parent / "my-plugin"

    def make_starter(self, root):
        (root / "scripts").mkdir(parents=True)
        (root / "scripts/init_plugin_project.sh").write_text("#!/bin/sh\nexit 0\n")
        (root / "CMakeLists.txt").write_text("project(CLASS_NAME_PLACEHOLDER)\n")
        (root / ".env.example").write_text("PROJECT_NAME=CLASS_NAME_PLACEHOLDER\n")
        (root / "README.md").write_text("PLUGIN_NAME_PLACEHOLDER\n")

    def run_create(self, *extra, starter=None, parent=None):
        return subprocess.run(
            [sys.executable, str(CREATE_PROJECT), "My Plugin", "--no-init-git",
             "--starter", str(starter if starter is not None else self.starter),
             "--destination-parent", str(parent if parent is not None else self.parent), *extra],
            capture_output=True, text=True, timeout=15,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        )

    def sentinel(self, root=None):
        target = root if root is not None else self.destination
        target.mkdir(parents=True, exist_ok=True)
        marker = target / "keep.txt"
        marker.write_text("existing data")
        return marker

    def test_new_destination_parent_is_created(self):
        result = self.run_create(parent=self.parent / "nested")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.parent / "nested/my-plugin/README.md").read_text(), "My Plugin\n")

    def test_valid_template_replacements_are_preserved(self):
        result = self.run_create()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.destination / "CMakeLists.txt").read_text(), "project(MyPlugin)\n")
        self.assertIn('PRODUCT_NAME="My Plugin"', (self.destination / ".env").read_text())

    def test_existing_destination_requires_force(self):
        marker = self.sentinel()
        result = self.run_create()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(marker.read_text(), "existing data")

    def test_force_still_replaces_an_unrelated_directory(self):
        marker = self.sentinel()
        result = self.run_create("--force")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(marker.exists())
        self.assertTrue((self.destination / "README.md").is_file())

    def test_missing_source_cannot_delete_existing_destination(self):
        marker = self.sentinel()
        result = self.run_create("--force", starter=self.base / "missing")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists(), "invalid starter deleted the destination before validation")

    def test_non_directory_source_cannot_delete_existing_destination(self):
        marker = self.sentinel()
        source = self.base / "file"
        source.write_text("not a starter")
        result = self.run_create("--force", starter=source)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists())

    def test_missing_required_template_file_preserves_existing_destination(self):
        marker = self.sentinel()
        (self.starter / "CMakeLists.txt").unlink()
        result = self.run_create("--force")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists())

    def test_destination_equal_to_starter_is_refused_before_removal(self):
        self.make_starter(self.destination)
        marker = self.sentinel()
        result = self.run_create("--force", starter=self.destination)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists())

    def test_destination_containing_starter_is_refused_before_removal(self):
        nested = self.destination / "starter"
        self.make_starter(nested)
        marker = self.sentinel()
        result = self.run_create("--force", starter=nested)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists())
        self.assertTrue((nested / "CMakeLists.txt").exists())

    def test_destination_inside_starter_is_refused(self):
        result = self.run_create(parent=self.starter)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.starter / "my-plugin").exists())

    @unittest.skipUnless(os.name == "posix", "requires symlinks")
    def test_destination_symlink_is_refused_without_touching_target(self):
        outside = self.base / "outside"
        marker = self.sentinel(outside)
        self.parent.mkdir()
        self.destination.symlink_to(outside, target_is_directory=True)
        result = self.run_create("--force")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(self.destination.is_symlink())
        self.assertTrue(marker.exists())

    @unittest.skipUnless(os.name == "posix", "requires symlinks")
    def test_dangling_destination_symlink_is_refused(self):
        self.parent.mkdir()
        self.destination.symlink_to(self.base / "missing", target_is_directory=True)
        result = self.run_create("--force")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(self.destination.is_symlink())
        self.assertFalse((self.base / "missing").exists())

    @unittest.skipUnless(os.name == "posix", "requires symlinks")
    def test_linked_template_file_cannot_copy_external_content(self):
        marker = self.sentinel()
        external = self.base / "private.txt"
        external.write_text("SYNTHETIC_PRIVATE_DATA")
        (self.starter / "copied.txt").symlink_to(external)
        result = self.run_create("--force")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists())
        self.assertFalse((self.destination / "copied.txt").exists())

    @unittest.skipUnless(os.name == "posix", "requires symlinks")
    def test_linked_template_directory_is_refused_before_overwrite(self):
        marker = self.sentinel()
        external = self.base / "private"
        external.mkdir()
        (external / "secret.txt").write_text("SYNTHETIC_PRIVATE_DATA")
        (self.starter / "linked").symlink_to(external, target_is_directory=True)
        result = self.run_create("--force")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists())

    @unittest.skipUnless(os.name == "posix", "requires symlinks")
    def test_dangling_template_symlink_is_refused_before_overwrite(self):
        marker = self.sentinel()
        (self.starter / "missing.txt").symlink_to(self.base / "missing")
        result = self.run_create("--force")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists())

    @unittest.skipUnless(hasattr(os, "mkfifo"), "requires named pipes")
    def test_nonregular_template_entry_is_refused_before_overwrite(self):
        marker = self.sentinel()
        os.mkfifo(self.starter / "pipe")
        result = self.run_create("--force")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(marker.exists())

    def test_excluded_template_directories_are_not_copied(self):
        for name in (".git", "integrate", "todo"):
            (self.starter / name).mkdir()
            (self.starter / name / "sentinel").write_text("excluded")
        result = self.run_create()
        self.assertEqual(result.returncode, 0, result.stderr)
        for name in (".git", "integrate", "todo"):
            self.assertFalse((self.destination / name).exists())

    def test_password_argument_is_rejected_without_echo_or_filesystem_changes(self):
        marker = self.sentinel()
        secret = "SYNTHETIC-APP-PASSWORD"
        for args in (("--app-specific-password", secret), (f"--app-specific-password={secret}",)):
            with self.subTest(form=args[0]):
                result = self.run_create("--force", *args)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn(secret, result.stdout + result.stderr)
                self.assertTrue(marker.exists())

    def test_password_is_not_advertised_and_generated_field_is_empty(self):
        help_result = self.run_create("--help")
        self.assertEqual(help_result.returncode, 0)
        self.assertNotIn("--app-specific-password", help_result.stdout)
        result = self.run_create()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("APP_SPECIFIC_PASSWORD=\n", (self.destination / ".env").read_text())


if __name__ == "__main__":
    unittest.main()
