import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-semibold">404</h1>
      <p className="text-muted-foreground">This page could not be found.</p>
      <Link href="/" className="font-medium underline underline-offset-4">
        Back to dashboard
      </Link>
    </main>
  );
}
