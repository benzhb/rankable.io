// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../src/client/App.js";

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("public legal pages", () => {
  it("renders the privacy policy without launching Discord authentication", () => {
    renderRoute("/privacy");

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Information we process/ }))
      .toBeInTheDocument();
    expect(screen.getByText(/request access or deletion/i)).toBeInTheDocument();
  });

  it("renders the terms of service at its public route", () => {
    renderRoute("/tos");

    expect(screen.getByRole("heading", { level: 1, name: "Terms of Service" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Acceptable use/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" }))
      .toHaveAttribute("href", "/privacy");
  });
});
