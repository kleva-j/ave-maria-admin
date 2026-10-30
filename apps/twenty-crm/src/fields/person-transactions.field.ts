import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { AVM_TRANSACTION_UNIVERSAL_IDENTIFIER } from 'src/objects/transaction';

export default defineField({
  universalIdentifier: 'b071a69b-1a92-4b71-a8eb-b7c8e96dd7b0',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmTransactions',
  type: FieldType.RELATION,
  label: 'AVM Transactions',
  relationTargetObjectMetadataUniversalIdentifier:
    AVM_TRANSACTION_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    '1648c8d3-b2eb-4d17-a83a-6b30c73da414',
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
