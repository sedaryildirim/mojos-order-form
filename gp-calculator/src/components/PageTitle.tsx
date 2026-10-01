"use client";

import { useEffect } from "react";

// Sets the browser tab title on client-rendered pages so open tabs are easy to tell apart.
export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} · GP Calculator`;
  }, [title]);
  return null;
}
