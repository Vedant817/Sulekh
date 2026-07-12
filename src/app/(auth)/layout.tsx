import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <Link href="/" className="flex flex-col items-center gap-1">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          SEBI TechSprint · PS4
        </span>
        <span className="text-2xl font-semibold tracking-tight">Sulekh</span>
      </Link>
      {children}
    </div>
  );
}
