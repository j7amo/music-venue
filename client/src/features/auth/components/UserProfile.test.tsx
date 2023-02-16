import { App } from "../../../App";
import { render, screen } from "../../../test-utils";
import { UserProfile } from "./UserProfile";

const testUser = {
  email: "user@user.com",
};

test("greets the user", () => {
  render(<UserProfile />, {
    // we now can provide initialState for the component:
    preloadedState: { user: { userDetails: testUser } },
  });
  const greeting = screen.getByRole("heading", { name: /hi, user@user.com/i });

  expect(greeting).toBeInTheDocument();
});

test("redirects if user is falsy", () => {
  // now when we have access to "history" object inside our tests, we can destructure it
  // from the returning value (which is object) of our custom "render" function:
  const { memoryHistory } = render(<UserProfile />);
  // if we don't know what to assert on when using "history" object,
  // we can just simply log what the object has:
  // console.log(memoryHistory);

  const greeting = screen.queryByRole("heading", {
    name: /hi, user@user.com/i,
  });

  // we now can assert on whether there was a redirect or not.
  // this is NOT FUNCTIONAL BUT RATHER IMPLEMENTATION DETAILS testing (we test CODE),
  // because we rely on internals of "memoryHistory" object which is not possible
  // for a user (he can not interact with it)
  expect(memoryHistory.location.pathname).toBe("/signin");
});

// IF we want to do FUNCTIONAL testing (test the actual BEHAVIOR of the app that is observed by user)
// then we have to:
// 1) render the whole <App/> component with initial route set to "/profile"
// 2) assert on the text on the page
test("view sign in page when trying to access /profile page while not logged in", () => {
  // we render <App/> component starting at "/profile" route/page with the help of "routeHistory" option
  // AND we don't specify any initialState(with the help of "preloadedState" option) because we simulate
  // that the user is not signed in (so we don't have any truthy value for "userDetails" state field)
  render(<App />, { routeHistory: ["/profile"] });

  const heading = screen.getByRole("heading", {
    name: /sign in to your account/i,
  });

  expect(heading).toBeInTheDocument();
});
