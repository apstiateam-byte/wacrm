import { describe, expect, it } from 'vitest';

import { GST_QUESTION, niches, realEstate, whatsappHref } from './niches';

describe('whatsappHref', () => {
  it('adds the India country code to a 10-digit number', () => {
    expect(whatsappHref('Hi', '98290 12345')).toBe('https://wa.me/919829012345?text=Hi');
  });

  it('keeps an international number and drops formatting', () => {
    expect(whatsappHref('Hi there', '+91 98290-12345')).toBe('https://wa.me/919829012345?text=Hi%20there');
  });

  it('strips a trunk zero', () => {
    expect(whatsappHref('Hi', '09829012345')).toBe('https://wa.me/919829012345?text=Hi');
  });

  it('returns null without a usable number', () => {
    expect(whatsappHref('Hi', '')).toBeNull();
    expect(whatsappHref('Hi', '12345')).toBeNull();
  });
});

describe('niche content', () => {
  it('has unique slugs', () => {
    expect(new Set(niches.map((n) => n.slug)).size).toBe(niches.length);
  });

  it.each(niches)('$slug: names Jaipur, answers GST and has 3–4 use cases', (n) => {
    expect(`${n.meta.title} ${n.meta.description}`).toContain('Jaipur');
    expect(n.faqs.some((f) => f.q === GST_QUESTION)).toBe(true);
    expect(n.useCases.items.length).toBeGreaterThanOrEqual(3);
    expect(n.useCases.items.length).toBeLessThanOrEqual(4);
  });

  it.each(niches)('$slug: copy has no emoji', (n) => {
    expect(JSON.stringify(n)).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('real estate rules out messaging purchased lists', () => {
    const answer = realEstate.faqs.find((f) => /purchased/i.test(f.q))?.a ?? '';
    expect(answer).toMatch(/^No\./);
  });
});
