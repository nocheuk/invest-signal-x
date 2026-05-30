import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing beta access page", () => {
  it("shows early beta plans and request access CTAs without Stripe checkout", () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );

    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("£19")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("£49")).toBeInTheDocument();
    expect(screen.getByText("Insider")).toBeInTheDocument();
    expect(screen.getAllByText("Contact us").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Request beta access").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/checkout/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stripe/i)).not.toBeInTheDocument();
  });

  it("has a request access form and trust disclaimer", () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Investor type")).toBeInTheDocument();
    expect(screen.getByLabelText("Target locations")).toBeInTheDocument();
    expect(screen.getByLabelText("Budget range")).toBeInTheDocument();
    expect(screen.getByText(/DealSignal is not financial advice/i)).toBeInTheDocument();
    expect(screen.getByText(/not a valuation/i)).toBeInTheDocument();
  });
});
