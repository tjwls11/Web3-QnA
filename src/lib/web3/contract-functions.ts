import * as storage from '../storage'
import {
  Contract,
  BrowserProvider,
  keccak256,
  toUtf8Bytes,
  Interface,
} from 'ethers'
import { JsonRpcProvider } from 'ethers'
import {
  getRpcProvider,
  getBrowserProvider,
  checkNetwork,
  switchNetwork,
} from './provider'
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from './config'
import {
  TOKEN_CONTRACT_ABI,
  QNA_CONTRACT_ABI,
  WAK_VAULT_SWAP_CONTRACT_ABI,
} from '../contracts/abi'

// 사용자 등록 여부 확인
export async function isUserRegistered(address: string): Promise<boolean> {
  return await storage.isUserRegistered(address)
}

// 사용자 등록
export async function registerUser(
  userName: string,
  address: string
): Promise<boolean> {
  // MongoDB에 저장
  const normalizedAddress = address.toLowerCase()
  const success = await storage.registerUser(normalizedAddress, userName)

  if (success) {
    console.log('사용자 등록 완료 (MongoDB):', {
      address: normalizedAddress,
      userName,
    })
  }

  return success
}

// RPC Provider가 준비될 때까지 기다리는 함수
async function waitForRpcProvider(
  provider: JsonRpcProvider,
  maxRetries = 3,
  delayMs = 500
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 간단한 호출로 Provider가 준비되었는지 확인
      // timeout을 짧게 설정하여 빠르게 실패 처리
      const blockNumber = await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 2000)
        ),
      ])
      console.log(`[RPC Provider] 준비 완료! 블록 번호: ${blockNumber}`)
      return true
    } catch (error: any) {
      const errorCode = error?.code || ''
      const errorMessage = error?.message || ''

      // Timeout 에러는 재시도
      if (errorMessage === 'Timeout') {
        if (i < maxRetries - 1) {
          console.log(
            `[RPC Provider] 타임아웃, 재시도 ${i + 1}/${maxRetries}...`
          )
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue
        }
      }

      // "signal already cancelled" 에러는 무시하고 재시도
      if (
        errorCode === 'UNSUPPORTED_OPERATION' &&
        (errorMessage.includes('cancelled') ||
          errorMessage.includes('signal') ||
          errorMessage.includes('fetchCancelSignal'))
      ) {
        // React Strict Mode로 인한 취소 에러, 재시도
        if (i < maxRetries - 1) {
          console.log(
            `[RPC Provider] 취소 에러, 재시도 ${i + 1}/${maxRetries}...`
          )
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue
        }
      }

      // 다른 에러는 즉시 실패
      console.error('[RPC Provider] 준비 실패:', {
        code: errorCode,
        message: errorMessage,
        attempt: i + 1,
      })
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
  return false
}

// 토큰 컨트랙트 읽기 전용 인스턴스 생성
function getTokenContractReadOnly(): Contract | null {
  const contractAddress = CONTRACT_ADDRESSES.TOKEN_CONTRACT
  console.log('[토큰 컨트랙트] 주소 확인:', contractAddress)
  console.log('[토큰 컨트랙트] ENV.WAK_TOKEN_CONTRACT:', process.env.NEXT_PUBLIC_WAK_TOKEN_CONTRACT_ADDRESS)
  console.log(
    '[토큰 컨트랙트] ENV.WAK_VAULT_SWAP_CONTRACT:',
    process.env.NEXT_PUBLIC_WAK_VAULT_SWAP_CONTRACT_ADDRESS
  )

  if (!contractAddress || contractAddress === '') {
    console.error('[토큰 컨트랙트] 주소가 설정되지 않았습니다!')
    console.error(
      '[토큰 컨트랙트] .env.local 에서 NEXT_PUBLIC_WAK_VAULT_SWAP_CONTRACT_ADDRESS (또는 NEXT_PUBLIC_WAK_TOKEN_CONTRACT_ADDRESS)를 설정하세요.'
    )
    return null
  }

  try {
    const rpcUrl = NETWORK_CONFIG.rpcUrl
    console.log('[토큰 컨트랙트] RPC URL:', rpcUrl)
    console.log('[토큰 컨트랙트] Chain ID:', NETWORK_CONFIG.chainId)

    const provider = getRpcProvider()
    console.log('[토큰 컨트랙트] Provider 생성 완료')

    const contract = new Contract(contractAddress, TOKEN_CONTRACT_ABI, provider)
    console.log('[토큰 컨트랙트] 인스턴스 생성 완료:', contractAddress)

    return contract
  } catch (error) {
    console.error('[토큰 컨트랙트] 생성 실패:', error)
    return null
  }
}

// WAK → ETH 출금 함수 (WakVaultSwap.sellWAK 사용)
export async function withdrawWakForEth(wakAmount: bigint): Promise<boolean> {
  console.log('=== WAK → ETH 출금 시작 (sellWAK) ===')
  console.log('[출금] WAK 금액 (wei):', wakAmount.toString())
  console.log('[출금] WAK 금액 (WAK):', Number(wakAmount) / 1e18)

  try {
    const provider = getBrowserProvider()
    if (!provider) {
      throw new Error('MetaMask가 설치되어 있지 않습니다.')
    }

    const isCorrectNetwork = await checkNetwork(provider)
    if (!isCorrectNetwork) {
      const switched = await switchNetwork(provider)
      if (!switched) {
        throw new Error('Sepolia 테스트넷으로 전환해주세요.')
      }
    }

    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()

    const vaultAddress = CONTRACT_ADDRESSES.WAK_VAULT_SWAP_CONTRACT
    if (!vaultAddress) {
      throw new Error(
        'WakVaultToken 컨트랙트 주소가 설정되지 않았습니다.\n\n.env.local 에 NEXT_PUBLIC_WAK_VAULT_SWAP_CONTRACT_ADDRESS 를 확인하세요.'
      )
    }

    // ERC20 WAK 토큰(AKVaultToken) 인스턴스
    const tokenContract = new Contract(
      CONTRACT_ADDRESSES.TOKEN_CONTRACT,
      TOKEN_CONTRACT_ABI,
      signer
    )

    // 온체인 WAK 잔고 확인 (출금 가능한지 사전 체크)
    const onchainBalance = await tokenContract.balanceOf(signerAddress)
    console.log(
      '[출금] 온체인 WAK 잔고:',
      onchainBalance.toString(),
      '요청 금액:',
      wakAmount.toString()
    )

    if (onchainBalance < wakAmount) {
      const balanceWak = Number(onchainBalance) / 1e18
      const reqWak = Number(wakAmount) / 1e18
      throw new Error(
        `온체인 WAK 잔고가 부족합니다. 보유: ${balanceWak} WAK, 요청: ${reqWak} WAK`
      )
    }

    // 현재 allowance 확인
    // 주의: WAKVaultToken.sellWAK 내부의 transferFrom(msg.sender, address(this), amount)는
    // spender=msg.sender(=user) 기준으로 allowance[from][spender] 를 사용하므로,
    // 여기서는 allowance(user, user)를 확인/설정해야 한다.
    const currentAllowance = await tokenContract.allowance(
      signerAddress,
      signerAddress
    )
    console.log(
      '[출금] 현재 Allowance:',
      currentAllowance.toString(),
      '필요:',
      wakAmount.toString()
    )

    if (currentAllowance < wakAmount) {
      console.log('[출금] Allowance 부족 → approve(user, amount) 실행')
      const approveTx = await tokenContract.approve(signerAddress, wakAmount)
      console.log('[출금] approve 트랜잭션 해시:', approveTx.hash)
      const approveReceipt = await provider.waitForTransaction(
        approveTx.hash,
        1,
        60000
      )
      if (!approveReceipt || approveReceipt.status === 0) {
        throw new Error('토큰 승인(approve)에 실패했습니다.')
      }
      console.log('[출금] approve 완료')
    } else {
      console.log('[출금] 기존 Allowance로 충분, approve 생략')
    }

    const vaultContract = new Contract(
      vaultAddress,
      WAK_VAULT_SWAP_CONTRACT_ABI,
      signer
    )

    console.log('[출금] sellWAK 트랜잭션 전송 중...')
    const tx = await vaultContract.sellWAK(wakAmount)
    console.log('[출금] 트랜잭션 해시:', tx.hash)

    const receipt = await provider.waitForTransaction(tx.hash, 1, 60000)
    if (!receipt || receipt.status === 0) {
      throw new Error('트랜잭션이 실패했습니다.')
    }

    console.log('[출금] 성공, 블록 번호:', receipt.blockNumber)

    // ETH 가치 계산 (컨트랙트의 rate 를 기준으로 계산)
    const rateScaled = await getExchangeRate()
    const tokensPerEth = Number(rateScaled) / 1e18
    const wakTokens = Number(wakAmount) / 1e18
    const ethValue = tokensPerEth > 0 ? wakTokens / tokensPerEth : 0

    try {
      // 1) 거래 내역 저장
      await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'withdraw',
          ethAmount: ethValue,
          wakAmount: wakTokens,
          transactionHash: tx.hash,
          userAddress: signerAddress,
        }),
      })

      // 2) 온체인 잔고 재조회 후 DB/프론트 동기화는
      // wallet-context 의 refreshTokenBalance()가 담당하므로
      // 여기서는 추가 동기화 작업을 하지 않는다.
    } catch (saveError) {
      console.error('[출금] 거래 내역 저장 실패:', saveError)
    }

    return true
  } catch (error: any) {
    console.error('[출금] 실패:', error)

    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.')
    }

    if (error.message) {
      throw error
    }

      throw new Error('WAK → ETH 출금에 실패했습니다.')
  }
}

