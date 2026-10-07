import { redirect } from "next/navigation";

// Root URL redirects to home
export default function RootPage() {
  redirect("/home");
}
