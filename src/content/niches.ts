// ============================================================
// Niche landing pages — /coaching and /real-estate.
//
// Copy for the pages that ads, printed one-pagers and local search
// point to. Same rules as marketing.ts: plain Indian-English, no
// invented customers, testimonials or metrics. Names, projects and
// numbers in the mock-ups are sample data and must read that way.
//
// The "Chat on WhatsApp" button uses NEXT_PUBLIC_SUPPORT_PHONE; without
// it the pages fall back to NEXT_PUBLIC_BOOKING_URL, then /contact.
// ============================================================

import type { PreviewSample } from '@/components/marketing/product-preview';
import { brand } from '@/content/marketing';

/** A small product visual next to a use-case spotlight. */
export type NicheVisual =
  | {
      kind: 'chat';
      title: string;
      messages: { from: 'customer' | 'business'; text: string; buttons?: string[] }[];
    }
  | {
      kind: 'template';
      name: string;
      category: 'Utility' | 'Marketing';
      /** PDF shown as the template's document header. */
      document?: string;
      body: string;
      buttons?: string[];
      meta: { label: string; value: string }[];
    }
  | {
      kind: 'flow';
      title: string;
      steps: { tag: 'When' | 'Wait' | 'If' | 'Then'; text: string }[];
    };

export interface NicheContent {
  slug: 'coaching' | 'real-estate';
  /** Short label for nav and footer. */
  navLabel: string;
  meta: { title: string; description: string };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    points: string[];
  };
  preview: PreviewSample;
  useCases: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: { eyebrow: string; title: string; body: string; points: string[]; visual: NicheVisual }[];
  };
  setup: { title: string; subtitle: string; steps: { title: string; body: string }[] };
  pricing: { title: string; subtitle: string };
  faqs: { q: string; a: string }[];
  /** Message pre-filled in the "Chat on WhatsApp" link. */
  whatsappText: string;
  closing: { title: string; body: string };
}

/** wa.me link to the support number, or null when none is configured. */
export function whatsappHref(text: string, phone: string = brand.supportPhone): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Shared by both pages; the answer follows the live tax setting. */
export const GST_QUESTION = 'Do prices include GST?';

const setupStepOne = {
  title: 'We connect your number',
  body: 'We set up your WhatsApp Business account with Meta and connect your number. In Jaipur we can sit with you at your office and do it together.',
};