// 토큰 전송 함수
export async function transferTokens(
  fromAddress: string,
  toAddress: string,
  amount: bigint
): Promise<boolean> {
  console.log('=== 토큰 전송 시작 ===')
  console.log('[전송] 보내는 주소:', fromAddress)
  console.log('[전송] 받는 주소:', toAddress)
  console.log('[전송] 금액 (wei):', amount.toString())
  console.log('[전송] 금액 (WAK):', Number(amount) / 1e18)

  try {
    const provider = getBrowserProvider()
    if (!provider) {
      throw new Error('MetaMask가 설치되어 있지 않습니다.')
    }

    // 네트워크 확인
    const isCorrectNetwork = await checkNetwork(provider)
    if (!isCorrectNetwork) {
      const switched = await switchNetwork(provider)
      if (!switched) {
        throw new Error('Sepolia 테스트넷으로 전환해주세요.')
      }
    }

    // Signer 가져오기
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()

    // 보내는 주소가 현재 연결된 지갑과 일치하는지 확인
    if (signerAddress.toLowerCase() !== fromAddress.toLowerCase()) {
      throw new Error('전송하려는 주소가 현재 연결된 지갑과 일치하지 않습니다.')
    }

    // 컨트랙트 인스턴스 생성 (쓰기 가능)
    const contract = new Contract(
      CONTRACT_ADDRESSES.TOKEN_CONTRACT,
      TOKEN_CONTRACT_ABI,
      signer
    )

    console.log('[전송] 컨트랙트 인스턴스 생성 완료')
    console.log('[전송] 전송 트랜잭션 전송 중...')

    // transfer 함수 호출
    const tx = await contract.transfer(toAddress, amount)
    console.log('[전송] 트랜잭션 해시:', tx.hash)
    console.log('[전송] 트랜잭션 확인 대기 중...')

    // 트랜잭션 확인 대기
    const receipt = await tx.wait()
    console.log('[전송] 성공')
    console.log('[전송] 블록 번호:', receipt.blockNumber)
    console.log('[전송] 가스 사용량:', receipt.gasUsed.toString())

    // 출금 내역 저장 및 토큰 잔액 업데이트
    try {
      const wakAmount = Number(amount) / 1e18

      // 거래 내역 저장 (출금은 ETH가 0)
      await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'withdraw',
          ethAmount: 0,
          wakAmount: wakAmount,
          transactionHash: tx.hash,
          userAddress: signerAddress,
        }),
      })
    } catch (saveError) {
      console.error('[전송] 내역 저장 실패:', saveError)
      // 내역 저장 실패해도 전송은 성공한 것으로 처리
    }

    return true
  } catch (error: any) {
    console.error('[전송] 실패:', error)

    if (error.code === 4001) {
      throw new Error('사용자가 트랜잭션을 거부했습니다.')
    } else if (error.code === -32603) {
      throw new Error('스마트 컨트랙트 실행 실패. 잔액을 확인해주세요.')
    } else if (error.message) {
      throw error
    } else {
      throw new Error('토큰 전송에 실패했습니다.')
    }
  }
}

// ETH를 WAK 토큰/포인트로 환전하는 함수 (WakDualSystem.depositETH 사용)
export async function buyTokensWithEth(ethAmount: bigint): Promise<boolean> {
  console.log('=== ETH → WAK 환전 시작 ===')
  console.log('[환전] ETH 금액 (wei):', ethAmount.toString())
  console.log('[환전] ETH 금액 (ETH):', Number(ethAmount) / 1e18)

  let provider: BrowserProvider | null = null
  let signer: any = null

  try {
    // 최소 0.01 ETH 이상만 환전 허용 (추가 안전장치)
    const MIN_ETH_WEI = BigInt(10) ** BigInt(16) // 0.01 ETH
    if (ethAmount < MIN_ETH_WEI) {
      throw new Error('최소 0.01 ETH 이상 입력해주세요.')
    }

    provider = getBrowserProvider()
    if (!provider) {
      throw new Error('MetaMask가 설치되어 있지 않습니다.')
    }

    // 네트워크 확인
    const isCorrectNetwork = await checkNetwork(provider)
    if (!isCorrectNetwork) {
      const switched = await switchNetwork(provider)
      if (!switched) {
        throw new Error('Sepolia 테스트넷으로 전환해주세요.')
      }
      // 네트워크 전환 후 provider 재생성
      provider = getBrowserProvider()
      if (!provider) {
        throw new Error('MetaMask가 설치되어 있지 않습니다.')
      }
    }

    // Signer 가져오기
    signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()

    // 현재 ETH 잔액 확인
    const balance = await provider.getBalance(signerAddress)
    console.log('[환전] 현재 ETH 잔액 (wei):', balance.toString())
    console.log('[환전] 현재 ETH 잔액 (ETH):', Number(balance) / 1e18)

    // WakVaultSwap 컨트랙트 인스턴스 생성 (쓰기 가능)
    const vaultAddress = CONTRACT_ADDRESSES.WAK_VAULT_SWAP_CONTRACT
    if (!vaultAddress) {
      throw new Error(
        'WakVaultSwap 컨트랙트 주소가 설정되지 않았습니다.\n\n.env.local 에 NEXT_PUBLIC_WAK_VAULT_SWAP_CONTRACT_ADDRESS 를 확인하세요.'
      )
    }

    const contract = new Contract(
      vaultAddress,
      WAK_VAULT_SWAP_CONTRACT_ABI,
      signer
    )

    console.log('[환전] WakVaultSwap 컨트랙트 인스턴스 생성 완료:', vaultAddress)

    // 실제 가스비 예상 (estimateGas 사용)
    let estimatedGasCost = BigInt(0)
    try {
      const gasEstimate = await contract.buyWAK.estimateGas({
        value: ethAmount,
      })
      const gasPrice = await provider.getFeeData()
      const currentGasPrice = gasPrice.gasPrice || BigInt(20_000_000_000) // 기본값: 20 gwei

      // 가스비 = 가스 사용량 * 가스 가격
      estimatedGasCost = gasEstimate * currentGasPrice

      // 여유를 위해 20% 추가
      estimatedGasCost = (estimatedGasCost * BigInt(120)) / BigInt(100)

      console.log('[환전] 예상 가스 사용량:', gasEstimate.toString())
      console.log('[환전] 가스 가격 (gwei):', Number(currentGasPrice) / 1e9)
      console.log('[환전] 예상 가스비 (wei):', estimatedGasCost.toString())
      console.log('[환전] 예상 가스비 (ETH):', Number(estimatedGasCost) / 1e18)
    } catch (gasEstimateError: any) {
      console.warn('[환전] 가스비 예상 실패, 기본값 사용:', gasEstimateError)
      // 가스비 예상 실패 시 보수적인 값 사용 (0.0001 ETH)
      estimatedGasCost = BigInt(100_000_000_000_000) // 0.0001 ETH in wei
    }

    // 사용 가능한 ETH 확인 (잔액 - 가스비)
    const availableEth = balance - estimatedGasCost
    console.log('[환전] 사용 가능한 ETH (wei):', availableEth.toString())
    console.log('[환전] 사용 가능한 ETH (ETH):', Number(availableEth) / 1e18)

    // 요청한 금액이 사용 가능한 금액보다 큰지 확인
    if (ethAmount > availableEth) {
      const availableEthAmount = Number(availableEth) / 1e18
      const estimatedGasCostEth = Number(estimatedGasCost) / 1e18
      throw new Error(
        `가스비를 고려한 사용 가능한 ETH 잔액이 부족합니다. 최대 ${availableEthAmount.toFixed(
          4
        )} ETH까지 환전 가능합니다. (예상 가스비: ${estimatedGasCostEth.toFixed(
          6
        )} ETH)`
      )
    }

    console.log('[환전] 환전 트랜잭션 전송 중 (buyWAK)...')

    // buyWAK 함수 호출 (ETH와 함께)
    const tx = await contract.buyWAK({ value: ethAmount })
    console.log('[환전] 트랜잭션 해시:', tx.hash)
    console.log('[환전] 트랜잭션 확인 대기 중...')

    // provider.waitForTransaction 사용 (subscriber 문제 방지)
    if (!provider) {
      throw new Error('Provider가 없습니다.')
    }

    // 트랜잭션 확인 대기 (provider.waitForTransaction 사용)
    const receipt = await provider.waitForTransaction(tx.hash, 1, 60000) // 최대 60초 대기

    if (!receipt) {
      throw new Error('트랜잭션 확인을 받지 못했습니다.')
    }

    if (receipt.status === 0) {
      throw new Error('트랜잭션이 실패했습니다.')
    }

    console.log('[환전] 성공')
    console.log('[환전] 블록 번호:', receipt.blockNumber)
    console.log('[환전] 가스 사용량:', receipt.gasUsed?.toString() || 'N/A')

    // 환전 내역 저장
    try {
      const ethAmountInEth = Number(ethAmount) / 1e18
      const rateScaled = await getExchangeRate()
      // rateScaled는 "1 ETH = X WAK" 를 18자리 스케일로 표현한 값
      const tokensPerEth = Number(rateScaled) / 1e18
      const wakAmount = ethAmountInEth * tokensPerEth

      await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'exchange',
          ethAmount: ethAmountInEth,
          wakAmount: wakAmount,
          transactionHash: tx.hash,
          userAddress: signerAddress,
        }),
      })

      // 토큰 잔액 업데이트는 wallet-context 의 refreshTokenBalance() 가
      // 온체인 balanceOf를 기준으로 처리하므로 여기서는 하지 않는다.
    } catch (saveError) {
      console.error('[환전] 내역 저장 실패:', saveError)
      // 내역 저장 실패해도 환전은 성공한 것으로 처리
    }

    return true
  } catch (error: any) {
    console.warn('[환전] 실패:', error)

    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.')
    } else if (
      error.code === 'INSUFFICIENT_FUNDS' ||
      error.message?.includes('insufficient funds')
    ) {
      // 가스비 부족 에러 처리
      if (provider && signer) {
        try {
          const signerAddress = await signer.getAddress()
          const balance = await provider.getBalance(signerAddress)
          const estimatedGasCost = BigInt(1_000_000_000_000_000) // 0.001 ETH
          const availableEth = balance - estimatedGasCost
          const availableEthAmount = Number(availableEth) / 1e18

          if (availableEthAmount > 0) {
            throw new Error(
              `가스비를 고려한 사용 가능한 ETH 잔액이 부족합니다. 최대 ${availableEthAmount.toFixed(
                4
              )} ETH까지 환전 가능합니다.`
            )
          } else {
            throw new Error(
              'ETH 잔액이 부족합니다. 가스비를 위해 최소 0.001 ETH 이상 필요합니다.'
            )
          }
        } catch (balanceError: any) {
          if (balanceError.message) {
            throw balanceError
          }
          throw new Error(
            'ETH 잔액이 부족합니다. 가스비를 위해 최소 0.001 ETH 이상 필요합니다.'
          )
        }
      } else {
        throw new Error(
          'ETH 잔액이 부족합니다. 가스비를 위해 최소 0.001 ETH 이상 필요합니다.'
        )
      }
    } else if (error.code === 'CALL_EXCEPTION') {
      // 가스 추정/트랜잭션 시 컨트랙트에서 revert 난 경우
      // buyWAK 기준으로는 보통 다음과 같은 경우:
      // - rate 값이 0 이거나 너무 커서 wakAmount가 0이 되는 경우
      // - 전달한 ETH가 너무 작아서 wakAmount가 0이 되는 경우
      throw new Error(
        '스마트 컨트랙트 실행이 거부되었습니다.\n\n' +
          '가능한 원인:\n' +
          '- WakVaultSwap 컨트랙트의 rate 값이 0 이거나 비정상적으로 설정됨\n' +
          '- 입력한 ETH 금액이 너무 작아서 1 wei 이하의 WAK만 계산되는 경우\n\n' +
          'Remix에서 다음을 확인하세요:\n' +
          '1) WakVaultSwap.rate() 값이 0이 아닌지\n' +
          '2) 1 WAK = rate(wei) ETH 가 원하는 비율(예: 0.01 ETH = 1e16)인지\n' +
          '3) 너무 작은 ETH(예: 1 wei)에 대해서는 wakAmount가 0이 되어 revert 될 수 있음'
      )
    } else if (
      error.code === -32603 ||
      error.message?.includes('execution reverted')
    ) {
      throw new Error('스마트 컨트랙트 실행 실패. 잔액을 확인해주세요.')
    } else if (error.message) {
      throw error
    } else {
      throw new Error('ETH → WAK 환전에 실패했습니다.')
    }
  }
}

