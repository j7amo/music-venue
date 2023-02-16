import { App } from "../../../App";
import { render, screen } from "../../../test-utils";

// we test NON-PROTECTED routes.
// They look identical, so we want to parametrize with the help of "test.each" of JEST
test.each([
  { routeName: "Home", path: "/", headingMatch: /welcome/i },
  { routeName: "Band", path: "/bands/0", headingMatch: /Avalanche/i },
  { routeName: "Shows", path: "/shows", headingMatch: /upcoming shows/i },
])(
  "$routeName page does not redirect to login screen",
  async ({ path, headingMatch }) => {
    render(<App />, { routeHistory: [path] });

    const pageHeading = await screen.findByRole("heading", {
      name: headingMatch,
    });

    expect(pageHeading).toBeInTheDocument();
  }
);
