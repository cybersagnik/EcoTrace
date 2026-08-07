// Phase-later. Not yet wired to any flow — added so components/ui matches
// the agreed structure ahead of settings/alerts phases needing it.
interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="rounded-card border border-border bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
