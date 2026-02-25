import { Outlet, NavLink } from "react-router-dom";
import { useThemeStore } from "../../stores/themeStore";
import { useEffect } from "react";

export function RootLayout() {
  const { resolvedTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  return (
    <div className="flex min-h-screen flex-col bg-base-100 text-base-content">
      {/* Top bar */}
      <header className="navbar bg-base-200 shadow-sm">
        <div className="flex-1">
          <NavLink to="/" className="btn btn-ghost text-xl font-bold">
            ⚔️ Dagda
          </NavLink>
        </div>
        <div className="flex-none">
          <NavLink to="/settings" className="btn btn-ghost btn-sm">
            ⚙️
          </NavLink>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
