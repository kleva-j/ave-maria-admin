import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { AVM_SAVINGS_PLAN_UNIVERSAL_IDENTIFIER } from 'src/objects/savings-plan';

export default defineField({
  universalIdentifier: 'c005db58-a194-4476-9bf6-a85354000705',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'avmSavingsPlans',
  type: FieldType.RELATION,
  label: 'AVM Savings Plans',
  relationTargetObjectMetadataUniversalIdentifier:
    AVM_SAVINGS_PLAN_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    '94e89b9f-0ebe-4fe1-9c7e-c04f164c07f4',
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
