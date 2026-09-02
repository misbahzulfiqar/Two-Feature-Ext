import type { ReactNode } from "react";

type FieldRowProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
};

export function FieldRow({ label, htmlFor, children }: FieldRowProps) {
  return (
    <div className="field-row">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
