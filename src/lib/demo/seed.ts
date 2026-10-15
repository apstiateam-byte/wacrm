// ============================================================
// Sample data for the shared live-demo workspace.
//
// `seedDemoAccount` wipes the account's operational data and inserts a
// small, believable business: contacts with tags, inbox conversations
// with message history, and a sales pipeline with deals. Runs with the
// service role (no plan triggers, no RLS). Re-running it is the nightly
// reset.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface DemoContact {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  tags: string[];
}

const TAGS: { name: string; color: string }[] = [
  { name: 'VIP', color: '#f59e0b' },
  { name: 'New lead', color: '#3b82f6' },
  { name: 'Repeat buyer', color: '#10b981' },
  { name: 'Wholesale', color: '#8b5cf6' },
  { name: 'Support', color: '#ef4444' },
];

const CONTACTS: DemoContact[] = [
  { name: 'Priya Sharma', phone: '919810000001', email: 'priya@example.com', company: 'Sharma Boutique', tags: ['VIP', 'Repeat buyer'] },
  { name: 'Rahul Mehta', phone: '919810000002', email: 'rahul@example.com', tags: ['New lead'] },
  { name: 'Ananya Iyer', phone: '919810000003', company: 'Iyer Home Decor', tags: ['Wholesale'] },
  { name: 'Vikram Singh', phone: '919810000004', tags: ['Support'] },
  { name: 'Sneha Kapoor', phone: '919810000005', email: 'sneha@example.com', tags: ['Repeat buyer'] },
  { name: 'Arjun Nair', phone: '919810000006', company: 'Nair Traders', tags: ['Wholesale', 'VIP'] },
  { name: 'Kavya Reddy', phone: '919810000007', tags: ['New lead'] },
  { name: 'Rohan Gupta', phone: '919810000008', email: 'rohan@example.com', tags: [] },
  { name: 'Meera Joshi', phone: '919810000009', tags: ['Repeat buyer'] },
  { name: 'Aditya Verma', phone: '919810000010', company: 'Verma Electronics', tags: ['New lead', 'Wholesale'] },
  { name: 'Isha Patel', phone: '919810000011', tags: ['Support'] },
  { name: 'Karan Malhotra', phone: '919810000012', email: 'karan@example.com', tags: ['VIP'] },
];

type Msg = [sender: 'customer' | 'agent' | 'bot', text: string, minutesAgo: number];

/** Conversation scripts, keyed by contact index. */
const THREADS: { contact: number; status: 'open' | 'pending' | 'closed'; unread: number; messages: Msg[] }[] = [
  {
    contact: 0,
    status: 'open',
    unread: 2,
    messages: [
      ['customer', 'Hi! Is the blue silk saree from your Diwali collection back in stock?', 95],
      ['agent', 'Hello Priya 👋 Yes, it arrived this morning. Shall I reserve one for you?', 90],
      ['customer', 'Yes please! Can you also send a photo of the border?', 12],
      ['customer', 'And do you deliver to Pune by Friday?', 11],
    ],
  },
  {
    contact: 1,
    status: 'open',
    unread: 1,
    messages: [
      ['customer', 'Saw your ad on Instagram. What are your bulk prices?', 60 * 5],
      ['bot', 'Thanks for reaching out! Reply 1 for retail, 2 for wholesale pricing.', 60 * 5 - 1],
      ['customer', '2', 60 * 4],
    ],
  },
  {
    contact: 2,
    status: 'pending',
    unread: 0,
    messages: [
      ['customer', 'We need 200 cushion covers for a hotel project.', DAY / MINUTE + 120],
      ['agent', 'Great — I have shared the catalogue. Our wholesale team will send a quote today.', DAY / MINUTE + 60],
      ['customer', 'Perfect, waiting for it.', DAY / MINUTE],
    ],
  },
  {
    contact: 3,
    status: 'open',
    unread: 1,
    messages: [
      ['customer', 'My order #4821 still shows "processing". Any update?', 30],
    ],
  },
  {
    contact: 4,
    status: 'closed',
    unread: 0,
    messages: [
      ['customer', 'Received the order, loved the packaging!', (2 * DAY) / MINUTE],
      ['agent', 'So glad to hear that, Sneha! Here is 10% off your next order: THANKYOU10', (2 * DAY) / MINUTE - 5],
      ['customer', 'Thank you 😊', (2 * DAY) / MINUTE - 10],
    ],
  },
  {
    contact: 5,
    status: 'open',
    unread: 0,
    messages: [
      ['agent', 'Hi Arjun, your quarterly stock order is ready for dispatch.', 60 * 26],
      ['customer', 'Great, please send the invoice to accounts.', 60 * 25],
    ],
  },
  {
    contact: 9,
    status: 'open',
    unread: 3,
    messages: [
      ['customer', 'Do you have GST invoices for B2B orders?', 8],
      ['customer', 'We are looking at 50 units per month.', 7],
      ['customer', 'Can someone call me?', 6],
    ],
  },
];

