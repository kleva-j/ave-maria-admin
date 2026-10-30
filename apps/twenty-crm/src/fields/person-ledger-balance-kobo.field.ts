import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '215135f8-a945-4a7b-9bb6-161326c9d251',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmLedgerBalanceKobo',
  type: FieldType.NUMBER,
  label: 'Ledger Balance (Kobo)',
});
