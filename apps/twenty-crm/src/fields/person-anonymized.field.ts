import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '50e59f46-e0b1-4dcc-bd5c-913d28184c55',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmAnonymized',
  type: FieldType.BOOLEAN,
  label: 'AVM Anonymized',
});
