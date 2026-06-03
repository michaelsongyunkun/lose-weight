import test from "node:test";
import assert from "node:assert/strict";

import {
  COOKING_SYSTEM_PROMPT,
  buildCookingSystemPrompt,
  buildDeepSeekPayload,
  generatePlanWithDeepSeek
} from "../src/server/deepseek-client.mjs";

const profile = {
  days: 3,
  familySize: 2,
  targetCalories: 1500,
  heightCm: 170,
  weightKg: 70,
  goal: "减脂",
  cuisine: "中式",
  allergies: "",
  dislikes: "",
  budget: "每周 300 元",
  prepTime: "每天 30 分钟",
  equipment: "电饭煲",
  pantry: "鸡蛋"
};

test("buildDeepSeekPayload requests JSON output from DeepSeek", () => {
  const payload = buildDeepSeekPayload(profile, "deepseek-v4-flash");

  assert.equal(payload.model, "deepseek-v4-flash");
  assert.equal(payload.response_format.type, "json_object");
  assert.equal(payload.thinking.type, "disabled");
  assert.equal(payload.messages[0].role, "system");
  assert.notEqual(payload.messages[0].content, COOKING_SYSTEM_PROMPT);
  assert.equal(payload.messages[0].content, buildCookingSystemPrompt(profile));
  assert.match(payload.messages[0].content, /中式家庭减脂备餐规划师/);
  assert.match(payload.messages[0].content, /本次用户身体指标/);
  assert.match(payload.messages[0].content, /主用户身高：170 cm/);
  assert.match(payload.messages[0].content, /主用户体重：70 kg/);
  assert.match(payload.messages[0].content, /主用户 BMI：24\.2（偏高）/);
  assert.match(payload.messages[0].content, /主用户每日蛋白目标：84-112 g/);
  assert.match(payload.messages[0].content, /身体指标驱动规则/);
  assert.match(payload.messages[0].content, /菜品制作细节拆解/);
  assert.match(payload.messages[0].content, /steps 至少 5 步/);
  assert.match(payload.messages[0].content, /切配形态、调味比例、锅具或设备、火候、时长、熟成判断/);
  assert.match(payload.messages[0].content, /RAG 食材闭环/);
  assert.match(payload.messages[0].content, /shoppingList\.name 或用户现有食材/);
  assert.match(payload.messages[0].content, /weeklyPlan/);
  assert.match(payload.messages[0].content, /mealPrepGuide/);
  assert.match(payload.messages[0].content, /每个采购食材/);
  assert.match(payload.messages[0].content, /estimatedCost/);
  assert.match(payload.messages[1].content, /只输出 JSON/);
  assert.match(payload.messages[1].content, /主用户 BMI: 24\.2/);
  assert.match(payload.messages[1].content, /steps 至少 5 步/);
  assert.match(payload.messages[1].content, /看到什么状态算完成/);
  assert.equal(payload.max_tokens, 9000);
});

test("generatePlanWithDeepSeek sends bearer key and normalizes model JSON", async () => {
  const calls = [];
  const plan = await generatePlanWithDeepSeek({
    apiKey: "sk-test",
    profile,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: "{\"weeklyPlan\":{\"day1\":{\"breakfast\":{\"name\":\"鸡蛋豆腐燕麦\",\"calories\":430,\"protein\":28,\"ingredients\":[\"鸡蛋2个\",\"豆腐100g\"],\"steps\":[\"洗豆腐\",\"打鸡蛋\",\"煮燕麦\",\"蒸豆腐\",\"分装复热\"]}}},\"shoppingList\":[{\"name\":\"豆腐\",\"amount\":\"400g\",\"estimatedCost\":8}],\"mealPrepGuide\":{\"sundayPrep\":{\"duration\":\"2小时\",\"tasks\":[\"0-30分钟：清洗豆腐\"]},\"weekdayReheat\":{\"lunch\":\"微波炉加热2分钟\"}}}"
                }
              }
            ]
          };
        }
      };
    }
  });

  assert.equal(calls[0].url, "https://api.deepseek.com/chat/completions");
  assert.equal(calls[0].options.headers.Authorization, "Bearer sk-test");
  assert.equal(plan.title, "中式家庭减脂备餐计划");
  assert.equal(plan.days[0].totalProtein, 28);
  assert.equal(plan.shoppingList[0].items[0].display, "豆腐 400g 约 8 元");
  assert.equal(plan.shoppingList[0].items[0].rag.name, "豆腐");
  assert.match(plan.guardrails.at(-1), /采购食材已锚定本地 RAG/);
  assert.equal(plan.batchPrep[0].task, "清洗豆腐");
});

test("generatePlanWithDeepSeek maps invalid API keys to a useful error", async () => {
  await assert.rejects(
    () => generatePlanWithDeepSeek({
      apiKey: "bad",
      profile,
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        async text() {
          return "Unauthorized";
        }
      })
    }),
    /API Key 无效/
  );
});

test("generatePlanWithDeepSeek maps DeepSeek network failures to a useful error", async () => {
  await assert.rejects(
    () => generatePlanWithDeepSeek({
      apiKey: "sk-test",
      profile,
      fetchImpl: async () => {
        const error = new TypeError("fetch failed");
        error.cause = { code: "EACCES" };
        throw error;
      }
    }),
    /无法连接 DeepSeek/
  );
});
