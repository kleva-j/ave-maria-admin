import { render, screen } from "@testing-library/react-native";

import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { AppThemeProvider } from "@/contexts/app-theme-context";

/**
 * OnboardingChecklist — because our jest-setup mocks convex/react to return
 * `undefined` for every query, `useEligibility().isReady` is false and the
 * component renders nothing. Locking that behavior avoids the checklist
 * flashing before its data actually loads.
 */
describe("OnboardingChecklist", () => {
  it("renders nothing until eligibility data resolves", () => {
    render(
      <AppThemeProvider>
        <OnboardingChecklist />
      </AppThemeProvider>,
    );
    expect(screen.queryByText("Get set up")).toBeNull();
  });
});
