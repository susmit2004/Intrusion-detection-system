import { redirect } from "next/navigation";

// Root URL redirects to overview
export default function RootPage() {
  redirect("/overview");
}
