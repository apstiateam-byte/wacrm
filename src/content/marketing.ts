// ============================================================
// Marketing-site copy and business details.
//
// This is YOUR brand copy — edit freely. Business/legal details come
// from environment variables so the same build can be white-labelled:
//
//   NEXT_PUBLIC_APP_NAME        product name            (default "wacrm")
//   NEXT_PUBLIC_LEGAL_ENTITY    registered business name
//   NEXT_PUBLIC_SUPPORT_EMAIL   support / grievance email
//   NEXT_PUBLIC_SUPPORT_PHONE   support phone (optional)
//   NEXT_PUBLIC_BUSINESS_ADDRESS registered address
//   NEXT_PUBLIC_BOOKING_URL     "Book a demo" link (Cal.com, Calendly…)
//   NEXT_PUBLIC_SALES_URL       Enterprise "Contact sales" link
//   NEXT_PUBLIC_MARKETING_SITE  "false" sends "/" straight to the app
//                               (self-hosted / internal installs)
// ============================================================

import { APP_NAME } from '@/lib/brand';

export const brand = {
  name: APP_NAME,
  legalEntity: process.env.NEXT_PUBLIC_LEGAL_ENTITY || APP_NAME,
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '',
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || '',
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL || '',
  salesUrl: process.env.NEXT_PUBLIC_SALES_URL || '',
};

export function marketingSiteEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MARKETING_SITE !== 'false';
}

export const hero = {
  eyebrow: 'Official WhatsApp Business API',
  title: 'Sell, support and grow on WhatsApp — from one shared inbox',
  subtitle:
    'Broadcast campaigns, chatbot flows, AI replies and a sales pipeline for your whole team. Start in minutes, no code required.',
  primaryCta: 'Start free trial',
  secondaryCta: 'Try the live demo',
  note: '14-day free trial · No card required · Cancel anytime',
};

/** Thin bar above the header. Set `href` to null to show text only. */
export const announcement = {
  text: 'New: AI auto-replies that answer from your own knowledge base',
  cta: 'See how',
  href: '/#product',
};

/** "Works with" strip — real integrations only, shown as text. */
export const integrations = [
  'WhatsApp Cloud API',
  'Meta templates',
  'OpenAI',
  'Anthropic',
  'OpenAI-compatible models',
  'REST API',
  'Webhooks',
  'MCP',
];

/** Interactive product tour on the landing page (pill tabs). */
export const productTour = [
  {
    id: 'inbox',
    label: 'Shared inbox',
    title: 'Every customer chat, one calm inbox',
    body: 'Assign conversations, leave internal notes, reply with templates and quick replies, and see the full customer profile beside every chat.',
    points: ['Assignment & status', 'Quick replies & templates', 'Contact profile and deals in view'],
  },
  {
    id: 'broadcasts',
    label: 'Broadcasts',
    title: 'Campaigns people actually open',
    body: 'Send approved templates to opted-in audiences with per-contact personalisation, then follow delivery, read and reply rates live.',
    points: ['Audience by tag or CSV', 'Personalised variables', 'Delivered / read / replied tracking'],
  },
  {
    id: 'flows',
    label: 'Chatbot flows',
    title: 'Answer and qualify 24×7',
    body: 'Build button and list menus on a visual canvas. Route customers, collect details and hand off to a person when it matters.',
    points: ['Drag-and-drop canvas', 'Buttons, lists and branches', 'Human hand-off'],
  },
  {
    id: 'ai',
    label: 'AI replies',
    title: 'AI that knows your business',
    body: 'Draft replies in one click or let AI answer routine questions from your own knowledge base — with your own AI provider key.',
    points: ['Knowledge base answers', 'Draft-to-reply in the inbox', 'Bring your own key'],
  },
  {
    id: 'pipeline',
    label: 'Sales pipeline',
    title: 'Turn chats into revenue',
    body: 'Create deals from conversations and move them across stages on a board. Know exactly what is closing this month.',
    points: ['Drag-and-drop board', 'Deal value by stage', 'Linked to the conversation'],
  },
] as const;

export const stats = [
  { value: '14 days', label: 'free trial, no card' },
  { value: '1 inbox', label: 'for your whole team' },
  { value: '24×7', label: 'replies with chatbots + AI' },
  { value: '0%', label: 'markup on Meta message fees' },
];

