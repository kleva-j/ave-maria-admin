import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { AVM_WITHDRAWAL_UNIVERSAL_IDENTIFIER } from 'src/objects/withdrawal';

export default defineField({
  universalIdentifier: '037cadec-1c2c-4553-ac18-165a0a764c78',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmWithdrawals',
  type: FieldType.RELATION,
  label: 'AVM Withdrawals',
  relationTargetObjectMetadataUniversalIdentifier:
    AVM_WITHDRAWAL_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    '6ff8bfd7-91c0-4afa-b3e0-f866ca7b2616',
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
