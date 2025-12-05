// Web3 설정

// 네트워크 설정 (테스트넷 또는 메인넷)
export const NETWORK_CONFIG = {
  chainId: 11155111, // Sepolia
  rpcUrl:
    process.env.NEXT_PUBLIC_RPC_URL ||
    'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
  name: 'Sepolia',
}

// 컨트랙트 주소
// AKVaultToken(WAKVaultToken) 하나에 "토큰 + 금고 + 스왑"을 모두 합쳤으므로,
// 기본적으로 NEXT_PUBLIC_WAK_VAULT_SWAP_CONTRACT_ADDRESS 하나만 설정해도 되게 한다.
const VAULT_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_WAK_VAULT_SWAP_CONTRACT_ADDRESS ||
  process.env.NEXT_PUBLIC_WAK_TOKEN_CONTRACT_ADDRESS ||
  ''

export const CONTRACT_ADDRESSES = {
  QNA_CONTRACT: process.env.NEXT_PUBLIC_QNA_CONTRACT_ADDRESS || '',
  // ERC20 WAK 토큰 컨트랙트 주소 (AKVaultToken)
  TOKEN_CONTRACT:
    process.env.NEXT_PUBLIC_WAK_TOKEN_CONTRACT_ADDRESS || VAULT_TOKEN_ADDRESS,
  // ETH 금고 + 고정 환율 스왑 컨트랙트 주소 (AKVaultToken)
  WAK_VAULT_SWAP_CONTRACT: VAULT_TOKEN_ADDRESS,
}

// IPFS 설정 (질문/답변 내용 저장용)
export const IPFS_CONFIG = {
  gateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  // Pinata 또는 다른 IPFS 서비스 사용 시
  pinataApiKey: process.env.NEXT_PUBLIC_PINATA_API_KEY || '',
  pinataSecretKey: process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || '',
}



