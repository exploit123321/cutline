import { makeClassifier } from "./loop";
import { llmClassifyOne } from "./llm";
import { mockClassifyOne } from "./mock";
import type { Classifier, ProviderId } from "./types";

export { segment } from "./segment";
export type { Classifier, ProviderId } from "./types";

export const providers: Record<ProviderId, Classifier> = {
  mock: makeClassifier(mockClassifyOne),
  llm: makeClassifier(llmClassifyOne),
};
