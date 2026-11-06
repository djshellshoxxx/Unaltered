"""Pure, fail-closed cloud workflow admission over a trusted metadata snapshot.

CLI: /usr/bin/python3 -I cloud_run_policy.py < snapshot.json
Print one decision JSON object; exit 0 only for admission, otherwise 1.

Version 1 input: schema_version, now (UTC YYYY-MM-DDTHH:MM:SSZ),
current_run_id, current_run_attempt, config, history, pull_requests.
Config requires explicit boolean owner_opt_in and positive integer
max_attempts_24h, cooldown_seconds, backoff_base_seconds, backoff_max_seconds.
history={complete: true, runs: [{id, run_attempt, status, conclusion,
created_at, updated_at}]}; pull_requests={complete: true, items:
[{number, state, head_ref}]}. The trusted caller must exhaust pagination for
this workflow's runs and the repository's PRs, without status/date filtering,
before asserting complete. Bounds exceeded or incomplete metadata must deny.

The caller supplies the clock; this module reads no environment, credentials,
network or files. GitHub metadata is not authenticated here. Serialize runs
at workflow level; this predicate cannot atomically reserve admission.

Accounting is a conservative workflow-frequency control, not a dollar/token
cap or paid usage measurement: all attempts of a run updated within 24h are
charged, even if earlier attempts were older. Current-run reruns are denied
because excluding that run ID otherwise hides its previous attempts. Each
non-success completed run extends backoff; only success resets the streak.
No model token usage or cost is inferred from workflow metadata.
"""
from datetime import datetime, timedelta, timezone
import json
import re
import sys


MAX_INPUT_BYTES = 2 * 1024 * 1024
MAX_RECORDS = 10000
MAX_INTEGER = 2**63 - 1
MAX_SECONDS = 2**31 - 1  # Representation bound, not a spending/frequency default.
ACTIVE_STATUSES = frozenset({'in_progress', 'queued', 'requested', 'waiting', 'pending'})
CONCLUSIONS = frozenset({'success', 'failure', 'neutral', 'cancelled', 'skipped',
                         'timed_out', 'action_required', 'stale'})
