import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { saveSupportCredential, loadSupportCredential, projectRoot } from '../scripts/support-credential.mjs';

test('operational credential uses authenticated encryption, survives restart, rejects wrong password and tampering', async () => {
  const fixture = randomBytes(32).toString('hex');
  const file = path.join(projectRoot, 'work', `test-support-${randomUUID()}.enc`);
  const passphrase = 'fixture-only-protection-password';
  try {
    await saveSupportCredential(fixture, passphrase, file);
    const stored = await readFile(file, 'utf8');
    assert.ok(!stored.includes(fixture), 'Protected file must not contain the plaintext fixture');
    const recovered = await loadSupportCredential(passphrase, file);
    assert.ok(recovered === fixture, 'Encryption round trip must preserve the credential');
    await assert.rejects(loadSupportCredential('different-fixture-password', file));
    const payload = JSON.parse(stored);
    const bytes = Buffer.from(payload.data, 'base64'); bytes[0] ^= 1; payload.data = bytes.toString('base64');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(file, JSON.stringify(payload));
    await assert.rejects(loadSupportCredential(passphrase, file));
  } finally { await unlink(file).catch(() => {}); }
});
test('missing credential never invents an existing backend key; malformed input is rejected', async () => {
  const file = path.join(projectRoot, 'work', `absent-${randomUUID()}.enc`);
  assert.equal(await loadSupportCredential('fixture-only-password', file), null);
  await assert.rejects(saveSupportCredential('malformed', 'fixture-only-password', file));
  await assert.rejects(saveSupportCredential(randomBytes(32).toString('hex'), 'short', file));
});
