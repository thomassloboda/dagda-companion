import { Outlet } from "react-router-dom";
import { useThemeStore } from "../../stores/themeStore";
import { useEffect } from "react";

export function RootLayout() {
  const { resolvedTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <Outlet />
    </div>
  );
}
