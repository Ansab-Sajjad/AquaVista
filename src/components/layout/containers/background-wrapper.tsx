"use client";

import { useEffect, useState } from "react";

import { Box } from "@mui/material";

export default function BackgroundWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Box
      className={`bg-grey-50 bg-waves fixed inset-0 -z-10 h-full w-full bg-cover bg-right-bottom bg-no-repeat`}
    />
  );
}
