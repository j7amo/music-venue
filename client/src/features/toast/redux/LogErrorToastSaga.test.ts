import { expectSaga } from "redux-saga-test-plan";

import { ToastOptions } from "../types";
import { logErrorToast, logErrorToasts } from "./LogErrorToastSaga";

// IMPORTANT!!! When testing sagas we generally test IMPLEMENTATION details
// and NOT USER BEHAVIOUR.
// In this course we use "redux-saga-test-plan" package which is mostly about
// INTEGRATION testing our sagas. We can assert on different effects being triggered
// BUT we CAN NOT ASSERT ON THE EFFECTS ORDER! For order assertions we have to
// run sagas step-by-step!

// We have to make up some mock data for the test:
// 1) "logErrorToasts" receives an action and destructures
// payload, so we need to have this payload defined (it
// should be of type "ToastOptions"):
const errorToastOptions: ToastOptions = {
  title: "It's time to panic",
  status: "error",
};

// 2) When "watchToasts" watcher saga (1)detects "showToast" action has been dispatched
// somewhere in our app, it (2)catches this whole dispatched action (type + payload)
// and (3)passes it to "logErrorToasts" worker saga (this is how watcher sagas with
// "takeEvery" effect generally work). So we have to prepare the mock action:
const errorToastAction = {
  type: "test",
  payload: errorToastOptions,
};

// now we make up some mock data for NON-ERROR flow
const nonErrorToastOptions: ToastOptions = {
  title: "It's OK!",
  status: "info",
};

const nonErrorToastAction = {
  type: "test",
  payload: nonErrorToastOptions,
};

test("saga calls analytics when it receives error toast action", async () => {
  // We have to use 'await' to make sure 'test' function
  // does not complete before 'expectSaga' finishes
  await expectSaga(logErrorToasts, errorToastAction)
    // next we want to assert that we have a "call" effect running (because
    // this is what happens in the "logErrorToasts" saga when it receives
    // an action with status: "error" in the action payload).
    // to do this we use chaining + name of the effect to check if
    // it was triggered:
    .call(logErrorToast, "It's time to panic")
    // and finally we call a special "run" method to run the saga flow
    .run();
});

test("saga does not call analytics when it receives non-error toast action", async () => {
  await expectSaga(logErrorToasts, nonErrorToastAction)
    // in this case we are testing the flow when we do not have a toast action with error,
    // and we want to assert that "logErrorToast" is NOT CALLED this time. So we
    // can do it 2 slightly different ways:
    // 1) just negating the call from the previous test:
    // .not.call(logErrorToast, "It's OK!")
    // 2) negating the call AND using a "fn" SHORTCUT to make a PARTIAL ASSERTION
    // on "logErrorToast" not being called. Here partial assertion makes sense
    // because we don't really need to pass any arguments for "logErrorToast" to be called with.
    // Why so? Because it should not be called at all in the first place!
    .not.call.fn(logErrorToast)
    .run();
});
