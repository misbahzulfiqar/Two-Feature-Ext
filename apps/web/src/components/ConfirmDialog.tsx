import { GradientButton, SecondaryButton } from "./Buttons";
import { DarkCard } from "./LayoutBits";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <DarkCard className="w-full max-w-md p-6">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-mute">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <GradientButton onClick={onConfirm}>{confirmLabel}</GradientButton>
        </div>
      </DarkCard>
    </div>
  );
}
