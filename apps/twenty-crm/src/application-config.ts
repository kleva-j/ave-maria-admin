import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    AVM_CONVEX_HTTP_URL: {
      universalIdentifier: 'db780a5e-27f1-4e1b-b048-d49d17f2ab67',
      label: 'AVM Convex HTTP URL',
      description: 'HTTP Actions origin for the matching AVM Convex deployment.',
      isRequired: true,
    },
    AVM_CONTACT_EDIT_WEBHOOK_SECRET: {
      universalIdentifier: '50cc56e3-22c6-4e83-9c4d-e3d756fc975d',
      label: 'AVM contact edit webhook secret',
      description: 'Shared secret used to authenticate Twenty contact edit events.',
      isSecret: true,
      isRequired: true,
    },
  },
});
