import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { AVM_BANK_ACCOUNT_UNIVERSAL_IDENTIFIER } from 'src/objects/bank-account';

export default defineField({
  universalIdentifier: '3292eaa3-11de-48d2-83ff-6e2c6a289c50',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmBankAccounts',
  type: FieldType.RELATION,
  label: 'AVM Bank Accounts',
  relationTargetObjectMetadataUniversalIdentifier:
    AVM_BANK_ACCOUNT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    'a34b5e3c-4383-47e3-9938-9b64b3ae9eda',
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
