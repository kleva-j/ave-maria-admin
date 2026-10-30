import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

export const AVM_SAVINGS_PLAN_UNIVERSAL_IDENTIFIER =
  'fe70a174-d7ef-439d-8a97-aba35235ede1';

export default defineObject({
  universalIdentifier: AVM_SAVINGS_PLAN_UNIVERSAL_IDENTIFIER,
  nameSingular: 'avmSavingsPlan',
  namePlural: 'avmSavingsPlans',
  labelSingular: 'Savings Plan',
  labelPlural: 'Savings Plans',
  description: 'Savings plan summaries mirrored from AVM Daily.',
  icon: 'IconPigMoney',
  fields: [
    { universalIdentifier: 'efde5c91-67b2-4e39-b2db-b44800e95809', name: 'externalId', type: FieldType.TEXT, label: 'AVM Savings Plan ID' },
    { universalIdentifier: 'ec435be1-e7ea-4f57-a393-1750e5c7f014', name: 'avmUserId', type: FieldType.TEXT, label: 'AVM User ID' },
    { universalIdentifier: '601c8c77-426c-43d7-a63e-ed9df45dbcd2', name: 'planType', type: FieldType.TEXT, label: 'Plan Type' },
    { universalIdentifier: 'f488c4a0-0ba5-44fd-91d3-b79a82dea9f6', name: 'status', type: FieldType.TEXT, label: 'Status' },
    { universalIdentifier: '740f86b5-a555-463d-9d02-53c4790232bb', name: 'balanceKobo', type: FieldType.NUMBER, label: 'Balance (Kobo)' },
    { universalIdentifier: '75be804a-c4a2-4adb-b3fa-8d16d8436613', name: 'targetAmountKobo', type: FieldType.NUMBER, label: 'Target Amount (Kobo)', isNullable: true, defaultValue: null },
    { universalIdentifier: '6950991b-a475-4dac-9f1a-24011603dcac', name: 'startedAt', type: FieldType.DATE_TIME, label: 'Started At' },
    { universalIdentifier: '6564b15f-c75a-4616-9042-2d8d7023fafb', name: 'maturesAt', type: FieldType.DATE_TIME, label: 'Matures At', isNullable: true, defaultValue: null },
    {
      universalIdentifier: '94e89b9f-0ebe-4fe1-9c7e-c04f164c07f4',
      name: 'person',
      type: FieldType.RELATION,
      label: 'Person',
      relationTargetObjectMetadataUniversalIdentifier:
        '20202020-e674-48e5-a542-72570eee7213',
      relationTargetFieldMetadataUniversalIdentifier:
        'c005db58-a194-4476-9bf6-a85354000705',
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
