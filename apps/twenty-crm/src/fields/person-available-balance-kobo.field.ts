import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '3d0d50d6-fc9b-4b73-a1f0-ab1390d8c774',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmAvailableBalanceKobo',
  type: FieldType.NUMBER,
  label: 'Available Balance (Kobo)',
});
