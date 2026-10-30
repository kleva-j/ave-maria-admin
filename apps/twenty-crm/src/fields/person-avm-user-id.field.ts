import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '4f5fa504-4230-4106-9753-aef924120f8d',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmUserId',
  type: FieldType.TEXT,
  label: 'AVM User ID',
  description: 'Stable app-side match key. Cleared when a customer is anonymized.',
});
