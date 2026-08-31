"use client";

import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";

import { Box, Paper } from "@mui/material";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/theme/theme-provider";
import { ContentType } from "@/types";

export default function ContentWrapper({ children }: PropsWithChildren) {
  const { content } = useThemeContext();
  const pathname = usePathname();
  // The project workspace (sidebar + big card) needs the full available width,
  // regardless of the user's global "Boxed" content preference.
  const isProjectWorkspace = /^\/projects\/[^/]+/.test(pathname);
  // Overview and Projects pages render inside a big card, which should use the
  // full available width regardless of the "Boxed" content preference.
  const isWideCardPage = pathname === "/overview" || pathname === "/projects";

  return (
    <Paper
      elevation={0}
      className={cn(
        "flex min-h-[calc(100vh-7.5rem)] w-full min-w-0 rounded-xl py-4 sm:rounded-4xl sm:py-6 md:py-8",
        isProjectWorkspace
          ? "bg-transparent ps-[5px] pe-4 lg:pe-12"
          : isWideCardPage
            ? "bg-background-paper/30 outline-line shadow-darker-xs mt-2 px-6 pt-20 outline -outline-offset-1 backdrop-blur-sm transition-all lg:px-16"
            : "bg-transparent px-4 lg:px-12",
      )}
    >
      <Box className="flex w-full">
        <Box
          className={cn(
            "mx-auto w-full transition-all",
            content === ContentType.Boxed && !isProjectWorkspace && !isWideCardPage && "max-w-screen-lg",
          )}
        >
          <Box className={cn("-mx-2 min-h-full px-2 *:mb-2", !isProjectWorkspace && "overflow-x-auto")}>{children}</Box>
        </Box>
      </Box>
    </Paper>
  );
}
