import { makeClassifier } from "./loop";
import { mockClassifyOne } from "./mock";
import { remoteClassifyOne } from "./remote";
import type { Classifier, ProviderId } from "./types";

export { segment } from "./segment";
export type { Classifier, ProviderId } from "./types";

export const providers: Record<ProviderId, Classifier> = {
  mock: makeClassifier(mockClassifyOne),
  jev: makeClassifier(remoteClassifyOne("jev")),
  llm: makeClassifier(remoteClassifyOne("llm")),
};
