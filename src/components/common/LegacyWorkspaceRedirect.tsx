import { Navigate, useLocation } from "react-router-dom";

/** Keep existing bookmarks, OAuth returns and external integrations working. */
export function LegacyWorkspaceRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/(?:avanca|agonia|dispara|disparo)(?=\/|$)/i, "/persiste")}${search}${hash}`} replace />;
}
