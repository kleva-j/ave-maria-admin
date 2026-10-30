import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

export const AVM_TRANSACTION_UNIVERSAL_IDENTIFIER =
  '080405f4-3415-4cb3-a5f6-b153a4fa9c32';

export default defineObject({
  universalIdentifier: AVM_TRANSACTION_UNIVERSAL_IDENTIFIER,
  nameSingular: 'avmTransaction',
  namePlural: 'avmTransactions',
  labelSingular: 'Transaction',
  labelPlural: 'Transactions',
  description: 'Allow-listed transaction details mirrored from AVM Daily.',
  icon: 'IconArrowsExchange',
  fields: [
    { universalIdentifier: '951c60e1-d621-42d3-a4b5-6827d38432dc', name: 'externalId', type: FieldType.TEXT, label: 'AVM Transaction ID' },
    { universalIdentifier: 'c657809b-daaa-4dd1-85b2-d017cba452d0', name: 'avmUserId', type: FieldType.TEXT, label: 'AVM User ID' },
    { universalIdentifier: '420d7548-8bef-46b7-bf41-c4a8c347febc', name: 'reference', type: FieldType.TEXT, label: 'Reference' },
    { universalIdentifier: '6a45c19d-2f5f-4cb0-90b2-096680a7f9a5', name: 'transactionType', type: FieldType.TEXT, label: 'Type' },
    { universalIdentifier: 'be04735e-5b77-4e4c-b8f3-c95915c70c67', name: 'amountKobo', type: FieldType.NUMBER, label: 'Amount (Kobo)' },
    { universalIdentifier: 'e85cbf66-38d9-4c41-acb0-47255a4e34da', name: 'occurredAt', type: FieldType.DATE_TIME, label: 'Date' },
    { universalIdentifier: '34007bcd-9e81-4234-91cb-103069d60b54', name: 'savingsPlanId', type: FieldType.TEXT, label: 'AVM Savings Plan ID', isNullable: true, defaultValue: null },
    { universalIdentifier: 'f62d0692-af3c-448e-bc85-8f8785ba0fa6', name: 'reversalReference', type: FieldType.TEXT, label: 'Reversal Reference', isNullable: true, defaultValue: null },
    {
      universalIdentifier: '1648c8d3-b2eb-4d17-a83a-6b30c73da414',
      name: 'person',
      type: FieldType.RELATION,
      label: 'Person',
      relationTargetObjectMetadataUniversalIdentifier:
        '20202020-e674-48e5-a542-72570eee7213',
      relationTargetFieldMetadataUniversalIdentifier:
        'b071a69b-1a92-4b71-a8eb-b7c8e96dd7b0',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'personId',
      },
      isNullable: true,
    },
  ],
});