// 환전 비율 조회
// WakVaultSwap.rate() 는 "1 WAK = rate ETH(wei)" 이므로,
// 여기서는 "1 ETH = X WAK" 값을 18자리 스케일(BigInt)로 변환해서 반환한다.
export async function getExchangeRate(): Promise<bigint> {
  try {
    const vaultAddress = CONTRACT_ADDRESSES.WAK_VAULT_SWAP_CONTRACT
    if (!vaultAddress) {
      // 주소가 아직 설정되지 않은 초기 상태에서는 치명 에러로 취급하지 않고 경고만 남긴다.
      console.warn(
        '[환전 비율] WakVaultSwap 컨트랙트 주소가 설정되지 않았습니다.'
      )
      // 기본값: 0.01 ETH = 1 WAK → 1 ETH = 100 WAK
      return BigInt(100) * BigInt(10) ** BigInt(18)
    }

    const provider = getRpcProvider()
    const vaultContract = new Contract(
      vaultAddress,
      WAK_VAULT_SWAP_CONTRACT_ABI,
      provider
    )

    const ethPerWakWei = await vaultContract.rate()
    const ethPerWak = BigInt(ethPerWakWei.toString())

    if (ethPerWak === BigInt(0)) {
      console.warn('[환전 비율] rate가 0입니다. 기본값 사용.')
      return BigInt(100) * BigInt(10) ** BigInt(18)
    }

    // 1 ETH = (1e18 / ethPerWak) WAK
    // 18자리 스케일을 위해: (1e18 / ethPerWak) * 1e18 = 1e36 / ethPerWak
    const ONE_ETHER = BigInt(10) ** BigInt(18)
    const scaled = (ONE_ETHER * ONE_ETHER) / ethPerWak
    return scaled
  } catch (err: any) {
    console.error('[환전 비율] 최종 실패:', err)
    // 기본값: 0.01 ETH = 1 WAK → 1 ETH = 100 WAK
    return BigInt(100) * BigInt(10) ** BigInt(18)
  }
}

// 컨트랙트 주소의 토큰 잔액 조회
export async function getContractTokenBalance(): Promise<bigint> {
  console.log('=== 컨트랙트 주소 토큰 잔액 조회 시작 ===')
  console.log(
    '[컨트랙트 조회] 컨트랙트 주소:',
    CONTRACT_ADDRESSES.TOKEN_CONTRACT
  )

  try {
    const contract = getTokenContractReadOnly()
    if (!contract) {
      console.error('[컨트랙트 조회] 컨트랙트 인스턴스를 생성할 수 없습니다.')
      return BigInt(0)
    }

    try {
      const balance = await contract.balanceOf(
        CONTRACT_ADDRESSES.TOKEN_CONTRACT
      )
      const balanceBigInt = BigInt(balance.toString())
      const balanceInWAK = Number(balanceBigInt) / 1e18

      console.log('[컨트랙트 조회] 성공')
      console.log('[컨트랙트 조회] 잔액 (wei):', balanceBigInt.toString())
      console.log('[컨트랙트 조회] 잔액 (WAK):', balanceInWAK)

      return balanceBigInt
    } catch (err: any) {
      const errorMessage = err?.message || ''
      const errorCode = err?.code || ''

      if (
        errorCode === 'UNSUPPORTED_OPERATION' ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('signal') ||
        errorMessage.includes('fetchCancelSignal') ||
        errorMessage.includes('operation="fetchCancelSignal')
      ) {
        return BigInt(0)
      }

      console.error('[컨트랙트 조회] balanceOf 호출 실패:', err)
      return BigInt(0)
    }
  } catch (err: any) {
    console.error('[컨트랙트 조회] 최종 실패:', err)
    return BigInt(0)
  }
}

