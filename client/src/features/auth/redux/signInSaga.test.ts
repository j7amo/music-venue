import { createMockTask } from "@redux-saga/testing-utils";
import { expectSaga, testSaga } from "redux-saga-test-plan";
import * as matchers from "redux-saga-test-plan/matchers";
import { StaticProvider, throwError } from "redux-saga-test-plan/providers";

import { showToast } from "../../toast/redux/toastSlice";
import { authServerCall } from "../api";
import { LoggedInUser, SignInDetails } from "../types";
import {
  cancelSignIn,
  endSignIn,
  signIn,
  signInRequest,
  signOut,
  startSignIn,
} from "./authSlice";
import { authenticateUser, signInFlow } from "./signInSaga";

const authUserResponse: LoggedInUser = {
  id: 123,
  email: "user@user.com",
  token: "12345",
};

const networkProviders: Array<StaticProvider> = [
  [matchers.call.fn(authServerCall), authUserResponse],
];

const signInDetails: SignInDetails = {
  email: "user@user.com",
  password: "123456",
  action: "signIn",
};

const signUpDetails: SignInDetails = {
  email: "user@user.com",
  password: "123456",
  action: "signUp",
};

// this function returns a Promise that will be resolved after "delay"
const sleep = (delay: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delay));

describe("signInFlow saga", () => {
  // we can use "test.todo" as a reminder for ourselves of what we would like to test
  // test.todo("cancel sign-in");
  test.each([
    { name: "sign-in", authDetails: signInDetails },
    { name: "sign-up", authDetails: signUpDetails },
  ])("successful $name", async ({ authDetails }) => {
    await expectSaga(signInFlow)
      .provide(networkProviders)
      .dispatch(signInRequest(authDetails))
      .fork(authenticateUser, authDetails)
      .put(startSignIn())
      .call(authServerCall, authDetails)
      // let's say we don't have a response from server but still we need to somehow
      // pass the test(both "signIn" and "showToast" action creators require response from "authServerCall").
      // We can use partial assertions (in this case we will not be checking payloads but only action types):
      // .put.actionType(signIn.type)
      // .put.actionType(showToast.type)
      .put(signIn(authUserResponse))
      .put(
        showToast({
          title: `Signed in as ${authUserResponse.email}`,
          status: "info",
        })
      )
      // we put this action to:
      // - reset (start over) inside an infinite "while" loop inside "signInFlow" saga
      // - cancel "authenticateUser" saga
      .put(endSignIn())
      // "signInFlow" saga has an infinite "while(true) loop" and as a result
      // we will be getting a warning "Saga exceeded async timeout of 250ms" each time we run the test.
      // generally there's not much we can do here BUT we can:
      // - reduce the default timeout value of 250ms to make our test run faster(because it will wait
      // less for "signInFlow" saga)
      // - replace "run" method with "silentRun" to hide the warning that we know will be there 100%
      .silentRun(10);
  });

  test("cancel sign-in", async () => {
    await expectSaga(signInFlow)
      .provide([
        // a DYNAMIC provider is an object(which is different from STATIC that is a tuple) where:
        // - KEY is an effect creator name we want to match
        // - VALUE is a function handler
        {
          // Each function handler takes two arguments:
          // - the yielded effect;
          // - "next" callback.
          // We can inspect the effect and return a fake value based on the properties in the effect.
          // If we don't want to handle the effect ourselves, we can pass it on to Redux Saga
          // by invoking the "next" callback parameter.
          call: async (effect, next) => {
            // we inspect yielded effect and check if the function that should be called is "authServerCall"
            if (effect.fn === authServerCall) {
              // we wait for let's say 500ms
              await sleep(500);
            }

            next();
          },
        },
        ...networkProviders,
      ])
      .dispatch(signInRequest(signInDetails))
      .fork(authenticateUser, signInDetails)
      .call(authServerCall, signInDetails)
      // we have a problem here: we dispatch a "cancelSignIn" action BUT
      // because "authServerCall" is mocked, the whole "authenticateUser" saga is resolved very fast,
      // and we have no chance to trigger the expected effects.
      // To fix this we need to delay the "authServerCall". For this we need to:
      // - create a "delay" function (classic "new Promise + setTimeout combo")
      // - create a DYNAMIC PROVIDER which will trigger the delay on "authServerCall"
      .dispatch(cancelSignIn())
      .put(showToast({ title: "Sign in canceled", status: "warning" }))
      .put(signOut())
      .put(endSignIn())
      .silentRun(10);
  });

  test("sign-in error", async () => {
    await expectSaga(signInFlow)
      .provide([
        [
          matchers.call(authServerCall, signInDetails),
          throwError(new Error("Something went wrong")),
        ],
        ...networkProviders,
      ])
      .dispatch(signInRequest(signInDetails))
      .fork(authenticateUser, signInDetails)
      .put(startSignIn())
      .call(authServerCall, signInDetails)
      .put(
        showToast({
          title: "Sign in failed: Something went wrong",
          status: "warning",
        })
      )
      // make sure we reset to the top of our "while" loop
      .put(endSignIn())
      .silentRun(10);
  });
});

