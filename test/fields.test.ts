import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectFields } from '../scripts/check-fields';

test('Sichtbare Felder übernehmen die Attribute des gemeinsamen Field', () => {
  const inspect = (markup: string) => inspectFields('probe.tsx', markup);
  assert.deepEqual(inspect('<Field>{control => <input {...control} />}</Field>'), []);
  assert.deepEqual(inspect('<Field>{control => <div><select {...control} /></div>}</Field>'), []);
  assert.deepEqual(inspect('<input type="hidden" />'), []);
  assert.equal(inspect('<input />').length, 1);
  assert.equal(inspect('<Field>{control => <textarea />}</Field>').length, 1);
  assert.equal(inspect('<Field>{control => <textarea {...other} />}</Field>').length, 1);
});
