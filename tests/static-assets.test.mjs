import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("frontend keeps the core cooking planner form with the output panel", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(html, /id="plannerForm"/);
  assert.match(html, /id="apiKey"/);
  assert.match(html, /id="apiKey"[\s\S]*required/);
  assert.doesNotMatch(html, /id="days"/);
  assert.doesNotMatch(html, /id="heightCm"/);
  assert.doesNotMatch(html, /id="weightKg"/);
  assert.doesNotMatch(html, /id="metricBmi"/);
  assert.match(html, /id="resultPanel"/);
  assert.match(html, /id="planTitle"/);
  assert.match(html, /id="weekView"/);
  assert.match(html, /id="shoppingView"/);
  assert.match(html, /id="prepView"/);
  assert.match(html, /id="copyButton"[\s\S]*disabled/);
  assert.match(html, /id="downloadButton"[\s\S]*disabled/);
  assert.match(app, /deepseekApiKey/);
  assert.match(app, /\/api\/plan/);
  assert.match(app, /days:\s*7/);
  assert.doesNotMatch(app, /data\.get\("days"\)/);
  assert.doesNotMatch(app, /heightCm:\s*Number\(data\.get\("heightCm"\)\)/);
  assert.doesNotMatch(app, /weightKg:\s*Number\(data\.get\("weightKg"\)\)/);
  assert.doesNotMatch(app, /updateBmi/);
});

test("sidebar menu keeps home first, planning second, and menu library third", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const homeScreenIndex = html.indexOf('id="homeScreen"');
  const plannerScreenIndex = html.indexOf('id="plannerScreen"');
  const menuLibraryScreenIndex = html.indexOf('id="menuLibraryScreen"');
  const menuIndex = html.indexOf('class="side-menu"');
  const firstMenuItemIndex = html.indexOf('data-screen="homeScreen"');
  const planningMenuItemIndex = html.indexOf('data-screen="plannerScreen"');
  const menuLibraryItemIndex = html.indexOf('data-screen="menuLibraryScreen"');

  assert.ok(homeScreenIndex >= 0, "home screen exists");
  assert.ok(plannerScreenIndex >= 0, "planning screen exists");
  assert.ok(menuLibraryScreenIndex >= 0, "menu library screen exists");
  assert.ok(menuIndex >= 0, "left menu exists");
  assert.ok(firstMenuItemIndex > menuIndex, "home menu item exists");
  assert.ok(planningMenuItemIndex > firstMenuItemIndex, "planning menu follows home");
  assert.ok(menuLibraryItemIndex > planningMenuItemIndex, "menu library follows planning");
  assert.match(html, /<strong>产品首页<\/strong>/);
  assert.match(html, /<strong>规划<\/strong>/);
  assert.match(html, /<strong>菜单大全<\/strong>/);
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
  assert.match(css, /\.menu-library-screen/);
  assert.match(app, /menuLibraryScreen/);
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

test("menu library screen loads the recipe RAG index", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const rag = JSON.parse(await readFile(new URL("../public/data/menu-library-rag.json", import.meta.url), "utf8"));

  assert.equal(rag.itemCount, 3008);
  assert.equal(rag.items[0].name, "火鸡肉西兰花小炒");
  assert.ok(rag.facets.topIngredients.includes("盐"));
  assert.equal(rag.calorieEstimateSource, "源食材可做菜品3000+道_热量估算.txt");
  assert.equal(rag.calorieEstimateMatchedCount, 3008);
  assert.equal(rag.items[0].calorieEstimate.totalKcal, 420);
  assert.equal(rag.items[0].calorieEstimate.perServingKcal, 210);
  assert.match(rag.items[0].calorieEstimate.text, /火鸡肉180g≈243大卡/);
  const tofuRecipe = rag.items.find((item) => item.name === "豆腐西兰花小炒");
  assert.equal(tofuRecipe.calorieEstimate.totalKcal, 310);
  assert.equal(tofuRecipe.calorieEstimate.perServingKcal, 155);
  assert.match(html, /id="menuLibraryScreen"/);
  assert.match(html, /id="menuRecipeGrid"/);
  assert.match(html, /id="menuSearchInput"/);
  assert.match(app, /MENU_LIBRARY_URL/);
  assert.match(app, /function renderMenuLibrary/);
  assert.match(app, /data-menu-ingredient/);
  assert.match(app, /renderRecipeCalories/);
  assert.match(css, /\.recipe-grid/);
  assert.match(css, /\.recipe-card/);
});

test("sidebar menu exposes ingredient nutrition as the fourth RAG screen", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const rag = JSON.parse(await readFile(new URL("../public/data/ingredient-nutrition-rag.json", import.meta.url), "utf8"));
  const menuLibraryItemIndex = html.indexOf('data-screen="menuLibraryScreen"');
  const nutritionItemIndex = html.indexOf('data-screen="ingredientNutritionScreen"');

  assert.equal(rag.itemCount, 13693);
  assert.ok(nutritionItemIndex > menuLibraryItemIndex, "ingredient nutrition follows menu library");
  assert.match(html, /<span>04<\/span>[\s\S]*<strong>食材营养<\/strong>/);
  assert.match(html, /id="ingredientNutritionScreen"/);
  assert.match(html, /id="ingredientNutritionGrid"/);
  assert.match(html, /id="ingredientNutritionSearchInput"/);
  assert.match(app, /NUTRITION_INDEX_URL/);
  assert.match(app, /function renderIngredientNutrition/);
  assert.match(css, /\.ingredient-nutrition-screen/);
  assert.match(css, /\.nutrition-food-grid/);
});

test("menu library does not expose source file or FDC match rows", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.doesNotMatch(html, /id="menuLibrarySource"/);
  assert.doesNotMatch(app, /menuLibrarySource/);
  assert.doesNotMatch(app, /index\.source/);
  assert.doesNotMatch(app, /fdcLine/);
  assert.doesNotMatch(app, /recipe-fdc/);
  assert.doesNotMatch(css, /\.recipe-fdc/);
});

test("shopping nutrition renderer only shows purchase-level totals", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const renderer = app.match(/function renderNutritionResult[\s\S]*?(?=\n\nfunction renderNutrientValue)/);

  assert.ok(renderer, "renderNutritionResult exists");
  assert.match(renderer[0], /renderTotalNutrition/);
  assert.doesNotMatch(renderer[0], /sourceLabel/);
  assert.doesNotMatch(renderer[0], /nutrition-card-head/);
  assert.doesNotMatch(renderer[0], /nutrition-values/);
  assert.doesNotMatch(renderer[0], /nutrition-alternatives/);
  assert.doesNotMatch(renderer[0], /RAG/);
});

test("planning screen keeps the DeepSeek agent panel but hides the system prompt", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const formIndex = html.indexOf('id="plannerForm"');
  const agentIndex = html.indexOf('id="cookingAgentPanel"');

  assert.ok(agentIndex > formIndex, "agent panel follows the planning form");
  assert.doesNotMatch(html, /id="agentPromptPreview"/);
  assert.doesNotMatch(html, /System Prompt/);
  assert.match(html, /DeepSeek/);
  assert.match(html, /API Key 由用户提供/);
  assert.match(app, /\/api\/agent/);
  assert.doesNotMatch(app, /agentPromptPreview/);
  assert.doesNotMatch(app, /agent\.systemPrompt/);
  assert.doesNotMatch(app, /system prompt/i);
  assert.match(css, /\.agent-panel/);
});
