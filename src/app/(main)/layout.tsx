import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import TopBar from "./TopBar";
import NavTabs from "./NavTabs";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isManager = user.role === "ADMIN" || user.role === "COMMANDER";

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* 상단 메뉴바 고정 (스크롤해도 항상 보이도록) */}
      <header className="sticky top-0 z-30 -mx-4 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <TopBar name={user.name} role={user.role} />
        <div className="mt-3">
          <NavTabs isManager={isManager} />
        </div>
      </header>
      <div className="mt-6 pb-10">{children}</div>
    </div>
  );
}
