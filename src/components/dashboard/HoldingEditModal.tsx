import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Calculator, Edit3 } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface HoldingEditModalProps {
  open: boolean;
  onClose: () => void;
  accountLabel: string;
  stockName: string;
  initialQuantity: number;
  initialPrice: number;
}

export function HoldingEditModal({
  open,
  onClose,
  accountLabel,
  stockName,
  initialQuantity,
  initialPrice,
}: HoldingEditModalProps) {
  const updateAccountHolding = useStore((s) => s.updateAccountHolding);

  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [price, setPrice] = useState<number>(initialPrice);

  useEffect(() => {
    setQuantity(initialQuantity);
    setPrice(initialPrice);
  }, [initialQuantity, initialPrice, open]);

  if (!open) return null;

  const totalValuation = Math.round(quantity * price);

  const handleSave = () => {
    if (quantity < 0 || price < 0) {
      alert('수량과 가격은 0 이상이어야 합니다.');
      return;
    }

    updateAccountHolding(accountLabel, stockName, quantity, price);
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
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-accent">[{accountLabel}] 계좌 보유 종목</span>
              <h3 className="text-base font-extrabold text-content-primary">{stockName}</h3>
            </div>
          </div>

          {/* Input Form */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-content-secondary">
                보유 수량 (주)
              </label>
              <input
                type="number"
                value={quantity === 0 ? '' : quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                placeholder="예: 100"
                className="w-full rounded-xl border border-stroke-strong bg-surface-primary px-4 py-3 text-sm font-bold text-content-primary placeholder:text-content-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-content-secondary">
                현재가 / 평균단가 (원)
              </label>
              <input
                type="number"
                value={price === 0 ? '' : price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                placeholder="예: 25000"
                className="w-full rounded-xl border border-stroke-strong bg-surface-primary px-4 py-3 text-sm font-bold text-content-primary placeholder:text-content-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Total Valuation Preview */}
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-content-tertiary">
                <span className="flex items-center gap-1">
                  <Calculator className="h-3.5 w-3.5 text-accent" /> 예상 평가금액
                </span>
                <span className="text-[11px] text-content-tertiary">(수량 × 가격)</span>
              </div>
              <p className="mt-1 text-lg font-black text-content-primary">
                ₩{totalValuation.toLocaleString()}원
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
              수정 사항 저장
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
