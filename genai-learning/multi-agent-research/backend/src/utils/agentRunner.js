// src/utils/agentRunner.js — Reusable agent execution loop
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";

/**
 * Run an agent loop: LLM decides → calls tools → observes → repeats until done
 * @param {object} model - LLM with tools bound
 * @param {object} tools - Map of toolName → tool function
 * @param {string} systemPrompt - Agent's system prompt
 * @param {string} userMessage - The task to complete
 * @param {function} onStep - Callback for each step (for streaming to UI)
 * @param {number} maxSteps - Safety limit
 */
export async function runAgentLoop({ model, tools, systemPrompt, userMessage, onStep, maxSteps = 10 }) {
  const messages = [new HumanMessage(userMessage)];
  let steps = 0;

  while (steps < maxSteps) {
    steps++;

    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      ...messages,
    ]);
    messages.push(response);

    // No tool calls → agent is done, return final answer
    if (!response.tool_calls?.length) {
      return { result: response.content, steps, messages };
    }

    // Execute each tool call
    for (const toolCall of response.tool_calls) {
      const toolFn = tools[toolCall.name];

      if (onStep) {
        onStep({
          type: "tool_call",
          agent: systemPrompt.split("\n")[0].replace("You are ", ""),
          tool: toolCall.name,
          args: toolCall.args,
          step: steps,
        });
      }

      let result = "Tool not found";
      if (toolFn) {
        try {
          result = await toolFn.invoke(toolCall.args);
        } catch (e) {
          result = `Error: ${e.message}`;
        }
      }

      if (onStep) {
        onStep({
          type: "tool_result",
          tool: toolCall.name,
          preview: String(result).substring(0, 150),
          step: steps,
        });
      }

      messages.push(new ToolMessage({ content: String(result), tool_call_id: toolCall.id }));
    }
  }

  return { result: "Max steps reached", steps, messages };
}
