import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

export const AVM_WITHDRAWAL_UNIVERSAL_IDENTIFIER =
  'bb88da84-9581-4d8b-936b-176192c64f58';

export default defineObject({
  universalIdentifier: AVM_WITHDRAWAL_UNIVERSAL_IDENTIFIER,
  nameSingular: 'avmWithdrawal',
  namePlural: 'avmWithdrawals',
  labelSingular: 'Withdrawal',
  labelPlural: 'Withdrawals',
  description: 'Customer withdrawals mirrored from AVM Daily.',
  icon: 'IconArrowUpRight',
  fields: [
    { universalIdentifier: '795bce1b-54e4-4393-9a08-39b522547af8', name: 'externalId', type: FieldType.TEXT, label: 'AVM Withdrawal ID' },
    { universalIdentifier: 'b25631eb-50f4-48bc-848c-59fe0bf3b0c1', name: 'avmUserId', type: FieldType.TEXT, label: 'AVM User ID' },
    { universalIdentifier: '6437f40c-0435-4a1c-951a-aa5fa1605082', name: 'reference', type: FieldType.TEXT, label: 'Reference' },
    { universalIdentifier: '90f33f60-9c99-4963-bb98-85863871e03e', name: 'amountKobo', type: FieldType.NUMBER, label: 'Amount (Kobo)' },
    { universalIdentifier: '6cd6ae46-ed99-458d-9c69-20b10b60ab45', name: 'status', type: FieldType.TEXT, label: 'Status' },
    { universalIdentifier: '67f65d85-6474-4914-ad86-999ed4d91a68', name: 'occurredAt', type: FieldType.DATE_TIME, label: 'Created At' },
    { universalIdentifier: '6fc35c81-fb6a-4836-83b7-16f248fe6274', name: 'sourceUpdatedAt', type: FieldType.DATE_TIME, label: 'AVM Updated At' },
    { universalIdentifier: '93c2ee3f-d02e-420f-a16a-db959b9ca306', name: 'savingsPlanId', type: FieldType.TEXT, label: 'AVM Savings Plan ID', isNullable: true, defaultValue: null },
    { universalIdentifier: '35659fd8-a28e-40c4-bc91-d8ac781feac3', name: 'reversalReference', type: FieldType.TEXT, label: 'Reversal Reference', isNullable: true, defaultValue: null },
    {
      universalIdentifier: '6ff8bfd7-91c0-4afa-b3e0-f866ca7b2616',
      name: 'person',
      type: FieldType.RELATION,
      label: 'Person',
      relationTargetObjectMetadataUniversalIdentifier:
        '20202020-e674-48e5-a542-72570eee7213',
      relationTargetFieldMetadataUniversalIdentifier:
        '037cadec-1c2c-4553-ac18-165a0a764c78',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'personId',
      },
      isNullable: true,
    },
  ],
});
