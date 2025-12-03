// Ethers.js Provider 설정

import { BrowserProvider, JsonRpcProvider } from 'ethers'
import { NETWORK_CONFIG } from './config'

// 브라우저에서 MetaMask Provider 가져오기
export function getBrowserProvider(): BrowserProvider | null {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null
  }

  try {
    return new BrowserProvider(window.ethereum)
  } catch (error) {
    console.error('Failed to create browser provider:', error)
    return null
  }
}

// RPC Provider 싱글톤 (읽기 전용 작업용)
let rpcProviderInstance: JsonRpcProvider | null = null

export function getRpcProvider(): JsonRpcProvider {
  if (!rpcProviderInstance) {
    try {
      // 네트워크 정보를 명시적으로 설정 (staticNetwork 옵션 제거)
      rpcProviderInstance = new JsonRpcProvider(NETWORK_CONFIG.rpcUrl, {
        name: NETWORK_CONFIG.name,
        chainId: NETWORK_CONFIG.chainId,
      })
    } catch (error) {
      console.error('RPC Provider 생성 실패:', error)
      // 폴백으로 새 인스턴스 생성
      rpcProviderInstance = new JsonRpcProvider(NETWORK_CONFIG.rpcUrl, {
        name: NETWORK_CONFIG.name,
        chainId: NETWORK_CONFIG.chainId,
      })
    }
  }
  return rpcProviderInstance
}

// 현재 연결된 네트워크 확인
export async function checkNetwork(provider: BrowserProvider): Promise<boolean> {
  try {
    const network = await provider.getNetwork()
    return Number(network.chainId) === NETWORK_CONFIG.chainId
  } catch (error) {
    console.error('Failed to check network:', error)
    return false
  }
}

// 네트워크 전환 요청
export async function switchNetwork(provider: BrowserProvider): Promise<boolean> {
  try {
    await provider.send('wallet_switchEthereumChain', [
      { chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}` },
    ])
    return true
  } catch (error: any) {
    // 네트워크가 없으면 추가 요청
    if (error.code === 4902) {
      try {
        await provider.send('wallet_addEthereumChain', [
          {
            chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}`,
            chainName: NETWORK_CONFIG.name,
            rpcUrls: [NETWORK_CONFIG.rpcUrl],
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18,
            },
          },
        ])
        return true
      } catch (addError) {
        console.error('Failed to add network:', addError)
        return false
      }
    }
    console.error('Failed to switch network:', error)
    return false
  }
}

declare global {
  interface Window {
    ethereum?: any
  }
}
