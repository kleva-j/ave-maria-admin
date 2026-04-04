type SyncUserProfile = {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

const PROFILE_FIELDS = ["email", "first_name", "last_name"] as const;

type ProfileField = (typeof PROFILE_FIELDS)[number];

export function buildUserProfileSyncAuditChange(
  beforeUser: SyncUserProfile,
  afterUser: SyncUserProfile,
) {
  const changedFields = PROFILE_FIELDS.filter(
    (field) => beforeUser[field] !== afterUser[field],
  ) as ProfileField[];

  return {
    changedFields,
    before: {
      email_present: Boolean(beforeUser.email),
      first_name_present: Boolean(beforeUser.first_name),
      last_name_present: Boolean(beforeUser.last_name),
    },
    after: {
      email_present: Boolean(afterUser.email),
      first_name_present: Boolean(afterUser.first_name),
      last_name_present: Boolean(afterUser.last_name),
      changed_fields: changedFields,
    },
  };
}
