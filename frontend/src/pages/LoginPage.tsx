import { LoginHero } from "./login/LoginHero";
import { LoginForm } from "./login/LoginForm";

export function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px]">
      <LoginHero />
      <LoginForm />
    </div>
  );
}