// all the previous tests were INTEGRATION tests (we used "expectSaga" for this),
// but we also need to somehow test if the "cancel" effect was triggered,
// and unfortunately the assertion on "cancel" is NOT SUPPORTED.
// so we have to write UNIT tests for this.
// Basically INTEGRATION tests are not the way to go if:
// - there's an unsupported saga effect;
// - the order of saga effects IS CRUCIAL;
describe("unit tests for fork cancellation", () => {
  test("saga cancel flow", () => {
    // we get iterator that we will be using to (1)move the saga to the next "yield"
    // and every such move will be (2)asserted by "testSaga" mock saga.
    // p.s. "testSaga" throws an error if the ORDER of yielded effects
    // don't match assertion effects(technically we can skip some assertions that we are not
    // interested in BUT we cannot(!!!) change the order of assertions because they DEPEND
    // ON values of PREVIOUSLY RESOLVED EFFECTS, which is NOT TRUE with
    // INTEGRATION tests with "expectSaga" where we can put assertions in ANY ORDER).
    // p.p.s. ALL saga effects are AVAILABLE!
    const saga = testSaga(signInFlow);
    saga.next().take(signInRequest.type);
    saga
      // Pass in arguments to next to simulate response values from the previous step's "yield"
      .next({ type: "test", payload: signInDetails })
      .fork(authenticateUser, signInDetails);
    // because on the previous step we should've gotten Redux Saga "task",
    // we have to pass it as an argument to the "next" method. But it's
    // quite complicated to create a "task" object on our own, so we use
    // "createMockTask" method from "redux-saga" itself:
    const task = createMockTask();
    saga.next(task).take([cancelSignIn.type, endSignIn.type]);
    saga.next(cancelSignIn()).cancel(task);
  });

  test("saga flow without cancel", () => {
    const saga = testSaga(signInFlow);
    // with the help of "next" method we:
    // - get to the first "yield" of "signInFlow" saga which results in
    // yielding "take" effect to Saga Middleware
    saga.next().take(signInRequest.type);
    // with the help of "next" method we:
    // - resolve the previous "yield" with "{ type: "test", payload: signInDetails }" value
    // - get to the next "yield" which results in yielding "fork" effect to Saga Middleware
    saga
      .next({ type: "test", payload: signInDetails })
      .fork(authenticateUser, signInDetails);
    // !!!IMPORTANT!!!
    // We are doing UNIT testing here and "testSaga" API DOES NOT SEE THE EFFECTS FROM OTHER (child) SAGAS!
    // So we CAN NOT DO THIS ASSERTION:
    // saga.next().put(startSignIn()); <= TO ASSERT ON CHILD SAGAS USE INTEGRATION TESTS WITH "expectSaga" API
    // with the help of "next" method we:
    // - resolve the previous "yield" with "undefined" value (because we do not pass anything into "next" method)
    // - get to the next "yield" which results in yielding "take" effect to Saga Middleware
    // p.s. We don't pass "task" via "next" this time because we are not really going to use it
    // as we do not reach "cancel" effect!
    saga.next().take([cancelSignIn.type, endSignIn.type]);
    // with the help of "next" method we:
    // - resolve the previous "yield" with ACTION object value(created by "endSignIn" action creator method)
    // - get to the next "yield" which results in yielding "take" effect to Saga Middleware ONCE AGAIN
    // INSTEAD OF CANCEL effect (this happens because we don't pass the IF check in this case and go back to the
    // start/top of "while(true) loop")
    saga.next(endSignIn()).take(signInRequest.type);
  });
});
