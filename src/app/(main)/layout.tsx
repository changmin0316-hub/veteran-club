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
    <div className="mx-auto max-w-6xl px-4 py-5">
      <TopBar name={user.name} role={user.role} />
      <div className="mt-4">
        <NavTabs isManager={isManager} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
