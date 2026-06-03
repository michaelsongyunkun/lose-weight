import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("frontend keeps the core cooking planner form with the output panel", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(html, /id="plannerForm"/);
  assert.match(html, /id="apiKey"/);
  assert.match(html, /id="apiKey"[\s\S]*required/);
  assert.match(html, /id="heightCm"/);
  assert.match(html, /id="weightKg"/);
  assert.match(html, /id="metricBmi"/);
  assert.match(html, /id="resultPanel"/);
  assert.match(html, /id="planTitle"/);
  assert.match(html, /id="weekView"/);
  assert.match(html, /id="shoppingView"/);
  assert.match(html, /id="prepView"/);
  assert.match(html, /id="copyButton"[\s\S]*disabled/);
  assert.match(html, /id="downloadButton"[\s\S]*disabled/);
  assert.match(app, /deepseekApiKey/);
  assert.match(app, /\/api\/plan/);
  assert.match(app, /heightCm:\s*Number\(data\.get\("heightCm"\)\)/);
  assert.match(app, /weightKg:\s*Number\(data\.get\("weightKg"\)\)/);
  assert.match(app, /updateBmi/);
});

test("sidebar menu keeps home first and planning second", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const homeScreenIndex = html.indexOf('id="homeScreen"');
  const plannerScreenIndex = html.indexOf('id="plannerScreen"');
  const menuIndex = html.indexOf('class="side-menu"');
  const firstMenuItemIndex = html.indexOf('data-screen="homeScreen"');
  const planningMenuItemIndex = html.indexOf('data-screen="plannerScreen"');

  assert.ok(homeScreenIndex >= 0, "home screen exists");
  assert.ok(plannerScreenIndex >= 0, "planning screen exists");
  assert.ok(menuIndex >= 0, "left menu exists");
  assert.ok(firstMenuItemIndex > menuIndex, "home menu item exists");
  assert.ok(planningMenuItemIndex > firstMenuItemIndex, "planning menu follows home");
  assert.match(html, /<strong>产品首页<\/strong>/);
  assert.match(html, /<strong>规划<\/strong>/);
  assert.doesNotMatch(html, /<strong>目标与厨房约束<\/strong>[\s\S]*<\/nav>/);
  assert.doesNotMatch(html, /<strong>周计划与采购<\/strong>[\s\S]*<\/nav>/);
  assert.match(html, /目标与厨房约束/);
  assert.doesNotMatch(html, /周计划与采购/);
  assert.doesNotMatch(html, /中式家庭减脂备餐/);
  assert.match(app, /function switchScreen/);
  assert.match(app, /data-screen/);
  assert.match(css, /\.app-screen/);
  assert.match(css, /\.app-screen\.active/);
  assert.match(css, /\.side-menu/);
});

test("product home screen introduction content is blank", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const homeMatch = html.match(/<section class="app-screen home-screen active" id="homeScreen"[^>]*>([\s\S]*?)<\/section>/);

  assert.ok(homeMatch, "home screen exists");
  assert.equal(homeMatch[1].trim(), "");
  assert.doesNotMatch(html, /class="home-copy"/);
  assert.doesNotMatch(html, /class="home-proof"/);
  assert.doesNotMatch(html, /home-lede/);
});

test("generation requires a user supplied API key and exposes no demo entry", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.doesNotMatch(html, /无 Key 演示/);
  assert.doesNotMatch(html, /Demo ready/);
  assert.doesNotMatch(html, /不填 Key 也可以生成本地演示计划/);
  assert.doesNotMatch(html, /id="demoButton"/);
  assert.doesNotMatch(app, /demoButton/);
  assert.doesNotMatch(app, /forceDemo/);
  assert.doesNotMatch(app, /Demo plan/);
  assert.match(app, /请输入 DeepSeek API Key/);
  assert.match(app, /本地服务未连接/);
  assert.match(app, /LOCAL_APP_ORIGIN/);
  assert.match(app, /LOCAL_APP_ORIGINS/);
  assert.match(app, /function appUrl/);
  assert.match(app, /LOCAL_APP_ORIGINS\.has\(location\.origin\)/);
  assert.match(app, /location\.protocol === "file:"/);
  assert.match(app, /function isLocalHost/);
  assert.match(app, /`\$\{LOCAL_APP_ORIGIN\}\$\{path\}`/);
  assert.match(app, /return path;/);
});

test("planner screen keeps output views below the agent panel", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const plannerStart = html.indexOf('<section class="app-screen planner-screen" id="plannerScreen"');
  const formIndex = html.indexOf('id="plannerForm"');
  const agentIndex = html.indexOf('id="cookingAgentPanel"');
  const resultIndex = html.indexOf('id="resultPanel"');
  const plannerEnd = html.indexOf("</section>", plannerStart);

  assert.ok(plannerStart >= 0, "planner panel exists");
  assert.ok(formIndex > plannerStart, "form is inside planner panel");
  assert.ok(formIndex < plannerEnd, "form remains inside planner panel");
  assert.ok(agentIndex > formIndex, "agent panel follows form");
  assert.ok(resultIndex > agentIndex, "output panel follows agent panel");
  assert.match(html, /role="tablist"/);
  assert.match(html, /data-view="week"/);
  assert.match(html, /data-view="shopping"/);
  assert.match(html, /data-view="prep"/);
  assert.match(app, /copyButton\?\.addEventListener/);
  assert.match(app, /downloadButton\?\.addEventListener/);
  assert.match(app, /setAttribute\("aria-selected", "true"\)/);
});

test("nutrition RAG data remains available inside the shopping output view", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const rag = JSON.parse(await readFile(new URL("../public/data/ingredient-nutrition-rag.json", import.meta.url), "utf8"));

  assert.equal(rag.itemCount, 13693);
  assert.ok(rag.items.some((item) => item.englishName && item.nutrients?.energyKcal));
  assert.match(html, /id="shoppingView"/);
  assert.match(app, /class="shopping-item-trigger"/);
});

test("planning screen includes the DeepSeek agent panel below the form", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const formIndex = html.indexOf('id="plannerForm"');
  const agentIndex = html.indexOf('id="cookingAgentPanel"');

  assert.ok(agentIndex > formIndex, "agent panel follows the planning form");
  assert.match(html, /id="agentPromptPreview"/);
  assert.match(html, /DeepSeek/);
  assert.match(html, /API Key 由用户提供/);
  assert.match(app, /\/api\/agent/);
  assert.match(app, /agent\.systemPrompt/);
  assert.match(css, /\.agent-panel/);
});
