/** The small Ionic column from the Innercircle teaser posts. Original line drawing, stroked in currentColor. */
export function IonicColumn({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 28 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {/* abacus */}
      <path d="M3.5 3.5h21" />
      {/* echinus between the volutes */}
      <path d="M7.5 5.2h13M8 7.4h12" />
      {/* volutes: a scroll curling in on each side */}
      <path d="M7.5 5.2c-2.6 0-4 1.2-4 2.7 0 1.3 1 2.2 2.2 2.2 1 0 1.8-.7 1.8-1.6 0-.8-.6-1.3-1.3-1.3-.6 0-1 .4-1 .9" />
      <path d="M20.5 5.2c2.6 0 4 1.2 4 2.7 0 1.3-1 2.2-2.2 2.2-1 0-1.8-.7-1.8-1.6 0-.8.6-1.3 1.3-1.3.6 0 1 .4 1 .9" />
      {/* necking and fluted shaft */}
      <path d="M9 9.6h10M9.5 10.4v15.2M18.5 10.4v15.2" />
      <path d="M12 11.2v13.6M14 11.2v13.6M16 11.2v13.6" strokeWidth="0.7" />
      {/* base */}
      <path d="M8 26.2h12M6.5 28h15M4.5 30h19" />
    </svg>
  );
}
