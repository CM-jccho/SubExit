"use client";
import { createContext, useContext } from "react";
import { defaultCompanions, type CompanionCharacter } from "@/lib/companions";
const CompanionContext = createContext<CompanionCharacter>(
  defaultCompanions[0],
);
export const CompanionProvider = CompanionContext.Provider;
export const useCompanion = () => useContext(CompanionContext);
