import userEvent from "@testing-library/user-event";

import { App } from "../../../App";
import { render, screen } from "../../../test-utils";
import { NavBar } from "./NavBar";

describe("SIGN IN button navigation", () => {
  // implementation details test approach:
  test("clicking SIGN IN button redirects to /signin url", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { memoryHistory } = render(<NavBar />);

    // ACT
    const signInButton = screen.getByRole("button", { name: /sign in/i });
    await user.click(signInButton);

    // ASSERT
    expect(memoryHistory.location.pathname).toBe("/signin");
  });

  // functional (behavior) test approach:
  test("clicking SIGN IN button redirects to /signin url", async () => {
    const user = userEvent.setup();
    render(<App />);

    const signInButton = screen.getByRole("button", { name: /sign in/i });
    await user.click(signInButton);

    const signInHeading = screen.getByRole("heading", {
      name: /sign in to your account/i,
    });

    expect(signInHeading).toBeInTheDocument();
  });
});

describe("NavBar contents when user is LOGGED IN / LOGGED OUT", () => {
  test("SIGN IN button is present in the NavBar when user is NOT logged in", () => {
    render(<NavBar />);

    const signInButton = screen.getByRole("button", { name: /sign in/i });

    expect(signInButton).toBeInTheDocument();
  });

  test("SIGN OUT button and logged in user's email is present in the NavBar when user IS logged in", () => {
    const testUser = {
      email: "user@user.com",
    };

    render(<NavBar />, { preloadedState: { user: { userDetails: testUser } } });

    const signOutButton = screen.getByRole("button", { name: /sign out/i });
    const email = screen.getByText(/user@user.com/i);

    expect(signOutButton).toBeInTheDocument();
    expect(email).toBeInTheDocument();
  });
});
