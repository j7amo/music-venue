import userEvent from "@testing-library/user-event";
import React from "react";

import { App } from "../../../App";
import { render, screen } from "../../../test-utils";

const testUser = {
  email: "user@user.com",
};

test("ticket page displays the correct band name for corresponding showId URL parameter", async () => {
  // we need to provide both state AND history
  // IMPORTANT!!! Whenever we need to test a child component
  // that receives URL params from parent component, we have to render parent component (e.g. <App/>)
  render(<App />, {
    preloadedState: { user: { userDetails: testUser } },
    routeHistory: ["/tickets/0"],
  });

  const bandName = await screen.findByRole("heading", {
    name: /avalanche of cheese/i,
  });

  expect(bandName).toBeInTheDocument();
});

test("purchase button pushes the correct URL", async () => {
  const user = userEvent.setup();
  const { memoryHistory } = render(<App />, {
    preloadedState: { user: { userDetails: testUser } },
    routeHistory: ["/tickets/0"],
  });

  const purchaseButton = await screen.findByRole("button", {
    name: /purchase/i,
  });
  await user.click(purchaseButton);

  expect(memoryHistory.location.pathname).toBe("/confirm/0");

  const searchRegex = expect.stringMatching(/holdId=\d+&seatCount=2/);
  expect(memoryHistory.location.search).toEqual(searchRegex);
});
