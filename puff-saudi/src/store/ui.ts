"use client";

import { create } from "zustand";

type UIState = {
  menuOpen: boolean;
  searchOpen: boolean;
  setMenu: (v: boolean) => void;
  setSearch: (v: boolean) => void;
};

export const useUI = create<UIState>((set) => ({
  menuOpen: false,
  searchOpen: false,
  setMenu: (menuOpen) => set({ menuOpen }),
  setSearch: (searchOpen) => set({ searchOpen }),
}));
