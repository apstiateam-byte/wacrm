// ============================================================
// Product name — ONE setting for the whole app.
//
// Set NEXT_PUBLIC_APP_NAME to rename the product everywhere: sidebar,
// page titles, marketing site, legal pages, emails, Razorpay checkout
// and every translated string that mentions the product (the message
// catalogues say "wacrm"; `withBrand` swaps it at load time).
//
// Pick a name you own. Avoid names that look like another company's
// trademark — Razorpay and Meta both check the brand on your site.
// ============================================================

export const DEFAULT_APP_NAME = 'wacrm';

export const APP_NAME: string = process.env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_APP_NAME;

/** Replace the default product name inside a message catalogue. */
export function withBrand<T>(messages: T, name: string = APP_NAME): T {
  if (name === DEFAULT_APP_NAME) return messages;
  const swap = (node: unknown): unknown => {
    if (typeof node === 'string') return node.replace(/\bwacrm\b/g, name);
    if (Array.isArray(node)) return node.map(swap);
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, swap(v)]));
    }
    return node;
  };
  return swap(messages) as T;
}
