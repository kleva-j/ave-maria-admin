import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { AVM_KYC_DOCUMENT_UNIVERSAL_IDENTIFIER } from 'src/objects/kyc-document';

export default defineField({
  universalIdentifier: 'cdcca120-dd5a-451a-b668-965bfc4d63cf',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmKycDocuments',
  type: FieldType.RELATION,
  label: 'AVM KYC Documents',
  relationTargetObjectMetadataUniversalIdentifier:
    AVM_KYC_DOCUMENT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    'b7d7cef6-0675-41d2-b985-1a16dd10dfc0',
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
