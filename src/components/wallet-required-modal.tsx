'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface WalletRequiredModalProps {
  onClose: () => void
}

export function WalletRequiredModal({ onClose }: WalletRequiredModalProps) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>접근 불가</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          이 페이지는 더 이상 사용되지 않는 보호 모달입니다.
        </p>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