UTC_FORMAT = '%Y-%m-%dT%H:%M:%SZ'
UTC_PATTERN = re.compile(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z')


class InvalidSnapshot(ValueError):
    """Malformed or incomplete admission input."""


def require(condition):
    if not condition:
        raise InvalidSnapshot('Malformed or incomplete metadata/configuration')


def positive_integer(value, maximum=MAX_INTEGER):
    require(type(value) is int and 1 <= value <= maximum)
    return value


def timestamp(value):
    require(isinstance(value, str) and UTC_PATTERN.fullmatch(value) is not None)
    try:
        return datetime.strptime(value, UTC_FORMAT).replace(tzinfo=timezone.utc)
    except ValueError as error:
        raise InvalidSnapshot('Invalid UTC timestamp') from error


def complete_records(section, key):
    require(isinstance(section, dict) and section.get('complete') is True)
    records = section.get(key)
    require(isinstance(records, list) and len(records) <= MAX_RECORDS)
    return records


def validate_runs(records, now):
    runs = []
    identifiers = set()
    for item in records:
        require(isinstance(item, dict))
        identifier = positive_integer(item.get('id'))
        require(identifier not in identifiers)
        identifiers.add(identifier)
        attempt = positive_integer(item.get('run_attempt'))
        status = item.get('status')
        conclusion = item.get('conclusion')
        require(isinstance(status, str) and status in ACTIVE_STATUSES | {'completed'})
        if status == 'completed':
            require(isinstance(conclusion, str) and conclusion in CONCLUSIONS)
        else:
            require('conclusion' in item and conclusion is None)
        created = timestamp(item.get('created_at'))
        updated = timestamp(item.get('updated_at'))
        require(created <= updated <= now)
        runs.append({'id': identifier, 'attempt': attempt, 'status': status,
                     'conclusion': conclusion, 'updated': updated})
    return runs


def validate_pull_requests(records):
    cloud_numbers = []
    identifiers = set()
    for item in records:
        require(isinstance(item, dict))
        identifier = positive_integer(item.get('number'))
        require(identifier not in identifiers)
        identifiers.add(identifier)
        state = item.get('state')
        require(isinstance(state, str) and state in {'open', 'closed'})
        head = item.get('head_ref')
        require(isinstance(head, str) and 1 <= len(head) <= 1024)
        require(all(ord(char) > 32 and ord(char) != 127 for char in head))
        if state == 'open' and head.startswith('codex/unaltered-cloud-'):
            cloud_numbers.append(identifier)
    return sorted(cloud_numbers)


def decision(allowed, reason, accounting=None, **details):
    result = {'schema_version': 1, 'allowed': allowed, 'reason': reason}
    if accounting is not None:
        result['accounting'] = accounting
    result.update(details)
    return result


def capped_backoff(base, cap, failures):
    delay = base
    # Double only until the configured cap. Work is logarithmic in cap,
    # independent of an adversarial run_attempt or failure streak magnitude.
    for _ in range(failures - 1):
        if delay >= cap:
            break
        delay = min(delay * 2, cap)
    return delay


def waiting_decision(runs, now, cooldown, base, cap, failures, accounting):
    if not runs:
        return None
    retry = runs[0]['updated'] + timedelta(seconds=cooldown)
    reason = 'cooldown'
    if failures:
        backoff_until = runs[0]['updated'] + timedelta(
            seconds=capped_backoff(base, cap, failures))
        if backoff_until >= retry:
            retry, reason = backoff_until, 'failure_backoff'
    if now < retry:
        return decision(False, reason, accounting,
                        retry_at=retry.isoformat().replace('+00:00', 'Z'))
    return None


def evaluate(snapshot):
    """Return a deterministic decision; malformed input always denies admission."""
    try:
        return evaluate_validated(snapshot)
    except (InvalidSnapshot, OverflowError, TypeError, ValueError):
        return decision(False, 'invalid_input')


def evaluate_validated(snapshot):
    require(isinstance(snapshot, dict))
    require(type(snapshot.get('schema_version')) is int and snapshot['schema_version'] == 1)
    config = snapshot.get('config')
    if not isinstance(config, dict) or config.get('owner_opt_in') is not True:
        return decision(False, 'owner_opt_in_required')
    maximum = positive_integer(config.get('max_attempts_24h'))
    cooldown = positive_integer(config.get('cooldown_seconds'), MAX_SECONDS)
    base = positive_integer(config.get('backoff_base_seconds'), MAX_SECONDS)
    cap = positive_integer(config.get('backoff_max_seconds'), MAX_SECONDS)
    require(base <= cap)
    now = timestamp(snapshot.get('now'))
    current_id = positive_integer(snapshot.get('current_run_id'))
    current_attempt = positive_integer(snapshot.get('current_run_attempt'))
    runs = validate_runs(complete_records(snapshot.get('history'), 'runs'), now)
    cloud_prs = validate_pull_requests(
        complete_records(snapshot.get('pull_requests'), 'items'))
    require(all(run['attempt'] == current_attempt for run in runs if run['id'] == current_id))
    # API timestamps have second precision. When completion times tie, put
    # unsuccessful runs first rather than infer a success reset from run IDs.
    runs = sorted((run for run in runs if run['id'] != current_id),
                  key=lambda run: (run['updated'], run['conclusion'] != 'success', run['id']),
                  reverse=True)
    window = now - timedelta(hours=24)
    attempts = sum(run['attempt'] for run in runs if run['updated'] >= window)
    failures = 0
    for run in runs:
        if run['status'] != 'completed' or run['conclusion'] == 'success':
            break
        failures += 1
    accounting = {'attempts_24h_upper_bound': attempts,
                  'max_attempts_24h': maximum,
                  'consecutive_unsuccessful_runs': failures}
    if current_attempt != 1:
        return decision(False, 'current_run_rerun', accounting)
    if cloud_prs:
        return decision(False, 'cloud_pull_request_open', accounting,
                        blocking_pull_requests=cloud_prs)
    if any(run['status'] != 'completed' for run in runs):
        return decision(False, 'workflow_in_progress', accounting)
    if attempts >= maximum:
        return decision(False, 'attempt_limit_24h', accounting)
    waiting = waiting_decision(runs, now, cooldown, base, cap, failures, accounting)
    return waiting or decision(True, 'admitted', accounting)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def reject_nonfinite(_value):
    raise InvalidSnapshot('Non-finite JSON value')


def main():
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        require(len(raw) <= MAX_INPUT_BYTES)
        snapshot = json.loads(raw.decode('utf-8'), object_pairs_hook=unique_object,
                              parse_constant=reject_nonfinite)
        result = evaluate(snapshot)
    except (InvalidSnapshot, UnicodeError, ValueError, RecursionError):
        result = decision(False, 'invalid_input')
    print(json.dumps(result, sort_keys=True, separators=(',', ':')))
    return 0 if result['allowed'] else 1


if __name__ == '__main__':
    sys.exit(main())