export const features = [
  {
    icon: 'inbox',
    title: 'Shared team inbox',
    body: 'Every customer chat in one place. Assign conversations, add notes, reply with quick replies and templates, and never miss a message.',
  },
  {
    icon: 'broadcast',
    title: 'Broadcast campaigns',
    body: 'Send approved templates to thousands of opted-in customers with personalisation, scheduling and delivery, read and reply tracking.',
  },
  {
    icon: 'flows',
    title: 'No-code chatbot flows',
    body: 'Drag-and-drop menus with buttons and lists to qualify leads, answer FAQs and route customers — around the clock.',
  },
  {
    icon: 'ai',
    title: 'AI replies & agents',
    body: 'Draft replies or let AI answer from your own knowledge base, using your own OpenAI, Anthropic or compatible key.',
  },
  {
    icon: 'automations',
    title: 'Automations',
    body: 'Trigger follow-ups on keywords, new contacts or tags. Wait for replies, branch, tag and assign automatically.',
  },
  {
    icon: 'pipeline',
    title: 'Sales pipeline',
    body: 'Turn chats into deals. Track value and stage on a drag-and-drop board and see what is closing this month.',
  },
  {
    icon: 'contacts',
    title: 'Contacts & segments',
    body: 'Import from CSV, tag, add custom fields and build audiences for campaigns in seconds.',
  },
  {
    icon: 'api',
    title: 'API & webhooks',
    body: 'Connect your store, CRM or ERP with a REST API, outbound webhooks and an MCP server for AI tools.',
  },
] as const;

export const steps = [
  { title: 'Sign up free', body: 'Create your workspace in seconds. Your 14-day trial includes Growth features.' },
  { title: 'Connect WhatsApp', body: 'Link your WhatsApp Business number through Meta — we guide you step by step.' },
  { title: 'Start selling', body: 'Import contacts, invite your team, launch a broadcast and switch on your chatbot.' },
];

// About section on the landing page. Placeholder copy — rewrite it to
// describe YOUR company, team and the customers you actually serve.
export const about = {
  eyebrow: 'About us',
  title: 'Built for businesses that sell on WhatsApp',
  paragraphs: [
    'Your customers already live on WhatsApp. But most teams still juggle one shared phone, scattered chats and spreadsheets to keep track of who said what. We built this platform so every business can run WhatsApp like a proper sales and support channel.',
    'We are a team that works closely with growing businesses in retail, education, real estate and services. Everything we build is on the official WhatsApp Business Platform from Meta — no grey-market tools, no risk to your number.',
  ],
  values: [
    { title: 'Official & compliant', body: 'Built on the WhatsApp Cloud API with opt-in messaging and Meta-approved templates.' },
    { title: 'Simple by design', body: 'Set up in minutes, no code. Your team learns it in an afternoon.' },
    { title: 'Your data, your control', body: 'Every workspace is isolated. Export anytime, and nothing is ever sold.' },
    { title: 'Support that answers', body: 'Real people help you connect your number and launch your first campaign.' },
  ],
};

export const contactSection = {
  eyebrow: 'Contact',
  title: 'Talk to us',
  subtitle: 'Questions about plans, onboarding or a custom setup? Send a message and we will get back to you within one business day.',
};

export const faqs = [
  {
    q: 'Do I need the WhatsApp Business API?',
    a: 'Yes. We use the official WhatsApp Cloud API from Meta, which is required for broadcasts, chatbots and multi-agent inboxes. We help you connect a new or existing number.',
  },
  {
    q: 'How are WhatsApp message charges billed?',
    a: 'Meta charges per delivered template message (marketing, utility, authentication). Those charges are billed by Meta directly to the payment method on your WhatsApp Business Account — we add no markup. Replies within the 24-hour customer service window are free.',
  },
  {
    q: 'What happens when my trial ends?',
    a: 'Your workspace becomes read-only until you choose a plan. Nothing is deleted, and incoming customer messages keep arriving in your inbox.',
  },
  {
    q: 'Can I change or cancel my plan?',
    a: 'Yes, any time from Settings → Billing & plan. Upgrades apply immediately; cancelling stops renewal and you keep access until the end of the paid period.',
  },
  {
    q: 'Do prices include GST?',
    a: 'Prices are shown excluding GST. 18% GST is added at checkout, and GST invoices are issued for every payment. Add your GSTIN to claim input tax credit.',
  },
  {
    q: 'Is my data secure?',
    a: 'Each workspace is isolated at the database level, access tokens are encrypted at rest, and you control who on your team can see and change what.',
  },
];
