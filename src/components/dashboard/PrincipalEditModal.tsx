import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Coins } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface PrincipalEditModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  initialPrincipal: number;
}

export function PrincipalEditModal({
  open,
  onClose,
  productName,
  initialPrincipal,
}: PrincipalEditModalProps) {
  const updateAccountHolding = useStore((s) => s.updateAccountHolding);

  const [principal, setPrincipal] = useState<number>(initialPrincipal);

  useEffect(() => {
    setPrincipal(initialPrincipal);
  }, [initialPrincipal, open]);

  if (!open) return null;

  const handleSave = () => {
    if (principal < 0) {
      alert('원금은 0 이상이어야 합니다.');
      return;
    }

    // 1개의 가상 수량으로 원금 업데이트 반영
    updateAccountHolding(productName, productName, 1, principal);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-stroke bg-surface-card p-6 shadow-xl"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-surface-secondary text-content-tertiary hover:text-content-primary"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-accent">투자원금 수정</span>
              <h3 className="text-lg font-extrabold text-content-primary">{productName}</h3>
            </div>
          </div>

          {/* Input Form */}
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold text-content-secondary">
                투자원금 (원)
              </label>
              <input
                type="number"
                value={principal === 0 ? '' : principal}
                onChange={(e) => setPrincipal(parseFloat(e.target.value) || 0)}
                placeholder="예: 35000000"
                className="w-full rounded-xl border border-stroke-strong bg-surface-primary px-4 py-3.5 text-base font-extrabold text-content-primary placeholder:text-content-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-content-tertiary">
                <span>입력한 원금 금액</span>
              </div>
              <p className="mt-1 text-xl font-black text-content-primary">
                ₩{Math.round(principal).toLocaleString()}원
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-stroke py-3 text-xs font-bold text-content-secondary hover:bg-surface-secondary"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-3 text-xs font-bold text-white shadow-md hover:bg-accent-hover"
            >
              <Check className="h-4 w-4" />
              원금 수정 저장
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
