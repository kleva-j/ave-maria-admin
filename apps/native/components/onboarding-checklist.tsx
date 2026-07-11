import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "convex/react";

import { api } from "@avm-daily/backend/convex/_generated/api";

import { useAppTheme } from "@/contexts/app-theme-context";
import { Icon, type IconName } from "@/components/icon";
import { useEligibility } from "@/lib/eligibility";
import { Card } from "@/components/ui/card";

/**
 * Post-signup checklist — three tri-state steps. Auto-hides when all done.
 * Mirrors `apps/web/src/components/onboarding-checklist.tsx`.
 */

type Step = {
  id: string;
  label: string;
  desc: string;
  icon: IconName;
  done: boolean;
};

export function OnboardingChecklist() {
  const eligibility = useEligibility();
  const viewer = useQuery(api.users.viewer, {});
  const { tokens } = useAppTheme();

  const madeFirstDeposit = (viewer?.total_balance_kobo ?? 0n) > 0n;

  const steps: readonly Step[] = [
    {
      id: "kyc",
      label: "Verify your identity",
      desc: "Complete KYC to unlock savings, transfers, and withdrawals.",
      icon: "shield",
      done: eligibility.kycApproved,
    },
    {
      id: "bank",
      label: "Add a verified bank account",
      desc: "Verify the account you'll use to fund savings and receive payouts.",
      icon: "building",
      done: eligibility.hasPrimaryBank,
    },
    {
      id: "deposit",
      label: "Make your first deposit",
      desc: "Fund your wallet to start saving toward your first goal.",
      icon: "arrow-down",
      done: madeFirstDeposit,
    },
  ];

  if (!eligibility.isReady) return null;
  if (steps.every((s) => s.done)) return null;

  const complete = steps.filter((s) => s.done).length;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.foreground }]}>
          Get set up
        </Text>
        <Text style={[styles.count, { color: tokens.mutedForeground }]}>
          {complete} of {steps.length} complete
        </Text>
      </View>
      <View style={styles.list}>
        {steps.map((s) => (
          <Card
            key={s.id}
            bordered
            padding={16}
            radius={18}
            style={[
              styles.item,
              {
                borderColor: s.done
                  ? mixColor(tokens.success, tokens.card, 0.6)
                  : tokens.border,
              },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: s.done
                    ? tokens.successDim
                    : tokens.primaryDim,
                },
              ]}
            >
              <Icon
                name={s.done ? "check-circle" : s.icon}
                size={22}
                color={s.done ? tokens.success : tokens.primary}
              />
            </View>
            <View style={styles.textCol}>
              <Text style={[styles.label, { color: tokens.foreground }]}>
                {s.label}
              </Text>
              <Text style={[styles.desc, { color: tokens.mutedForeground }]}>
                {s.desc}
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={tokens.subtle} />
          </Card>
        ))}
      </View>
    </View>
  );
}

/**
 * Approximate CSS `color-mix` for two hex colors. Enough for the design's
 * "border tinted 60% toward success" case. Falls back to `a` if either
 * input isn't hex.
 */
function mixColor(a: string, b: string, factor: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa.r * factor + pb.r * (1 - factor));
  const g = Math.round(pa.g * factor + pb.g * (1 - factor));
  const bl = Math.round(pa.b * factor + pb.b * (1 - factor));
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
  if (!color.startsWith("#") || color.length < 7) return null;
  return {
    r: parseInt(color.slice(1, 3), 16),
    g: parseInt(color.slice(3, 5), 16),
    b: parseInt(color.slice(5, 7), 16),
  };
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  count: {
    fontSize: 12,
  },
  list: {
    gap: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  desc: {
    fontSize: 12,
    lineHeight: 17,
  },
});
