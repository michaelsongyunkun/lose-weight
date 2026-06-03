import test from "node:test";
import assert from "node:assert/strict";

import healthHandler from "../api/health.js";
import { createPlanHandler } from "../api/plan.js";

function createResponse() {
  return {
    headers: new Map(),
    statusCode: 0,
    payload: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
}

test("Vercel GET /api/health returns ok", () => {
  const response = createResponse();

  healthHandler({ method: "GET", headers: {} }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ok, true);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("Vercel POST /api/plan requires an API key", async () => {
  const response = createResponse();
  const handler = createPlanHandler({
    fetchImpl: async () => {
      throw new Error("fetch should not run");
    }
  });

  await handler({
    method: "POST",
    headers: {},
    body: { profile: { days: 3, familySize: 2, targetCalories: 1500 } }
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.error, /DeepSeek API Key/);
});

test("Vercel POST /api/plan proxies to DeepSeek when API key is supplied", async () => {
  const response = createResponse();
  const handler = createPlanHandler({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Vercel plan",
                  weeklyPlan: {
                    day1: {
                      breakfast: {
                        name: "Serverless breakfast",
                        ingredients: [],
                        steps: ["Wash ingredients", "Cook gently", "Plate"],
                        calories: 320,
                        protein: 24
                      }
                    }
                  },
                  shoppingList: [],
                  mealPrepGuide: {
                    sundayPrep: { duration: "1 hour", tasks: [] },
                    weekdayReheat: {}
                  }
                })
              }
            }
          ]
        };
      }
    })
  });

  await handler({
    method: "POST",
    headers: {},
    body: {
      apiKey: "sk-test",
      model: "deepseek-v4-flash",
      profile: { days: 3, familySize: 2, targetCalories: 1500 }
    }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.mode, "live");
  assert.equal(response.payload.plan.title, "Vercel plan");
});

test("Vercel OPTIONS /api/plan supports local preflight", async () => {
  const response = createResponse();
  const handler = createPlanHandler();

  await handler({
    method: "OPTIONS",
    headers: {
      origin: "http://127.0.0.1:5500"
    }
  }, response);

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:5500");
  assert.match(response.headers.get("access-control-allow-methods"), /POST/);
});
