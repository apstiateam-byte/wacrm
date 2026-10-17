import { brand } from "@/content/marketing";
import type { Plan } from "@/lib/billing/types";
import { jsonLd, SITE_URL } from "@/lib/marketing/seo";

// Structured data (schema.org JSON-LD) for the marketing site. Describes
// only what is true on the page: no ratings or reviews until real ones
// exist.

function JsonLdScript({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}

const ORG_ID = `${SITE_URL}/#organization`;

export function organizationLd() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: brand.name,
    legalName: brand.legalEntity.trim(),
    url: SITE_URL,
    logo: `${SITE_URL}/apple-icon`,
    email: brand.supportEmail,
    ...(brand.supportPhone ? { telephone: brand.supportPhone } : {}),
    ...(brand.address ? { address: { "@type": "PostalAddress", streetAddress: brand.address, addressCountry: "IN" } } : {}),
    areaServed: "IN",
  };
}

export function softwareLd(plans: Plan[], description: string) {
  const offers = plans
    .filter((p) => !p.contact_sales && p.price_inr_monthly != null)
    .map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: p.price_inr_monthly,
      priceCurrency: "INR",
      url: `${SITE_URL}/pricing`,
      category: "subscription",
    }));
  return {
    "@type": "SoftwareApplication",
    name: brand.name,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "CRM",
    operatingSystem: "Web",
    url: SITE_URL,
    description,
    publisher: { "@id": ORG_ID },
    ...(offers.length ? { offers } : {}),
  };
}

export function faqLd(items: readonly { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path === "/" ? "" : it.path}`,
    })),
  };
}

export function JsonLd({ graph }: { graph: object[] }) {
  return <JsonLdScript data={{ "@context": "https://schema.org", "@graph": graph }} />;
}

/** Home page: organisation, product with live INR offers, and the FAQ. */
export function HomeJsonLd({ plans, faqs, description }: { plans: Plan[]; faqs: readonly { q: string; a: string }[]; description: string }) {
  return (
    <JsonLd
      graph={[
        organizationLd(),
        { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: brand.name, publisher: { "@id": ORG_ID } },
        softwareLd(plans, description),
        faqLd(faqs),
      ]}
    />
  );
}
