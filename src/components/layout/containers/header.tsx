"use client";
import Mode from "../mode/mode";
import Notifications from "../notifications/notifications";
import Search from "../search/search";
import Shortcuts from "../shortcuts/shortcuts";
import User from "../user/user";
import Link from "next/link";
import * as React from "react";
import { useEffect, useState } from "react";

import { Box, Button, Fade, useMediaQuery, useTheme } from "@mui/material";

import { useLayoutContext } from "@/components/layout/layout-context";
import Logo from "@/components/logo/logo";
import { DEFAULTS } from "@/config";
import NiListSquare from "@/icons/nexture/ni-list-square";
import NiMenuSplit from "@/icons/nexture/ni-menu-split";
import { cn } from "@/lib/utils";
import { MenuShowState } from "@/types";

export default function Header() {
  const { showLeftInMobile, showLeftMobileButton, leftPrimaryCurrent, leftShowBackdrop, hideLeft } = useLayoutContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mounted, setMounted] = useState(false);
  const [rightButtonsVisibleMobile, setRightButtonsVisibleMobile] = useState(false);

  const handleRightButtonsMobileToggle = () => {
    setRightButtonsVisibleMobile((prevValue) => !prevValue);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Box component="header" className="mui-fixed fixed z-20 h-16 w-full">
        <Box className="flex h-full flex-row items-center" style={{ padding: `0 var(--main-padding)` }}>
          <Link href={DEFAULTS.appRoot}>
            <Logo classNameFull="ms-2 hidden md:block" classNameMobile="ms-2 md:hidden" />
          </Link>
        </Box>
      </Box>
    );
  }

  return (
    <Box component="header" className="mui-fixed fixed z-20 h-16 w-full">
      <Box
        className={cn(
          "bg-background-paper shadow-darker-xs flex h-full w-full flex-none flex-row items-center rounded-b-3xl sm:h-16",
        )}
        style={{ padding: `0 var(--main-padding)` }}
      >
        <Box
          className={cn(
            "bg-background-paper absolute inset-0 -z-10 rounded-b-3xl",
            leftPrimaryCurrent !== MenuShowState.Hide && "rounded-bl-none!",
          )}
        ></Box>
        {/* Left menu button */}
        <Button
          variant="text"
          size="large"
          color="text-primary"
          className={cn(
            "icon-only hover-icon-shrink [&.active]:text-primary [&.active]:bg-grey-25 hover:bg-grey-25",
            showLeftMobileButton ? "flex" : "hidden",
            leftPrimaryCurrent !== MenuShowState.Hide && "active",
          )}
          onClick={() => (leftShowBackdrop ? hideLeft() : showLeftInMobile())}
          startIcon={<NiMenuSplit size={24} />}
        />
        <Box className="flex h-full flex-1 flex-row items-center gap-4 md:gap-6">
          {/* Logo */}
          <Link href={DEFAULTS.appRoot}>
            <Logo classNameFull="ms-2 hidden md:block" classNameMobile="ms-2 md:hidden" />
          </Link>

        </Box>

        {/* Right buttons */}
        <Box className="flex flex-row sm:gap-1">
          <Fade in={rightButtonsVisibleMobile || !isMobile}>
            <Box className={cn("hidden flex-row sm:flex! sm:gap-1", rightButtonsVisibleMobile ? "flex" : "hidden")}>
              <Search />
              <Shortcuts />
              <Notifications />
              <Mode />
            </Box>
          </Fade>
        </Box>

        {/* The button to turn on and off the mobile version of the right buttons and version select */}
        <Button
          variant="text"
          size="large"
          color="text-primary"
          className={cn(
            "icon-only hover-icon-shrink [&.active]:text-primary hover:bg-grey-25 ms-1 sm:hidden",
            rightButtonsVisibleMobile && "active",
          )}
          onClick={handleRightButtonsMobileToggle}
          startIcon={<NiListSquare size={"large"} />}
        />

        {/* User Avatar and Menu */}
        <User />
      </Box>
    </Box>
  );
}
