// Module resolution hook for tests/r1/r1-acceptance.test.mjs: '@playwright/test' becomes the local test double.
export async function resolve(specifier, context, next) {
  if (specifier === '@playwright/test') return { url: new URL('./playwright.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
