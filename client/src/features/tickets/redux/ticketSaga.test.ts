import axios from "axios";
import { expectSaga } from "redux-saga-test-plan";
import * as matchers from "redux-saga-test-plan/matchers";
import { StaticProvider, throwError } from "redux-saga-test-plan/providers";

import {
  holdReservation,
  purchaseReservation,
} from "../../../test-utils/fake-data";
import { showToast } from "../../toast/redux/toastSlice";
import {
  cancelPurchaseServerCall,
  releaseServerCall,
  reserveTicketServerCall,
} from "../api";
import { TicketAction } from "../types";
import {
  cancelTransaction,
  generateErrorToastOptions,
  purchaseTickets,
  releaseTickets,
  ticketFlow,
} from "./ticketSaga";
import {
  endTransaction,
  resetTransaction,
  selectors,
  startTicketAbort,
  startTicketPurchase,
  startTicketRelease,
} from "./ticketSlice";

const holdAction = {
  type: "test",
  payload: holdReservation,
};

const releasePayload = { reservation: holdReservation, reason: "abort" };
const purchasePayload = {
  purchaseReservation,
  holdReservation,
};

// we don't want to do any real network calls during our tests, so it's a good
// idea to extract providers into a separate array and just use it in "provide" method:
const networkProviders: Array<StaticProvider> = [
  [matchers.call.fn(reserveTicketServerCall), null],
  [matchers.call.fn(releaseServerCall), null],
  [matchers.call.fn(cancelPurchaseServerCall), null],
];

// "cancelTransaction" saga is being called in different test scenarios,
// so in order to not test its implementation everytime we come to the point of calling this saga,
// we can just test its implementation(all the effects that are triggered inside the saga) once separately
// from the other tests and not repeat ourselves
test("cancelTransaction cancels hold and resets transaction", async () => {
  await expectSaga(cancelTransaction, holdReservation)
    .provide(networkProviders)
    .call(releaseServerCall, holdReservation)
    .put(resetTransaction())
    .run();
});

describe("common to all flows", () => {
  test("start with hold call to server", async () => {
    await expectSaga(ticketFlow, holdAction)
      // "reserveTicketServerCall" is an actual call to the server which we
      // generally do not want to make during tests, hence we should MOCK it.
      // In order to use mocking capabilities of "redux-saga-test-plan" library
      // we need to use PROVIDE method that accepts an array of PROVIDERS.
      // Each provider is a tuple (in our case is an array of 2 items):
      // 1) MATCHER - which is a description of what PROVIDER must intercept (in
      // our case we specify that we want to intercept/mock a "call" effect with
      // "reserveTicketServerCall")
      // 2) MOCK VALUE - value which will be returned.
      .provide(networkProviders)
      // the test will pass, but we'll have a saga timeout message...
      // it happens because in the "ticketFlow" saga after calling "reserveTicketServerCall"
      // there is a "take" effect that waits for any of 3 specific actions to be dispatched
      // somewhere in the app.
      .call(reserveTicketServerCall, holdReservation)
      // so in order to proceed to the next saga step we need to DISPATCH any action that
      // this "take" effect interested in (but we have to take into consideration that different
      // actions result in different saga flows), so we choose to dispatch "startTicketAbort" action here.
      // And... the test will fail! Why so? Because this action will eventually lead to this chain of calls:
      // "call" effect for "releaseTickets" ->
      // "call" effect for "cancelTransaction" ->
      // "call" effect for "releaseServerCall" (which IS a real call to server - we MUST MOCK it via "provide")
      .dispatch(startTicketAbort(releasePayload))
      .run();
  });

  test("show error toast and clean up after server error", async () => {
    await expectSaga(ticketFlow, holdAction)
      // here we want to simulate a situation when we have some network error,
      // so we mock the call to "reserveTicketServerCall", but there's a difference
      // from the previous test: we do not want to just return "null" but explicitly throw an error
      // in order to trigger the correct flow of "ticketFlow" saga:
      .provide([
        [
          matchers.call.fn(reserveTicketServerCall),
          // we use a special method from "redux-saga-test-plan: for this
          throwError(new Error("error")),
        ],
        [
          // the "network error" flow also assumes that we select the current ticket action
          // from the store to use this info in generating the error and showing the error toast,
          // and we need to mock it as well (here we use partial matching with the help of "select.selector")
          matchers.select.selector(selectors.getTicketAction),
          TicketAction.hold,
        ],
        // and we should not forget that we also have to mock this server call OR test will fail
        // [matchers.call.fn(releaseServerCall), null],
        // here we spread "networkProviders" which is perfectly fine because matching works like this:
        // ONLY the FIRST MATCH matters, other matches will be skipped (in our case we have
        // 2 similar matches (matchers.call.fn(reserveTicketServerCall))
        // BUT 2 different MOCKED values - null and error throw. Only the first match will be triggered.)
        ...networkProviders,
      ])
      // after we set up the test ((1)we passed "ticketFlow" worker saga + action to "expectSaga" function
      // and (2)we configured mocks for both network calls and state slice selection), we now can
      // assert on "put" effect being triggered with the same error message that we explicitly threw previously
      // and ticket action we "extracted" from the global state
      .put(showToast(generateErrorToastOptions("error", TicketAction.hold)))
      // and this is the assertion on the "clean up" part(next 2 lines) our saga:
      .call(cancelTransaction, holdReservation)
      .run();
  });
});

