import type { DatabaseEventPayload, ObjectRecordUpdateEvent } from 'twenty-sdk/logic-function';

import { defineLogicFunction } from 'twenty-sdk/define';

type Person = {
  id: string;
  name?: { firstName?: string; lastName?: string };
  emails?: { primaryEmail?: string };
  phones?: { primaryPhoneNumber?: string };
  avmUserId?: string;
};

type PersonUpdatedEvent = DatabaseEventPayload<ObjectRecordUpdateEvent<Person>>;

const handler = async (event: PersonUpdatedEvent) => {
  const endpoint = process.env.AVM_CONVEX_HTTP_URL;
  const secret = process.env.AVM_CONTACT_EDIT_WEBHOOK_SECRET;
  if (!endpoint || !secret) {
    throw new Error('AVM contact edit forwarding is not configured');
  }

  const { before, after } = event.properties;
  const fields: Record<string, string> = {};
  if (before.name?.firstName !== after.name?.firstName && after.name?.firstName !== undefined) {
    fields.first_name = after.name.firstName;
  }
  if (before.name?.lastName !== after.name?.lastName && after.name?.lastName !== undefined) {
    fields.last_name = after.name.lastName;
  }
  if (before.emails?.primaryEmail !== after.emails?.primaryEmail && after.emails?.primaryEmail !== undefined) {
    fields.email = after.emails.primaryEmail;
  }
  if (before.phones?.primaryPhoneNumber !== after.phones?.primaryPhoneNumber && after.phones?.primaryPhoneNumber !== undefined) {
    fields.phone = after.phones.primaryPhoneNumber;
  }
  if (!Object.keys(fields).length || !after.avmUserId) return { accepted: false };

  const eventBytes = new TextEncoder().encode(JSON.stringify(event));
  const digest = await crypto.subtle.digest('SHA-256', eventBytes);
  const eventId = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const body = JSON.stringify({
    eventId,
    personId: event.recordId,
    workosId: after.avmUserId,
    fields,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const signature = Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/twenty/contact-edit`, {
    method: 'POST',
    headers: {
      'x-avm-timestamp': timestamp,
      'x-avm-signature': signature,
      'content-type': 'application/json',
    },
    body,
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`AVM contact edit webhook returned HTTP ${response.status}`);
  }
  return { accepted: response.status !== 404 };
};

export default defineLogicFunction({
  universalIdentifier: '60c2b1d9-14f6-4c21-bb93-df182ac1e43c',
  name: 'forward-person-contact-edits-for-review',
  timeoutSeconds: 10,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'person.updated',
    updatedFields: ['name', 'emails', 'phones'],
  },
});
