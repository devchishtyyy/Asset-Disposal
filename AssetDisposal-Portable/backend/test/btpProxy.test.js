const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAssetPayload } = require('../services/btpProxy');

test('normalizes a nested asset payload into the app contract', () => {
  const payload = {
    d: {
      AssetNumber: '000000000123',
      Plant: '1000',
      Department: 'MAR',
      AssetDescription: 'Laptop',
      TotalQuantity: 2,
      YearOfPurchase: 2021,
      Cost: '50000',
      BookValue: '25000'
    }
  };

  assert.deepEqual(normalizeAssetPayload(payload), {
    plant: '1000',
    department: 'MAR',
    assetDescription: 'Laptop',
    totalQuantity: '2',
    yearOfPurchase: '2021',
    cost: '50000',
    bookValue: '25000'
  });
});

test('normalizes array-based payloads and falls back to common field names', () => {
  const payload = [{
    assetNumber: '000000000456',
    plant: '2000',
    description: 'Printer',
    quantity: 1,
    purchaseYear: 2022,
    acquisitionValue: 1200,
    bookValue: 800
  }];

  assert.deepEqual(normalizeAssetPayload(payload), {
    plant: '2000',
    department: '',
    assetDescription: 'Printer',
    totalQuantity: '1',
    yearOfPurchase: '2022',
    cost: '1200',
    bookValue: '800'
  });
});
