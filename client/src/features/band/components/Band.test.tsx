import { App } from "../../../App";
import { render, screen } from "../../../test-utils";

test("band page displays the correct band name for corresponding bandId URL parameter", async () => {
  // we put a path with URL parameter into the "routeHistory" option
  render(<App />, { routeHistory: ["/bands/0"] });

  const bandName = await screen.findByRole("heading", {
    name: /Avalanche of Cheese/i,
  });

  expect(bandName).toBeInTheDocument();
});
