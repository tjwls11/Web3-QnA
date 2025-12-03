import { IPFS_CONFIG } from './web3/config'

export interface IPFSContent {
  title?: string
  content: string
  tags?: string[]
}

// IPFS에 콘텐츠 업로드
export async function uploadToIPFS(data: IPFSContent): Promise<string> {
  try {
    // Pinata를 사용하는 경우
    if (IPFS_CONFIG.pinataApiKey && IPFS_CONFIG.pinataSecretKey) {
      return await uploadToPinata(data)
    }

    // 기본 IPFS 노드 사용 (로컬 또는 공개 게이트웨이)
    return await uploadToPublicIPFS(data)
  } catch (error) {
    console.error('IPFS 업로드 실패:', error)
    throw new Error('콘텐츠 업로드에 실패했습니다.')
  }
}

// Pinata를 통한 업로드
async function uploadToPinata(data: IPFSContent): Promise<string> {
  const formData = new FormData()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  formData.append('file', blob)

  const metadata = JSON.stringify({
    name: data.title || 'Content',
  })
  formData.append('pinataMetadata', metadata)

  const options = JSON.stringify({
    cidVersion: 0,
  })
  formData.append('pinataOptions', options)

  const response = await fetch(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    {
      method: 'POST',
      headers: {
        pinata_api_key: IPFS_CONFIG.pinataApiKey,
        pinata_secret_api_key: IPFS_CONFIG.pinataSecretKey,
      },
      body: formData,
    }
  )

  if (!response.ok) {
    throw new Error('Pinata 업로드 실패')
  }

  const result = await response.json()
  return result.IpfsHash
}

async function uploadToPublicIPFS(data: IPFSContent): Promise<string> {
  const content = JSON.stringify(data)
  const hash = await generateHash(content)

  if (typeof window !== 'undefined') {
    localStorage.setItem(`ipfs_${hash}`, content)
  }

  return hash
}

async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex.slice(0, 16) // 간단한 해시
}

// IPFS에서 콘텐츠 다운로드
export async function downloadFromIPFS(hash: string): Promise<IPFSContent> {
  try {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`ipfs_${hash}`)
      if (cached) {
        return JSON.parse(cached)
      }
    }

    // IPFS 게이트웨이에서 다운로드
    const response = await fetch(`${IPFS_CONFIG.gateway}${hash}`)
    if (!response.ok) {
      throw new Error('IPFS 다운로드 실패')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('IPFS 다운로드 실패:', error)
    throw new Error('콘텐츠를 불러올 수 없습니다.')
  }
}

// IPFS URL 생성
export function getIPFSUrl(hash: string): string {
  return `${IPFS_CONFIG.gateway}${hash}`
}
