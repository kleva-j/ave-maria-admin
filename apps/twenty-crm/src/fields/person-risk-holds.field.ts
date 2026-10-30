import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { AVM_RISK_HOLD_UNIVERSAL_IDENTIFIER } from 'src/objects/risk-hold';

export default defineField({
  universalIdentifier: 'aa85a924-44cf-4490-8da0-3d3962e958ed',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmRiskHolds',
  type: FieldType.RELATION,
  label: 'AVM Risk Holds',
  relationTargetObjectMetadataUniversalIdentifier:
    AVM_RISK_HOLD_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    'bdb364a2-5617-4578-983a-fd4fbeafe032',
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
