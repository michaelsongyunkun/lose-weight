import { validateProfile } from "../domain/prompt-builder.mjs";
import { generatePlanWithDeepSeek } from "./deepseek-client.mjs";

const DEFAULT_MODEL = "deepseek-v4-flash";

export async function createPlanResponse(body = {}, { fetchImpl = globalThis.fetch } = {}) {
  const validation = validateProfile(body.profile || {});

  if (!validation.valid) {
    throw createHttpError("规划参数无效。", 400, validation.errors);
  }

  const apiKey = String(body.apiKey || "").trim();
  if (!apiKey) {
    throw createHttpError("请先提交 DeepSeek API Key 后再生成备餐计划。", 400);
  }

  const plan = await generatePlanWithDeepSeek({
    apiKey,
    profile: validation.profile,
    model: body.model || DEFAULT_MODEL,
    fetchImpl
  });

  return { mode: "live", plan };
}

export function createHttpError(message, status = 500, details = undefined) {
  const error = new Error(message);
  error.status = status;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

export function errorToPayload(error) {
  return {
    error: error?.message || "服务器错误。",
    details: error?.details
  };
}