// 토큰 잔액 조회 (실제 지갑에서 가져오기)
export async function getTokenBalance(address: string): Promise<bigint> {
  console.log('=== 토큰 잔액 조회 시작 ===')
  console.log('[조회] 지갑 주소:', address)
  console.log('[조회] 지갑 주소 (소문자):', address?.toLowerCase())
  console.log('[조회] 컨트랙트 주소:', CONTRACT_ADDRESSES.TOKEN_CONTRACT)
  console.log(
    '[조회] 컨트랙트 주소 (소문자):',
    CONTRACT_ADDRESSES.TOKEN_CONTRACT?.toLowerCase()
  )
  console.log('[조회] RPC URL:', NETWORK_CONFIG.rpcUrl)
  console.log('[조회] Chain ID:', NETWORK_CONFIG.chainId)

  if (!address) {
    console.error('[조회] 지갑 주소가 없습니다!')
    return BigInt(0)
  }

  // 먼저 BrowserProvider를 사용 시도 (MetaMask가 연결되어 있으면)
  const browserProvider = getBrowserProvider()
  if (browserProvider) {
    try {
      console.log('[조회] BrowserProvider 사용 시도...')
      const network = await browserProvider.getNetwork()
      const currentChainId = Number(network.chainId)

      if (currentChainId === NETWORK_CONFIG.chainId) {
        console.log('[조회] BrowserProvider로 조회 시작...')
        const contract = new Contract(
          CONTRACT_ADDRESSES.TOKEN_CONTRACT,
          TOKEN_CONTRACT_ABI,
          browserProvider
        )

        try {
          // 컨트랙트 메타 정보(name, symbol, totalSupply)는 참고용으로만 조회
          console.log('[조회] 컨트랙트 정보 확인 중...')
          try {
            const contractName = await contract.name()
            const contractSymbol = await contract.symbol()
            const contractTotalSupply = await contract.totalSupply()
            console.log('[조회] 컨트랙트 존재 확인')
            console.log('[조회] 컨트랙트 이름:', contractName)
            console.log('[조회] 컨트랙트 심볼:', contractSymbol)
            console.log('[조회] 총 공급량:', contractTotalSupply.toString())
          } catch (nameError: any) {
            // 정보 조회 실패는致命적 에러가 아니므로 경고로만 남기고 balanceOf를 계속 시도한다.
            console.warn('[조회] 컨트랙트 정보 조회 실패')
            console.warn('[조회] 에러 코드:', nameError?.code)
            console.warn('[조회] 에러 메시지:', nameError?.message)
            console.warn('[조회] 에러 짧은 메시지:', nameError?.shortMessage)
            console.warn(
              '[조회] 컨트랙트가 존재하지 않거나 ABI가 맞지 않을 수 있습니다.'
            )
            console.warn(
              '[조회] 컨트랙트 주소:',
              CONTRACT_ADDRESSES.TOKEN_CONTRACT
            )
            console.warn(
              '[조회] Etherscan 확인: https://sepolia.etherscan.io/address/' +
                CONTRACT_ADDRESSES.TOKEN_CONTRACT
            )

            // 컨트랙트가 아예 없다고 판단되는 경우에만 0 반환
            if (
              nameError?.code === 'BAD_DATA' ||
              nameError?.code === 'CALL_EXCEPTION'
            ) {
              console.warn('[조회] 컨트랙트가 존재하지 않습니다. 배포를 확인하세요.')
              return BigInt(0)
            }
          }

          // balanceOf 호출 (메타 정보 조회 성공/실패와 관계없이 시도)
          console.log('[조회] balanceOf 호출 중...')
          console.log('[조회] 조회할 주소:', address)
          const balance = await contract.balanceOf(address)
          const balanceBigInt = BigInt(balance.toString())
          const balanceInWAK = Number(balanceBigInt) / 1e18

          console.log('[조회] BrowserProvider로 성공')
          console.log('[조회] 잔액 (wei):', balanceBigInt.toString())
          console.log('[조회] 잔액 (WAK):', balanceInWAK)

          return balanceBigInt
        } catch (balanceError: any) {
          // BAD_DATA 에러 (0x 반환)는 실제로 0을 의미할 수 있음
          console.warn('[조회] balanceOf 호출 중 에러 발생!')
          console.warn('[조회] 에러 코드:', balanceError?.code)
          console.warn('[조회] 에러 메시지:', balanceError?.message)
          console.warn('[조회] 에러 짧은 메시지:', balanceError?.shortMessage)
          console.warn('[조회] 에러 value:', balanceError?.value)
          console.warn('[조회] 에러 info:', balanceError?.info)

          if (
            balanceError?.code === 'BAD_DATA' &&
            (balanceError?.value === '0x' ||
              balanceError?.message?.includes('0x') ||
              balanceError?.shortMessage?.includes('0x'))
          ) {
            console.log('[조회] balanceOf가 0x를 반환했습니다')
            console.log('[조회] 이는 다음 중 하나를 의미할 수 있습니다:')
            console.log('[조회] 1. 해당 주소의 잔액이 실제로 0')
            console.log('[조회] 2. 컨트랙트가 존재하지 않음')
            console.log('[조회] 3. 네트워크가 잘못됨')
            console.log(
              '[조회] 컨트랙트 주소:',
              CONTRACT_ADDRESSES.TOKEN_CONTRACT
            )
            console.log('[조회] 조회 주소:', address)
            console.log('[조회] 네트워크 Chain ID:', currentChainId)
            console.log(
              '[조회] Etherscan 주소: https://sepolia.etherscan.io/address/' +
                address
            )
            console.log(
              '[조회] 컨트랙트 Etherscan: https://sepolia.etherscan.io/address/' +
                CONTRACT_ADDRESSES.TOKEN_CONTRACT
            )
            // 0x는 실제로 0을 의미하므로 0 반환
            return BigInt(0)
          } else {
            console.warn(
              '[조회] BrowserProvider balanceOf 호출 실패:',
              balanceError?.message || balanceError?.shortMessage
            )
            console.warn('[조회] 에러 코드:', balanceError?.code)
            console.warn('[조회] RPC Provider로 전환합니다...')
            // RPC Provider로 폴백 (아래 코드 계속 실행)
          }
        }
      } else {
        console.warn(
          '[조회] BrowserProvider의 네트워크가 다릅니다:',
          currentChainId
        )
        console.warn('[조회] RPC Provider로 전환합니다...')
      }
    } catch (browserError: any) {
      console.warn(
        '[조회] BrowserProvider 실패, RPC Provider로 전환:',
        browserError?.message
      )
    }
  }

  // BrowserProvider가 없거나 실패한 경우 RPC Provider 사용
  // RPC Provider가 실패하면 BrowserProvider를 다시 시도하거나 0 반환
  try {
    const contract = getTokenContractReadOnly()
    if (!contract) {
      console.error('[조회] 컨트랙트 인스턴스를 생성할 수 없습니다.')
      // BrowserProvider가 있으면 다시 시도
      if (browserProvider) {
        console.log('[조회] BrowserProvider로 직접 호출 재시도...')
        try {
          const network = await browserProvider.getNetwork()
          const currentChainId = Number(network.chainId)
          if (currentChainId === NETWORK_CONFIG.chainId) {
            const directContract = new Contract(
              CONTRACT_ADDRESSES.TOKEN_CONTRACT,
              TOKEN_CONTRACT_ABI,
              browserProvider
            )
            // 직접 호출 시도 (에러 무시하고 0 반환)
            try {
              const balance = await directContract.balanceOf(address)
              return BigInt(balance.toString())
            } catch {
              return BigInt(0)
            }
          }
        } catch {
          return BigInt(0)
        }
      }
      return BigInt(0)
    }

    // RPC Provider가 준비될 때까지 기다리기 (더 짧은 대기 시간)
    const provider = getRpcProvider()
    console.log('[조회] RPC Provider 준비 확인 중...')
    const isReady = await waitForRpcProvider(provider, 2, 300) // 2회 재시도, 300ms 대기 (더 빠르게 실패)
    if (!isReady) {
      console.warn('[조회] RPC Provider가 준비되지 않았습니다.')
      console.warn('[조회] RPC 엔드포인트가 불안정할 수 있습니다.')
      // BrowserProvider가 있으면 다시 시도
      if (browserProvider) {
        console.log('[조회] BrowserProvider로 직접 호출 재시도...')
        try {
          const network = await browserProvider.getNetwork()
          const currentChainId = Number(network.chainId)
          if (currentChainId === NETWORK_CONFIG.chainId) {
            const directContract = new Contract(
              CONTRACT_ADDRESSES.TOKEN_CONTRACT,
              TOKEN_CONTRACT_ABI,
              browserProvider
            )
            // 직접 호출 시도 (에러 무시하고 0 반환)
            try {
              const balance = await directContract.balanceOf(address)
              const balanceBigInt = BigInt(balance.toString())
              console.log(
                '[조회] BrowserProvider 재시도 성공, 잔액:',
                balanceBigInt.toString()
              )
              return balanceBigInt
            } catch (directError: any) {
              // BAD_DATA 에러는 0으로 처리
              if (directError?.code === 'BAD_DATA') {
                console.log('[조회] BrowserProvider 재시도: 잔액이 0입니다.')
                return BigInt(0)
              }
              console.warn(
                '[조회] BrowserProvider 재시도 실패:',
                directError?.message
              )
              return BigInt(0)
            }
          }
        } catch {
          return BigInt(0)
        }
      }
      return BigInt(0)
    }
    console.log('[조회] RPC Provider 준비 완료!')

    // 컨트랙트 정보 확인
    try {
      const name = await contract.name()
      const symbol = await contract.symbol()
      const decimals = await contract.decimals()
      const totalSupply = await contract.totalSupply()
      console.log('[조회] 컨트랙트 정보:', {
        name,
        symbol,
        decimals: decimals.toString(),
        totalSupply: totalSupply.toString() + ' wei',
        totalSupplyWAK: (Number(totalSupply) / 1e18).toString() + ' WAK',
      })
    } catch (infoError: any) {
      // 컨트랙트 메타 정보 조회 실패는 잔액 조회에 치명적이지 않으므로 경고로만 기록
      console.warn('[조회] 컨트랙트 정보 조회 실패:', infoError)
      console.warn('[조회] 에러 상세:', {
        code: infoError?.code,
        message: infoError?.message,
      })
    }

    // balanceOf 호출 (에러 핸들링 강화)
    try {
      console.log('[조회] balanceOf 호출 중...')
      console.log('[조회] 호출 파라미터:', {
        address,
        addressLower: address?.toLowerCase(),
        contractAddress: CONTRACT_ADDRESSES.TOKEN_CONTRACT,
        contractAddressLower: CONTRACT_ADDRESSES.TOKEN_CONTRACT?.toLowerCase(),
      })

      // Promise를 래핑하여 취소 에러를 완전히 처리
      let balance: any
      try {
        console.log('[조회] balanceOf 호출 시작...')
        console.log('[조회] 컨트랙트 주소:', CONTRACT_ADDRESSES.TOKEN_CONTRACT)
        console.log('[조회] 호출할 주소:', address)

        // 직접 호출하여 에러를 명확히 확인
        const balancePromise = contract.balanceOf(address)
        console.log('[조회] Promise 생성 완료, await 시작...')

        balance = await balancePromise
        console.log('[조회] balanceOf 호출 완료!')
        console.log('[조회] balanceOf 반환값 (원본):', balance)
        console.log('[조회] balanceOf 반환값 타입:', typeof balance)
        console.log('[조회] balanceOf 반환값 toString():', balance?.toString())
      } catch (balanceError: any) {
        // 에러 정보를 안전하게 추출 (Contract 객체 제외)
        const errorMessage = balanceError?.message || String(balanceError) || ''
        const errorShortMessage = balanceError?.shortMessage || ''
        const errorCode = balanceError?.code || ''
        const errorName = balanceError?.name || ''
        const errorReason = balanceError?.reason || ''
        const errorData = balanceError?.data || ''

        // balanceOf 실패는 사용자 경험 상 치명적이지 않으므로 경고로만 기록하고 0을 반환한다.
        console.warn('[조회] balanceOf 호출 중 에러 발생!')
        console.warn('[조회] 에러 메시지:', errorMessage)
        console.warn('[조회] 에러 짧은 메시지:', errorShortMessage)
        console.warn('[조회] 에러 코드:', errorCode)
        console.warn('[조회] 에러 이름:', errorName)
        if (errorReason) {
          console.warn('[조회] 에러 이유:', errorReason)
        }
        if (errorData) {
          console.warn('[조회] 에러 데이터:', errorData)
        }

        // "signal already cancelled" 에러만 조용히 무시
        const isCancelledError =
          errorCode === 'UNSUPPORTED_OPERATION' &&
          (errorMessage.includes('cancelled') ||
            errorMessage.includes('signal') ||
            errorMessage.includes('fetchCancelSignal') ||
            errorShortMessage.includes('cancelled') ||
            errorShortMessage.includes('signal') ||
            errorShortMessage.includes('fetchCancelSignal'))

        if (isCancelledError) {
          console.warn('[조회] 취소 에러로 인해 0 반환 (React Strict Mode)')
          return BigInt(0)
        }

        // UNSUPPORTED_OPERATION이지만 cancelled가 아닌 경우도 사용자에게 치명적이지 않으므로 0 반환
        if (errorCode === 'UNSUPPORTED_OPERATION' && !isCancelledError) {
          console.warn('[조회] UNSUPPORTED_OPERATION 에러 (cancelled 아님)')
          console.warn('[조회] RPC Provider가 준비되지 않았을 수 있습니다.')
          console.warn(
            '[조회] 잠시 후 다시 시도하거나 BrowserProvider를 사용하세요.'
          )
          return BigInt(0)
        }

        // RPC 연결 에러인 경우
        if (
          errorMessage.includes('network') ||
          errorMessage.includes('connection') ||
          errorMessage.includes('timeout') ||
          errorCode === 'NETWORK_ERROR' ||
          errorCode === 'TIMEOUT'
        ) {
          console.warn('[조회] RPC 연결 에러 발생!')
          console.warn('[조회] RPC URL을 확인하세요:', NETWORK_CONFIG.rpcUrl)
          return BigInt(0)
        }

        // 다른 에러도 0 반환 (사용자 경험 개선)
        return BigInt(0)
      }

      if (balance === undefined || balance === null) {
        console.error('[조회] balanceOf가 undefined 또는 null을 반환했습니다!')
        return BigInt(0)
      }

      const balanceBigInt = BigInt(balance.toString())
      const balanceInWAK = Number(balanceBigInt) / 1e18

      console.log('[조회] 성공')
      console.log('[조회] 잔액 (wei):', balanceBigInt.toString())
      console.log('[조회] 잔액 (WAK):', balanceInWAK)

      // 만약 잔액이 0이면, 컨트랙트 주소의 잔액도 확인해보기
      if (balanceBigInt === BigInt(0)) {
        console.warn('[조회] 컨트랙트 주소의 잔액이 0입니다.')
        console.log('[조회] 컨트랙트 주소의 잔액을 확인합니다...')
        try {
          const contractBalance = await contract.balanceOf(
            CONTRACT_ADDRESSES.TOKEN_CONTRACT
          )
          const contractBalanceBigInt = BigInt(contractBalance.toString())
          const contractBalanceInWAK = Number(contractBalanceBigInt) / 1e18
          console.log(
            '[조회] 컨트랙트 주소 잔액 (wei):',
            contractBalanceBigInt.toString()
          )
          console.log('[조회] 컨트랙트 주소 잔액 (WAK):', contractBalanceInWAK)
          if (contractBalanceBigInt > BigInt(0)) {
            console.error('[조회] 토큰이 컨트랙트 주소로 mint되었습니다.')
            console.error('[조회] 지갑 주소로 토큰을 전송해야 합니다.')
            console.error(
              '[조회] 컨트랙트 주소:',
              CONTRACT_ADDRESSES.TOKEN_CONTRACT
            )
            console.error('[조회] 지갑 주소:', address)
          }
        } catch (contractBalanceError: any) {
          // 컨트랙트 잔액 확인 에러도 조용히 무시
          const contractErrorMessage = contractBalanceError?.message || ''
          const contractErrorCode = contractBalanceError?.code || ''
          if (
            contractErrorCode === 'UNSUPPORTED_OPERATION' ||
            contractErrorMessage.includes('cancelled') ||
            contractErrorMessage.includes('signal') ||
            contractErrorMessage.includes('fetchCancelSignal') ||
            contractErrorMessage.includes('operation="fetchCancelSignal')
          ) {
            // 조용히 무시
          } else {
            console.error(
              '[조회] 컨트랙트 주소 잔액 확인 실패:',
              contractBalanceError
            )
          }
        }
      }

      return balanceBigInt
    } catch (err: any) {
      // "signal already cancelled" 에러는 완전히 무시하고 0 반환
      const errorMessage = err?.message || ''
      const errorCode = err?.code || ''

      if (
        errorCode === 'UNSUPPORTED_OPERATION' ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('signal') ||
        errorMessage.includes('fetchCancelSignal') ||
        errorMessage.includes('operation="fetchCancelSignal')
      ) {
        // 에러를 완전히 조용히 처리 (콘솔에도 출력하지 않음)
        return BigInt(0)
      }

      // 최종 balanceOf 실패도 경고만 남기고 0 반환
      console.warn('[조회] balanceOf 호출 실패:', err)
      console.warn('[조회] 에러 상세:', {
        code: errorCode,
        message: errorMessage,
        data: err?.data,
      })

      // 다른 에러도 0 반환 (사용자 경험 개선)
      return BigInt(0)
    }
  } catch (err: any) {
    // 최종 에러 처리
    const errorMessage = err?.message || ''
    const errorCode = err?.code || ''

    if (
      errorCode === 'UNSUPPORTED_OPERATION' ||
      errorMessage.includes('cancelled') ||
      errorMessage.includes('signal') ||
      errorMessage.includes('fetchCancelSignal') ||
      errorMessage.includes('operation="fetchCancelSignal')
    ) {
      // 에러를 완전히 조용히 처리 (콘솔에도 출력하지 않음)
      return BigInt(0)
    }

    console.error('[조회] 최종 실패:', err)
    console.error('[조회] 에러 상세:', {
      code: errorCode,
      message: errorMessage,
      data: err?.data,
    })

    // 모든 에러는 0 반환 (사용자 경험 개선)
    return BigInt(0)
  }
}

