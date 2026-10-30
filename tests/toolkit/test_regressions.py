"""Offline regressions for bundled toolkit code; no SDK, services or credentials."""
import ast
import asyncio
import contextlib
import http.client
import importlib.util
import io
import json
import socket
import sys
import time
import traceback
import unittest
import urllib.error
import urllib.request
from email.message import Message
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.response import addinfourl

ROOT = Path(__file__).resolve().parents[2]
VIEWER_PATH = ROOT / 'skills/skill-creator/eval-viewer/generate_review.py'
PROBE_PATH = ROOT / 'skills/claude-api/shared/preserved-thinking-migration/drop_block_probe.py'
EVALUATOR_PATH = ROOT / 'skills/mcp-builder/scripts/evaluation.py'


def load_viewer():
    spec = importlib.util.spec_from_file_location('toolkit_viewer', VIEWER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_definitions(path, names, scope):
    """Load the real selected functions without optional SDK imports or CLI code."""
    tree = ast.parse(path.read_text())
    nodes = [node for node in tree.body
             if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
             and node.name in names]
    if {node.name for node in nodes} != set(names):
        raise AssertionError('Missing regression target')
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(path), 'exec'), scope)
    return scope


class ViewerTests(unittest.TestCase):
    def test_output_text_cannot_close_the_embedded_script(self):
        viewer = load_viewer()
        payload = '</script><script>window.__toolkitAuditMarker=1</script><!--&'
        html = viewer.generate_html([{'outputs': [{'type': 'text', 'content': payload}]}], 'audit')
        self.assertFalse(payload in html, 'Output text must not become an HTML script')
        # Escaping must preserve the original output, not delete or HTML-encode it.
        data = json.JSONDecoder().raw_decode(html.split('const EMBEDDED_DATA = ', 1)[1])[0]
        self.assertEqual(data['runs'][0]['outputs'][0]['content'], payload)
        self.assertIn('\\u003c', html)

    def test_occupied_port_fails_without_signals_or_a_different_port(self):
        viewer = load_viewer()
        with (patch.object(sys, 'argv', ['generate_review.py', str(ROOT), '--port', '3117']),
              patch.object(viewer, 'find_runs', return_value=[{'id': 'synthetic'}]),
              patch.object(viewer, 'HTTPServer', side_effect=OSError('Address already in use')) as server,
              patch.object(viewer, 'webbrowser') as browser,
              patch.object(viewer, '_kill_port', create=True,
                           side_effect=AssertionError('Must not signal unrelated processes')) as kill_port,
              contextlib.redirect_stderr(io.StringIO()) as error):
            with self.assertRaises(SystemExit) as exit_result:
                viewer.main()
            self.assertEqual(exit_result.exception.code, 1)
            self.assertIn('3117', error.getvalue())
            self.assertIn('Address already in use', error.getvalue())
            server.assert_called_once()
            kill_port.assert_not_called()
            browser.open.assert_not_called()


class RedirectTests(unittest.TestCase):
    def test_authenticated_probe_rejects_redirects_without_a_second_request(self):
        tree = ast.parse(PROBE_PATH.read_text())
        redirect_classes = [node.name for node in tree.body
                            if isinstance(node, ast.ClassDef)
                            and any(isinstance(base, ast.Attribute) and base.attr == 'HTTPRedirectHandler'
                                    for base in node.bases)]
        scope = load_definitions(PROBE_PATH, ['post', *redirect_classes], {
            'json': json, 'time': time, 'urllib': urllib, 'socket': socket, 'http': http,
        })
        for status in (301, 302, 303, 307, 308):
            with self.subTest(status=status):
                requested = []

                def transport(_handler, request):
                    requested.append(request.full_url)
                    headers = Message()
                    if len(requested) == 1:
                        headers['Location'] = 'http://different.example/collect'
                        response = addinfourl(io.BytesIO(b'redirect'), headers, request.full_url, status)
                        response.msg = 'Redirect'
                    else:
                        response = addinfourl(io.BytesIO(b'{}'), headers, request.full_url, 200)
                        response.msg = 'OK'
                    return response

                # Intercept at the transport layer: even an accidental follow cannot use sockets.
                with (patch.object(urllib.request.HTTPHandler, 'http_open', transport),
                      patch.object(urllib.request.HTTPSHandler, 'https_open', transport),
                      patch.object(socket, 'create_connection', side_effect=AssertionError('Network forbidden'))):
                    result = scope['post']('http://original.example', '/v1/messages', {}, [],
                                           {'x-api-key': 'SYNTHETIC-NOT-A-SECRET'}, 1)
                self.assertEqual(requested, ['http://original.example/v1/messages'])
                self.assertEqual(result[0], status)


class EvaluatorTests(unittest.TestCase):
    def test_all_tool_uses_are_returned_once_with_their_original_ids(self):
        scope = load_definitions(EVALUATOR_PATH, ['agent_loop'], {
            'asyncio': asyncio, 'json': json, 'time': time, 'traceback': traceback,
            'Anthropic': object, 'Any': object, 'EVALUATION_PROMPT': 'synthetic',
        })
        tool_uses = [SimpleNamespace(type='tool_use', name='first', id='tool-1', input={'n': 1}),
                     SimpleNamespace(type='tool_use', name='second', id='tool-2', input={'n': 2}),
                     SimpleNamespace(type='tool_use', name='first', id='tool-3', input={'n': 3})]
        model_calls, tool_calls = [], []

        def create(**kwargs):
            model_calls.append(kwargs)
            if len(model_calls) == 1:
                return SimpleNamespace(stop_reason='tool_use', content=[SimpleNamespace(type='text', text='working'), *tool_uses])
            return SimpleNamespace(stop_reason='end_turn', content=[SimpleNamespace(text='<response>done</response>')])

        async def call_tool(name, arguments):
            tool_calls.append((name, arguments))
            if name == 'second':
                raise RuntimeError('synthetic tool failure')
            return {'text': 'synthetic result'}

        client = SimpleNamespace(messages=SimpleNamespace(create=create))
        connection = SimpleNamespace(call_tool=call_tool)
        answer, metrics = asyncio.run(scope['agent_loop'](client, 'fake', 'synthetic', [], connection))
        self.assertEqual(answer, '<response>done</response>')
        self.assertEqual(len(model_calls), 2)
        self.assertEqual(tool_calls, [(tool.name, tool.input) for tool in tool_uses])
        result_turns = [message for message in model_calls[-1]['messages'][1:]
                        if message['role'] == 'user']
        self.assertEqual(len(result_turns), 1)
        self.assertEqual([item['tool_use_id'] for item in result_turns[0]['content']],
                         [tool.id for tool in tool_uses])
        self.assertIn('synthetic tool failure', result_turns[0]['content'][1]['content'])
        self.assertEqual(metrics['first']['count'], 2)
        self.assertEqual(metrics['second']['count'], 1)


if __name__ == '__main__':
    unittest.main()
