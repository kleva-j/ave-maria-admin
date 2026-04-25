export function formatAdminDateTime(timestamp?: number | null) {
  if (!timestamp) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function formatAdminCurrencyFromKobo(amountKobo: bigint | number) {
  const amount =
    typeof amountKobo === "bigint"
      ? Number(amountKobo) / 100
      : amountKobo / 100;

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatFullName(parts: Array<string | null | undefined>) {
  const value = parts.filter(Boolean).join(" ").trim();
  return value.length > 0 ? value : "Unknown user";
}

const ADMIN_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  operations: "Operations",
  finance: "Finance",
  compliance: "Compliance",
  support: "Support",
};

export function formatAdminRole(role: string): string {
  return ADMIN_ROLE_LABELS[role] ?? role;
}

export function formatBytes(size?: number) {
  if (!size && size !== 0) {
    return "—";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const kb = size / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}
