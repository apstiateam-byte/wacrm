// ============================================================
// Legal page text — a STARTING TEMPLATE, not legal advice.
//
// Have a lawyer review these before going live: they must match how
// your business actually operates (refund terms, data locations,
// grievance officer, governing law). Razorpay and Meta both check that
// these pages exist and are reachable from your site footer.
// ============================================================

import { brand } from './marketing';
import type { LegalSection } from '@/components/marketing/legal-page';

export const LEGAL_UPDATED = '14 October 2026';

const contactLine = () =>
  [
    `Email: ${brand.supportEmail}`,
    brand.supportPhone ? `Phone: ${brand.supportPhone}` : null,
    brand.address ? `Address: ${brand.address}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

export function termsSections(): LegalSection[] {
  const n = brand.name;
  const e = brand.legalEntity;
  return [
    {
      heading: 'Agreement',
      paragraphs: [
        `These Terms of Service govern your use of ${n}, a software-as-a-service product operated by ${e} ("we", "us"). By creating an account or using the service you agree to these terms on behalf of yourself and the business you represent.`,
      ],
    },
    {
      heading: 'The service',
      paragraphs: [
        `${n} lets businesses manage customer conversations on the WhatsApp Business Platform: a shared inbox, broadcasts, chatbots, automations, AI-assisted replies, contacts and a sales pipeline.`,
        'The WhatsApp Business Platform is provided by Meta Platforms, Inc. Your use of WhatsApp is also subject to the WhatsApp Business Terms of Service, the WhatsApp Business Messaging Policy and the WhatsApp Commerce Policy. We are not responsible for decisions Meta makes about your account, phone number, templates or messaging limits.',
      ],
    },
    {
      heading: 'Accounts and trials',
      paragraphs: [
        'You must provide accurate information and keep your login credentials secure. You are responsible for all activity in your workspace, including by team members you invite.',
        'New workspaces include a free trial. When the trial ends the workspace becomes read-only until a paid plan is chosen. We may change or end trial offers at any time.',
      ],
    },
    {
      heading: 'Plans, payment and taxes',
      paragraphs: [
        'Paid plans are billed in advance, monthly or annually, through our payment partner. Monthly plans renew automatically until cancelled; annual plans are paid once for twelve months. Prices exclude applicable taxes (including GST), which are added at checkout.',
        'Charges for WhatsApp messages are set and billed by Meta directly to the payment method on your WhatsApp Business Account and are not part of our fees.',
        'If a renewal payment fails, we may make the workspace read-only after a grace period. We may change prices with at least 30 days\' notice; changes apply from your next billing period.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'You must only message people who have opted in to receive messages from your business, honour opt-out requests promptly, and comply with applicable law, including the Information Technology Act, 2000, the Digital Personal Data Protection Act, 2023 and TRAI regulations.',
        'You must not use the service to send spam, unlawful, fraudulent, harassing or infringing content, to attempt to breach its security, or to overload it. We may suspend workspaces that break these rules or that put the platform or our WhatsApp access at risk.',
      ],
    },
    {
      heading: 'Your data',
      paragraphs: [
        'You own the data you put into the service. You grant us the rights needed to host, process and display it to provide the service. Our handling of personal data is described in our Privacy Policy.',
        'You can export your data while your account is active. After cancellation we may delete workspace data following a reasonable retention period.',
      ],
    },
    {
      heading: 'Availability and changes',
      paragraphs: [
        'We work to keep the service available but do not guarantee uninterrupted operation. Features may change over time; we will not materially reduce the core functionality of a paid plan during a paid period.',
      ],
    },
    {
      heading: 'Liability',
      paragraphs: [
        'The service is provided "as is". To the extent permitted by law, we are not liable for indirect or consequential losses, and our total liability for any claim is limited to the fees you paid us in the three months before the claim arose.',
      ],
    },
    {
      heading: 'Termination',
      paragraphs: [
        'You may cancel at any time from Settings → Billing & plan. We may suspend or terminate accounts that breach these terms. Sections that by their nature should survive termination will survive.',
      ],
    },
    {
      heading: 'Governing law and contact',
      paragraphs: [
        'These terms are governed by the laws of India, and the courts at the place of our registered office have exclusive jurisdiction.',
        `Questions about these terms: ${contactLine()}`,
      ],
    },
  ];
}

export function privacySections(): LegalSection[] {
  const n = brand.name;
  const e = brand.legalEntity;
  return [
    {
      heading: 'Who we are',
      paragraphs: [
        `${e} operates ${n}. This policy explains what personal data we collect, why, and the choices you have.`,
        `For data inside your workspace (your customers' names, numbers and messages) your business is the data fiduciary/controller and we process it on your behalf to provide the service.`,
      ],
    },
    {
      heading: 'Data we collect',
      paragraphs: [
        'Account data: name, email, password (stored hashed by our authentication provider), workspace name and team membership.',
        'Billing data: billing name, email, address and GSTIN. Card, UPI and bank details are collected and processed by our payment partner (Razorpay) and never stored by us.',
        'Workspace data: contacts, conversations, messages, media, templates, deals and settings you or your customers create through the service, including data received from the WhatsApp Business Platform.',
        'Technical data: logs, IP address, browser information and usage events needed to secure and operate the service.',
      ],
    },
    {
      heading: 'How we use data',
      paragraphs: [
        'To provide and secure the service, process payments and issue invoices, provide support, send service notices (such as trial and billing reminders), and comply with legal obligations. We do not sell personal data.',
      ],
    },
    {
      heading: 'Service providers',
      paragraphs: [
        'We share data only with providers that help us run the service: cloud hosting and database (e.g. Supabase, Vercel), Meta (to send and receive WhatsApp messages), Razorpay (payments), email delivery, and — only if you enable AI features with your own key — the AI provider you choose.',
      ],
    },
    {
      heading: 'Security and retention',
      paragraphs: [
        'Workspaces are isolated at the database level, access tokens are encrypted at rest, and access is role-based. We keep data while your account is active and for a limited period afterwards, unless the law requires longer retention (for example, invoices).',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'You can access, correct and export your account data from the app, and request deletion of your account. Under the Digital Personal Data Protection Act, 2023 you may also request information about processing, correction, erasure, and nominate another person to exercise your rights.',
        `Contact our grievance officer: ${contactLine()}. We respond within the timelines required by law.`,
      ],
    },
    {
      heading: 'Changes',
      paragraphs: ['We will post updates to this policy here and notify account owners of material changes.'],
    },
  ];
}

