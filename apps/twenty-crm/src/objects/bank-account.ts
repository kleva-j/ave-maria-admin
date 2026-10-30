import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

export const AVM_BANK_ACCOUNT_UNIVERSAL_IDENTIFIER =
  '0a69e3cf-de71-44a1-ada6-c19e7cf4b347';

export default defineObject({
  universalIdentifier: AVM_BANK_ACCOUNT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'avmBankAccount',
  namePlural: 'avmBankAccounts',
  labelSingular: 'Bank Account Summary',
  labelPlural: 'Bank Account Summaries',
  description: 'Masked bank account summaries; full account numbers are excluded.',
  icon: 'IconBuildingBank',
  fields: [
    { universalIdentifier: '09657c3f-5e19-48b3-8a45-8db237d8ba32', name: 'externalId', type: FieldType.TEXT, label: 'AVM Bank Account ID' },
    { universalIdentifier: '3f24e245-92a5-417d-b942-687bf2b50dfc', name: 'avmUserId', type: FieldType.TEXT, label: 'AVM User ID' },
    { universalIdentifier: 'ad749df9-e288-488b-aa13-c0042dd712db', name: 'bankName', type: FieldType.TEXT, label: 'Bank Name' },
    { universalIdentifier: 'dbde4116-835b-4782-b090-750d7f82c903', name: 'accountName', type: FieldType.TEXT, label: 'Account Name', isNullable: true, defaultValue: null },
    { universalIdentifier: '50b0954f-412e-43af-8cc9-e3492f58ed25', name: 'lastFourDigits', type: FieldType.TEXT, label: 'Last Four Digits' },
    { universalIdentifier: 'e3910c7c-0ade-4b08-8826-6879bf506495', name: 'verificationStatus', type: FieldType.TEXT, label: 'Verification Status' },
    { universalIdentifier: '24e08468-d3a6-4469-a0da-e5371378d6b3', name: 'isCurrent', type: FieldType.BOOLEAN, label: 'Current Account' },
    {
      universalIdentifier: 'a34b5e3c-4383-47e3-9938-9b64b3ae9eda',
      name: 'person',
      type: FieldType.RELATION,
      label: 'Person',
      relationTargetObjectMetadataUniversalIdentifier:
        '20202020-e674-48e5-a542-72570eee7213',
      relationTargetFieldMetadataUniversalIdentifier:
        '3292eaa3-11de-48d2-83ff-6e2c6a289c50',
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
