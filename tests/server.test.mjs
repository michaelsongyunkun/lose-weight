import test from "node:test";
import assert from "node:assert/strict";

import { createCookingCoachServer } from "../server.mjs";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

test("GET /api/health returns ok", async () => {
  const server = createCookingCoachServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
  } finally {
    server.close();
  }
});

test("GET /api/agent returns the DeepSeek cooking agent prompt", async () => {
  const server = createCookingCoachServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/agent`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.provider, "DeepSeek");
    assert.equal(body.apiKeyPolicy, "user_provided");
    assert.equal(body.apiKeyRequired, true);
    assert.match(body.systemPrompt, /# 中式家庭减脂备餐规划师/);
  } finally {
    server.close();
  }
});

test("local server allows file-opened frontend requests", async () => {
  const server = createCookingCoachServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/plan`, {
      method: "OPTIONS",
      headers: {
        Origin: "null",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
      }
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "null");
    assert.match(response.headers.get("access-control-allow-methods") || "", /POST/);
    assert.match(response.headers.get("access-control-allow-headers") || "", /Content-Type/);
  } finally {
    server.close();
  }
});

test("local server allows frontend requests from other localhost ports", async () => {
  const server = createCookingCoachServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/plan`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:5500",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
      }
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:5500");
    assert.match(response.headers.get("access-control-allow-methods") || "", /POST/);
  } finally {
    server.close();
  }
});

test("POST /api/plan requires an API key", async () => {
  const server = createCookingCoachServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: { days: 3, familySize: 2, targetCalories: 1500 }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /DeepSeek API Key/);
    assert.equal(body.mode, undefined);
    assert.equal(body.plan, undefined);
  } finally {
    server.close();
  }
});

test("POST /api/plan rejects malformed JSON without stopping the local server", async () => {
  const server = createCookingCoachServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json"
    });
    const body = await response.json();
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const health = await healthResponse.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /JSON/);
    assert.equal(healthResponse.status, 200);
    assert.equal(health.ok, true);
  } finally {
    server.close();
  }
});

test("POST /api/plan maps DeepSeek failures without stopping the local server", async () => {
  const server = createCookingCoachServer({
    fetchImpl: async () => {
      throw new Error("network down");
    }
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "sk-test",
        model: "deepseek-v4-flash",
        profile: { days: 3, familySize: 2, targetCalories: 1500 }
      })
    });
    const body = await response.json();
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const health = await healthResponse.json();

    assert.equal(response.status, 502);
    assert.match(body.error, /DeepSeek/);
    assert.equal(healthResponse.status, 200);
    assert.equal(health.ok, true);
  } finally {
    server.close();
  }
});

test("GET /data/ingredient-nutrition-rag.json serves the nutrition RAG index", async () => {
  const server = createCookingCoachServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/data/ingredient-nutrition-rag.json`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.itemCount, 13693);
    assert.equal(body.servingBasis, "每 1g 食材约含量");
  } finally {
    server.close();
  }
});

test("POST /api/plan proxies to DeepSeek when API key is supplied", async () => {
  const server = createCookingCoachServer({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [
            {
              message: {
                content: "{\"title\":\"接口计划\",\"days\":[{\"day\":\"第 1 天\",\"meals\":[{\"name\":\"鸡蛋豆腐饭\",\"calories\":500,\"protein\":32,\"steps\":[\"蒸豆腐\"]}]}],\"shoppingList\":[],\"batchPrep\":[]}"
              }
            }
          ]
        };
      }
    })
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "sk-test",
        model: "deepseek-v4-flash",
        profile: { days: 3, familySize: 2, targetCalories: 1500 }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.mode, "live");
    assert.equal(body.plan.title, "接口计划");
  } finally {
    server.close();
  }
});
