import {
  render as rtlRender,
  RenderOptions,
  RenderResult,
} from "@testing-library/react";
import { createMemoryHistory, MemoryHistory } from "history";
import React from "react";
import { Provider } from "react-redux";
import { Router } from "react-router";

import { configureStoreWithMiddlewares, RootState } from "../app/store";

// In order to test Redux & React Router in our apps we need to have our components
// wrapped by:
// - <Provider /> component of Redux(so components can access the STORE);
// - <Router /> component of React Router(so components have access to HISTORY and LOCATION)
// For this we have 2 main APPROACHES to take:
// I) We put all these wrappers inside <App /> component and just render <App /> component
// everytime we need to test something.
// PROS:
// - no additional test setup needed;
// - closer to production code;
// CONS:
// - no control over initial state for a specific component;
// - can not render child components separately;
// - tests will be slower because we need to render the whole <App /> for every test
// II) We put all these wrappers inside index.tsx and wrap <App /> component with them.
// We then create a custom "render" function that will wrap any child component we want to test
// with all the needed providers.
// PROS:
// - full control over initial state of the component;
// - can render child components;
// - faster tests;
// CONS:
// - more complicated test setup (we need to create custom "render" function and create new store for every test)
// - further from production code;

// So... We'll take the 2nd approach here.

// we specify our custom render options type(they are mostly the same but have some differences):
type CustomRenderOptions = {
  // we upgrade native "RenderOptions" of RTL with
  // 1) Initial state from Redux store
  preloadedState?: RootState;
  // 2) Array of history routes
  routeHistory?: Array<string>;
  // 3) Starting route index to specify if we want our test start at the specific route of the route array
  initialRouteIndex?: number;
  // 4) We remove the built-in "wrapper" type to substitute it with our own wrapper later
  renderOptions?: Omit<RenderOptions, "wrapper">;
};

// we specify custom return type which we need to do because we return now not only
// "RenderResult" but also a "memoryHistory" field to be able to assert on history in our tests:
type CustomRenderResult = RenderResult & { memoryHistory: MemoryHistory };

// React Testing Library "render" function accepts 2 arguments:
// - ui (JSX to render);
// - render options.
// So we basically want to mimic the original function BUT:
// - add wrappers (providers);
function render(
  ui: React.ReactElement,
  {
    preloadedState = {},
    routeHistory,
    initialRouteIndex,
    ...renderOptions
  }: CustomRenderOptions = {}
): CustomRenderResult {
  // this is where we define "memoryHistory" (we choose it because we do not want to interact
  // with the browser when we interact with "history" during tests)
  const memoryHistory = createMemoryHistory({
    initialEntries: routeHistory,
    initialIndex: initialRouteIndex,
  });
  // we define "<Wrapper />" component to accept "children" and just wrap them with providers
  const Wrapper: React.FC = ({ children }) => {
    // this is where our test Redux store is defined with mocked state
    const store = configureStoreWithMiddlewares(preloadedState);

    return (
      <Provider store={store}>
        <Router history={memoryHistory}>{children}</Router>
      </Provider>
    );
  };

  // here we use built-in "render" function of RTL with the addition of our <Wrapper />
  const rtlRenderObject = rtlRender(ui, { wrapper: Wrapper, ...renderOptions });

  // in addition to what's returned by default by native "render" method of RTL,
  // we also return history to make assertions on it in the tests
  return {
    ...rtlRenderObject,
    memoryHistory,
  };
}

// we re-export everything from RTL
export * from "@testing-library/react";
// and overwrite built-in "render" with our own implementation,
// so that we can just import everything we need for our tests from this file
export { render };
