import {
  COOKING_AGENT_ID,
  COOKING_AGENT_NAME,
  COOKING_AGENT_RUNTIME_RULES,
  COOKING_AGENT_SYSTEM_PROMPT
} from "../domain/cooking-agent-prompt.mjs";

export function createAgentResponse() {
  return {
    id: COOKING_AGENT_ID,
    name: COOKING_AGENT_NAME,
    provider: "DeepSeek",
    modelOptions: ["deepseek-v4-flash", "deepseek-v4-pro"],
    apiKeyPolicy: "user_provided",
    apiKeyStorage: "browser_local_only",
    apiKeyRequired: true,
    systemPrompt: `${COOKING_AGENT_SYSTEM_PROMPT}\n\n${COOKING_AGENT_RUNTIME_RULES}`
  };
}
