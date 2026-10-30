import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

export const AVM_KYC_DOCUMENT_UNIVERSAL_IDENTIFIER =
  'ee9a4f4f-0cbb-4d7c-9036-3293d5c8f0c5';

export default defineObject({
  universalIdentifier: AVM_KYC_DOCUMENT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'avmKycDocument',
  namePlural: 'avmKycDocuments',
  labelSingular: 'KYC Document',
  labelPlural: 'KYC Documents',
  description: 'KYC document metadata only. Files and identity numbers are excluded.',
  icon: 'IconFileCheck',
  fields: [
    { universalIdentifier: '8cc5f866-b8db-497e-a0a4-a126371bafdd', name: 'externalId', type: FieldType.TEXT, label: 'AVM Document ID' },
    { universalIdentifier: '2072068c-c600-4542-b4bc-563a335cb063', name: 'avmUserId', type: FieldType.TEXT, label: 'AVM User ID' },
    { universalIdentifier: 'e12f6833-5405-4902-a9a7-e9756ffbe0db', name: 'documentType', type: FieldType.TEXT, label: 'Document Type' },
    { universalIdentifier: '0888b2b5-c779-411a-9324-855b23bec20d', name: 'status', type: FieldType.TEXT, label: 'Status' },
    { universalIdentifier: '6dd451f0-cd42-440b-9f48-442d9bb5cbb1', name: 'uploadedAt', type: FieldType.DATE_TIME, label: 'Uploaded At', isNullable: true, defaultValue: null },
    { universalIdentifier: '573f8fc9-7b19-49ce-886b-c13764cc4a20', name: 'reviewedAt', type: FieldType.DATE_TIME, label: 'Reviewed At', isNullable: true, defaultValue: null },
    { universalIdentifier: 'f2f7bc64-7bec-4107-90ec-cb1dc71eac78', name: 'sanitizedRejectionReason', type: FieldType.TEXT, label: 'Sanitized Rejection Reason', isNullable: true, defaultValue: null },
    {
      universalIdentifier: 'b7d7cef6-0675-41d2-b985-1a16dd10dfc0',
      name: 'person',
      type: FieldType.RELATION,
      label: 'Person',
      relationTargetObjectMetadataUniversalIdentifier:
        '20202020-e674-48e5-a542-72570eee7213',
      relationTargetFieldMetadataUniversalIdentifier:
        'cdcca120-dd5a-451a-b668-965bfc4d63cf',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'personId',
      },
      isNullable: true,
      defaultValue: null,
    },
  ],
});
