"use client";

import { useEffect } from "react";
import { getActor } from "./actor";

// Fills an empty "Your name" field from the name saved on this computer.
export function useRememberedName(current: string, set: (name: string) => void) {
  useEffect(() => {
    const known = getActor();
    if (known && !current) set(known);
    // only on mount: later edits to the field are the user's own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
