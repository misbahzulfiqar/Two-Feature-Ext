import type { ReactNode } from "react";

type FieldRowProps = {
  label: string;
  hint: string;
  htmlFor: string;
  icon: ReactNode;
  children: ReactNode;
};

export function FieldRow({ label, hint, htmlFor, icon, children }: FieldRowProps) {
  return (
    <div className="field-row">
      <div className="field-icon">{icon}</div>
      <div className="field-copy">
        <label htmlFor={htmlFor}>{label}</label>
        <p className="field-hint">{hint}</p>
      </div>
      {children}
    </div>
  );
}
