import { Link, useLocation } from "react-router-dom";
import { List, Map, PlusCircle, Tags } from "lucide-react";

const navItems = [
  { key: "list", label: "一覧", view: "list", icon: List },
  { key: "map", label: "地図", view: "map", icon: Map },
  { key: "save", label: "保存", path: "/add", icon: PlusCircle, primary: true },
  { key: "categories", label: "カテゴリ", view: "categories", icon: Tags },
];

function resolveActiveKey(location) {
  if (location.pathname !== "/") return "";
  return new URLSearchParams(location.search).get("view") || "list";
}

function BottomNav({ user }) {
  const location = useLocation();
  const activeKey = resolveActiveKey(location);

  if (location.pathname === "/add") return null;
  if (location.pathname.startsWith("/spot/") || location.pathname.startsWith("/edit/")) return null;
  if (!user) return null;

  return (
    <nav className="bottomNav" aria-label="主要ナビゲーション">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = activeKey === item.key;
        const to = item.path ? item.path : `/?view=${item.view}`;

        return (
          <Link
            key={item.key}
            to={to}
            data-tour={item.key === "save" ? "save-nav" : undefined}
            className={`bottomNavItem${active ? " active" : ""}${item.primary ? " primary" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="bottomNavIcon">
              <Icon aria-hidden="true" />
            </span>
            <span className="bottomNavLabel">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