// QnA 컨트랙트 읽기 전용 인스턴스 생성
function getQnAContractReadOnly(): Contract | null {
  const contractAddress = CONTRACT_ADDRESSES.QNA_CONTRACT
  if (!contractAddress || contractAddress === '') {
    console.error('[QnA 컨트랙트] 주소가 설정되지 않았습니다!')
    return null
  }

  try {
    const provider = getRpcProvider()
    const contract = new Contract(contractAddress, QNA_CONTRACT_ABI, provider)
    return contract
  } catch (error) {
    console.error('[QnA 컨트랙트] 인스턴스 생성 실패:', error)
    return null
  }
}

// QnA 컨트랙트 쓰기 가능 인스턴스 생성
function getQnAContract(signer: any): Contract | null {
  const contractAddress = CONTRACT_ADDRESSES.QNA_CONTRACT
  if (!contractAddress || contractAddress === '') {
    console.error('[QnA 컨트랙트] 주소가 설정되지 않았습니다!')
    return null
  }

  try {
    const contract = new Contract(contractAddress, QNA_CONTRACT_ABI, signer)
    return contract
  } catch (error) {
    console.error('[QnA 컨트랙트] 인스턴스 생성 실패:', error)
    return null
  }
}

// 토큰 approve 함수
export async function approveTokens(
  spenderAddress: string,
  amount: bigint
): Promise<boolean> {
  console.log('=== 토큰 Approve 시작 ===')
  console.log('[Approve] Spender 주소:', spenderAddress)
  console.log('[Approve] 금액 (wei):', amount.toString())
  console.log('[Approve] 금액 (WAK):', Number(amount) / 1e18)

  try {
    const provider = getBrowserProvider()
    if (!provider) {
      throw new Error('MetaMask가 설치되어 있지 않습니다.')
    }

    // 네트워크 확인
    const isCorrectNetwork = await checkNetwork(provider)
    if (!isCorrectNetwork) {
      const switched = await switchNetwork(provider)
      if (!switched) {
        throw new Error('Sepolia 테스트넷으로 전환해주세요.')
      }
    }

    // Signer 가져오기
    const signer = await provider.getSigner()

    // 토큰 컨트랙트 인스턴스 생성
    const tokenContract = new Contract(
      CONTRACT_ADDRESSES.TOKEN_CONTRACT,
      TOKEN_CONTRACT_ABI,
      signer
    )

    console.log('[Approve] 컨트랙트 인스턴스 생성 완료')
    console.log('[Approve] Approve 트랜잭션 전송 중...')

    // approve 함수 호출
    const tx = await tokenContract.approve(spenderAddress, amount)
    console.log('[Approve] 트랜잭션 해시:', tx.hash)
    console.log('[Approve] 트랜잭션 확인 대기 중...')

    // 트랜잭션 확인 대기 (provider.waitForTransaction 사용하여 subscriber 문제 방지)
    const receipt = await provider.waitForTransaction(tx.hash, 1, 60000)

    if (!receipt) {
      throw new Error('트랜잭션 확인을 받지 못했습니다.')
    }

    if (receipt.status === 0) {
      throw new Error('트랜잭션이 실패했습니다.')
    }

    console.log('[Approve] 성공')
    console.log('[Approve] 블록 번호:', receipt.blockNumber)

    return true
  } catch (error: any) {
    console.error('[Approve] 실패:', error)

    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.')
    } else if (error.message) {
      throw error
    } else {
      throw new Error('토큰 Approve에 실패했습니다.')
    }
  }
}

