import { create } from "zustand";

type FeedVideoState = {
  muted: boolean;
  setMuted: (v: boolean) => void;
  toggleMuted: () => void;
};

export const useFeedVideoStore = create<FeedVideoState>((set) => ({
  muted: true,
  setMuted: (v) => set({ muted: v }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
}));
