import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DefaultRequestBody,
  RequestParams,
  ResponseComposition,
  rest,
  RestContext,
  RestRequest,
} from "msw";

import { App } from "../../../App";
import { baseUrl, endpoints } from "../../../app/axios/constants";
import { handlers } from "../../../mocks/handlers";
import { testServer } from "../../../mocks/server";
import { getByLabelText, getByRole, render, screen } from "../../../test-utils";

test.each([
  { routeName: "Profile", routePath: "/profile" },
  { routeName: "Tickets", routePath: "/tickets/0" },
  { routeName: "Confirm", routePath: "/confirm/0?holdId=123&seatCount=2" },
])(
  "$routeName route redirects to /signin if user is NOT logged in",
  ({ routePath }) => {
    render(<App />, { routeHistory: [routePath] });

    const pageHeading = screen.getByRole("heading", { name: /sign in/i });

    expect(pageHeading).toBeInTheDocument();
  }
);

test.each([
  { testName: "sign in", buttonMatchRegex: /sign in/i },
  {
    testName: "sign up",
    buttonMatchRegex: /sign up/i,
  },
])(
  "Successful $testName flow when going to protected route when NOT logged in redirects to /signin route AND redirects back to protected route after successful login",
  async ({ buttonMatchRegex }) => {
    const user = userEvent.setup();
    const { memoryHistory } = render(<App />, { routeHistory: ["/profile"] });

    const pageHeading = screen.getByRole("heading", { name: /sign in/i });
    expect(pageHeading).toBeInTheDocument();

    // we need to find Form in order to restrict all the consequent queries to the form elements.
    // we do this because when we try to query Sign In button, there are multiple results on the page.
    // we have to use "getByTestId" method here because our form has no role...
    const signInForm = screen.getByTestId("sign-in-form");
    const emailInput = getByLabelText(signInForm, /email/i);
    const passwordInput = getByLabelText(signInForm, /password/i);
    const signInButton = getByRole(signInForm, "button", {
      name: buttonMatchRegex,
    });

    await user.clear(emailInput);
    await user.type(emailInput, "user@user.com");
    await user.clear(passwordInput);
    await user.type(passwordInput, "123456");
    await user.click(signInButton);

    // we use "waitFor" for async assertion (because URL change is a result of network call which is mocked by the way but still a network call)
    await waitFor(() =>
      expect(memoryHistory.location.pathname).toBe("/profile")
    );
    const profileGreeting = screen.getByRole("heading", {
      name: /hi, user@user.com/i,
    });
    expect(profileGreeting).toBeInTheDocument();
    // and we also want to make sure that "entries" array of "memoryHistory" object has only one entry (because our app is written
    // in such way that "sign-in/sign-up" route is REPLACED after successful login WITH previous route we attempted to visit when we were
    // NOT logged in). Alternatively we could've iterated over entries array and assert on each entry that it is not a "sign-in/sign-up" route.
    expect(memoryHistory.entries).toHaveLength(1);
  }
);

// this handler simulates server response for cases when SIGN-IN information is incorrect
const signInFailureHandler = (
  req: RestRequest<DefaultRequestBody, RequestParams>,
  res: ResponseComposition,
  ctx: RestContext
) => {
  return res(ctx.status(401));
};

// this handler simulates server response for cases when SIGN-UP information is incorrect (note that in
// this case information is incorrect WHEN user enters EMAIL that is already in use which is different from SIGN-IN failure)
const signUpFailureHandler = (
  req: RestRequest<DefaultRequestBody, RequestParams>,
  res: ResponseComposition,
  ctx: RestContext
) => {
  return res(ctx.status(400), ctx.json({ message: "Email is already in use" }));
};

// this handler simulates server response for cases when there's a server error
const serverErrorHandler = (
  req: RestRequest<DefaultRequestBody, RequestParams>,
  res: ResponseComposition,
  ctx: RestContext
) => {
  return res(ctx.status(500));
};

// in order to parametrize these tests we need several parameters:
// - testName - test name for future (when released) interpolation for creating dynamic test description;
// - endpoint - to send request to a specific endpoint(they are DIFFERENT for SIGN-IN and SIGN-UP);
// - handler - function to be used as a response resolver;
// - buttonNameRegex - to query a button that corresponds to SIGN-IN/SIGN-UP flow.
test.each([
  {
    testName: "signInFailure",
    endpoint: endpoints.signIn,
    handler: signInFailureHandler,
    buttonNameRegex: /sign in/i,
  },
  {
    testName: "signInServerError",
    endpoint: endpoints.signIn,
    handler: serverErrorHandler,
    buttonNameRegex: /sign in/i,
  },
  {
    testName: "signUpFailure",
    endpoint: endpoints.signUp,
    handler: signUpFailureHandler,
    buttonNameRegex: /sign up/i,
  },
  {
    testName: "signUpServerError",
    endpoint: endpoints.signUp,
    handler: serverErrorHandler,
    buttonNameRegex: /sign up/i,
  },
])(
  "unsuccessful signin as a result of $testName followed by successful signin",
  async ({ endpoint, handler, buttonNameRegex }) => {
    const errorHandler = rest.post(`${baseUrl}/${endpoint}`, handler);
    // here we want to reset (replace) initial handlers list
    // that we used when we called "setupServer" to produce "testServer"
    // with a new list that contains all the initial handlers PLUS our new "errorHandler" SO THAT IT WILL OVERRIDE
    // handling of network call to SIGN-IN endpoint with returning 401 status:
    testServer.resetHandlers(...handlers, errorHandler);
    const user = userEvent.setup();
    const { memoryHistory } = render(<App />, { routeHistory: ["/profile"] });

    const authHeading = await screen.findByRole("heading", {
      name: /sign in/i,
    });

    const authForm = screen.getByTestId("sign-in-form");
    const emailInput = getByLabelText(authForm, /email/i);
    const passwordInput = getByLabelText(authForm, /password/i);
    const authButton = getByRole(authForm, "button", {
      name: buttonNameRegex,
    });

    await user.clear(emailInput);
    await user.type(emailInput, "user@user.com");
    await user.clear(passwordInput);
    await user.type(passwordInput, "123456");
    await user.click(authButton);

    // because now we are guaranteed NOT to receive user data (that's needed for the redux store) via server response,
    // we can expect that we are still on the SIGN-IN page:
    await waitFor(() => {
      expect(authHeading).toBeInTheDocument();
      // we can also check history:
      expect(memoryHistory.location.pathname).toBe("/signin");
    });

    // now we can reset handlers to the initial handlers list excluding our special "errorHandler" which
    // will result in a normal data returned and user becoming logged in
    testServer.resetHandlers();
    // and try to click SIGN-IN/SIGN-UP button again
    await user.click(authButton);

    // now we assert on user seeing the PROFILE page
    await waitFor(() => {
      const profileGreeting = screen.getByRole("heading", {
        name: /hi, user@user.com/i,
      });

      expect(profileGreeting).toBeInTheDocument();
      expect(memoryHistory.location.pathname).toBe("/profile");
      expect(memoryHistory.entries).toHaveLength(1);
    });
  }
);
