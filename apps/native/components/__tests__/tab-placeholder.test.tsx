import { render, screen } from "@testing-library/react-native";

import { TabPlaceholder } from "@/components/user-shell/tab-placeholder";
import { AppThemeProvider } from "@/contexts/app-theme-context";

describe("TabPlaceholder", () => {
  it("renders title, copy, and the target PR pill", () => {
    render(
      <AppThemeProvider>
        <TabPlaceholder
          title="Savings Plans"
          copy="Set goals, track progress."
          pr="PR N02"
          icon="target"
        />
      </AppThemeProvider>,
    );
    expect(screen.getByText("Savings Plans")).toBeTruthy();
    expect(screen.getByText("Set goals, track progress.")).toBeTruthy();
    expect(screen.getByText(/Arrives with PR N02/i)).toBeTruthy();
  });
});
