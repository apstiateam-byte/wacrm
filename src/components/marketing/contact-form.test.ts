import { describe, expect, it } from 'vitest';

import { validateContact } from './contact-form';

const valid = {
  name: 'Priya Sharma',
  email: 'priya@example.com',
  phone: '',
  company: '',
  topic: 'Book a demo',
  message: 'We would like a demo for our retail team.',
};

describe('validateContact', () => {
  it('accepts a complete enquiry', () => {
    expect(validateContact(valid)).toEqual({});
    expect(validateContact({ ...valid, phone: '+91 98100 00001' })).toEqual({});
  });

  it('requires a name, a valid email and a real message', () => {
    const errors = validateContact({ ...valid, name: 'P', email: 'not-an-email', message: 'hi' });
    expect(Object.keys(errors).sort()).toEqual(['email', 'message', 'name']);
  });

  it('only checks the phone when one is given', () => {
    expect(validateContact({ ...valid, phone: 'call me' }).phone).toBeDefined();
    expect(validateContact({ ...valid, phone: '' }).phone).toBeUndefined();
  });
});
