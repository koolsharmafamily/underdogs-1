import type { ReactNode } from "react";

/** The thin gold double-rule frame with clipped corners, for cards and the invite. */
export function Frame({ children, className = "", bodyClassName = "" }: { children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={`frame ${className}`}>
      <div className="frame-gap">
        <div className="frame-inner">
          <div className={`frame-body ${bodyClassName}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/** The small "Demo" label every invented thing carries. */
export function DemoTag({ label = "Demo" }: { label?: string }) {
  return <span className="demo-tag">{label}</span>;
}
