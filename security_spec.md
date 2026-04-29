# Security Specification: FDM Trainer

## Data Invariants
1. A history entry cannot exist without a valid user ID that strictly matches the authenticated user.
2. The user's metadata (email, name) must be provided in the payload for evaluation records.
3. Chat history array is structurally enforced with max 200 elements, preventing Denial of Wallet.
4. Score must be between 0 and 100.
5. All IDs must conform to alphanumeric constraints.
6. Only verified Xertica.ai administrators can list globally, read globally, delete, or update records.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: `userId` set to another user's UID.
2. **Missing Author**: Missing `userId` property.
3. **Ghost Field Injection**: Adding an unmapped `isAdmin: true` field.
4. **Denial of Wallet (String Size)**: `userName` string of 2MB.
5. **Denial of Wallet (Array Size)**: `chatHistory` containing 5,000 items.
6. **Value Poisoning**: `score` as a string (`"100"`) instead of a number.
7. **Boundary Bypass**: `score` set to 105 or -5.
8. **Invalid Path Injection**: Document ID containing slash characters `/`.
9. **Missing Report Payload**: Missing detailed sub-map for analysis.
10. **Partial Update Attempt**: Trying to use patch update by a standard user.
11. **Type Evasion**: `chatHistory` as an object instead of array.
12. **Blanket Querying**: A standard user attempting `list()` queries without `userId` where-clause.

## Test Runner (firestore.rules.test.ts)

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-fdm-trainer',
    firestore: {
      rules: readFileSync(resolve(__dirname, 'firestore.rules'), 'utf8')
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore Security Rules', () => {
  it('prevents Identity Spoofing', async () => {
    const db = testEnv.authenticatedContext('user-123', { email_verified: true }).firestore();
    await assertFails(db.collection('history').doc('h1').set({
      userId: 'hacker-999', userEmail: 'u@x.com', userName: 'U', date: 'd', persona: 'P', score: 100, report: {}
    }));
  });

  // Example coverage for Dirty Dozen...
});
```