// 질문 등록 (토큰 approve + escrow 포함)
// contentHash를 bytes32로 변환하는 헬퍼 함수
function stringToBytes32(value: string): string {
  if (!value || value === '') {
    // 빈 값은 허용되지 않으므로 기본 해시 생성
    // 타임스탬프를 사용하여 고유한 해시 생성
    const timestamp = Date.now().toString()
    return keccak256(toUtf8Bytes(timestamp))
  }
  // 이미 hex 문자열인 경우 (0x로 시작하고 64자리)
  if (value.startsWith('0x') && value.length === 66) {
    return value
  }
  // hex 문자열이지만 길이가 다른 경우 패딩
  if (value.startsWith('0x')) {
    const hex = value.slice(2).padStart(64, '0').slice(0, 64)
    return '0x' + hex
  }
  // 문자열을 keccak256 해시로 변환 (32바이트)
  return keccak256(toUtf8Bytes(value))
}

export async function createQuestionWithReward(
  title: string,
  contentHash: string,
  reward: bigint,
  tags: string[]
): Promise<bigint> {
  console.log('=== 질문 등록 시작 ===')
  console.log('[질문] 제목:', title)
  console.log('[질문] 보상 (WAK):', Number(reward) / 1e18)
  console.log('[질문] 태그:', tags)

  try {
    const provider = getBrowserProvider()
    if (!provider) {
      throw new Error('MetaMask가 설치되어 있지 않습니다.')
    }

    // 네트워크 확인
    const isCorrectNetwork = await checkNetwork(provider)
    if (!isCorrectNetwork) {
      const switched = await switchNetwork(provider)
      if (!switched) {
        throw new Error('Sepolia 테스트넷으로 전환해주세요.')
      }
    }

    // Signer 가져오기
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()

    const rewardWAK = Number(reward) / 1e18

    // 1. 먼저 DB 잔액 확인
    let dbBalance = 0
    try {
      const userResponse = await fetch('/api/auth/user')
      if (userResponse.ok) {
        const userData = await userResponse.json()
        dbBalance = userData.user?.tokenBalance || 0
      }
    } catch (dbError) {
      console.warn('[질문] DB 잔액 조회 실패:', dbError)
    }

    console.log('[질문] DB 토큰 잔액:', dbBalance, 'WAK')
    console.log('[질문] 필요 토큰:', rewardWAK, 'WAK')

    // 2. DB 잔액 확인
    if (dbBalance < rewardWAK) {
      throw new Error(
        `토큰 잔액이 부족합니다. 현재 잔액: ${dbBalance.toFixed(
          2
        )} WAK, 필요: ${rewardWAK} WAK\n\n` +
          `마이페이지에서 ETH를 WAK으로 환전하세요.`
      )
    }

    // 3. 블록체인에서 토큰 잔액 확인 (실제 지갑 잔액)
    const blockchainBalance = await getTokenBalance(signerAddress)
    const blockchainBalanceWAK = Number(blockchainBalance) / 1e18

    console.log('[질문] 블록체인 토큰 잔액:', blockchainBalanceWAK, 'WAK')

    // 4. 블록체인 잔액이 부족하면 경고 (하지만 DB 잔액이 있으면 진행)
    if (blockchainBalance < reward) {
      console.warn('[질문] 블록체인 잔액이 부족하지만 DB 잔액이 충분합니다.')
      console.warn(
        '[질문] DB 잔액:',
        dbBalance,
        'WAK, 블록체인 잔액:',
        blockchainBalanceWAK,
        'WAK'
      )

      // 블록체인 잔액이 0이면 환전 필요
      if (blockchainBalanceWAK < 0.01) {
        throw new Error(
          `블록체인에 토큰이 없습니다. DB 잔액: ${dbBalance.toFixed(
            2
          )} WAK, 블록체인 잔액: ${blockchainBalanceWAK.toFixed(2)} WAK\n\n` +
            `질문 등록을 위해서는 블록체인에 토큰이 필요합니다. 마이페이지에서 ETH를 WAK으로 환전하세요.`
        )
      }

      // 블록체인 잔액이 부족하지만 일부 있으면 경고만 표시하고 진행
      console.warn('[질문] 블록체인 잔액이 부족하지만 계속 진행합니다.')
    }

    // 2. QnA 컨트랙트에 토큰 approve
    console.log('[질문] 토큰 Approve 중...')
    await approveTokens(CONTRACT_ADDRESSES.QNA_CONTRACT, reward)

    // 3. QnA 컨트랙트 인스턴스 생성
    const qnaContract = getQnAContract(signer)
    if (!qnaContract) {
      throw new Error('QnA 컨트랙트 인스턴스를 생성할 수 없습니다.')
    }

    // 4. Allowance 확인 (approve가 제대로 되었는지)
    console.log('[질문] 토큰 Allowance 확인 중...')
    const tokenContract = new Contract(
      CONTRACT_ADDRESSES.TOKEN_CONTRACT,
      TOKEN_CONTRACT_ABI,
      signer
    )
    const allowance = await tokenContract.allowance(
      signerAddress,
      CONTRACT_ADDRESSES.QNA_CONTRACT
    )
    console.log('[질문] Allowance:', allowance.toString(), 'wei')
    console.log('[질문] 필요 Allowance:', reward.toString(), 'wei')

    if (allowance < reward) {
      throw new Error(
        `토큰 Allowance가 부족합니다. Allowance: ${
          Number(allowance) / 1e18
        } WAK, 필요: ${rewardWAK} WAK\n\n` + `다시 시도해주세요.`
      )
    }

    // 5. 컨트랙트 존재 확인 (코드가 있는지 확인)
    const code = await provider.getCode(CONTRACT_ADDRESSES.QNA_CONTRACT)
    if (code === '0x') {
      throw new Error(
        `QnA 컨트랙트가 주소 ${CONTRACT_ADDRESSES.QNA_CONTRACT}에 배포되지 않았습니다.\n\n` +
          `컨트랙트를 배포하거나 올바른 주소를 설정해주세요.`
      )
    }

    console.log('[질문] 질문 등록 트랜잭션 전송 중...')

    // 6. contentHash를 bytes32로 변환
    const contentHashBytes32 = stringToBytes32(contentHash)
    console.log('[질문] contentHash (bytes32):', contentHashBytes32)

    // 7. 질문 등록 (토큰이 자동으로 escrow됨)
    let tx
    try {
      tx = await qnaContract.createQuestion(
        title,
        contentHashBytes32,
        reward,
        tags
      )
    } catch (txError: any) {
      console.error('[질문] 트랜잭션 전송 실패:', txError)

      // 더 명확한 에러 메시지 제공
      if (txError.code === 'CALL_EXCEPTION' || txError.reason) {
        throw new Error(
          `컨트랙트 호출 실패: ${txError.reason || '알 수 없는 오류'}\n\n` +
            `가능한 원인:\n` +
            `- 토큰 Allowance가 부족함\n` +
            `- 컨트랙트가 해당 주소에 배포되지 않음\n` +
            `- 네트워크가 맞지 않음\n\n` +
            `다시 시도하거나 마이페이지에서 토큰을 확인해주세요.`
        )
      }
      throw txError
    }
    console.log('[질문] 트랜잭션 해시:', tx.hash)
    console.log('[질문] 트랜잭션 확인 대기 중...')

    // 트랜잭션 확인 대기
    const receipt = await provider.waitForTransaction(tx.hash, 1, 60000)

    if (!receipt) {
      throw new Error('트랜잭션 확인을 받지 못했습니다.')
    }

    if (receipt.status === 0) {
      throw new Error('트랜잭션이 실패했습니다.')
    }

    console.log('[질문] 성공')
    console.log('[질문] 블록 번호:', receipt.blockNumber)

    // 이벤트에서 질문 ID 추출
    let questionId: bigint | null = null

    for (const log of receipt.logs) {
      try {
        const parsed = qnaContract.interface.parseLog({
          topics: Array.from(log.topics),
          data: log.data,
        })
        if (parsed?.name === 'QuestionCreated') {
          questionId = BigInt(parsed.args[0].toString())
          console.log('[질문] 질문 ID:', questionId.toString())
          break
        }
      } catch {
        // 이벤트 파싱 실패 시 다음 로그 확인
        continue
      }
    }

    if (questionId) {
      return questionId
    } else {
      // 이벤트를 찾지 못한 경우, 트랜잭션에서 직접 조회
      // (실제로는 컨트랙트에서 questionCounter를 조회해야 함)
      throw new Error('질문 ID를 찾을 수 없습니다.')
    }
  } catch (error: any) {
    console.error('[질문] 실패:', error)

    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.')
    } else if (error.message) {
      throw error
    } else {
      throw new Error('질문 등록에 실패했습니다.')
    }
  }
}

