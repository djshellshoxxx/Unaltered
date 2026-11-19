import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CALENDARS, DEFAULT_EXPLORERS } from '../../src/core/net/allowlist';
import { restoreDefaults } from '../../src/ui/state';
import { mountSettings } from '../../src/ui/views/settings';
import { doc, installFakeDom } from './ui-fake-dom';

let restore: () => void;
beforeEach(() => { restore = installFakeDom(); });
afterEach(() => { restoreDefaults(); restore(); });

describe('advanced settings keyboard focus', () => {
  it.each([DEFAULT_CALENDARS[0]!, DEFAULT_EXPLORERS[0]!, 'min-cal'])(
    'retains focus on the edited control after rerendering %s',
    (key) => {
      const id = key === 'min-cal' ? key : `network-${new URL(key).host}`;
      const root = doc.createElement('main');
      doc.body.appendChild(root);
      mountSettings(root as never, () => {});
      const control = doc.getElementById(id)!;
      control.focus();
      if (id === 'min-cal') control.value = '1';
      else control.checked = !control.checked;
      control.dispatch('change');
      const updated = doc.getElementById(id);
      expect(updated).not.toBe(control);
      expect(doc.activeElement).toBe(updated);
    },
  );
});
