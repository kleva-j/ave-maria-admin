type SyncUserProfile = {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

const PROFILE_FIELDS = ["email", "first_name", "last_name"] as const;

type ProfileField = (typeof PROFILE_FIELDS)[number];
type NormalizedSyncUserProfile = Record<ProfileField, string | null>;

function normalizeProfileValue(value: string | null | undefined) {
  return value === undefined || value === null || value === "" ? null : value;
}

function normalizeProfile(user: SyncUserProfile): NormalizedSyncUserProfile {
  return {
    email: normalizeProfileValue(user.email),
    first_name: normalizeProfileValue(user.first_name),
    last_name: normalizeProfileValue(user.last_name),
  };
}

export function buildUserProfileSyncAuditChange(
  beforeUser: SyncUserProfile,
  afterUser: SyncUserProfile,
) {
  const normalizedBefore = normalizeProfile(beforeUser);
  const normalizedAfter = normalizeProfile(afterUser);

  const changedFields = PROFILE_FIELDS.filter(
    (field) => normalizedBefore[field] !== normalizedAfter[field],
  ) as ProfileField[];

  return {
    changedFields,
    before: {
      email_present: Boolean(normalizedBefore.email),
      first_name_present: Boolean(normalizedBefore.first_name),
      last_name_present: Boolean(normalizedBefore.last_name),
    },
    after: {
      email_present: Boolean(normalizedAfter.email),
      first_name_present: Boolean(normalizedAfter.first_name),
      last_name_present: Boolean(normalizedAfter.last_name),
      changed_fields: changedFields,
    },
  };
}
