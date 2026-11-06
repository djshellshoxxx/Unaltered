"""Offline admission regressions. All numbers and times are synthetic fixtures."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest


POLICY = Path(__file__).with_name('cloud_run_policy.py')
SPEC = importlib.util.spec_from_file_location('cloud_run_policy', POLICY)
policy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(policy)


def fixture():
    return {
        'schema_version': 1, 'now': '2026-11-06T12:00:00Z',
        'current_run_id': 999, 'current_run_attempt': 1,
        'config': {'owner_opt_in': True, 'max_attempts_24h': 3,
                   'cooldown_seconds': 60, 'backoff_base_seconds': 120,
                   'backoff_max_seconds': 1920},
        'history': {'complete': True, 'runs': []},
        'pull_requests': {'complete': True, 'items': []},
    }


def run_record(identifier=1, updated='2026-11-06T11:00:00Z', conclusion='success', attempt=1):
    return {'id': identifier, 'run_attempt': attempt, 'status': 'completed',
            'conclusion': conclusion, 'created_at': '2026-11-05T00:00:00Z',
            'updated_at': updated}


class AdmissionTests(unittest.TestCase):
    def decision(self, data):
        return policy.evaluate(data)

    def denied(self, data, reason=None):
        result = self.decision(data)
        self.assertIs(result['allowed'], False)
        if reason:
            self.assertEqual(result['reason'], reason)
        return result

    def test_empty_complete_history_allows_explicitly_configured_owner(self):
        result = self.decision(fixture())
        self.assertTrue(result['allowed'])
        self.assertEqual(result['accounting']['attempts_24h_upper_bound'], 0)

    def test_absent_false_or_non_boolean_opt_in_never_enables(self):
        for value in [None, False, 'true', 1, [], {}]:
            with self.subTest(value=value):
                data = fixture()
                data['config']['owner_opt_in'] = value
                self.denied(data, 'owner_opt_in_required')
        for key in ['config', 'owner_opt_in']:
            data = fixture()
            del (data if key == 'config' else data['config'])[key]
            self.denied(data, 'owner_opt_in_required')

    def test_frequency_counts_attempts_and_stops_at_configured_limit(self):
        data = fixture()
        data['history']['runs'] = [run_record(attempt=3)]
        result = self.denied(data, 'attempt_limit_24h')
        self.assertEqual(result['accounting']['attempts_24h_upper_bound'], 3)

    def test_old_run_rerun_recently_cannot_escape_window(self):
        data = fixture()
        data['history']['runs'] = [run_record(attempt=3)]
        self.assertLess(data['history']['runs'][0]['created_at'], '2026-11-05T12:00:00Z')
        self.denied(data, 'attempt_limit_24h')

    def test_24h_boundary_is_inclusive_and_older_is_excluded(self):
        data = fixture()
        data['config']['max_attempts_24h'] = 1
        data['history']['runs'] = [run_record(updated='2026-11-05T12:00:00Z')]
        self.denied(data, 'attempt_limit_24h')
        data['history']['runs'][0]['updated_at'] = '2026-11-05T11:59:59Z'
        self.assertTrue(self.decision(data)['allowed'])

    def test_cooldown_uses_persisted_update_and_exact_boundary(self):
        data = fixture()
        data['history']['runs'] = [run_record(updated='2026-11-06T11:59:01Z')]
        result = self.denied(data, 'cooldown')
        self.assertEqual(result['retry_at'], '2026-11-06T12:00:01Z')
        data['now'] = result['retry_at']
        self.assertTrue(self.decision(data)['allowed'])

    def test_failures_back_off_exponentially_across_unordered_history(self):
        data = fixture()
        data['history']['runs'] = [
            run_record(2, '2026-11-06T11:55:00Z', 'failure'),
            run_record(1, '2026-11-06T10:00:00Z', 'success'),
            run_record(3, '2026-11-06T11:57:00Z', 'timed_out'),
        ]
        data['config']['max_attempts_24h'] = 9
        result = self.denied(data, 'failure_backoff')
        self.assertEqual(result['accounting']['consecutive_unsuccessful_runs'], 2)
        self.assertEqual(result['retry_at'], '2026-11-06T12:01:00Z')
        data['now'] = result['retry_at']
        self.assertTrue(self.decision(data)['allowed'])

    def test_backoff_is_capped_without_constructing_huge_exponents(self):
        data = fixture()
        data['config']['max_attempts_24h'] = 1000
        data['history']['runs'] = [run_record(i, '2026-11-06T11:59:00Z', 'cancelled')
                                   for i in range(1, 101)]
        result = self.denied(data, 'failure_backoff')
        self.assertEqual(result['retry_at'], '2026-11-06T12:31:00Z')

    def test_success_resets_failure_backoff(self):
        data = fixture()
        data['history']['runs'] = [run_record(1, conclusion='failure'),
                                   run_record(2, '2026-11-06T11:58:00Z')]
        self.assertTrue(self.decision(data)['allowed'])

    def test_equal_completion_timestamps_cannot_infer_a_success_reset_from_ids(self):
        data = fixture()
        data['history']['runs'] = [run_record(1, '2026-11-06T11:58:30Z', 'failure'),
                                   run_record(2, '2026-11-06T11:58:30Z')]
        result = self.denied(data, 'failure_backoff')
        self.assertEqual(result['accounting']['consecutive_unsuccessful_runs'], 1)

    def test_all_known_active_statuses_block_and_current_run_is_excluded(self):
        for status in ['queued', 'in_progress', 'requested', 'waiting', 'pending']:
            with self.subTest(status=status):
                data = fixture()
                record = run_record()
                record.update(status=status, conclusion=None)
                data['history']['runs'] = [record]
                self.denied(data, 'workflow_in_progress')
                record['id'] = data['current_run_id']
                self.assertTrue(self.decision(data)['allowed'])

    def test_rerunning_current_id_cannot_bypass_history_controls(self):
        data = fixture()
        data['current_run_attempt'] = 2
        self.denied(data, 'current_run_rerun')

    def test_current_run_metadata_cannot_contradict_the_declared_attempt(self):
        data = fixture()
        data['history']['runs'] = [run_record(data['current_run_id'], attempt=2)]
        self.denied(data, 'invalid_input')

    def test_open_cloud_pr_after_first_100_blocks_regardless_of_draft(self):
        data = fixture()
        data['pull_requests']['items'] = [
            {'number': i, 'state': 'open', 'head_ref': f'ordinary-{i}'} for i in range(1, 151)]
        data['pull_requests']['items'][-1]['head_ref'] = 'codex/unaltered-cloud-previous'
        self.denied(data, 'cloud_pull_request_open')
        data['pull_requests']['items'][-1]['state'] = 'closed'
        self.assertTrue(self.decision(data)['allowed'])

    def test_incomplete_snapshots_or_wrong_completeness_type_fail_closed(self):
        for section in ['history', 'pull_requests']:
            for value in [False, None, 'true', 1]:
                with self.subTest(section=section, value=value):
                    data = fixture()
                    data[section]['complete'] = value
                    self.denied(data, 'invalid_input')

    def test_malformed_or_unknown_history_is_rejected_even_when_old(self):
        mutations = [('id', True), ('run_attempt', 0), ('run_attempt', True),
                     ('status', 'unknown'), ('conclusion', 'unknown'),
                     ('conclusion', None), ('updated_at', '2026-11-06T12:00:01Z'),
                     ('updated_at', '2026-11-04T00:00:00Z'),
                     ('created_at', '2026-11-05T00:00:00+00:00'),
                     ('updated_at', '2026-11-06T11:00:00.000Z'),
                     ('created_at', '2026-02-30T00:00:00Z')]
        for key, value in mutations:
            with self.subTest(key=key, value=value):
                data = fixture()
                record = run_record()
                record[key] = value
                data['history']['runs'] = [record]
                self.denied(data, 'invalid_input')
        for key in run_record():
            data = fixture()
            record = run_record()
            del record[key]
            data['history']['runs'] = [record]
            self.denied(data, 'invalid_input')

    def test_active_status_with_completed_conclusion_is_invalid(self):
        data = fixture()
        record = run_record()
        record['status'] = 'queued'
        data['history']['runs'] = [record]
        self.denied(data, 'invalid_input')

    def test_duplicate_records_cannot_ambiguously_reset_failure_or_hide_pr(self):
        data = fixture()
        data['history']['runs'] = [run_record(), run_record(conclusion='failure')]
        self.denied(data, 'invalid_input')
        data = fixture()
        data['pull_requests']['items'] = [
            {'number': 1, 'state': 'open', 'head_ref': 'ordinary'},
            {'number': 1, 'state': 'closed', 'head_ref': 'codex/unaltered-cloud-x'}]
        self.denied(data, 'invalid_input')

    def test_missing_malformed_configuration_never_falls_back_to_budget_defaults(self):
        for key in ['max_attempts_24h', 'cooldown_seconds',
                    'backoff_base_seconds', 'backoff_max_seconds']:
            for value in [None, 0, -1, True, '3', 1.5, 2**64]:
                with self.subTest(key=key, value=value):
                    data = fixture()
                    data['config'][key] = value
                    self.denied(data, 'invalid_input')
            data = fixture()
            del data['config'][key]
            self.denied(data, 'invalid_input')
        data = fixture()
        data['config']['backoff_max_seconds'] = 1
        self.denied(data, 'invalid_input')

    def test_malformed_pr_metadata_is_not_ignored(self):
        for record in [{}, {'number': True, 'state': 'open', 'head_ref': 'a'},
                       {'number': 1, 'state': 'unknown', 'head_ref': 'a'},
                       {'number': 1, 'state': 'open', 'head_ref': 'x\n'}]:
            data = fixture()
            data['pull_requests']['items'] = [record]
            self.denied(data, 'invalid_input')

    def test_arrays_are_bounded_even_for_direct_python_callers(self):
        data = fixture()
        data['history']['runs'] = [run_record()] * (policy.MAX_RECORDS + 1)
        self.denied(data, 'invalid_input')

    def test_evaluation_does_not_mutate_the_caller_snapshot(self):
        data = fixture()
        data['history']['runs'] = [run_record(2), run_record(1)]
        before = copy.deepcopy(data)
        self.decision(data)
        self.assertEqual(data, before)

    def cli(self, payload):
        return subprocess.run(['/usr/bin/python3', '-I', str(POLICY)], input=payload,
                              text=True, capture_output=True, check=False)

    def test_cli_allow_and_deny_have_machine_readable_output_and_exit_codes(self):
        for opt_in, code in [(True, 0), (False, 1)]:
            data = fixture()
            data['config']['owner_opt_in'] = opt_in
            result = self.cli(json.dumps(data))
            self.assertEqual(result.returncode, code, result.stderr)
            self.assertIs(json.loads(result.stdout)['allowed'], opt_in)

    def test_cli_rejects_malformed_duplicate_nonfinite_deep_and_oversized_json(self):
        for payload in ['{', '[]', '{"schema_version":1,"schema_version":1}',
                        '{"x":NaN}', '[' * 2000 + '0' + ']' * 2000,
                        ' ' * (policy.MAX_INPUT_BYTES + 1)]:
            with self.subTest(length=len(payload)):
                result = self.cli(payload)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertFalse(json.loads(result.stdout)['allowed'])
                self.assertEqual(result.stderr, '')


if __name__ == '__main__':
    unittest.main()
