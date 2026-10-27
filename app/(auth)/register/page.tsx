import { redirect } from "next/navigation";

// Accounts are created automatically on first Privy login.
export default function RegisterPage() {
  redirect("/login");
}
