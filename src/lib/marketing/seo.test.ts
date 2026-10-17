import { describe, expect, it } from 'vitest';

import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { faqLd } from '@/components/marketing/json-ld';
import { jsonLd, MARKETING_ROUTES, pageMetadata, SITE_URL } from './seo';

describe('pageMetadata', () => {
  it('sets a canonical URL and matching Open Graph tags', () => {
    const m = pageMetadata({ path: '/coaching', title: 'Coaching', description: 'D' });
    expect(m.alternates?.canonical).toBe('/coaching');
    expect(m.openGraph).toMatchObject({ url: '/coaching', description: 'D', locale: 'en_IN' });
    expect(m.title).toBe('Coaching');
  });

  it('keeps an absolute title as-is', () => {
    const m = pageMetadata({ path: '/', title: 'Brand — CRM', description: 'D', absoluteTitle: true });
    expect(m.title).toEqual({ absolute: 'Brand — CRM' });
  });
});

describe('sitemap and robots', () => {
  it('lists every marketing route once, with absolute URLs', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toHaveLength(MARKETING_ROUTES.length);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(`${SITE_URL}/coaching`);
    expect(urls).toContain(`${SITE_URL}/real-estate`);
    expect(urls.every((u) => u.startsWith(SITE_URL))).toBe(true);
  });

  it('keeps the app private and points to the sitemap', () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.disallow).toEqual(expect.arrayContaining(['/api/', '/dashboard', '/inbox', '/settings']));
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe('jsonLd', () => {
  it('escapes "<" so content cannot close the script tag', () => {
    const out = jsonLd(faqLd([{ q: 'Q', a: '</script><b>' }]));
    expect(out).not.toContain('</script>');
    expect(JSON.parse(out).mainEntity[0].acceptedAnswer.text).toBe('</script><b>');
  });
});
