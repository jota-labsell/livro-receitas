import type { ReactNode } from "react";
import "./admin-theme.css";
/** Shared administrative theme, isolated from the public sales and checkout pages. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="jf-admin">{children}</div>;
}
