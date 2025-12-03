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
export const CONTRACT_ADDRESSES = {
  QNA_CONTRACT: process.env.NEXT_PUBLIC_QNA_CONTRACT_ADDRESS || '',
  TOKEN_CONTRACT: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || '',
}

// IPFS 설정 (질문/답변 내용 저장용)
export const IPFS_CONFIG = {
  gateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  // Pinata 또는 다른 IPFS 서비스 사용 시
  pinataApiKey: process.env.NEXT_PUBLIC_PINATA_API_KEY || '',
  pinataSecretKey: process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || '',
}



