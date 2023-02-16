import React from "react";

import { App } from "../../../App";
import { render } from "../../../test-utils";

const testUser = {
  email: "user@user.com",
};

test("bad query params on confirm page trigger redirect to tickets page with correct :showId", () => {
  const { memoryHistory } = render(<App />, {
    preloadedState: { user: { userDetails: testUser } },
    // here we deliberately remove "holdId" to make malformed query params
    routeHistory: ["/confirm/0?seatCount=2"],
    // or we can as well test with seatCount is missing from query params:
    // routeHistory: ["/confirm/0?holdId=12345"],
  });

  expect(memoryHistory.location.pathname).toBe("/tickets/0");
});
