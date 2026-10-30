import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '94bd3577-2dae-429a-a6d3-0a706c0c24de',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmReferralCode',
  type: FieldType.TEXT,
  label: 'AVM Referral Code',
});
