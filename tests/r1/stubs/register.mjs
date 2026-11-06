// `node --import <this file>`: install ./hooks.mjs so the runner under test gets the Playwright test double.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
