import { rest } from "msw";

import { baseUrl, endpoints } from "../app/axios/constants";
import { bandUrl } from "../features/band/redux/bandApi";
import { showsUrl } from "../features/tickets/redux/showApi";
import { bands, shows } from "../test-utils/fake-data";

// rest.get("some url", (req, res, ctx) => {});
// the basic structure of a mock handler:
// - "get" - HTTP method that we are mocking (can be any viable HTTP method);
// - "some url" - the endpoint that we're making a call to;
// - "(req, res, ctx) => {}" - a response resolver function which has its own structure:
// - "req" - request object;
// - "res" - a function to create a response;
// - "ctx" - a utility to build response.

// sign in and sign up endpoints are basically the same:
// - they require the same request
// - they provide the same response
const authHandler = (req, res, ctx) => {
  const { email } = req.body;

  return res(
    ctx.json({
      user: {
        email,
        id: 123,
        token: "123456",
      },
    })
  );
};

export const handlers = [
  rest.get(showsUrl, (req, res, ctx) => res(ctx.json({ shows }))),
  rest.get(`${bandUrl}/:bandId`, (req, res, ctx) =>
    res(
      ctx.json({
        band: bands.find((item) => item.id === parseInt(req.params.bandId, 10)),
      })
    )
  ),
  rest.get(`${showsUrl}/:showId`, (req, res, ctx) =>
    res(
      ctx.json({
        show: shows.find((item) => item.id === parseInt(req.params.showId, 10)),
      })
    )
  ),
  rest.patch(`${showsUrl}/:showId/hold/:holdId`, (req, res, ctx) =>
    res(ctx.status(200))
  ),
  rest.patch(`${showsUrl}/:showId/release/:holdId`, (req, res, ctx) =>
    res(ctx.status(200))
  ),
  rest.post(`${baseUrl}/${endpoints.signIn}`, authHandler),
  rest.post(`${baseUrl}/${endpoints.signUp}`, authHandler),
];
