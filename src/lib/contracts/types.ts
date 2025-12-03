// 스마트 컨트랙트 타입 정의

export interface Question {
  id: bigint
  author: string
  title: string
  contentHash: string // IPFS 해시
  reward: bigint
  tags: string[]
  createdAt: bigint
  status: 'open' | 'answered' | 'solved'
  answerCount: bigint
  githubUrl?: string // 깃허브 링크 (선택사항)
}

export interface Answer {
  id: bigint
  questionId: bigint
  author: string
  contentHash: string // IPFS 해시
  createdAt: bigint
  isAccepted: boolean
}

export interface User {
  address: string
  userName: string
  registeredAt: bigint
  questionCount: bigint
  answerCount: bigint
  acceptedAnswerCount: bigint
  reputation: bigint
}

export interface Bookmark {
  questionId: bigint
  userAddress: string
  createdAt: bigint
}
