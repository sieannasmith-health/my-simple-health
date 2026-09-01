import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/msh-food-acquisition.js';

const food = globalThis.MSHFoodAcquisition;

test('normalizes and validates GTIN identifiers', () => {
  assert.deepEqual(food.normalizeGtin('036000291452'), {
    value: '036000291452',
    scheme: 'gtin_12'
  });
  assert.equal(food.isValidGtin('036000291452'), true);
  assert.equal(food.isValidGtin('036000291453'), false);
});

test('keeps unresolved receipt lines instead of discarding them', () => {
  const acquisition = food.createAcquisition({
    purchaseDate: '2026-08-31',
    sourceType: 'receipt_image',
    sourceProvider: 'msh_receipt',
    items: [{ receiptText: 'KRO GRK YOG 32OZ', lineTotal: 5.99, confidence: 0.72 }]
  });

  assert.equal(acquisition.items.length, 1);
  assert.equal(acquisition.items[0].sourceDescription, 'KRO GRK YOG 32OZ');
  assert.equal(acquisition.items[0].resolutionStatus, 'unresolved');
  assert.equal(acquisition.items[0].lineTotal, 5.99);
});

test('does not use GTIN as the product primary key', () => {
  const repo = food.createRepository();
  const product = repo.addProduct({ canonicalName: 'Demo Yogurt', brand: 'Demo' });
  const identifier = repo.addIdentifier(product.id, { scheme: 'gtin_12', value: '036000291452' });

  assert.notEqual(product.id, identifier.value);
  assert.equal(repo.findProductByIdentifier('036000291452').id, product.id);
});

test('blocks exact duplicate acquisitions from the same provider record', () => {
  const repo = food.createRepository();
  const merchant = repo.addMerchant({ name: 'Kroger', merchantType: 'grocery' });
  const purchase = {
    merchantId: merchant.id,
    purchaseDate: '2026-08-31',
    total: 25.30,
    sourceType: 'digital_receipt',
    sourceProvider: 'kroger_receipt',
    sourceRecordId: 'receipt-123'
  };

  assert.equal(repo.recordAcquisition(purchase).status, 'recorded');
  const second = repo.recordAcquisition(purchase);
  assert.equal(second.status, 'duplicate');
  assert.equal(second.matchScore, 1);
  assert.equal(repo.snapshot().acquisitions.length, 1);
});

test('adapter registry normalizes providers behind one acquisition contract', async () => {
  const registry = food.createAdapterRegistry();
  registry.register('demo-store', {
    normalize(raw) {
      return {
        purchaseDate: raw.date,
        total: raw.amount,
        sourceType: 'retailer',
        sourceProvider: 'demo-store',
        sourceRecordId: raw.id,
        items: raw.lines.map(line => ({ sourceDescription: line }))
      };
    }
  });

  const acquisition = await registry.ingest('demo-store', {
    id: 'order-1',
    date: '2026-08-31',
    amount: 14.25,
    lines: ['Milk', 'Eggs']
  });

  assert.equal(acquisition.source.sourceProvider, 'demo-store');
  assert.equal(acquisition.total, 14.25);
  assert.equal(acquisition.items.length, 2);
});
