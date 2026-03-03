import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t py-6 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Context Blocks</p>
        <nav className="flex items-center gap-6">
          <Link
            href="/impressum"
            className="hover:text-foreground transition-colors"
          >
            Legal Notice
          </Link>
          <Link
            href="/datenschutz"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
