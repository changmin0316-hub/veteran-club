import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import TopBar from "./TopBar";
import NavTabs from "./NavTabs";
import StickyHeader from "./StickyHeader";

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
      <StickyHeader>
        <TopBar name={user.name} role={user.role} />
        <div className="mt-3">
          <NavTabs isManager={isManager} />
        </div>
      </StickyHeader>
      <div className="mt-6 pb-10">{children}</div>
    </div>
  );
}
