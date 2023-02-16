import userEvent from "@testing-library/user-event";

import { getByRole, getByText, render, screen } from "../../../test-utils";
import { Shows } from "./Shows";

const testUser = {
  email: "user@user.com",
};

test("displays details for non-sold-out show", async () => {
  render(<Shows />);

  // we have to use "async + await + findAllByRole" combo because shows will be rendered asynchronously
  // (we make a GET request to the "/shows" endpoint on component mount)
  const shows = await screen.findAllByRole("listitem");
  // to isolate all the following DOM queries we take the first item from "shows" array
  const nonSoldOutShow = shows[0];

  // now we can import query methods from RTL (by the way they have slightly different signatures than screen.[method])
  // and use "nonSoldOutShow" as a container to query anything we want into
  const ticketsButton = getByRole(nonSoldOutShow, "button", {
    name: /tickets/i,
  });
  const bandName = getByRole(nonSoldOutShow, "heading", {
    name: /Avalanche of Cheese/i,
  });
  const bandDescription = getByText(
    nonSoldOutShow,
    /rollicking country with ambitious kazoo solos/i
  );

  expect(ticketsButton).toBeInTheDocument();
  expect(bandName).toBeInTheDocument();
  expect(bandDescription).toBeInTheDocument();
});

test("displays details for sold-out show", async () => {
  render(<Shows />);
  const shows = await screen.findAllByRole("listitem");
  // we know from the fake data (which we return from the MSW) that the 2nd item is a sold out show
  const soldOutShow = shows[1];

  const soldOutHeading = getByRole(soldOutShow, "heading", {
    name: /sold out/i,
  });
  const bandName = getByRole(soldOutShow, "heading", {
    name: /The Joyous Nun Riot/i,
  });
  const bandDescription = getByText(
    soldOutShow,
    /serious world music with an iconic musical saw/i
  );

  expect(soldOutHeading).toBeInTheDocument();
  expect(bandName).toBeInTheDocument();
  expect(bandDescription).toBeInTheDocument();
});

test("clicking TICKETS button from Shows component pushes the correct route to history", async () => {
  const user = userEvent.setup();
  // to assert on what is pushed to history we don't need to render <App/> component
  const { memoryHistory } = render(<Shows />);

  const buyTicketsButton = await screen.findByRole("button", {
    name: /tickets/i,
  });
  await user.click(buyTicketsButton);

  expect(memoryHistory.location.pathname).toBe("/tickets/0");
});
