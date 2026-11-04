import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dateRange, deskTime, pieceStage, shipmentShipState, shipState } from '../src/admin';

describe('admin times in the desk zone (D-096)', () => {
  // 2026-10-08 13:38 UTC = 9:38 AM in New Jersey (EDT) = 7:08 PM in India.
  const at = '2026-10-08T13:38:00Z';

  it('shows the US desk New Jersey first, India beside it', () => {
    assert.deepEqual(deskTime(at, 'us'), { main: 'Oct 8, 9:38 AM', other: '7:08 PM IST' });
  });

  it('shows the India desk India first, New Jersey beside it', () => {
    assert.deepEqual(deskTime(at, 'india'), { main: 'Oct 8, 7:08 PM', other: '9:38 AM ET' });
  });

  it('names the other day when the zones are on different dates', () => {
    assert.deepEqual(deskTime('2026-10-08T22:00:00Z', 'us'), { main: 'Oct 8, 6:00 PM', other: 'Oct 9, 3:30 AM IST' });
  });

  it('defaults to New Jersey for an admin without a desk', () => {
    assert.equal(deskTime(at, null).main, 'Oct 8, 9:38 AM');
  });

  it('writes delivery windows as calendar days', () => {
    assert.equal(dateRange('2026-10-30', '2026-11-04'), 'Oct 30 – Nov 4');
    assert.equal(dateRange(null, null), '—');
  });
});

describe('what a shipment can do now (D-154, D-187, as ship_shipment checks it)', () => {
  const at = (status: string) => ({ status });
  const order = {
    status: 'confirmed',
    items: [
      { status: 'active', shipment_id: 'food', pickup: at('picked') },
      { status: 'active', shipment_id: 'rest', pickup: at('pending') },
    ],
  };
  const food = { id: 'food', status: 'open' };
  const rest = { id: 'rest', status: 'open' };

  it('a shipment leaves the hub once its own pieces are there', () => {
    assert.equal(shipmentShipState(order, food).canShip, true);
    assert.equal(shipmentShipState(order, rest).canShip, false);
    assert.equal(shipmentShipState(order, { ...food, status: 'shipped' }).canShip, false);
  });

  it('a piece no longer active does not hold its shipment back', () => {
    const items = [{ status: 'unavailable', shipment_id: 'rest', pickup: at('unavailable') }];
    assert.equal(shipmentShipState({ ...order, items }, rest).canShip, true);
  });

  it('the whole order ships once every piece is at the hub', () => {
    assert.equal(shipState(order).canShip, false);
    assert.equal(shipState({ ...order, items: order.items.map((i) => ({ ...i, pickup: at('picked') })) }).canShip, true);
    assert.equal(shipState({ ...order, status: 'shipped', items: [] }).canShip, false);
  });

  it('a piece already in the US has no pickup and needs none', () => {
    assert.equal(shipState({ status: 'arrived', items: [{ status: 'active', pickup: null }] }).canShip, true);
  });
});

describe('where a sold piece stands (D-140)', () => {
  it('To order → Ordered → At the hub', () => {
    assert.equal(pieceStage({ status: 'pending', ordered_at: null }), 'to_order');
    assert.equal(pieceStage({ status: 'pending', ordered_at: '2026-11-04T10:00:00Z' }), 'ordered');
    assert.equal(pieceStage({ status: 'picked', ordered_at: '2026-11-04T10:00:00Z' }), 'at_hub');
    assert.equal(pieceStage({ status: 'unavailable', ordered_at: null }), 'unavailable');
  });
});