export const coaching: NicheContent = {
  slug: 'coaching',
  navLabel: 'Coaching',
  meta: {
    title: 'WhatsApp CRM for coaching institutes in Jaipur',
    description:
      'Answer admission enquiries instantly, book demo classes, send fee reminders and parent updates on WhatsApp — one shared inbox for your counsellors. Setup help in Jaipur. 14-day free trial.',
  },
  hero: {
    badge: 'For coaching institutes in Jaipur',
    title: 'Turn every admission enquiry into a demo class',
    subtitle:
      'Answer course and fee questions the moment they arrive, book demo classes, send fee reminders and keep parents informed — from one WhatsApp inbox your counsellors and front desk share.',
    points: ['14-day free trial', 'We set up your first flow', 'Official WhatsApp Business Platform'],
  },
  preview: {
    chats: [
      { name: 'Rohan Meena', text: 'Fees for the JEE 2-year batch?', time: '2m', unread: 2, active: true },
      { name: 'Sunita Agarwal', text: 'Can my son attend a demo on Saturday?', time: '9m', unread: 1 },
      { name: 'Ishaan Gupta', text: 'Is the NEET crash course offline?', time: '24m', unread: 1 },
      { name: 'Neha Choudhary', text: 'Paid the 2nd instalment today', time: '1h' },
      { name: 'Harsh Saini', text: 'Thanks, see you at the demo', time: '1d' },
    ],
    messages: [
      { from: 'customer', text: 'Hi, what are the fees for the JEE 2-year classroom batch?' },
      { from: 'business', text: 'Hi Rohan! Sharing the fee structure now. Would you like to attend a free demo class first?' },
      { from: 'customer', text: 'Yes. Which centre is closest to Mansarovar?' },
    ],
    suggestion: { kind: 'flow', label: 'Flow', text: 'Demo slots at Mansarovar centre — Sat 10 AM · Sat 4 PM' },
    contact: {
      name: 'Rohan Meena',
      subtitle: 'Class 11 · JEE enquiry',
      tags: [
        { label: 'New enquiry', tone: 'sky' },
        { label: 'Demo pending', tone: 'amber' },
      ],
      card: { label: 'Admission', title: 'JEE 2-year classroom', value: 'Counsellor: Pooja', stage: 'Demo' },
    },
  },
  useCases: {
    eyebrow: 'Built for admissions',
    title: 'From first enquiry to fee receipt, on WhatsApp',
    subtitle: 'Students and parents already message you on WhatsApp. Give that traffic a proper process instead of one busy phone at the front desk.',
    items: [
      {
        eyebrow: 'Admission enquiries',
        title: 'Every enquiry answered, even at 11 PM',
        body: 'A chatbot flow greets new enquiries, shows your courses as tap-to-pick buttons and collects class, course and preferred centre. The chat is then assigned to a counsellor with the details already filled in.',
        points: ['Course menu with buttons and lists', 'Class, course and centre saved on the contact', 'Hand-off to the right counsellor'],
        visual: {
          kind: 'chat',
          title: 'Enquiry flow',
          messages: [
            { from: 'business', text: 'Welcome! Which course are you interested in?', buttons: ['JEE', 'NEET', 'Foundation (8–10)'] },
            { from: 'customer', text: 'NEET' },
            { from: 'business', text: 'Great. Which class are you in right now?', buttons: ['Class 11', 'Class 12', 'Dropper'] },
            { from: 'customer', text: 'Class 12' },
          ],
        },
      },
      {
        eyebrow: 'Demo-class booking',
        title: 'Fill demo batches without the phone tag',
        body: 'Offer this week’s demo slots as a WhatsApp list. The choice is saved on the contact, the counsellor sees it in the inbox, and everyone booked for a slot gets a reminder the evening before.',
        points: ['Slots as a tap-to-pick list', 'Booking saved as a tag on the contact', 'Scheduled reminder to each slot'],
        visual: {
          kind: 'chat',
          title: 'Demo booking',
          messages: [
            { from: 'business', text: 'Pick a free demo class at our Mansarovar centre:', buttons: ['Sat 10:00 AM · Physics', 'Sat 4:00 PM · Chemistry', 'Sun 11:00 AM · Biology'] },
            { from: 'customer', text: 'Sat 4:00 PM · Chemistry' },
            { from: 'business', text: 'Booked! We’ll send you a reminder on Friday evening.' },
          ],
        },
      },
      {
        eyebrow: 'Fee reminders',
        title: 'Instalment reminders that go out on time',
        body: 'Import the due list from your fee register, and send a personalised, Meta-approved reminder to each student or parent on the date you choose. Replies like “paid today” land in the inbox for your accounts team.',
        points: ['Name, amount and due date filled in per contact', 'Scheduled sends', 'Replies routed to accounts'],
        visual: {
          kind: 'template',
          name: 'fee_instalment_reminder',
          category: 'Utility',
          body: 'Hi Neha, a reminder that the 2nd instalment of ₹18,000 for NEET 2-year classroom is due on 15 November. Reply here if you have already paid.',
          buttons: ['Pay instalment', 'Talk to accounts'],
          meta: [
            { label: 'Audience', value: 'Tag: Instalment 2 due' },
            { label: 'Send', value: 'Scheduled · 12 Nov, 10:00 AM' },
          ],
        },
      },
      {
        eyebrow: 'Parent updates',
        title: 'Keep parents in the loop, batch by batch',
        body: 'Send test results, holiday notices and PTM dates to the parents of one batch at a time. Parents and students are tagged separately, so each gets only what is meant for them.',
        points: ['Audiences by batch and role', 'Only to parents who opted in', 'Questions come back to one shared inbox'],
        visual: {
          kind: 'template',
          name: 'ptm_notice',
          category: 'Utility',
          body: 'Dear Parent, the parent-teacher meeting for the JEE 2-year batch is on Sunday, 24 November at 11:00 AM at our Gopalpura centre. Please confirm if you can attend.',
          buttons: ['I will attend', 'Request another time'],
          meta: [
            { label: 'Audience', value: 'Parents · JEE 2-year batch' },
            { label: 'Send', value: 'Now' },
          ],
        },
      },
    ],
  },
  setup: {
    title: 'We set it up with you',
    subtitle: 'You don’t need a technical person. We get your institute live and hand over a working setup.',
    steps: [
      setupStepOne,
      {
        title: 'We build your first flow',
        body: 'Course menu, fee enquiry and demo-class booking, written in your institute’s own words — in English, Hindi or both.',
      },
      {
        title: 'Your team goes live',
        body: 'Counsellors log in, we import your opted-in contacts and walk the team through the inbox. You can change any flow later, without code.',
      },
    ],
  },
  pricing: {
    title: 'One price for the whole institute',
    subtitle: 'Every counsellor works from the same number. Start with a 14-day free trial — no card required.',
  },
  faqs: [
    {
      q: 'Can we message every student and parent in our register?',
      a: 'Only those who have agreed to hear from you on WhatsApp. Add a WhatsApp consent line to your admission and enquiry forms, or treat people who message you first as opted in for that conversation. Messaging people who haven’t opted in gets your number reported and can get it restricted by Meta.',
    },
    {
      q: 'Can we send fee reminders and notices in Hindi?',
      a: 'Yes. Templates can be written in Hindi, English or both. Each language version is approved by Meta once, and after that you can send it as often as you need.',
    },
    {
      q: 'Can counsellors and the front desk share one number?',
      a: 'Yes. Everyone logs in to the same inbox with their own account. Chats can be assigned to a counsellor, internal notes stay inside the team, and you can see who replied to whom.',
    },
    {
      q: 'Can we keep our current WhatsApp number?',
      a: 'Usually, yes. You can connect a new number or move an existing one to the WhatsApp Business Platform. Moving a number changes how it works on the phone app, so we explain the options before anything is switched.',
    },
    {
      q: 'What does WhatsApp charge for fee reminders and broadcasts?',
      a: 'Meta charges per template message. Fee reminders and notices are usually utility messages; offers and admission campaigns are marketing messages, which cost more. Meta bills these directly to your WhatsApp Business Account — we add no markup. Replies to a student who messaged you in the last 24 hours are free.',
    },
    { q: GST_QUESTION, a: '' },
  ],
  whatsappText: 'Hi, I run a coaching institute and would like to know more about the WhatsApp CRM.',
  closing: {
    title: 'Answer every enquiry before the next institute does',
    body: 'Start a free trial today, or message us and we’ll set up your first admission flow with you.',
  },
};

