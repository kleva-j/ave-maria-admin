import { fireEvent, render, screen } from "@testing-library/react-native";

import { Button } from "@/components/ui/button";
import { AppThemeProvider } from "@/contexts/app-theme-context";

describe("Button", () => {
  it("fires onPress when enabled", () => {
    const onPress = jest.fn();
    render(
      <AppThemeProvider>
        <Button label="Continue" onPress={onPress} />
      </AppThemeProvider>,
    );
    fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire onPress when disabled", () => {
    const onPress = jest.fn();
    render(
      <AppThemeProvider>
        <Button label="Continue" onPress={onPress} disabled />
      </AppThemeProvider>,
    );
    fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
