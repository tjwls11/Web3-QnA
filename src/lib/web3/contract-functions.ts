import * as storage from '../storage'
import { Contract, BrowserProvider, keccak256, toUtf8Bytes } from 'ethers'
import { JsonRpcProvider } from 'ethers'
import {
  getRpcProvider,
  getBrowserProvider,
  checkNetwork,
  switchNetwork,
} from './provider'
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from './config'
import { TOKEN_CONTRACT_ABI, QNA_CONTRACT_ABI } from '../contracts/abi'

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
  console.log(
    '[토큰 컨트랙트] 환경 변수:',
    process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS
  )

  if (!contractAddress || contractAddress === '') {
    console.error('[토큰 컨트랙트] 주소가 설정되지 않았습니다!')
    console.error(
      '[토큰 컨트랙트] .env.local 파일에 NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS를 확인하세요.'
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
    console.log('[전송] ✅ 성공!')
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

      // 토큰 잔액 업데이트 (실제 블록체인 잔액 조회)
      const newBalance = await getTokenBalance(signerAddress)
      const balanceInWAK = Number(newBalance) / 1e18

      await fetch('/api/auth/token-balance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenBalance: balanceInWAK,
        }),
      })
    } catch (saveError) {
      console.error('[전송] 내역 저장 실패:', saveError)
      // 내역 저장 실패해도 전송은 성공한 것으로 처리
    }

    return true
  } catch (error: any) {
    console.error('[전송] ❌ 실패:', error)

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

// ETH를 WAK 토큰으로 환전하는 함수
export async function buyTokensWithEth(ethAmount: bigint): Promise<boolean> {
  console.log('=== ETH → WAK 환전 시작 ===')
  console.log('[환전] ETH 금액 (wei):', ethAmount.toString())
  console.log('[환전] ETH 금액 (ETH):', Number(ethAmount) / 1e18)

  let provider: BrowserProvider | null = null
  let signer: any = null

  try {
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

    // 컨트랙트 인스턴스 생성 (쓰기 가능)
    const contract = new Contract(
      CONTRACT_ADDRESSES.TOKEN_CONTRACT,
      TOKEN_CONTRACT_ABI,
      signer
    )

    console.log('[환전] 컨트랙트 인스턴스 생성 완료')

    // 실제 가스비 예상 (estimateGas 사용)
    let estimatedGasCost = BigInt(0)
    try {
      const gasEstimate = await contract.buyTokens.estimateGas({
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

    console.log('[환전] 환전 트랜잭션 전송 중...')

    // buyTokens 함수 호출 (ETH와 함께)
    const tx = await contract.buyTokens({ value: ethAmount })
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

    console.log('[환전] ✅ 성공!')
    console.log('[환전] 블록 번호:', receipt.blockNumber)
    console.log('[환전] 가스 사용량:', receipt.gasUsed?.toString() || 'N/A')

    // 환전 내역 저장 및 토큰 잔액 업데이트
    try {
      const ethAmountInEth = Number(ethAmount) / 1e18
      const rate = await getExchangeRate()
      // rate는 18자리 기준이므로 1e18로 나눠서 실제 비율 계산
      // 예: rate = 100 * 10^18이면 1 ETH = 100 WAK
      const rateInEth = Number(rate) / 1e18
      const wakAmount = ethAmountInEth * rateInEth

      // 거래 내역 저장
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

      // 토큰 잔액 업데이트 (실제 블록체인 잔액 조회)
      const newBalance = await getTokenBalance(signerAddress)
      const balanceInWAK = Number(newBalance) / 1e18

      await fetch('/api/auth/token-balance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenBalance: balanceInWAK,
        }),
      })
    } catch (saveError) {
      console.error('[환전] 내역 저장 실패:', saveError)
      // 내역 저장 실패해도 환전은 성공한 것으로 처리
    }

    return true
  } catch (error: any) {
    console.error('[환전] ❌ 실패:', error)

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

// 환전 비율 조회 (rate 변수 조회)
export async function getExchangeRate(): Promise<bigint> {
  try {
    const contract = getTokenContractReadOnly()
    if (!contract) {
      console.error('[환전 비율] 컨트랙트 인스턴스를 생성할 수 없습니다.')
      // 기본값: 0.01 ETH = 1 WAK (1 ETH = 100 WAK)
      // rate는 18자리 기준이므로 100 * 10^18
      return BigInt(100) * BigInt(10 ** 18)
    }

    try {
      const rate = await contract.rate()
      return BigInt(rate.toString())
    } catch (err: any) {
      console.warn('[환전 비율] 조회 실패, 기본값 사용:', err)
      // 기본값: 0.01 ETH = 1 WAK (1 ETH = 100 WAK)
      return BigInt(100) * BigInt(10 ** 18)
    }
  } catch (err: any) {
    console.error('[환전 비율] ❌ 최종 실패:', err)
    // 기본값: 0.01 ETH = 1 WAK (1 ETH = 100 WAK)
    return BigInt(100) * BigInt(10 ** 18)
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

      console.log('[컨트랙트 조회] ✅ 성공!')
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
    console.error('[컨트랙트 조회] ❌ 최종 실패:', err)
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
          // 먼저 컨트랙트가 존재하는지 확인 (name(), symbol(), totalSupply() 호출)
          console.log('[조회] 컨트랙트 정보 확인 중...')
          let contractExists = false
          try {
            const contractName = await contract.name()
            const contractSymbol = await contract.symbol()
            const contractTotalSupply = await contract.totalSupply()
            console.log('[조회] ✅ 컨트랙트 존재 확인!')
            console.log('[조회] 컨트랙트 이름:', contractName)
            console.log('[조회] 컨트랙트 심볼:', contractSymbol)
            console.log('[조회] 총 공급량:', contractTotalSupply.toString())
            contractExists = true
          } catch (nameError: any) {
            console.error('[조회] ❌ 컨트랙트 정보 조회 실패!')
            console.error('[조회] 에러 코드:', nameError?.code)
            console.error('[조회] 에러 메시지:', nameError?.message)
            console.error('[조회] 에러 짧은 메시지:', nameError?.shortMessage)
            console.error(
              '[조회] 컨트랙트가 존재하지 않거나 ABI가 맞지 않을 수 있습니다.'
            )
            console.error(
              '[조회] 컨트랙트 주소:',
              CONTRACT_ADDRESSES.TOKEN_CONTRACT
            )
            console.error(
              '[조회] Etherscan 확인: https://sepolia.etherscan.io/address/' +
                CONTRACT_ADDRESSES.TOKEN_CONTRACT
            )

            // 컨트랙트가 존재하지 않으면 0 반환
            if (
              nameError?.code === 'BAD_DATA' ||
              nameError?.code === 'CALL_EXCEPTION'
            ) {
              console.error(
                '[조회] 컨트랙트가 존재하지 않습니다. 배포를 확인하세요.'
              )
              return BigInt(0)
            }
          }

          // 컨트랙트가 존재하는 경우에만 balanceOf 호출
          if (contractExists) {
            console.log('[조회] balanceOf 호출 중...')
            console.log('[조회] 조회할 주소:', address)
            const balance = await contract.balanceOf(address)
            const balanceBigInt = BigInt(balance.toString())
            const balanceInWAK = Number(balanceBigInt) / 1e18

            console.log('[조회] ✅ BrowserProvider로 성공!')
            console.log('[조회] 잔액 (wei):', balanceBigInt.toString())
            console.log('[조회] 잔액 (WAK):', balanceInWAK)

            return balanceBigInt
          } else {
            // 컨트랙트가 존재하지 않으면 0 반환
            return BigInt(0)
          }
        } catch (balanceError: any) {
          // BAD_DATA 에러 (0x 반환)는 실제로 0을 의미할 수 있음
          console.error('[조회] balanceOf 호출 중 에러 발생!')
          console.error('[조회] 에러 코드:', balanceError?.code)
          console.error('[조회] 에러 메시지:', balanceError?.message)
          console.error('[조회] 에러 짧은 메시지:', balanceError?.shortMessage)
          console.error('[조회] 에러 value:', balanceError?.value)
          console.error('[조회] 에러 info:', balanceError?.info)

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
                '[조회] ✅ BrowserProvider 재시도 성공! 잔액:',
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
      console.error('[조회] 컨트랙트 정보 조회 실패:', infoError)
      console.error('[조회] 에러 상세:', {
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

        console.error('[조회] balanceOf 호출 중 에러 발생!')
        console.error('[조회] 에러 메시지:', errorMessage)
        console.error('[조회] 에러 짧은 메시지:', errorShortMessage)
        console.error('[조회] 에러 코드:', errorCode)
        console.error('[조회] 에러 이름:', errorName)
        if (errorReason) {
          console.error('[조회] 에러 이유:', errorReason)
        }
        if (errorData) {
          console.error('[조회] 에러 데이터:', errorData)
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

        // UNSUPPORTED_OPERATION이지만 cancelled가 아닌 경우는 실제 에러
        if (errorCode === 'UNSUPPORTED_OPERATION' && !isCancelledError) {
          console.error('[조회] ⚠️ UNSUPPORTED_OPERATION 에러 (cancelled 아님)')
          console.error('[조회] RPC Provider가 준비되지 않았을 수 있습니다.')
          console.error(
            '[조회] 잠시 후 다시 시도하거나 BrowserProvider를 사용하세요.'
          )
          // RPC Provider 문제일 수 있으므로 재시도하거나 BrowserProvider 사용 권장
          throw balanceError
        }

        // RPC 연결 에러인 경우
        if (
          errorMessage.includes('network') ||
          errorMessage.includes('connection') ||
          errorMessage.includes('timeout') ||
          errorCode === 'NETWORK_ERROR' ||
          errorCode === 'TIMEOUT'
        ) {
          console.error('[조회] RPC 연결 에러 발생!')
          console.error('[조회] RPC URL을 확인하세요:', NETWORK_CONFIG.rpcUrl)
          return BigInt(0)
        }

        // 다른 에러는 다시 throw하여 외부 catch에서 처리
        throw balanceError
      }

      if (balance === undefined || balance === null) {
        console.error('[조회] balanceOf가 undefined 또는 null을 반환했습니다!')
        return BigInt(0)
      }

      const balanceBigInt = BigInt(balance.toString())
      const balanceInWAK = Number(balanceBigInt) / 1e18

      console.log('[조회] ✅ 성공!')
      console.log('[조회] 잔액 (wei):', balanceBigInt.toString())
      console.log('[조회] 잔액 (WAK):', balanceInWAK)

      // 만약 잔액이 0이면, 컨트랙트 주소의 잔액도 확인해보기
      if (balanceBigInt === BigInt(0)) {
        console.warn('[조회] ⚠️ 컨트랙트 주소의 잔액이 0입니다!')
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
            console.error('[조회] ❌ 토큰이 컨트랙트 주소로 mint되었습니다!')
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

      console.error('[조회] balanceOf 호출 실패:', err)
      console.error('[조회] 에러 상세:', {
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

    console.error('[조회] ❌ 최종 실패:', err)
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

    console.log('[Approve] ✅ 성공!')
    console.log('[Approve] 블록 번호:', receipt.blockNumber)

    return true
  } catch (error: any) {
    console.error('[Approve] ❌ 실패:', error)

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
      console.warn('[질문] ⚠️ 블록체인 잔액이 부족하지만 DB 잔액이 충분합니다.')
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

    console.log('[질문] ✅ 성공!')
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
    console.error('[질문] ❌ 실패:', error)

    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.')
    } else if (error.message) {
      throw error
    } else {
      throw new Error('질문 등록에 실패했습니다.')
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

    // QnA 컨트랙트 인스턴스 생성
    const qnaContract = getQnAContract(signer)
    if (!qnaContract) {
      throw new Error('QnA 컨트랙트 인스턴스를 생성할 수 없습니다.')
    }

    console.log('[채택] 답변 채택 트랜잭션 전송 중...')

    // 답변 채택 (토큰이 자동으로 분배됨)
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

    console.log('[채택] ✅ 성공!')
    console.log('[채택] 블록 번호:', receipt.blockNumber)

    return true
  } catch (error: any) {
    console.error('[채택] ❌ 실패:', error)

    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.')
    } else if (error.message) {
      throw error
    } else {
      throw new Error('답변 채택에 실패했습니다.')
    }
  }
}