const STAGES = [
  { name: 'New enquiry', color: '#3b82f6' },
  { name: 'Quote sent', color: '#8b5cf6' },
  { name: 'Negotiation', color: '#f59e0b' },
  { name: 'Won', color: '#10b981' },
];

const DEALS: { contact: number; title: string; value: number; stage: number; status: 'open' | 'won' }[] = [
  { contact: 2, title: 'Hotel cushion covers — 200 pcs', value: 84000, stage: 1, status: 'open' },
  { contact: 5, title: 'Quarterly stock order', value: 152000, stage: 3, status: 'won' },
  { contact: 9, title: 'B2B monthly supply', value: 60000, stage: 0, status: 'open' },
  { contact: 1, title: 'Wholesale starter pack', value: 25000, stage: 0, status: 'open' },
  { contact: 0, title: 'Wedding trousseau', value: 48500, stage: 2, status: 'open' },
];

async function must<T>(label: string, op: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await op;
  if (error) throw new Error(`[demo seed] ${label}: ${error.message}`);
  return data;
}

/** Remove the account's operational data (children cascade). */
async function wipe(db: SupabaseClient, accountId: string): Promise<void> {
  for (const table of ['deals', 'pipelines', 'broadcasts', 'conversations', 'contacts', 'tags']) {
    await must(`wipe ${table}`, db.from(table).delete().eq('account_id', accountId));
  }
}

export async function seedDemoAccount(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  await wipe(db, accountId);
  const ago = (minutes: number) => new Date(now.getTime() - minutes * MINUTE).toISOString();
  const owned = { account_id: accountId, user_id: userId };

  const tags = await must(
    'tags',
    db.from('tags').insert(TAGS.map((t) => ({ ...owned, ...t }))).select('id, name'),
  );
  const tagId = new Map((tags as { id: string; name: string }[]).map((t) => [t.name, t.id]));

  const contacts = (await must(
    'contacts',
    db
      .from('contacts')
      .insert(
        CONTACTS.map((c, i) => ({
          ...owned,
          name: c.name,
          phone: c.phone,
          email: c.email ?? null,
          company: c.company ?? null,
          created_at: ago((CONTACTS.length - i) * 60 * 24),
        })),
      )
      .select('id, phone'),
  )) as { id: string; phone: string }[];
  const contactIdByIndex = CONTACTS.map((c) => contacts.find((row) => row.phone === c.phone)!.id);

  const contactTags = CONTACTS.flatMap((c, i) =>
    c.tags.map((name) => ({ contact_id: contactIdByIndex[i], tag_id: tagId.get(name)! })),
  );
  if (contactTags.length) await must('contact_tags', db.from('contact_tags').insert(contactTags));

  for (const thread of THREADS) {
    const last = thread.messages[thread.messages.length - 1];
    const conv = (await must(
      'conversation',
      db
        .from('conversations')
        .insert({
          ...owned,
          contact_id: contactIdByIndex[thread.contact],
          status: thread.status,
          unread_count: thread.unread,
          last_message_text: last[1],
          last_message_at: ago(last[2]),
          created_at: ago(thread.messages[0][2]),
        })
        .select('id')
        .single(),
    )) as { id: string };

    await must(
      'messages',
      db.from('messages').insert(
        thread.messages.map(([sender, text, minutesAgo], i) => ({
          conversation_id: conv.id,
          sender_type: sender,
          sender_id: sender === 'agent' ? userId : null,
          content_type: 'text',
          content_text: text,
          message_id: `demo.${conv.id}.${i}`,
          status: sender === 'customer' ? 'delivered' : 'read',
          created_at: ago(minutesAgo),
        })),
      ),
    );
  }

  const pipeline = (await must(
    'pipeline',
    db.from('pipelines').insert({ ...owned, name: 'Sales' }).select('id').single(),
  )) as { id: string };
  const stages = (await must(
    'stages',
    db
      .from('pipeline_stages')
      .insert(STAGES.map((s, position) => ({ pipeline_id: pipeline.id, name: s.name, color: s.color, position })))
      .select('id, position'),
  )) as { id: string; position: number }[];
  const stageId = (position: number) => stages.find((s) => s.position === position)!.id;

  await must(
    'deals',
    db.from('deals').insert(
      DEALS.map((d) => ({
        ...owned,
        pipeline_id: pipeline.id,
        stage_id: stageId(d.stage),
        contact_id: contactIdByIndex[d.contact],
        title: d.title,
        value: d.value,
        currency: 'INR',
        status: d.status,
      })),
    ),
  );
}
