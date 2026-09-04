import {
  languageRewriteInstruction,
  resolvedUserLanguage,
  shouldRewriteLanguage,
} from "./language";
import { SUMMARY_MODEL_ID } from "./models";
import { completeChat } from "./openrouter";
import { repeatRewriteInstruction } from "./persona";
import {
  companionMaxTokens,
  companionTemperature,
  makeRequestMessages,
  makeSummaryMessages,
} from "./prompt";
import { cleanedReply, isApproximateRepeat } from "./reply";
import type { ChatMessage, ClientClock } from "./types";

export async function generateCompanionReply(input: {
  apiKey: string;
  model: string;
  persona: string;
  recent: ChatMessage[];
  unsummarized: ChatMessage[];
  summary: string;
  clock: ClientClock;
}): Promise<{ content: string; summary: string }> {
  let summary = input.summary;
  if (input.unsummarized.length > 0) {
    try {
      summary = await completeChat({
        apiKey: input.apiKey,
        model: SUMMARY_MODEL_ID,
        messages: makeSummaryMessages({
          existingSummary: input.summary,
          unsummarized: input.unsummarized,
        }),
        temperature: 0.2,
        maxTokens: 400,
      });
    } catch {
      summary = input.summary;
    }
  }

  const requestMessages = makeRequestMessages({
    persona: input.persona,
    recent: input.recent,
    summary,
    clock: input.clock,
  });
  let reply = await completeChat({
    apiKey: input.apiKey,
    model: input.model,
    messages: requestMessages,
    temperature: companionTemperature,
    maxTokens: companionMaxTokens,
  });

  const lastUser = [...input.recent].reverse().find((message) => message.role === "user");
  const language = resolvedUserLanguage(lastUser?.content ?? "", input.recent);
  if (shouldRewriteLanguage(language, reply)) {
    reply = await completeChat({
      apiKey: input.apiKey,
      model: input.model,
      messages: [
        ...requestMessages,
        { role: "assistant", content: reply },
        { role: "system", content: languageRewriteInstruction(language) },
      ],
      temperature: companionTemperature,
      maxTokens: companionMaxTokens,
    });
  }

  const previousAssistant = input.recent
    .filter((message) => message.role === "assistant")
    .map((message) => message.content);
  const lastUserText = lastUser?.content ?? "";
  const repeatAgainst = [...previousAssistant.slice(-2), lastUserText];
  let content = cleanedReply(reply, previousAssistant);
  if (isApproximateRepeat(content, repeatAgainst) || isApproximateRepeat(reply, repeatAgainst)) {
    try {
      reply = await completeChat({
        apiKey: input.apiKey,
        model: input.model,
        messages: [
          ...requestMessages,
          { role: "assistant", content: reply },
          { role: "system", content: repeatRewriteInstruction },
        ],
        temperature: companionTemperature,
        maxTokens: companionMaxTokens,
      });
      content = cleanedReply(reply, previousAssistant);
    } catch {
      // Keep the first reply if the retry fails.
    }
  }
  return { content, summary };
}