// 답변 작성 (스마트 컨트랙트에 등록)
export async function createAnswerContract(
  questionId: bigint,
  contentHash: string
): Promise<bigint | null> {
  console.log('=== 답변 작성 시작 (스마트 컨트랙트) ===')
  console.log('[답변] 질문 ID:', questionId.toString())
  console.log('[답변] Content Hash:', contentHash)

  try {
    const provider = getBrowserProvider()
    if (!provider) {
      // MetaMask가 없으면 null 반환 (에러 throw 안 함)
      // useContract에서 MongoDB 저장은 이미 완료되었으므로 정상 동작
      console.warn(
        '[답변 작성] MetaMask가 없습니다. MongoDB에는 저장되었지만 스마트 컨트랙트에는 등록되지 않습니다.'
      )
      return null
    }

    // 네트워크 확인
    const isCorrectNetwork = await checkNetwork(provider)
    if (!isCorrectNetwork) {
      const switched = await switchNetwork(provider)
      if (!switched) {
        throw new Error('Sepolia 테스트넷으로 전환해주세요.')
      }
    }

    // Signer 가져오기
    const signer = await provider.getSigner()

    // QnA 컨트랙트 인스턴스 생성
    const qnaContract = getQnAContract(signer)
    if (!qnaContract) {
      throw new Error('QnA 컨트랙트 인스턴스를 생성할 수 없습니다.')
    }

    // contentHash를 bytes32로 변환
    const contentHashBytes32 = stringToBytes32(contentHash)
    console.log('[답변] Content Hash (bytes32):', contentHashBytes32)

    console.log('[답변] 답변 작성 트랜잭션 전송 중...')

    // 답변 작성
    const tx = await qnaContract.createAnswer(questionId, contentHashBytes32)
    console.log('[답변] 트랜잭션 해시:', tx.hash)
    console.log('[답변] 트랜잭션 확인 대기 중...')

    // 트랜잭션 확인 대기
    const receipt = await provider.waitForTransaction(tx.hash, 1, 60000)

    if (!receipt) {
      throw new Error('트랜잭션 확인을 받지 못했습니다.')
    }

    if (receipt.status === 0) {
      throw new Error('트랜잭션이 실패했습니다.')
    }

    console.log('[답변] 성공')
    console.log('[답변] 블록 번호:', receipt.blockNumber)

    // 이벤트에서 답변 ID 추출
    let answerId: bigint | null = null

    for (const log of receipt.logs) {
      try {
        const parsed = qnaContract.interface.parseLog({
          topics: Array.from(log.topics),
          data: log.data,
        })
        if (parsed?.name === 'AnswerCreated') {
          answerId = BigInt(parsed.args[0].toString()) // answerId
          console.log('[답변] 답변 ID:', answerId.toString())
          break
        }
      } catch {
        // 이벤트 파싱 실패 시 다음 로그 확인
        continue
      }
    }

    if (answerId) {
      return answerId
    } else {
      // 이벤트를 찾지 못한 경우, 트랜잭션에서 직접 조회
      // (실제로는 컨트랙트에서 answerCounter를 조회해야 함)
      throw new Error('답변 ID를 찾을 수 없습니다.')
    }
  } catch (error: any) {
    console.error('[답변] 실패:', error)

    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.')
    } else if (error.message) {
      throw error
    } else {
      throw new Error('답변 작성에 실패했습니다.')
    }
  }
}

// 답변 채택 (토큰 분배)
export async function acceptAnswer(
  questionId: bigint,
  answerId: bigint
): Promise<boolean> {
  console.log('=== 답변 채택 시작 ===')
  console.log('[채택] 질문 ID:', questionId.toString())
  console.log('[채택] 답변 ID:', answerId.toString())

  try {
    const provider = getBrowserProvider()
    if (!provider) {
      throw new Error('MetaMask가 설치되어 있지 않습니다.')
    }

    // 네트워크 확인
    const isCorrectNetwork = await checkNetwork(provider)
    if (!isCorrectNetwork) {
      const switched = await switchNetwork(provider)
      if (!switched) {
        throw new Error('Sepolia 테스트넷으로 전환해주세요.')
      }
    }

    // Signer 가져오기
    const signer = await provider.getSigner()

    // 컨트랙트 주소 확인
    const contractAddress = CONTRACT_ADDRESSES.QNA_CONTRACT
    if (!contractAddress || contractAddress === '') {
      throw new Error(
        'QnA 컨트랙트 주소가 설정되지 않았습니다.\n\n' +
          '.env.local 파일에 NEXT_PUBLIC_QNA_CONTRACT_ADDRESS를 확인하세요.'
      )
    }

    // 컨트랙트 존재 확인 (코드가 있는지 확인)
    const code = await provider.getCode(contractAddress)
    if (code === '0x' || code === '0x0') {
      throw new Error(
        `QnA 컨트랙트가 주소 ${contractAddress}에 배포되지 않았습니다.\n\n` +
          `가능한 원인:\n` +
          `- Remix에서 컨트랙트 코드가 사라졌거나 삭제됨\n` +
          `- 잘못된 컨트랙트 주소가 설정됨\n` +
          `- 컨트랙트가 다른 네트워크에 배포됨\n\n` +
          `해결 방법:\n` +
          `1. Remix에서 컨트랙트를 다시 배포하세요\n` +
          `2. 배포된 컨트랙트 주소를 .env.local에 설정하세요\n` +
          `3. 올바른 네트워크(Sepolia)에 연결되어 있는지 확인하세요`
      )
    }

    console.log('[채택] 컨트랙트 주소:', contractAddress)
    console.log('[채택] 컨트랙트 코드 존재 확인')

    // 컨트랙트에 토큰이 있는지 확인 (escrow 확인)
    try {
      const readOnlyContract = getQnAContractReadOnly()
      if (readOnlyContract) {
        const escrow = await readOnlyContract.getQuestionEscrow(questionId)
        console.log('[채택] 질문 escrow 잔액:', escrow.toString(), 'wei')
        console.log(
          '[채택] 질문 escrow 잔액 (WAK):',
          Number(escrow) / 1e18,
          'WAK'
        )
        if (escrow === BigInt(0)) {
          console.warn('[채택] 질문의 escrow 잔액이 0입니다.')
          console.warn('[채택] 이미 채택되었거나 환불되었을 수 있습니다.')
        }
      }
    } catch (escrowError: any) {
      console.warn('[채택] escrow 조회 실패 (계속 진행):', escrowError.message)
    }

    // QnA 컨트랙트 인스턴스 생성
    const qnaContract = getQnAContract(signer)
    if (!qnaContract) {
      throw new Error('QnA 컨트랙트 인스턴스를 생성할 수 없습니다.')
    }

    console.log('[채택] 답변 채택 트랜잭션 전송 중...')

    // 답변 채택 (토큰이 자동으로 분배됨)
    // estimateGas는 트랜잭션 요청 창을 띄울 수 있으므로 바로 시도
    const tx = await qnaContract.acceptAnswer(questionId, answerId)
    console.log('[채택] 트랜잭션 해시:', tx.hash)
    console.log('[채택] 트랜잭션 확인 대기 중...')

    // 트랜잭션 확인 대기
    const receipt = await provider.waitForTransaction(tx.hash, 1, 60000)

    if (!receipt) {
      throw new Error('트랜잭션 확인을 받지 못했습니다.')
    }

    if (receipt.status === 0) {
      throw new Error('트랜잭션이 실패했습니다.')
    }

    // AnswerAccepted 이벤트 확인 (토큰 전송 확인)
    console.log('[채택] ========== 트랜잭션 상세 정보 ==========')
    console.log('[채택] 트랜잭션 해시:', receipt.hash)
    console.log(
      '[채택] 트랜잭션 상태:',
      receipt.status === 1 ? '성공' : '실패'
    )
    console.log('[채택] 트랜잭션 로그 수:', receipt.logs.length)
    console.log('[채택] 컨트랙트 주소:', contractAddress.toLowerCase())
    console.log(
      '[채택] Etherscan 링크:',
      `https://sepolia.etherscan.io/tx/${receipt.hash}`
    )

    // 컨트랙트 주소와 일치하는 로그만 필터링
    const contractLogs = receipt.logs.filter(
      (log: any) => log.address.toLowerCase() === contractAddress.toLowerCase()
    )
    console.log('[채택] QnA 컨트랙트에서 발생한 로그 수:', contractLogs.length)

    // 모든 로그 출력 (디버깅용)
    console.log(
      '[채택] 모든 로그:',
      receipt.logs.map((log: any, index: number) => ({
        index,
        address: log.address,
        addressMatch:
          log.address.toLowerCase() === contractAddress.toLowerCase(),
        topics: log.topics,
        dataLength: log.data.length,
      }))
    )

    const qnaContractInterface = new Interface(QNA_CONTRACT_ABI)

    // 컨트랙트 주소와 일치하는 로그만 파싱 시도
    const parsedLogs: any[] = []
    for (const log of contractLogs) {
      try {
        const parsed = qnaContractInterface.parseLog({
          topics: Array.from(log.topics),
          data: log.data,
        })
        if (parsed) {
          parsedLogs.push(parsed)
          console.log('[채택] 파싱된 이벤트:', parsed.name)
          console.log('[채택] 이벤트 인자:', parsed.args)
        }
      } catch (e: any) {
        // 파싱 실패 로그 출력
        console.log('[채택] 파싱 실패 (다른 컨트랙트일 수 있음):', e.message)
      }
    }

    // AnswerAccepted 이벤트 찾기
    const answerAcceptedEvent = parsedLogs.find(
      (parsed: any) => parsed.name === 'AnswerAccepted'
    )

    // 이벤트 시그니처로 직접 찾기 시도
    if (!answerAcceptedEvent) {
      console.log(
        '[채택] 파싱된 이벤트 목록:',
        parsedLogs.map((p: any) => p.name)
      )

      // AnswerAccepted 이벤트 시그니처: AnswerAccepted(uint256,uint256,address,uint256)
      // topics[0] = keccak256("AnswerAccepted(uint256,uint256,address,uint256)")
      const answerAcceptedTopic =
        qnaContractInterface.getEvent('AnswerAccepted')?.topicHash
      console.log(
        '[채택] AnswerAccepted 이벤트 토픽 해시:',
        answerAcceptedTopic
      )

      // topics[0]로 직접 찾기
      const matchingLogs = contractLogs.filter(
        (log: any) => log.topics[0] === answerAcceptedTopic
      )
      console.log(
        '[채택] AnswerAccepted 토픽과 일치하는 로그 수:',
        matchingLogs.length
      )

      if (matchingLogs.length > 0) {
        console.log('[채택] 이벤트는 있지만 파싱에 실패했습니다.')
        console.log('[채택] 로그 데이터:', matchingLogs[0])
      }
    }

    let answerAuthorAddress: string | null = null
    let rewardAmount: bigint | null = null

    if (answerAcceptedEvent) {
      answerAuthorAddress = answerAcceptedEvent.args.answerAuthor
      rewardAmount = answerAcceptedEvent.args.reward
      console.log('[채택] AnswerAccepted 이벤트 확인')
      console.log('[채택] 답변자:', answerAuthorAddress)
      console.log('[채택] 보상 금액:', rewardAmount?.toString(), 'wei')
      console.log(
        '[채택] 보상 금액 (WAK):',
        rewardAmount ? Number(rewardAmount) / 1e18 : 0,
        'WAK'
      )
    } else {
      console.error('[채택] AnswerAccepted 이벤트를 찾을 수 없습니다.')
      console.error(
        '[채택] 파싱된 이벤트 목록:',
        parsedLogs.map((p: any) => p.name)
      )
      console.error('[채택] 스마트 컨트랙트에서 토큰이 전송되지 않았을 수 있습니다.')
      console.error('[채택] 컨트랙트 주소:', CONTRACT_ADDRESSES.QNA_CONTRACT)
      console.error('[채택] 트랜잭션 해시:', receipt.hash)
      console.error(
        '[채택] Etherscan에서 확인:',
        `https://sepolia.etherscan.io/tx/${receipt.hash}`
      )
    }

    console.log('[채택] 성공')
    console.log('[채택] 블록 번호:', receipt.blockNumber)

    // 이벤트 정보를 로그로 남김 (MongoDB API에서 블록체인 잔액 조회로 동기화)
    if (answerAuthorAddress && rewardAmount) {
      console.log('[채택] 이벤트 정보:', {
        answerAuthor: answerAuthorAddress,
        reward: rewardAmount.toString(),
        rewardWAK: Number(rewardAmount) / 1e18,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
      })
    }

    return true
  } catch (error: any) {
    console.error('[채택] 실패:', error)

    // "Answer not found" 에러인 경우, 그대로 throw하여 useContract에서 처리하도록 함
    if (
      error.reason === 'Answer not found' ||
      error.message?.includes('Answer not found')
    ) {
      // 원본 에러를 그대로 throw하여 useContract에서 자동 등록 로직이 실행되도록 함
      throw error
    }

    // "Already resolved" 에러인 경우, 질문이 이미 해결된 상태
    if (
      error.reason === 'Already resolved' ||
      error.message?.includes('Already resolved')
    ) {
      throw new Error(
        '이 질문은 이미 해결되었습니다. 다른 답변이 이미 채택되었습니다.'
      )
    }

    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.')
    } else if (error.message) {
      throw error
    } else {
      throw new Error('답변 채택에 실패했습니다.')
    }
  }
}

