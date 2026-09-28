import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 pt-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-serif text-4xl text-heading">Wrong door.</h1>
      <p className="text-text-dim">This room doesn&apos;t exist. Or it hasn&apos;t dropped yet.</p>
      <Link href="/" className="btn btn-ghost">
        Back to the vault
      </Link>
    </section>
  );
}
