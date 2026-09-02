import type { ReactNode } from "react";
import { ChevronIcon } from "./Icons.tsx";

type ControlFieldProps = {
  children: ReactNode;
  showChevron?: boolean;
  leading?: ReactNode;
};

export function ControlField({
  children,
  showChevron = false,
  leading,
}: ControlFieldProps) {
  return (
    <div className={showChevron ? "control-field has-chevron" : "control-field"}>
      {leading ? <span className="control-leading">{leading}</span> : null}
      {children}
      {showChevron ? (
        <span className="chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      ) : null}
    </div>
  );
}
