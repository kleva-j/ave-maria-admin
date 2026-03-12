import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import Loader from "@/components/loader";

describe("Loader Component", () => {
  it("should render loader with correct structure", () => {
    // Arrange & Act
    const { container } = render(<Loader />);

    // Assert
    expect(container.firstChild).toBeTruthy();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("should have the correct CSS classes", () => {
    // Arrange & Act
    const { container } = render(<Loader />);

    // Assert
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain("flex");
    expect(wrapper?.className).toContain("h-full");
    expect(wrapper?.className).toContain("items-center");
    expect(wrapper?.className).toContain("justify-center");
    expect(wrapper?.className).toContain("pt-8");
  });

  it("should render Loader2 icon with spin animation", () => {
    // Arrange & Act
    const { container } = render(<Loader />);

    // Assert
    const icon = container.querySelector("svg");
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("class")).toContain("animate-spin");
  });
});