describe("purchase flow", () => {
  test("network error on purchase shows toast error and cancels the transaction", async () => {
    await expectSaga(ticketFlow, holdAction)
      .provide([
        [
          // this is another variant of matcher that helps us provide a more specific
          // effect description for more precise matching (here we will try to match/mock
          // a "call" effect for "reserveTicketServerCall" with "purchaseReservation" argument name which
          // will result in effect being matched ONLY in "purchaseTickets" worker saga because it uses
          // "call" effect just the way we describe it in the matcher, and this matcher WILL NOT MATCH for
          // a "call" effect for "reserveTicketServerCall" with "holdPayload" argument name inside ticketFlow saga
          // because obviously argument names do not match)
          matchers.call.like({
            fn: reserveTicketServerCall,
            args: [purchaseReservation],
          }),
          throwError(new Error("purchase failed")),
        ],
        [
          matchers.select.selector(selectors.getTicketAction),
          TicketAction.hold,
        ],
        ...networkProviders,
      ])
      .call(reserveTicketServerCall, holdReservation)
      .dispatch(startTicketPurchase(purchasePayload))
      // we could have put these lines here BUT currently we are not interested in
      // "purchaseTickets" saga and its implementation(as the test description implies).
      // All that we are interested in is whether we end up in "error" path of "ticketFlow" saga,
      // so we don't need to test next 3 lines for now
      // .call(reserveTicketServerCall, purchaseReservation)
      // .call(releaseServerCall, holdReservation)
      // .put(endTransaction())
      .call(cancelPurchaseServerCall, purchaseReservation)
      .put(
        showToast(
          generateErrorToastOptions("purchase failed", TicketAction.hold)
        )
      )
      .call(cancelTransaction, holdReservation)
      .run();
  });

  test("abort purchase while call to server is running", async () => {
    const cancelSource = axios.CancelToken.source();

    await expectSaga(purchaseTickets, purchasePayload, cancelSource)
      .provide([
        ...networkProviders,
        // here we have something new:
        // in "purchaseTickets" we have a "race" effect, and we want to MOCK it
        // in a way that lets effect that is associated with "abort" key to "win".
        // in order to do it we need 2 things:
        // 1) a dynamic provider (which looks completely different from static one):
        {
          // 2) a function that returns what we need to get into the needed branch of saga flow
          race: () => ({ abort: true }),
        },
      ])
      .call(cancelSource.cancel)
      .call(cancelPurchaseServerCall, purchaseReservation)
      .put(showToast({ title: "purchase canceled", status: "warning" }))
      .call(cancelTransaction, holdReservation)
      .not.put(showToast({ title: "tickets purchased", status: "success" }))
      .run();
  });

  test("successful purchase", async () => {
    const cancelSource = axios.CancelToken.source();

    await expectSaga(purchaseTickets, purchasePayload, cancelSource)
      .provide(networkProviders)
      .call(reserveTicketServerCall, purchaseReservation, cancelSource.token)
      .put(showToast({ title: "tickets purchased", status: "success" }))
      .call(releaseServerCall, holdReservation)
      .put(endTransaction())
      // here we also make negated assertions to be sure that there were no cancelling in any form
      // p.s. we use "cancelSource.cancel" to cancel an ONGOING axios request,"cancelPurchaseServerCall"
      // is used for cancelling the purchase that was already registered on the server.
      .not.call.fn(cancelSource.cancel)
      .not.call.fn(cancelPurchaseServerCall)
      .not.put(showToast({ title: "purchase canceled", status: "warning" }))
      .run();
  });
});

// this is a good example of a situation when it would be better to use
// "jest.each" to parameterize 2 tests that look almost the same (only the "dispatch" line differs)
describe("hold cancellation flow", () => {
  // we can do it the old way...
  // test("when user navigates away from the reservation page", async () => {
  //   await expectSaga(ticketFlow, holdAction)
  //     .provide(networkProviders)
  //     .call(reserveTicketServerCall, holdReservation)
  //     .dispatch(startTicketAbort(releasePayload))
  //     .call(releaseTickets, releasePayload)
  //     .put(showToast({ title: "abort", status: "warning" }))
  //     .call(cancelTransaction, holdReservation)
  //     .run();
  // });
  // and repeat ourselves...
  // test("when user clicks cancel button or hold expires after 5 minutes", async () => {
  //   await expectSaga(ticketFlow, holdAction)
  //     .provide(networkProviders)
  //     .call(reserveTicketServerCall, holdReservation)
  //     .dispatch(startTicketRelease(releasePayload))
  //     .call(releaseTickets, releasePayload)
  //     .put(showToast({ title: "abort", status: "warning" }))
  //     .call(cancelTransaction, holdReservation)
  //     .run();
  // });

  // but it's better to refactor with the help of "test.each" function that:
  // - accepts an array of ARGUMENTS OBJECTS (we define them as we want)
  // - returns a function that can be called just like usual "test" function
  // AND we pass any field value we want from arguments object to it.
  // As a result we can run (1)SAME TEST WITH (2)DIFFERENT ARGUMENTS.
  test.each([
    { name: "cancel", actionCreator: startTicketRelease },
    {
      name: "abort",
      actionCreator: startTicketAbort,
    },
  ])(
    // here we use a special Jest variable interpolation to create dynamic test descriptions
    // BUT currently this feature is not yet released
    "cancels hold and resets ticket transaction on $name",
    // to pass "actionCreator" to the test function we need to destructure it first
    async ({ actionCreator }) => {
      await expectSaga(ticketFlow, holdAction)
        .provide(networkProviders)
        .call(reserveTicketServerCall, holdReservation)
        // now this line of code is parameterized AND is DYNAMIC (and we don't have to repeat ourselves anymore)
        .dispatch(actionCreator(releasePayload))
        .call(releaseTickets, releasePayload)
        .put(showToast({ title: "abort", status: "warning" }))
        .call(cancelTransaction, holdReservation)
        .run();
    }
  );
});
