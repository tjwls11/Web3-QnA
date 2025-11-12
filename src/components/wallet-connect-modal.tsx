"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Wallet } from "lucide-react"
import { useWallet } from "@/lib/wallet-context"

export function WalletConnectModal() {
  const { isConnected, userName, connectWallet, setUserName } = useWallet()
  const [isOpen, setIsOpen] = useState(false)
  const [showNameInput, setShowNameInput] = useState(false)
  const [nameValue, setNameValue] = useState("")

  useEffect(() => {
    // 지갑은 연결되었지만 이름이 없으면 이름 입력 화면 표시
    if (isConnected && !userName) {
      setIsOpen(true)
      setShowNameInput(true)
    }
  }, [isConnected, userName])

  const handleConnect = async () => {
    await connectWallet()
  }

  const handleNameSubmit = () => {
    if (nameValue.trim()) {
      setUserName(nameValue.trim())
      setIsOpen(false)
      setShowNameInput(false)
      setNameValue("")
    } else {
      alert("이름을 입력해주세요.")
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        {!showNameInput ? (
          <>
            <DialogHeader>
              <DialogTitle>지갑을 등록해야합니다</DialogTitle>
              <DialogDescription>서비스를 이용하려면 MetaMask 지갑을 연결해주세요.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <Button onClick={handleConnect} size="lg" className="gap-2">
                <Wallet className="h-5 w-5" />
                MetaMask 지갑 연결
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>이름 등록</DialogTitle>
              <DialogDescription>서비스에서 사용할 이름을 입력해주세요.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="username">이름</Label>
                <Input
                  id="username"
                  placeholder="사용자 이름을 입력하세요"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleNameSubmit()
                    }
                  }}
                />
              </div>
              <Button onClick={handleNameSubmit} className="w-full">
                등록하기
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
