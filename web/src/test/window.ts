// The design system's entry puts its components on `window`, and the API reads the page's address: Node has neither.
// A window that is only a location is enough for both; nothing here renders.
(globalThis as { window?: unknown }).window ??= Object.assign(globalThis, { location: new URL('http://127.0.0.1:7338/') });
