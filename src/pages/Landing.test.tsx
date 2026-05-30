import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Landing from "@/pages/Landing";

describe("Landing page sales copy", () => {
  it("positions DealSignal for England commercial property beta without fake production metrics", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    expect(screen.getByText(/Find commercial property investment opportunities across England automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/Rightmove Commercial \+ Acuitus/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Request beta access/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/14,832/)).not.toBeInTheDocument();
    expect(screen.queryByText(/GDV analysed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/View demo dashboard/i)).not.toBeInTheDocument();
  });
});
