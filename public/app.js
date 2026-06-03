const STORAGE_KEY = "deepseekApiKey";
const LOCAL_APP_ORIGIN = "http://127.0.0.1:4317";
const LOCAL_APP_ORIGINS = new Set([LOCAL_APP_ORIGIN, "http://localhost:4317"]);
const NUTRITION_INDEX_URL = appUrl("/data/ingredient-nutrition-rag.json");
const NUTRIENT_DISPLAY_FIELDS = [
  ["energyKcal", "能量"],
  ["proteinG", "蛋白"],
  ["fatG", "脂肪"],
  ["carbsG", "碳水"],
  ["fiberG", "纤维"],
  ["sodiumMg", "钠"]
];
const NUTRITION_QUERY_ALIASES = [
  { names: ["鸡胸肉"], terms: ["chicken breast"], prefer: ["breast", "roasted", "meat only"], avoid: ["fried", "batter", "flour", "sandwich"] },
  { names: ["鸡腿"], terms: ["chicken leg"], prefer: ["leg", "roasted"], avoid: ["fried", "batter", "sandwich"] },
  { names: ["鸡肉"], terms: ["chicken"], prefer: ["broilers", "roasted"], avoid: ["sandwich", "soup", "fried"] },
  { names: ["虾仁", "虾"], terms: ["shrimp"], prefer: ["raw"], avoid: ["fried", "applebee", "denny", "restaurant", "platter"] },
  { names: ["三文鱼", "鲑鱼"], terms: ["salmon"], prefer: ["raw"], avoid: ["oil", "sandwich"] },
  { names: ["鲈鱼", "鱼肉", "鱼"], terms: ["fish"], prefer: ["raw"], avoid: ["oil", "sandwich", "soup"] },
  { names: ["瘦牛肉", "牛肉"], terms: ["beef"], prefer: ["lean", "roast", "fresh"], avoid: ["sandwich", "soup", "gravy"] },
  { names: ["瘦猪肉", "猪肉"], terms: ["pork"], prefer: ["loin", "fresh"], avoid: ["gravy", "sausage", "sandwich"] },
  { names: ["鸡蛋", "蛋"], terms: ["egg"], prefer: ["eggs"], avoid: ["sandwich", "noodles", "babyfood"] },
  { names: ["糙米"], terms: ["brown rice"], prefer: ["dry", "cereal"], avoid: ["biscuit", "babyfood"] },
  { names: ["米饭", "大米", "米"], terms: ["rice"], prefer: ["cooked", "dry"], avoid: ["biscuit", "babyfood"] },
  { names: ["燕麦"], terms: ["oats"], prefer: ["oats"], avoid: ["honey", "bunches", "cereal ready-to-eat"] },
  { names: ["全麦吐司", "吐司", "面包"], terms: ["bread"], prefer: ["whole-wheat"], avoid: ["sweet", "cake"] },
  { names: ["红薯", "地瓜"], terms: ["sweet potatoes"], prefer: ["sweet potatoes"], avoid: ["babyfood"] },
  { names: ["土豆", "马铃薯"], terms: ["potato"], prefer: ["potato"], avoid: ["chips"] },
  { names: ["西兰花"], terms: ["broccoli"], prefer: ["broccoli"], avoid: ["sandwich", "hot pockets"] },
  { names: ["番茄", "西红柿"], terms: ["tomato"], prefer: ["tomato"], avoid: ["soup", "sauce"] },
  { names: ["菠菜"], terms: ["spinach"], prefer: ["spinach"], avoid: ["noodles"] },
  { names: ["黄瓜"], terms: ["cucumber"], prefer: ["cucumber"], avoid: ["pickle"] },
  { names: ["胡萝卜"], terms: ["carrots"], prefer: ["carrots"], avoid: ["babyfood"] },
  { names: ["洋葱"], terms: ["onion"], prefer: ["onion"], avoid: ["rings"] },
  { names: ["白菜", "卷心菜"], terms: ["cabbage"], prefer: ["cabbage"], avoid: ["soup"] },
  { names: ["蘑菇", "香菇", "菌菇"], terms: ["mushroom"], prefer: ["mushroom"], avoid: ["soup"] },
  { names: ["豆腐"], terms: ["tofu soybean"], prefer: ["soy"], avoid: ["margarine", "oil"] },
  { names: ["豆浆"], terms: ["soy milk"], prefer: ["soy"], avoid: ["infant"] },
  { names: ["低钠酱油", "酱油"], terms: ["soy sauce"], prefer: ["soy sauce"], avoid: ["margarine"] },
  { names: ["橄榄油"], terms: ["olive oil"], prefer: ["olive"], avoid: ["spread"] },
  { names: ["醋"], terms: ["vinegar"], prefer: ["vinegar"], avoid: ["sauce"] },
  { names: ["黑胡椒", "胡椒"], terms: ["pepper"], prefer: ["pepper"], avoid: ["sauce"] }
];

