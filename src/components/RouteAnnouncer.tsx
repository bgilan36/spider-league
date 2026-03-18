import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const pathLabel = pathname === "/" ? "home" : pathname.split("/").join(" ").trim();
    const pageTitle = document.title || `Spider League ${pathLabel}`;
    setAnnouncement(`Navigated to ${pageTitle}`);
  }, [pathname]);

  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </p>
  );
}