// 컨트랙트 배포 상태 확인 유틸리티 함수
export async function checkContractDeployment(): Promise<{
  qnaContract: { address: string; deployed: boolean; error?: string }
  tokenContract: { address: string; deployed: boolean; error?: string }
}> {
  // 공개 RPC URL 목록 (폴백용)
  const publicRpcUrls = [
    'https://rpc.sepolia.org',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // 공개 Infura 키
    'https://ethereum-sepolia-rpc.publicnode.com',
  ]

  let provider: any = null
  let lastError: any = null

  // 먼저 설정된 RPC Provider 시도
  try {
    provider = getRpcProvider()
    // 간단한 테스트 요청으로 연결 확인
    await provider.getBlockNumber()
    console.log('[배포 확인] RPC Provider 연결 성공')
  } catch (error: any) {
    console.warn(
      '[배포 확인] 설정된 RPC Provider 실패, 공개 RPC 시도:',
      error.message
    )
    lastError = error

    // 공개 RPC URL들을 순차적으로 시도
    for (const rpcUrl of publicRpcUrls) {
      try {
        const testProvider = new JsonRpcProvider(rpcUrl, {
          name: NETWORK_CONFIG.name,
          chainId: NETWORK_CONFIG.chainId,
        })
        await testProvider.getBlockNumber()
        provider = testProvider
        console.log('[배포 확인] 공개 RPC 연결 성공:', rpcUrl)
        break
      } catch (rpcError: any) {
        console.warn('[배포 확인] RPC URL 실패:', rpcUrl, rpcError.message)
        continue
      }
    }
  }

  // Browser Provider를 마지막으로 시도
  if (!provider) {
    try {
      provider = getBrowserProvider()
      if (provider) {
        await provider.getBlockNumber()
        console.log('[배포 확인] Browser Provider 연결 성공')
      }
    } catch (error: any) {
      console.warn('[배포 확인] Browser Provider 실패:', error.message)
    }
  }

  if (!provider) {
    throw new Error(
      `Provider를 가져올 수 없습니다.\n\n` +
        `가능한 원인:\n` +
        `- RPC URL이 올바르지 않음 (현재: ${NETWORK_CONFIG.rpcUrl})\n` +
        `- 네트워크 연결 문제\n\n` +
        `해결 방법:\n` +
        `1. .env.local 파일에 NEXT_PUBLIC_RPC_URL을 설정하세요\n` +
        `2. 예: NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org\n` +
        `3. 개발 서버를 재시작하세요`
    )
  }

  const results: {
    qnaContract: { address: string; deployed: boolean; error?: string }
    tokenContract: { address: string; deployed: boolean; error?: string }
  } = {
    qnaContract: {
      address: CONTRACT_ADDRESSES.QNA_CONTRACT,
      deployed: false,
    },
    tokenContract: {
      address: CONTRACT_ADDRESSES.TOKEN_CONTRACT,
      deployed: false,
    },
  }

  // QnA 컨트랙트 확인
  if (results.qnaContract.address) {
    try {
      console.log('[배포 확인] QnA 컨트랙트 주소:', results.qnaContract.address)
      const code = await provider.getCode(results.qnaContract.address)
      console.log(
        '[배포 확인] QnA 컨트랙트 코드:',
        code ? `${code.slice(0, 20)}...` : '없음'
      )
      results.qnaContract.deployed =
        code !== '0x' && code !== '0x0' && code.length > 2
      if (!results.qnaContract.deployed) {
        results.qnaContract.error =
          '컨트랙트 코드가 없습니다. Remix에서 다시 배포하세요.'
      }
    } catch (error: any) {
      console.error('[배포 확인] QnA 컨트랙트 확인 실패:', error)
      // "signal already cancelled" 에러는 무시하고 실제 에러 메시지 사용
      if (
        error.message?.includes('signal') ||
        error.message?.includes('cancelled')
      ) {
        results.qnaContract.error =
          '네트워크 요청이 취소되었습니다. 다시 시도하세요.'
      } else {
        results.qnaContract.error = error.message || '확인 실패'
      }
    }
  } else {
    results.qnaContract.error = '주소가 설정되지 않았습니다.'
  }

  // Token 컨트랙트 확인
  if (results.tokenContract.address) {
    try {
      console.log(
        '[배포 확인] Token 컨트랙트 주소:',
        results.tokenContract.address
      )
      const code = await provider.getCode(results.tokenContract.address)
      console.log(
        '[배포 확인] Token 컨트랙트 코드:',
        code ? `${code.slice(0, 20)}...` : '없음'
      )
      results.tokenContract.deployed =
        code !== '0x' && code !== '0x0' && code.length > 2
      if (!results.tokenContract.deployed) {
        results.tokenContract.error =
          '컨트랙트 코드가 없습니다. Remix에서 다시 배포하세요.'
      }
    } catch (error: any) {
      console.error('[배포 확인] Token 컨트랙트 확인 실패:', error)
      // "signal already cancelled" 에러는 무시하고 실제 에러 메시지 사용
      if (
        error.message?.includes('signal') ||
        error.message?.includes('cancelled')
      ) {
        results.tokenContract.error =
          '네트워크 요청이 취소되었습니다. 다시 시도하세요.'
      } else {
        results.tokenContract.error = error.message || '확인 실패'
      }
    }
  } else {
    results.tokenContract.error = '주소가 설정되지 않았습니다.'
  }

  return results
}
