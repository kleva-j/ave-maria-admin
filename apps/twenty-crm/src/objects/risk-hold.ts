import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

export const AVM_RISK_HOLD_UNIVERSAL_IDENTIFIER =
  '2ff6cb2b-27f6-4b60-93e0-0c601ee86216';

export default defineObject({
  universalIdentifier: AVM_RISK_HOLD_UNIVERSAL_IDENTIFIER,
  nameSingular: 'avmRiskHold',
  namePlural: 'avmRiskHolds',
  labelSingular: 'Risk Hold',
  labelPlural: 'Risk Holds',
  description: 'Operational risk holds mirrored from AVM Daily.',
  icon: 'IconShieldLock',
  fields: [
    { universalIdentifier: 'c3e80f47-7c71-4c31-9320-e1cba391af32', name: 'externalId', type: FieldType.TEXT, label: 'AVM Risk Hold ID' },
    { universalIdentifier: '4ce5a453-56c5-4cda-a3da-fc29a3aa095a', name: 'avmUserId', type: FieldType.TEXT, label: 'AVM User ID' },
    { universalIdentifier: '4d772049-43ca-43c9-9000-9201c3806fc7', name: 'status', type: FieldType.TEXT, label: 'Status' },
    { universalIdentifier: 'e1aa5c6c-d0a2-451c-8e06-e08ca2e85169', name: 'reason', type: FieldType.TEXT, label: 'Reason' },
    { universalIdentifier: '53b24209-f31b-494e-8464-2c50d55a4b94', name: 'sourceCreatedAt', type: FieldType.DATE_TIME, label: 'AVM Created At' },
    { universalIdentifier: 'cf69df18-4b18-4257-8e41-66621373495c', name: 'releasedAt', type: FieldType.DATE_TIME, label: 'Released At', isNullable: true, defaultValue: null },
    {
      universalIdentifier: 'bdb364a2-5617-4578-983a-fd4fbeafe032',
      name: 'person',
      type: FieldType.RELATION,
      label: 'Person',
      relationTargetObjectMetadataUniversalIdentifier:
        '20202020-e674-48e5-a542-72570eee7213',
      relationTargetFieldMetadataUniversalIdentifier:
        'aa85a924-44cf-4490-8da0-3d3962e958ed',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'personId',
      },
      isNullable: true,
    },
  ],
});
