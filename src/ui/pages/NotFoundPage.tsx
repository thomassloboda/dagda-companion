import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
      <Link to="/" className="btn btn-primary">
        {t("notFound.backBtn")}
      </Link>
    </div>
  );
}
