import { Link, useLocation } from "react-router-dom";
import { FiFlag, FiGift, FiLifeBuoy, FiShield } from "react-icons/fi";
import { SignOutButton } from "./ReportQueue.jsx";

const SECTIONS = [
  { to: "/admin", label: "Reports", icon: FiFlag },
  { to: "/admin/tickets", label: "Support tickets", icon: FiLifeBuoy },
  { to: "/admin/grants", label: "Premium grants", icon: FiGift },
];

// The dashboard's own header: which queue you're in, and who you are.
// Reports and support tickets are separate queues — different people write
// them, and they're judged on different things.
export default function AdminNav({ me, onSignOut, right }) {
  const { pathname } = useLocation();
  return (
    <header className="mb-6 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <FiShield className="h-5 w-5 text-violet-400" />
        <span className="text-lg font-semibold tracking-tight">Moderation</span>
      </div>

      <nav className="flex gap-1 rounded-full bg-zinc-900/70 p-1">
        {SECTIONS.map((section) => {
          const active = section.to === "/admin" ? pathname === "/admin" : pathname.startsWith(section.to);
          return (
            <Link
              key={section.to}
              to={section.to}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                active ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1 text-sm text-zinc-400">
        {right}
        <span className="hidden sm:inline">@{me?.username}</span>
        <SignOutButton onClick={onSignOut} className="" />
      </div>
    </header>
  );
}
