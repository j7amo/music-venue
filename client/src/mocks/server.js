import { setupServer } from "msw/node";

import { handlers } from "./handlers";

// create a request mock server for tests
export const testServer = setupServer(...handlers);
