'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { checkContractDeployment } from '@/lib/web3/contract-functions'
import { CONTRACT_ADDRESSES } from '@/lib/web3/config'
import { CheckCircle2, XCircle, Loader2, Copy, ExternalLink } from 'lucide-react'
import Header from '@/components/header'
import { Footer } from '@/components/footer'

export default function DebugPage() {
  const [checking, setChecking] = useState(false)
  const [results, setResults] = useState<{
    qnaContract: { address: string; deployed: boolean; error?: string }
    tokenContract: { address: string; deployed: boolean; error?: string }
  } | null>(null)

  // 페이지 로드 시 자동으로 확인
  useEffect(() => {
    handleCheck()
  }, [])

  const handleCheck = async () => {
    setChecking(true)
    try {
      const deploymentStatus = await checkContractDeployment()
      setResults(deploymentStatus)
      console.log('=== 컨트랙트 배포 상태 ===')
      console.log('QnA 컨트랙트:', {
        주소: deploymentStatus.qnaContract.address,
        배포됨: deploymentStatus.qnaContract.deployed,
        에러: deploymentStatus.qnaContract.error,
      })
      console.log('Token 컨트랙트:', {
        주소: deploymentStatus.tokenContract.address,
        배포됨: deploymentStatus.tokenContract.deployed,
        에러: deploymentStatus.tokenContract.error,
      })
    } catch (error: any) {
      console.error('확인 실패:', error)
      setResults({
        qnaContract: {
          address: CONTRACT_ADDRESSES.QNA_CONTRACT,
          deployed: false,
          error: error.message || '확인 실패',
        },
        tokenContract: {
          address: CONTRACT_ADDRESSES.TOKEN_CONTRACT,
          deployed: false,
          error: error.message || '확인 실패',
        },
      })
    } finally {
      setChecking(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const openInEtherscan = (address: string) => {
    window.open(`https://sepolia.etherscan.io/address/${address}`, '_blank')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">개발자 도구</h1>
          <p className="text-muted-foreground">
            컨트랙트 배포 상태를 확인하고 디버깅 정보를 확인할 수 있습니다.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>컨트랙트 배포 상태 확인</CardTitle>
            <CardDescription>
              현재 설정된 컨트랙트 주소에 실제로 컨트랙트가 배포되어 있는지 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCheck} disabled={checking} className="mb-4">
              {checking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  확인 중...
                </>
              ) : (
                '배포 상태 확인'
              )}
            </Button>

            {results && (
              <div className="space-y-4">
                {/* QnA 컨트랙트 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">QnA 컨트랙트</CardTitle>
                      {results.qnaContract.deployed ? (
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          배포됨
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          배포 안됨
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">주소:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded flex-1">
                          {results.qnaContract.address || '설정되지 않음'}
                        </code>
                        {results.qnaContract.address && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(results.qnaContract.address)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openInEtherscan(results.qnaContract.address)}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {results.qnaContract.error && (
                      <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                        {results.qnaContract.error}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Token 컨트랙트 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Token 컨트랙트</CardTitle>
                      {results.tokenContract.deployed ? (
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          배포됨
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          배포 안됨
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">주소:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded flex-1">
                          {results.tokenContract.address || '설정되지 않음'}
                        </code>
                        {results.tokenContract.address && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(results.tokenContract.address)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openInEtherscan(results.tokenContract.address)}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {results.tokenContract.error && (
                      <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                        {results.tokenContract.error}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 환경 변수 정보 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">환경 변수 정보</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">NEXT_PUBLIC_QNA_CONTRACT_ADDRESS:</span>
                        <code className="ml-2 bg-muted px-2 py-1 rounded">
                          {process.env.NEXT_PUBLIC_QNA_CONTRACT_ADDRESS || '설정되지 않음'}
                        </code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS:</span>
                        <code className="ml-2 bg-muted px-2 py-1 rounded">
                          {process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || '설정되지 않음'}
                        </code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>콘솔 로그 확인</CardTitle>
            <CardDescription>
              브라우저 개발자 도구(F12)의 콘솔 탭에서 상세한 로그를 확인할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              위의 "배포 상태 확인" 버튼을 클릭하면 콘솔에 상세한 정보가 출력됩니다.
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}

