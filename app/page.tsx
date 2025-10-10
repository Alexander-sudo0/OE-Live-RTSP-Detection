import { redirect } from "next/navigation"

export default function Page() {
  // Redirect root to login
  redirect("/login")
}