export function refundSections(): LegalSection[] {
  const n = brand.name;
  return [
    {
      heading: 'Free trial',
      paragraphs: [
        `Every new workspace starts with a free trial of ${n} so you can evaluate the service before paying. No payment details are needed for the trial.`,
      ],
    },
    {
      heading: 'Cancellation',
      paragraphs: [
        'You can cancel a monthly subscription at any time from Settings → Billing & plan. Cancellation stops future renewals; you keep full access until the end of the period you have already paid for.',
        'Annual plans are a single payment for twelve months and do not renew automatically.',
      ],
    },
    {
      heading: 'Refunds',
      paragraphs: [
        'Because the service can be evaluated free of charge during the trial, payments are generally non-refundable, including for partially used billing periods.',
        'If you were charged in error (for example a duplicate payment) or the service was unavailable for an extended period due to our fault, contact us within 7 days of the charge. Approved refunds are issued to the original payment method within 5–7 working days.',
        'Charges for WhatsApp messages are billed by Meta and are governed by Meta\'s policies, not this one.',
      ],
    },
    {
      heading: 'Delivery of service',
      paragraphs: [
        'This is a digital service. Access to the plan you purchase is activated immediately after successful payment; nothing is shipped physically.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`For billing questions or refund requests: ${contactLine()}`],
    },
  ];
}
