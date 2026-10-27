import { create } from "zustand";
import type { Studio } from "../model/types";
import { talkshow } from "../fixtures/studios";

type State = {
  studio: Studio;
};

export const useStore = create<State>()(() => ({
  studio: talkshow,
}));
