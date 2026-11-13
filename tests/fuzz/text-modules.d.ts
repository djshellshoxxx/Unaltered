// The fuzz driver bundles repository text fixtures with esbuild's text loader (scripts/parser-fuzz.mjs).
declare module '*.hex' {
  const text: string;
  export default text;
}
