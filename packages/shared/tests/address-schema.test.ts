import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addressSchema, checkoutShippingSchema } from '../src/schemas';

describe('US Address & Shipping Schemas', () => {
  it('successfully validates complete, compliant US addresses', () => {
    const validAddresses = [
      {
        fullName: 'Alex Morgan',
        line1: '742 Evergreen Terrace',
        line2: 'Apt 4B',
        city: 'Springfield',
        state: 'OR',
        zipCode: '97477',
        country: 'US',
      },
      {
        fullName: 'Jordan Lee',
        line1: '350 5th Avenue',
        city: 'New York',
        state: 'NY',
        zipCode: '10118',
        country: 'US',
      },
      {
        fullName: 'Sam Taylor',
        line1: '100 Universal City Plaza',
        line2: 'Suite 200',
        city: 'Universal City',
        state: 'CA',
        zipCode: '91608-1002',
        country: 'US',
      },
    ];

    for (const addr of validAddresses) {
      const result = addressSchema.safeParse(addr);
      assert.ok(result.success, `Expected address to be valid: ${JSON.stringify(result)}`);
    }
  });

  it('rejects invalid ZIP codes', () => {
    const invalidZipCodes = [
      '123', // Too short
      '1234', // 4 digits
      '123456', // 6 digits
      'ABCDE', // Non-numeric
      '97477-12', // Malformed +4
      '97477-12345', // 5 digits in +4
    ];

    for (const zip of invalidZipCodes) {
      const result = addressSchema.safeParse({
        fullName: 'Alex Morgan',
        line1: '742 Evergreen Terrace',
        city: 'Springfield',
        state: 'OR',
        zipCode: zip,
        country: 'US',
      });

      assert.equal(result.success, false, `Expected ZIP "${zip}" to be rejected`);
    }
  });

  it('rejects invalid state codes that are not 2 uppercase characters', () => {
    const invalidStates = ['California', 'O', 'ORE', '12', ''];

    for (const state of invalidStates) {
      const result = addressSchema.safeParse({
        fullName: 'Alex Morgan',
        line1: '742 Evergreen Terrace',
        city: 'Springfield',
        state,
        zipCode: '97477',
        country: 'US',
      });

      assert.equal(result.success, false, `Expected state "${state}" to be rejected`);
    }
  });

  it('validates checkout shipping schema including customer email', () => {
    const valid = checkoutShippingSchema.safeParse({
      email: 'customer@example.com',
      fullName: 'Alex Morgan',
      line1: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'OR',
      zipCode: '97477',
      country: 'US',
    });

    assert.ok(valid.success);

    const invalidEmail = checkoutShippingSchema.safeParse({
      email: 'not-an-email',
      fullName: 'Alex Morgan',
      line1: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'OR',
      zipCode: '97477',
      country: 'US',
    });

    assert.equal(invalidEmail.success, false);
  });
});
