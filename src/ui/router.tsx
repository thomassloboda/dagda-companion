import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "./components/layout/RootLayout";
import { HomePage } from "./pages/HomePage";
import { CreatePartyPage } from "./pages/CreatePartyPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CombatPage } from "./pages/CombatPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <RootLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: "party/new", element: <CreatePartyPage /> },
        { path: "party/:partyId", element: <DashboardPage /> },
        { path: "party/:partyId/combat", element: <CombatPage /> },
        { path: "settings", element: <SettingsPage /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
