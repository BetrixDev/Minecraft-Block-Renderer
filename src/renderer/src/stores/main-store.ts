import { create } from "zustand";

type MainStore = {
  selectedBlockId?: string;
  setSelectedBlockId: (id?: string) => void;
};

export const useMainStore = create<MainStore>()((set) => ({
  setSelectedBlockId: (id) => set({ selectedBlockId: id }),
}));