const form = document.querySelector("#plannerForm");
const apiKeyInput = document.querySelector("#apiKey");
const rememberKeyInput = document.querySelector("#rememberKey");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const statusBanner = document.querySelector("#statusBanner");
const planTitle = document.querySelector("#planTitle");
const weekView = document.querySelector("#weekView");
const shoppingView = document.querySelector("#shoppingView");
const prepView = document.querySelector("#prepView");
const appScreens = document.querySelectorAll(".app-screen");
const screenControls = document.querySelectorAll("[data-screen]");
const menuButtons = document.querySelectorAll(".side-menu-link");
const agentPromptPreview = document.querySelector("#agentPromptPreview");
const agentTitle = document.querySelector("#agentTitle");
const agentProvider = document.querySelector("#agentProvider");
const agentKeyPolicy = document.querySelector("#agentKeyPolicy");
const agentModelPolicy = document.querySelector("#agentModelPolicy");

let currentPlan = null;
let currentMarkdown = "";
let currentSvg = "";
let nutritionIndex = null;
let nutritionIndexPromise = null;

apiKeyInput.value = localStorage.getItem(STORAGE_KEY) || "";
renderEmpty();
bindMetricMirrors();
bindScreenNavigation();
loadNutritionIndex().catch(() => {});
loadAgentPanel().catch(() => {
  if (agentPromptPreview) {
    agentPromptPreview.textContent = "Agent system prompt 暂时无法加载。";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await requestPlan();
});

copyButton?.addEventListener("click", async () => {
  if (!currentMarkdown) return;
  await navigator.clipboard.writeText(currentMarkdown);
  setStatus("Copied", "Markdown 已复制。", "loading");
  setTimeout(() => setStatus("Ready", "结果可以继续调整。"), 1200);
});

downloadButton?.addEventListener("click", () => {
  if (!currentSvg) return;
  const blob = new Blob([currentSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ai-cooking-plan.svg";
  anchor.click();
  URL.revokeObjectURL(url);
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.remove("active");
      tab.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    button.setAttribute("aria-selected", "true");
    document.querySelector(`#${button.dataset.view}View`)?.classList.add("active");
  });
});

shoppingView?.addEventListener("click", handleShoppingNutritionClick);

function bindScreenNavigation() {
  screenControls.forEach((button) => {
    button.addEventListener("click", () => {
      switchScreen(button.dataset.screen);
    });
  });
}

function switchScreen(screenId) {
  appScreens.forEach((screen) => {
    const isActive = screen.id === screenId;
    screen.classList.toggle("active", isActive);
    screen.hidden = !isActive;
  });

  menuButtons.forEach((button) => {
    const isActive = button.dataset.screen === screenId;
    button.classList.toggle("active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

async function requestPlan() {
  const profile = collectProfile();
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    setStatus("API Key required", "请输入 DeepSeek API Key 后再生成备餐计划。", "error");
    apiKeyInput.focus();
    return;
  }

  if (rememberKeyInput.checked && apiKey) {
    localStorage.setItem(STORAGE_KEY, apiKey);
  } else if (!rememberKeyInput.checked) {
    localStorage.removeItem(STORAGE_KEY);
  }

  setLoading(true);
  setStatus("Planning", "正在请求 DeepSeek。", "loading");

  try {
    const response = await fetch(appUrl("/api/plan"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        model: document.querySelector("#model").value,
        profile
      })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "生成失败");
    }
    currentPlan = body.plan;
    currentMarkdown = toMarkdown(currentPlan);
    currentSvg = toSvg(currentPlan);
    renderPlan(currentPlan);
    setStatus("DeepSeek plan", currentPlan.summary || "计划已生成。");
  } catch (error) {
    setStatus("Error", formatRequestError(error), "error");
  } finally {
    setLoading(false);
  }
}

function appUrl(path) {
  if (LOCAL_APP_ORIGINS.has(location.origin)) {
    return path;
  }
  if (location.protocol === "file:" || isLocalHost(location.hostname)) {
    return `${LOCAL_APP_ORIGIN}${path}`;
  }
  return path;
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function loadAgentPanel() {
  if (!agentPromptPreview) return;
  const response = await fetch(appUrl("/api/agent"));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const agent = await response.json();
  if (agentTitle && agent.name) {
    agentTitle.textContent = agent.name;
  }
  agentPromptPreview.textContent = agent.systemPrompt || "";
  if (agentProvider) {
    agentProvider.textContent = agent.provider || "DeepSeek";
  }
  if (agentKeyPolicy) {
    agentKeyPolicy.textContent = agent.apiKeyRequired
      ? "API Key 由用户提供"
      : "API Key 未启用";
  }
  if (agentModelPolicy && Array.isArray(agent.modelOptions)) {
    agentModelPolicy.textContent = agent.modelOptions.join(" / ");
  }
}

function formatRequestError(error) {
  const message = String(error?.message || error || "生成失败");
  if (/failed to fetch|load failed|networkerror/i.test(message)) {
    return "本地服务未连接。请先运行 start-ai-cooking-coach.cmd；如果你是直接打开 HTML 文件，也可以保持服务运行后继续使用当前页面。";
  }
  return message;
}

function collectProfile() {
  const data = new FormData(form);
  return {
    days: Number(data.get("days")),
    familySize: Number(data.get("familySize")),
    targetCalories: Number(data.get("targetCalories")),
    heightCm: Number(data.get("heightCm")),
    weightKg: Number(data.get("weightKg")),
    goal: data.get("goal"),
    cuisine: data.get("cuisine"),
    allergies: data.get("allergies"),
    dislikes: data.get("dislikes"),
    budget: data.get("budget"),
    prepTime: data.get("prepTime"),
    equipment: data.get("equipment"),
    pantry: data.get("pantry")
  };
}

function renderEmpty() {
  if (!weekView || !shoppingView || !prepView) return;
  weekView.innerHTML = `<div class="empty-state"><div><h3>等待生成</h3><p>周计划会显示在这里。</p></div></div>`;
  shoppingView.innerHTML = `<div class="empty-state"><div><h3>等待生成</h3><p>采购清单会显示在这里。</p></div></div>`;
  prepView.innerHTML = `<div class="empty-state"><div><h3>等待生成</h3><p>备餐流程会显示在这里。</p></div></div>`;
}

function renderPlan(plan) {
  if (!planTitle || !weekView || !shoppingView || !prepView) return;
  planTitle.textContent = plan.title;
  if (copyButton) copyButton.disabled = false;
  if (downloadButton) downloadButton.disabled = false;

  weekView.innerHTML = `<div class="day-grid">${plan.days.map(renderDay).join("")}</div>${renderGuardrails(plan)}`;
  shoppingView.innerHTML = `<div class="shopping-grid">${plan.shoppingList.map(renderShoppingGroup).join("")}</div>`;
  prepView.innerHTML = `<div class="prep-list">${plan.batchPrep.map(renderPrep).join("")}</div>${renderGuardrails(plan)}`;
}

function renderDay(day) {
  return `
    <article class="day-card">
      <div class="day-head">
        <div>
          <strong>${escapeHtml(day.day)}</strong>
          <span>${escapeHtml(day.theme)}</span>
        </div>
        <div>${day.totalCalories} kcal / ${day.totalProtein}g protein</div>
      </div>
      <div class="meal-list">
        ${day.meals.map(renderMeal).join("")}
      </div>
    </article>
  `;
}

function renderMeal(meal) {
  return `
    <article class="meal-card">
      <div class="meal-card-head">
        <div class="slot-pill">${escapeHtml(meal.slot)}</div>
        <h3>${escapeHtml(meal.name)}</h3>
      </div>
      <div class="meal-meta">
        <span class="nutrition-chip"><strong>${meal.calories}</strong> kcal</span>
        <span class="nutrition-chip"><strong>${meal.protein}</strong> g 蛋白</span>
        <span class="nutrition-chip">${escapeHtml(meal.time)}</span>
      </div>
      <p class="meal-summary">${escapeHtml(meal.leftovers)}</p>
      <p class="ingredient-line">${meal.ingredients.slice(0, 4).map(escapeHtml).join(" / ")}</p>
      <ul class="meal-steps">${meal.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>
    </article>
  `;
}

function renderShoppingGroup(group, groupIndex) {
  return `
    <article class="list-card">
      <h3>${escapeHtml(group.category)}</h3>
      <ul class="shopping-list">
        ${group.items.map((item, itemIndex) => renderShoppingItem(item, groupIndex, itemIndex)).join("")}
      </ul>
    </article>
  `;
}

function renderShoppingItem(item, groupIndex, itemIndex) {
  const panelId = `nutrition-${groupIndex}-${itemIndex}`;
  return `
    <li class="shopping-item">
      <button class="shopping-item-trigger" type="button" data-shopping-group="${groupIndex}" data-shopping-item="${itemIndex}" aria-expanded="false" aria-controls="${panelId}">
        <span>${escapeHtml(shoppingItemDisplay(item))}</span>
        <small>营养</small>
      </button>
      <div class="nutrition-panel" id="${panelId}" hidden></div>
    </li>
  `;
}

function renderPrep(item) {
  return `
    <article class="prep-card">
      <strong>${escapeHtml(item.time)}</strong>
      <span>${escapeHtml(item.task)}</span>
      <small>${escapeHtml(item.duration)}</small>
    </article>
  `;
}

function renderGuardrails(plan) {
  if (!plan.guardrails?.length) return "";
  return `
    <aside class="guardrail-card">
      <h3>营养边界</h3>
      <ul>${plan.guardrails.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </aside>
  `;
}

function toMarkdown(plan) {
  const lines = [`# ${plan.title}`, "", plan.summary || "", ""];
  for (const day of plan.days) {
    lines.push(`## ${day.day} - ${day.theme}`);
    lines.push(`总计：${day.totalCalories} kcal / ${day.totalProtein}g 蛋白`, "");
    for (const meal of day.meals) {
      lines.push(`### ${meal.slot}：${meal.name}`);
      lines.push(`- 热量：${meal.calories} kcal`);
      lines.push(`- 蛋白：${meal.protein}g`);
      lines.push(`- 时间：${meal.time}`);
      lines.push(`- 保存：${meal.leftovers}`);
      lines.push(`- 食材：${meal.ingredients.join("，") || "按需准备"}`);
      lines.push(`- 做法：${meal.steps.join("；") || "按常规少油烹调"}`, "");
    }
  }
  lines.push("## 采购清单");
  for (const group of plan.shoppingList) {
    lines.push(`- ${group.category}: ${group.items.map(shoppingItemDisplay).join("，")}`);
  }
  lines.push("", "## 备餐流程");
  for (const item of plan.batchPrep) {
    lines.push(`- ${item.time}: ${item.task} (${item.duration})`);
  }
  lines.push("", "## 营养边界");
  for (const item of plan.guardrails) {
    lines.push(`- ${item}`);
  }
  return lines.join("\n");
}

function toSvg(plan) {
  const width = 1400;
  const margin = 56;
  const cardWidth = width - margin * 2;
  const nodes = [];
  let y = 72;

  nodes.push(`<rect width="${width}" height="__HEIGHT__" fill="#f7f4ee"/>`);
  nodes.push(`<rect x="24" y="24" width="${width - 48}" height="__INNER_HEIGHT__" rx="18" fill="#fffdf8" stroke="#24302b" stroke-width="3"/>`);
  nodes.push(`<text x="${margin}" y="${y}" class="eyebrow">AI COOKING COACH</text>`);
  y += 48;
  nodes.push(`<text x="${margin}" y="${y}" class="title">${svgEscape(plan.title)}</text>`);
  y += 36;
  y = addWrappedText(nodes, plan.summary || "家庭减脂备餐计划", margin, y, 58, "summary", 28);
  y += 18;

  for (const day of plan.days) {
    const cardTop = y;
    const rectIndex = nodes.length;
    nodes.push("");
    y += 42;
    nodes.push(`<text x="${margin + 26}" y="${y}" class="day-title">${svgEscape(day.day)}  ${svgEscape(day.theme)}</text>`);
    nodes.push(`<text x="${width - margin - 280}" y="${y}" class="day-total">${day.totalCalories} kcal / ${day.totalProtein}g 蛋白</text>`);
    y += 34;

    for (const meal of day.meals) {
      nodes.push(`<text x="${margin + 30}" y="${y}" class="meal-slot">${svgEscape(meal.slot)}</text>`);
      nodes.push(`<text x="${margin + 112}" y="${y}" class="meal-name">${svgEscape(meal.name)}</text>`);
      nodes.push(`<text x="${width - margin - 320}" y="${y}" class="meal-meta">${meal.calories} kcal · ${meal.protein}g · ${svgEscape(meal.time)}</text>`);
      y += 28;
      const detail = `${meal.leftovers} / ${meal.ingredients.slice(0, 3).join(" / ")}`;
      y = addWrappedText(nodes, detail, margin + 112, y, 62, "meal-detail", 24);
      if (meal.steps.length) {
        y = addWrappedText(nodes, `做法：${meal.steps.slice(0, 2).join("；")}`, margin + 112, y, 62, "meal-step", 24);
      }
      y += 12;
    }

    const cardHeight = y - cardTop + 18;
    nodes[rectIndex] = `<rect x="${margin}" y="${cardTop}" width="${cardWidth}" height="${cardHeight}" rx="14" fill="#ffffff" stroke="#d9d5ca"/>`;
    y += 20;
  }

  y = addSvgSection(nodes, "采购清单", plan.shoppingList.map((group) => `${group.category}: ${group.items.map(shoppingItemDisplay).join("，")}`), margin, y);
  y = addSvgSection(nodes, "备餐流程", plan.batchPrep.map((item) => `${item.time}: ${item.task} (${item.duration})`), margin, y);

  const height = y + 56;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${svgEscape(plan.title)}">
  <style>
    .eyebrow{font:700 18px "Microsoft YaHei",sans-serif;letter-spacing:2px;fill:#f06a3e}
    .title{font:800 42px "Microsoft YaHei",sans-serif;fill:#24302b}
    .summary{font:400 22px "Microsoft YaHei",sans-serif;fill:#66736d}
    .day-title{font:800 27px "Microsoft YaHei",sans-serif;fill:#24302b}
    .day-total{font:700 22px "Microsoft YaHei",sans-serif;fill:#557c55}
    .meal-slot{font:800 20px "Microsoft YaHei",sans-serif;fill:#f06a3e}
    .meal-name{font:800 22px "Microsoft YaHei",sans-serif;fill:#24302b}
    .meal-meta{font:700 19px "Microsoft YaHei",sans-serif;fill:#3f6f8f}
    .meal-detail,.meal-step,.section-line{font:400 19px "Microsoft YaHei",sans-serif;fill:#66736d}
    .section-title{font:800 28px "Microsoft YaHei",sans-serif;fill:#24302b}
  </style>
  ${nodes.join("\n  ").replaceAll("__HEIGHT__", String(height)).replaceAll("__INNER_HEIGHT__", String(height - 48))}
</svg>`;
  return svg;
}

function addSvgSection(nodes, title, items, x, y) {
  nodes.push(`<text x="${x}" y="${y + 22}" class="section-title">${svgEscape(title)}</text>`);
  y += 58;
  for (const item of items.slice(0, 8)) {
    y = addWrappedText(nodes, `- ${item}`, x + 8, y, 70, "section-line", 24);
  }
  return y + 18;
}

function addWrappedText(nodes, text, x, y, maxChars, className, lineHeight) {
  const lines = wrapSvgText(text, maxChars);
  for (const line of lines) {
    nodes.push(`<text x="${x}" y="${y}" class="${className}">${svgEscape(line)}</text>`);
    y += lineHeight;
  }
  return y;
}

function wrapSvgText(value, maxChars) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return [""];
  const lines = [];
  let current = "";
  for (const char of text) {
    current += char;
    if (current.length >= maxChars || /[；。]/.test(char)) {
      lines.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

async function handleShoppingNutritionClick(event) {
  const button = event.target.closest(".shopping-item-trigger");
  if (!button) return;

  const panel = document.querySelector(`#${button.getAttribute("aria-controls")}`);
  if (!panel) return;

  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  panel.hidden = expanded;
  if (expanded) return;

  const groupIndex = Number(button.dataset.shoppingGroup);
  const itemIndex = Number(button.dataset.shoppingItem);
  const item = currentPlan?.shoppingList?.[groupIndex]?.items?.[itemIndex];
  panel.innerHTML = `<div class="nutrition-loading">正在检索食材营养库...</div>`;

  try {
    const index = await loadNutritionIndex();
    const result = findNutritionMatch(item, index);
    panel.innerHTML = renderNutritionResult(result, item, index);
  } catch (error) {
    panel.innerHTML = `<div class="nutrition-empty">营养索引暂时无法加载：${escapeHtml(error.message)}</div>`;
  }
}

function loadNutritionIndex() {
  if (nutritionIndex) {
    return Promise.resolve(nutritionIndex);
  }
  if (!nutritionIndexPromise) {
    nutritionIndexPromise = fetch(NUTRITION_INDEX_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((index) => {
        nutritionIndex = index;
        return index;
      });
  }
  return nutritionIndexPromise;
}

function findNutritionMatch(item, index) {
  const query = buildNutritionQuery(item);
  if (!query.terms.length || !Array.isArray(index.items)) {
    return { status: "none", query, matches: [] };
  }

  const matches = index.items
    .map((entry) => ({ entry, score: scoreNutritionEntry(entry, query) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!matches.length) {
    return { status: "none", query, matches: [] };
  }

  const status = matches[0].score >= 12 ? "matched" : "near";
  return { status, query, matches };
}

function buildNutritionQuery(item) {
  const display = shoppingItemDisplay(item);
  const rawName = String(item?.name || display || "").trim();
  const cleaned = rawName
    .replace(/\d+(?:\.\d+)?\s*(?:kg|g|克|千克|斤|个|颗|盒|瓶|袋|ml|l|升|份)/gi, "")
    .replace(/[，,、+＋/]/g, " ")
    .trim();
  const alias = NUTRITION_QUERY_ALIASES.find((candidate) =>
    candidate.names.some((name) => cleaned.includes(name))
  );

  if (alias) {
    return {
      label: alias.names[0],
      display,
      terms: alias.terms,
      prefer: alias.prefer || [],
      avoid: alias.avoid || []
    };
  }

  const englishTerms = cleaned
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length >= 3);
  const fallbackTerms = [...englishTerms];
  if (/[\u4e00-\u9fff]/.test(cleaned)) {
    fallbackTerms.unshift(cleaned);
  }
  if (!fallbackTerms.length && cleaned) {
    fallbackTerms.push(cleaned.toLowerCase());
  }

  return {
    label: cleaned || display,
    display,
    terms: [...new Set(fallbackTerms)],
    prefer: [],
    avoid: []
  };
}

function scoreNutritionEntry(entry, query) {
  const name = String(entry.name || "").toLowerCase();
  const text = String(entry.searchText || entry.name || "").toLowerCase();
  let score = 0;

  for (const term of query.terms) {
    const normalized = term.toLowerCase();
    if (text.includes(normalized)) {
      score += 9 + Math.min(normalized.length, 16) / 2;
    } else {
      const tokens = normalized.split(/\s+/).filter(Boolean);
      const tokenHits = tokens.filter((token) => text.includes(token)).length;
      score += tokenHits * 2.5;
    }
  }

  for (const term of query.prefer) {
    if (text.includes(term.toLowerCase())) {
      score += 2.5;
    }
  }
  for (const term of query.avoid) {
    if (text.includes(term.toLowerCase())) {
      score -= 4;
    }
  }
  if (query.terms.some((term) => name.startsWith(term.toLowerCase()))) {
    score += 3;
  }
  return score;
}

function renderNutritionResult(result, item, index) {
  if (!result.matches.length) {
    return `
      <div class="nutrition-empty">
        <strong>未找到精准匹配</strong>
        <span>文档中暂时没有与“${escapeHtml(result.query.label)}”足够接近的条目。来源库：${escapeHtml(index.dataSource || "营养文档")}。</span>
      </div>
    `;
  }

  const [best, ...alternatives] = result.matches;
  const entry = best.entry;
  const amountGrams = parseAmountGrams(item?.amount || shoppingItemDisplay(item));
  const sourceLabel = result.status === "matched" ? "RAG 命中" : "相近候选";

  return `
    <div class="nutrition-card">
      <div class="nutrition-card-head">
        <strong>${sourceLabel}</strong>
        <span>每 1g 约含量 · USDA FDC ${escapeHtml(entry.fdcId)}</span>
      </div>
      <p class="nutrition-entry-name">${escapeHtml(entry.name || entry.englishName)}</p>
      ${entry.englishName && entry.englishName !== entry.name ? `<p class="nutrition-entry-subname">${escapeHtml(entry.englishName)}</p>` : ""}
      <div class="nutrition-values">
        ${NUTRIENT_DISPLAY_FIELDS.map(([key, label]) => renderNutrientValue(entry, key, label)).join("")}
      </div>
      ${entry.features?.length ? `<p class="nutrition-tags">${entry.features.map(escapeHtml).join(" / ")}</p>` : ""}
      ${amountGrams ? renderTotalNutrition(entry, amountGrams) : ""}
      ${alternatives.length ? `<details class="nutrition-alternatives"><summary>查看其他候选</summary><ul>${alternatives.map((match) => `<li>${escapeHtml(match.entry.name)}${match.entry.englishName && match.entry.englishName !== match.entry.name ? ` · ${escapeHtml(match.entry.englishName)}` : ""}</li>`).join("")}</ul></details>` : ""}
    </div>
  `;
}

function renderNutrientValue(entry, key, label) {
  const nutrient = entry.nutrients?.[key];
  if (!nutrient || nutrient.value === null || nutrient.value === undefined) {
    return `<span><strong>${label}</strong>NA</span>`;
  }
  return `<span><strong>${label}</strong>${formatNumber(nutrient.value)}${escapeHtml(nutrient.unit)}</span>`;
}

function renderTotalNutrition(entry, amountGrams) {
  return `
    <section class="nutrition-total-block" aria-label="按采购量估算的整体营养">
      <div class="nutrition-total-head">
        <strong>采购整体营养</strong>
        <span>每克营养 × ${formatNumber(amountGrams)}g</span>
      </div>
      <div class="nutrition-total-grid">
        ${NUTRIENT_DISPLAY_FIELDS.map(([key, label]) => renderTotalNutrientValue(entry, key, label, amountGrams)).join("")}
      </div>
    </section>
  `;
}

function renderTotalNutrientValue(entry, key, label, amountGrams) {
  const nutrient = entry.nutrients?.[key];
  if (!nutrient || nutrient.value === null || nutrient.value === undefined) {
    return `<span><strong>${label}</strong>NA</span>`;
  }
  return `<span><strong>${label}</strong>${estimateTotalNutrient(nutrient, amountGrams)}${escapeHtml(totalNutrientUnit(nutrient.unit))}</span>`;
}

function parseAmountGrams(value) {
  const text = String(value || "").toLowerCase();
  const kg = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|千克|公斤)/i);
  if (kg) return Number(kg[1]) * 1000;
  const grams = text.match(/(\d+(?:\.\d+)?)\s*(?:g|克)/i);
  if (grams) return Number(grams[1]);
  return null;
}

function estimateTotalNutrient(nutrient, amountGrams) {
  if (!amountGrams || nutrient.value === null || nutrient.value === undefined) {
    return "NA";
  }
  return formatNumber(nutrient.value * amountGrams);
}

function totalNutrientUnit(unit) {
  return String(unit || "").replace(/\/g$/i, "");
}

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) {
    return "NA";
  }
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(1)));
}

function shoppingItemDisplay(item) {
  if (typeof item === "string") {
    return item;
  }
  if (!item || typeof item !== "object") {
    return "";
  }
  if (item.display) {
    return item.display;
  }
  const cost = item.estimatedCost === null || item.estimatedCost === undefined
    ? ""
    : `约 ${item.estimatedCost} 元`;
  return [item.name, item.amount, cost].filter(Boolean).join(" ");
}

function svgEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function setStatus(title, text, variant = "") {
  if (!statusBanner) return;
  statusBanner.className = `status-banner ${variant}`.trim();
  statusBanner.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
}

function setLoading(isLoading) {
  form.querySelectorAll("button, input, textarea, select").forEach((element) => {
    element.disabled = isLoading;
  });
}

function bindMetricMirrors() {
  const pairs = [
    ["days", "metricDays"],
    ["targetCalories", "metricCalories"],
    ["familySize", "metricFamily"]
  ];
  for (const [inputId, metricId] of pairs) {
    const input = document.querySelector(`#${inputId}`);
    const metric = document.querySelector(`#${metricId}`);
    input.addEventListener("input", () => {
      metric.textContent = input.value || "0";
    });
  }
  const heightInput = document.querySelector("#heightCm");
  const weightInput = document.querySelector("#weightKg");
  const bmiMetric = document.querySelector("#metricBmi");
  const updateBmi = () => {
    const heightM = Number(heightInput.value) / 100;
    const weightKg = Number(weightInput.value);
    const bmi = heightM > 0 && weightKg > 0 ? weightKg / (heightM * heightM) : 0;
    bmiMetric.textContent = bmi ? Number(bmi.toFixed(1)) : "0";
  };
  heightInput.addEventListener("input", updateBmi);
  weightInput.addEventListener("input", updateBmi);
  updateBmi();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
