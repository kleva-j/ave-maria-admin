import { render, screen } from "@testing-library/react-native";

import { Badge } from "@/components/ui/badge";
import { AppThemeProvider } from "@/contexts/app-theme-context";

/**
 * Badge — renders a label + is discoverable by accessibility label. Deeper
 * variant-color assertions belong in a snapshot suite; here we lock the
 * public contract (accepts variant + label).
 */
describe("Badge", () => {
  it("renders its label", () => {
    render(
      <AppThemeProvider>
        <Badge variant="success" label="Verified" />
      </AppThemeProvider>,
    );
    expect(screen.getByLabelText("Verified")).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
  });
});
