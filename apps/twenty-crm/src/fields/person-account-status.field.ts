import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '72f56021-7db3-46e6-9bdd-4dc2db574b88',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmAccountStatus',
  type: FieldType.TEXT,
  label: 'AVM Account Status',
});