export const realEstate: NicheContent = {
  slug: 'real-estate',
  navLabel: 'Real estate',
  meta: {
    title: 'WhatsApp CRM for real-estate agents in Jaipur',
    description:
      'Reply to property leads on WhatsApp within seconds, qualify budget, locality and BHK automatically, book site visits and send brochures. Built for agents and small brokerages in Jaipur. 14-day free trial.',
  },
  hero: {
    badge: 'For real-estate agents and brokerages in Jaipur',
    title: 'Reply to every property lead in seconds, not hours',
    subtitle:
      'Instant WhatsApp replies to ad and portal leads, automatic budget, locality and BHK questions, site-visit booking and brochure follow-ups — so your agents spend their time on buyers who are ready.',
    points: ['14-day free trial', 'We set up your first flow', 'Official WhatsApp Business Platform'],
  },
  preview: {
    chats: [
      { name: 'Amit Khandelwal', text: '3 BHK in Jagatpura under ₹90 L?', time: '1m', unread: 2, active: true },
      { name: 'Sunita Jain', text: 'Is Sunday’s site visit confirmed?', time: '7m', unread: 1 },
      { name: 'Rahul Sharma', text: 'Please share the floor plan', time: '18m', unread: 1 },
      { name: 'Deepak Rathore', text: 'What is the possession date?', time: '2h' },
      { name: 'Megha Agarwal', text: 'Will discuss with family and revert', time: '1d' },
    ],
    messages: [
      { from: 'customer', text: 'Hi, saw your ad. Any 3 BHK in Jagatpura under ₹90 L?' },
      { from: 'business', text: 'Hi Amit! Yes — Aravali Greens has 3 BHK options in that range. Sharing the brochure now.' },
      { from: 'customer', text: 'Can we see the flat this Sunday?' },
    ],
    suggestion: { kind: 'flow', label: 'Flow', text: 'Site-visit slots on Sunday — 11 AM · 4 PM' },
    contact: {
      name: 'Amit Khandelwal',
      subtitle: 'Lead · Click-to-WhatsApp ad',
      tags: [
        { label: 'Hot lead', tone: 'amber' },
        { label: '3 BHK', tone: 'sky' },
      ],
      card: { label: 'Deal', title: 'Aravali Greens · 3 BHK', value: '₹86 L', stage: 'Site visit' },
    },
  },
  useCases: {
    eyebrow: 'Built for property sales',
    title: 'Speed to lead, without hiring a call centre',
    subtitle: 'Buyers enquire with several brokers at once. The first useful reply usually gets the site visit.',
    items: [
      {
        eyebrow: 'Instant lead reply',
        title: 'Every new lead gets a reply within seconds',
        body: 'Leads from Click-to-WhatsApp ads land straight in your inbox. Facebook lead forms and portal leads can be pushed in through our API — we help connect them during setup — and an automation sends your approved intro template right away.',
        points: ['Works day and night, weekends included', 'New leads assigned to the agent on duty', 'Every lead in one list, not five phones'],
        visual: {
          kind: 'flow',
          title: 'New property lead',
          steps: [
            { tag: 'When', text: 'New lead from ad, form or portal' },
            { tag: 'Then', text: 'Send template: project intro + brochure' },
            { tag: 'Then', text: 'Start the qualification flow' },
            { tag: 'Then', text: 'Assign to agent on duty · tag New lead' },
          ],
        },
      },
      {
        eyebrow: 'Lead qualification',
        title: 'Budget, locality and BHK — before you call',
        body: 'A short chatbot flow asks the questions your agents ask on every first call. The answers are saved on the contact, so your team calls the serious buyers first and with the right options in hand.',
        points: ['Tap-to-answer buttons and lists', 'Answers saved as contact fields and tags', 'Filter leads by budget or locality'],
        visual: {
          kind: 'chat',
          title: 'Qualification flow',
          messages: [
            { from: 'business', text: 'What budget are you looking at?', buttons: ['Under ₹50 L', '₹50 L – 1 Cr', 'Above ₹1 Cr'] },
            { from: 'customer', text: '₹50 L – 1 Cr' },
            { from: 'business', text: 'Which area do you prefer?', buttons: ['Jagatpura', 'Vaishali Nagar', 'Mansarovar', 'Ajmer Road'] },
            { from: 'customer', text: 'Jagatpura' },
            { from: 'business', text: 'And how many bedrooms?', buttons: ['2 BHK', '3 BHK', '4 BHK+'] },
          ],
        },
      },
      {
        eyebrow: 'Site-visit booking',
        title: 'Site visits booked in the chat',
        body: 'Offer visit slots as a list. The buyer picks one, the deal moves to “Site visit” on your pipeline, and a reminder goes out the day before so fewer visits are missed.',
        points: ['Slots offered as a WhatsApp list', 'Deal stage updated on the pipeline', 'Reminder the day before the visit'],
        visual: {
          kind: 'chat',
          title: 'Site-visit booking',
          messages: [
            { from: 'business', text: 'Pick a time to visit Aravali Greens, Jagatpura:', buttons: ['Sat 11:00 AM', 'Sun 11:00 AM', 'Sun 4:00 PM'] },
            { from: 'customer', text: 'Sun 11:00 AM' },
            { from: 'business', text: 'Done! Our agent Vikas will meet you at the sales office. We’ll remind you on Saturday.' },
          ],
        },
      },
      {
        eyebrow: 'Brochures & follow-ups',
        title: 'Brochures and follow-ups that don’t slip',
        body: 'Save a template for each project with its brochure attached. If a lead goes quiet, an automation follows up after the delay you set — and stops as soon as they reply.',
        points: ['PDF brochure and floor plans in the message', 'Automatic follow-up when a lead goes quiet', 'Pipeline from enquiry to booking'],
        visual: {
          kind: 'template',
          name: 'project_brochure',
          category: 'Marketing',
          document: 'Aravali-Greens-brochure.pdf',
          body: 'Hi Amit, here is the brochure and price list for 3 BHK apartments at Aravali Greens, Jagatpura. Would you like to see the site this weekend?',
          buttons: ['Book a site visit', 'Call me'],
          meta: [
            { label: 'Follow-up', value: 'If no reply in 2 days' },
            { label: 'Stops', value: 'As soon as the lead replies' },
          ],
        },
      },
    ],
  },
  setup: {
    title: 'We set it up with you',
    subtitle: 'No technical team needed. We get your number, your projects and your lead sources working during your free trial.',
    steps: [
      setupStepOne,
      {
        title: 'We build your first flow',
        body: 'Lead reply, budget, locality and BHK questions and site-visit booking for your current projects, with your brochures attached.',
      },
      {
        title: 'Your team goes live',
        body: 'Agents log in, we connect your ad and lead sources where they allow it, and walk the team through the inbox and pipeline.',
      },
    ],
  },
  pricing: {
    title: 'Priced for agents and small brokerages',
    subtitle: 'Your whole team on one number. Start with a 14-day free trial — no card required.',
  },
  faqs: [
    {
      q: 'Can I upload a purchased database and bulk-message it?',
      a: 'No. Purchased, scraped or shared lists are not opt-in, and WhatsApp does not allow messaging them. Numbers that message people who never asked to hear from you get reported, lose quality rating and can be restricted or banned by Meta. Message only people who enquired with you or agreed to hear from you — ad and portal enquiries, walk-ins and past clients who said yes.',
    },
    {
      q: 'Do leads from Facebook and property portals come in automatically?',
      a: 'Click-to-WhatsApp ads land directly in your inbox. Facebook lead forms and portal leads can be sent in through our API and webhooks where the source supports it — we help set this up during onboarding. Because these leads haven’t messaged you yet, the first message is an approved template.',
    },
    {
      q: 'Can my agents share one number?',
      a: 'Yes. Each agent logs in with their own account to the same inbox. Leads can be assigned to an agent, internal notes stay inside the team, and the owner sees every conversation.',
    },
    {
      q: 'Can I send brochures, floor plans and photos?',
      a: 'Yes. Attach PDF brochures and floor plans or images to templates for new leads, and send any file inside an active conversation.',
    },
    {
      q: 'Does it track deals as well as chats?',
      a: 'Yes. The sales pipeline shows each buyer as a deal with its value and stage — for example enquiry, site visit, negotiation and booked — linked to the WhatsApp conversation.',
    },
    { q: GST_QUESTION, a: '' },
  ],
  whatsappText: 'Hi, I am a real-estate agent and would like to know more about the WhatsApp CRM.',
  closing: {
    title: 'Be the first broker to reply',
    body: 'Start a free trial today, or message us and we’ll set up your lead reply and site-visit flow with you.',
  },
};

export const niches = [coaching, realEstate] as const;
