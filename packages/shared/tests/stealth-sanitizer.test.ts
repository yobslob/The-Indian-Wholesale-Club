import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizeTrackingEvent } from '../src/utils/stealth-sanitizer';

describe('Stealth Logistics Origin Sanitizer', () => {
  const FORBIDDEN_WORDS = [
    'india',
    'delhi',
    'mumbai',
    'bengaluru',
    'bangalore',
    'chennai',
    'tirupur',
    'kolkata',
    'igi airport',
    'cross-border',
    'international linehaul',
  ];

  it('masks Indian cities in location to "Carrier Regional Hub"', () => {
    const locations = [
      'Delhi Hub',
      'New Delhi Sort Facility',
      'Mumbai Port Area',
      'Bengaluru International Facility',
      'Tirupur Logistics Terminal',
      'Kolkata Air Cargo Complex',
      'IGI Airport DEL',
    ];

    for (const loc of locations) {
      const result = sanitizeTrackingEvent({
        rawStatus: 'In Transit',
        rawLocation: loc,
        rawDescription: 'Package received at sorting station',
      });

      assert.equal(
        result.sanitizedLocation,
        'Carrier Regional Hub',
        `Expected "${loc}" to be sanitized to "Carrier Regional Hub"`,
      );
      assert.equal(result.customerFacingLocation, 'Carrier Regional Hub');
    }
  });

  it('replaces customs and international jargon in descriptions with domestic terminology', () => {
    const testCases = [
      {
        input: 'Customs clearance processed',
        expectedPart: 'Package processing at regional hub',
      },
      {
        input: 'Export scan finalized by carrier',
        expectedPart: 'Carrier processing',
      },
      {
        input: 'International shipment departure',
        expectedPart: 'Shipment in transit to distribution center',
      },
      {
        input: 'Import clearance at port of entry',
        expectedPart: 'Arrived at regional distribution facility',
      },
      {
        input: 'Handover to linehaul transshipment hub',
        expectedPart: 'Transferring between regional facilities',
      },
    ];

    for (const { input, expectedPart } of testCases) {
      const result = sanitizeTrackingEvent({
        rawStatus: 'Processing',
        rawDescription: input,
      });

      assert.ok(
        result.sanitizedDescription.toLowerCase().includes(expectedPart.toLowerCase()),
        `Expected description to include "${expectedPart}", got "${result.sanitizedDescription}"`,
      );
    }
  });

  it('accurately maps raw statuses to customer-facing milestones', () => {
    const milestoneMap = [
      { raw: 'Order placed by customer', expected: 'Order Confirmed' },
      { raw: 'Processing and quality inspection', expected: 'Processing & Quality Inspection' },
      { raw: 'Carrier transit movement', expected: 'In Transit' },
      { raw: 'Out for delivery with courier', expected: 'Out for Delivery' },
      { raw: 'Package delivered at front door', expected: 'Delivered' },
      { raw: 'Weather exception hold', expected: 'Exception / Hub Delay' },
    ];

    for (const { raw, expected } of milestoneMap) {
      const result = sanitizeTrackingEvent({ rawStatus: raw });
      assert.equal(result.customerFacingStatus, expected);
      assert.equal(result.customerFacingMilestone, expected);
    }
  });

  it('strictly verifies zero leakage of forbidden foreign geographic words', () => {
    const dirtyInputs = [
      {
        status: 'Departed from IGI Airport New Delhi India',
        loc: 'Delhi, India',
        desc: 'Customs clearance export completed at air cargo complex Delhi',
      },
      {
        status: 'Mumbai cross-border overseas transit',
        loc: 'BOM / Mumbai Hub',
        desc: 'Flight departed from Mumbai to overseas bonded center',
      },
      {
        status: 'Tirupur manufacturing origin scan',
        loc: 'Tirupur, Tamil Nadu',
        desc: 'Carrier picked up at origin in Tirupur Tamil Nadu',
      },
    ];

    for (const input of dirtyInputs) {
      const result = sanitizeTrackingEvent({
        rawStatus: input.status,
        rawLocation: input.loc,
        rawDescription: input.desc,
      });

      assert.equal(result.isOriginConcealed, true);

      const locLower = result.sanitizedLocation.toLowerCase();
      const descLower = result.sanitizedDescription.toLowerCase();

      for (const word of FORBIDDEN_WORDS) {
        assert.ok(
          !locLower.includes(word),
          `Leaked word "${word}" in sanitizedLocation: "${result.sanitizedLocation}"`,
        );
        assert.ok(
          !descLower.includes(word),
          `Leaked word "${word}" in sanitizedDescription: "${result.sanitizedDescription}"`,
        );
      }
    }
  });
});
