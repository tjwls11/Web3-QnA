import type { Question, Answer } from './contracts/types'

const STORAGE_KEYS = {
  QUESTIONS: 'qna_questions',
  ANSWERS: 'qna_answers',
  BOOKMARKS: 'qna_bookmarks',
  USERS: 'qna_users',
  AUTH_USERS: 'qna_auth_users',
  CURRENT_USER: 'qna_current_user',
}

// 질문 저장 (MongoDB)
export async function saveQuestion(question: Question & { content: string }): Promise<boolean> {
  try {
    const response = await fetch('/api/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: question.id.toString(),
        author: question.author,
        title: question.title,
        content: question.content,
        contentHash: question.contentHash,
        reward: question.reward.toString(),
        tags: question.tags,
        createdAt: question.createdAt.toString(),
        status: question.status,
        githubUrl: question.githubUrl || '',
      }),
    })

    if (!response.ok) {
      throw new Error('질문 저장 실패')
    }

    return true
  } catch (error) {
    console.error('질문 저장 실패:', error)
    return false
  }
}

// 질문 조회 (MongoDB)
export async function getQuestions(): Promise<Array<Question & { content: string }>> {
  try {
    const response = await fetch('/api/questions')
    if (!response.ok) {
      throw new Error('질문 조회 실패')
    }
    const data = await response.json()
    if (!data.questions) {
      return []
    }
    
    // 문자열로 받은 BigInt 값들을 BigInt로 변환
    return data.questions.map((q: any) => ({
      ...q,
      id: BigInt(q.id),
      reward: BigInt(q.reward),
      createdAt: BigInt(q.createdAt),
      answerCount: BigInt(q.answerCount),
    }))
  } catch (error) {
    console.error('질문 조회 실패:', error)
    return []
  }
}

// 질문 ID로 조회 (MongoDB)
export async function getQuestionById(
  id: string | number | bigint
): Promise<(Question & { content: string }) | null> {
  try {
    const questionId = id.toString()
    const response = await fetch(`/api/questions?id=${encodeURIComponent(questionId)}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('질문 조회 실패:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        questionId,
      })
      
      // 404는 질문이 없는 것이므로 null 반환
      if (response.status === 404) {
        return null
      }
      
      throw new Error(`질문 조회 실패: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    if (!data.question) {
      return null
    }
    
    // 문자열로 받은 BigInt 값들을 BigInt로 변환
    return {
      ...data.question,
      id: BigInt(data.question.id),
      reward: BigInt(data.question.reward),
      createdAt: BigInt(data.question.createdAt),
      answerCount: BigInt(data.question.answerCount),
    }
  } catch (error) {
    console.error('질문 조회 실패:', error)
    return null
  }
}

// 사용자 질문 조회 (MongoDB)
export async function getUserQuestions(
  address: string
): Promise<Array<Question & { content: string }>> {
  try {
    const response = await fetch(`/api/questions?author=${address}`)
    if (!response.ok) {
      throw new Error('질문 조회 실패')
    }
    const data = await response.json()
    if (!data.questions) {
      return []
    }
    
    // 문자열로 받은 BigInt 값들을 BigInt로 변환
    return data.questions.map((q: any) => ({
      ...q,
      id: BigInt(q.id),
      reward: BigInt(q.reward),
      createdAt: BigInt(q.createdAt),
      answerCount: BigInt(q.answerCount),
    }))
  } catch (error) {
    console.error('질문 조회 실패:', error)
    return []
  }
}

// 답변 저장
export function saveAnswer(answer: Answer & { content: string }): void {
  const answers = getAnswers()
  answers.push(answer)
  
  // BigInt 값을 문자열로 변환하여 저장
  const serializedAnswers = answers.map((ans) => ({
    ...ans,
    id: ans.id.toString(),
    questionId: ans.questionId.toString(),
    createdAt: ans.createdAt.toString(),
  }))
  
  localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(serializedAnswers))
}

// 답변 조회
export function getAnswers(): Array<Answer & { content: string }> {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.ANSWERS)
  if (!data) return []
  
  const parsed = JSON.parse(data)
  
  // 문자열로 저장된 BigInt 값들을 다시 BigInt로 변환
  return parsed.map((ans: any) => ({
    ...ans,
    id: BigInt(ans.id),
    questionId: BigInt(ans.questionId),
    createdAt: BigInt(ans.createdAt),
  }))
}

// 질문 ID로 답변 조회
export function getAnswersByQuestionId(
  questionId: string | number
): Array<Answer & { content: string }> {
  const answers = getAnswers()
  return answers.filter(
    (a) => a.questionId.toString() === questionId.toString()
  )
}

// 찜하기 추가
export async function addBookmark(
  questionId: string | number,
  userAddress: string
): Promise<void> {
  // MongoDB에 저장
  try {
    const response = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questionId: questionId.toString(),
        userAddress: userAddress.toLowerCase(),
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('찜하기 추가 실패:', error)
      throw new Error(error.error || '찜하기 추가에 실패했습니다.')
    }

    // localStorage에도 저장 (로컬 캐시)
    const bookmarks = getBookmarks()
    const key = `${userAddress}_${questionId}`
    if (!bookmarks.includes(key)) {
      bookmarks.push(key)
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks))
    }
  } catch (error) {
    console.error('찜하기 추가 실패:', error)
    throw error
  }
}

// 찜하기 제거
export async function removeBookmark(
  questionId: string | number,
  userAddress: string
): Promise<void> {
  // MongoDB에서 제거
  try {
    const response = await fetch(
      `/api/bookmarks?questionId=${questionId.toString()}&userAddress=${userAddress.toLowerCase()}`,
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('찜하기 제거 실패:', error)
      throw new Error(error.error || '찜하기 제거에 실패했습니다.')
    }

    // localStorage에서도 제거
    const bookmarks = getBookmarks()
    const key = `${userAddress}_${questionId}`
    const filtered = bookmarks.filter((b) => b !== key)
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(filtered))
  } catch (error) {
    console.error('찜하기 제거 실패:', error)
    throw error
  }
}

// 찜하기 조회
export function getBookmarks(): string[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS)
  return data ? JSON.parse(data) : []
}

// 찜하기 여부 확인
export function isBookmarked(
  questionId: string | number,
  userAddress: string
): boolean {
  const bookmarks = getBookmarks()
  const key = `${userAddress}_${questionId}`
  return bookmarks.includes(key)
}

// 사용자 찜 목록 조회
export function getUserBookmarks(userAddress: string): string[] {
  const bookmarks = getBookmarks()
  return bookmarks
    .filter((b) => b.startsWith(`${userAddress}_`))
    .map((b) => b.split('_')[1])
}

// 사용자 답변 조회 (MongoDB)
export async function getUserAnswers(
  address: string
): Promise<Array<Answer & { content: string; questionTitle?: string }>> {
  try {
    const response = await fetch(`/api/answers?author=${address}`)
    if (!response.ok) {
      throw new Error('답변 조회 실패')
    }
    const data = await response.json()
    return data.answers || []
  } catch (error) {
    console.error('답변 조회 실패:', error)
    return []
  }
}

// 사용자 찜 목록 조회 (MongoDB)
export async function getUserBookmarksList(
  address: string
): Promise<Array<Question & { content: string }>> {
  try {
    const normalizedAddress = address.toLowerCase()
    console.log('[찜 목록] 조회 시작:', normalizedAddress)
    
    const response = await fetch(`/api/bookmarks?userAddress=${normalizedAddress}`)
    
    if (!response.ok) {
      const error = await response.json()
      console.error('[찜 목록] API 오류:', error)
      throw new Error(error.error || '찜 목록 조회 실패')
    }
    
    const data = await response.json()
    console.log('[찜 목록] 응답 데이터:', data)
    
    if (!data.questions || !Array.isArray(data.questions)) {
      console.log('[찜 목록] 질문이 없거나 배열이 아님')
      return []
    }
    
    // 문자열로 받은 BigInt 값들을 BigInt로 변환
    const questions = data.questions.map((q: any) => ({
      ...q,
      id: BigInt(q.id),
      reward: BigInt(q.reward || 0),
      createdAt: BigInt(q.createdAt),
      answerCount: BigInt(q.answerCount || 0),
    }))
    
    console.log('[찜 목록] 변환 완료:', questions.length, '개')
    return questions
  } catch (error: any) {
    console.error('[찜 목록] 조회 실패:', error)
    return []
  }
}

// 보상 내역 조회 (MongoDB)
export async function getUserRewards(
  address: string
): Promise<Array<{ type: string; amount: number; date: string; tx?: string }>> {
  try {
    const response = await fetch(`/api/rewards?userAddress=${address}`)
    if (!response.ok) {
      throw new Error('보상 내역 조회 실패')
    }
    const data = await response.json()
    return data.rewards || []
  } catch (error) {
    console.error('보상 내역 조회 실패:', error)
    return []
  }
}

// 활동 기록 조회 (MongoDB)
export async function getUserActivities(
  address: string
): Promise<Array<{ type: string; content: string; time: string }>> {
  try {
    const response = await fetch(`/api/activities?userAddress=${address}`)
    if (!response.ok) {
      throw new Error('활동 기록 조회 실패')
    }
    const data = await response.json()
    return data.activities || []
  } catch (error) {
    console.error('활동 기록 조회 실패:', error)
    return []
  }
}

// 거래 내역 조회 (환전/출금) (MongoDB) - email 기반
export async function getUserTransactions(): Promise<Array<{
  type: string
  ethAmount: number
  wakAmount: number
  transactionHash?: string
  status: string
  date: string
  time: string
  createdAt: number
}>> {
  try {
    const response = await fetch('/api/transactions')
    if (!response.ok) {
      throw new Error('거래 내역 조회 실패')
    }
    const data = await response.json()
    return data.transactions || []
  } catch (error) {
    console.error('거래 내역 조회 실패:', error)
    return []
  }
}

// 사용자 등록 (MongoDB)
export async function registerUser(address: string, userName: string): Promise<boolean> {
  try {
    console.log('[사용자 등록] 시작:', { address, userName })
    
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        userName,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.log('[사용자 등록] API 응답 오류:', { status: response.status, error })
      
      if (error.error?.includes('이미 등록된')) {
        console.log('[사용자 등록] 이미 등록된 사용자 - 성공으로 처리')
        return true // 이미 등록된 경우도 성공으로 처리
      }
      throw new Error(error.error || '사용자 등록 실패')
    }

    const result = await response.json()
    console.log('[사용자 등록] 성공:', result)
    return true
  } catch (error: any) {
    console.error('[사용자 등록] 실패:', error)
    throw error // 에러를 다시 throw하여 상위에서 처리할 수 있도록
  }
}

// 사용자 조회 (MongoDB)
export async function getUsers(): Promise<Record<
  string,
  { address: string; userName: string; registeredAt: number }
>> {
  try {
    const response = await fetch('/api/users')
    if (!response.ok) {
      throw new Error('사용자 조회 실패')
    }
    const data = await response.json()
    const users: Record<string, { address: string; userName: string; registeredAt: number }> = {}
    
    if (data.users) {
      data.users.forEach((user: any) => {
        users[user.address] = {
          address: user.address,
          userName: user.userName,
          registeredAt: user.registeredAt,
        }
      })
    }
    
    return users
  } catch (error) {
    console.error('사용자 조회 실패:', error)
    return {}
  }
}

// 사용자 등록 여부 확인 (MongoDB)
export async function isUserRegistered(address: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/users?address=${address}`)
    if (!response.ok) {
      return false
    }
    const data = await response.json()
    return !!data.user
  } catch (error) {
    console.error('사용자 등록 여부 확인 실패:', error)
    return false
  }
}

// 사용자 정보 조회 (MongoDB)
export async function getUserInfo(
  address: string
): Promise<{ address: string; userName: string; registeredAt: number } | null> {
  try {
    const response = await fetch(`/api/users?address=${address}`)
    if (!response.ok) {
      return null
    }
    const data = await response.json()
    if (!data.user) {
      return null
    }
    return {
      address: data.user.address,
      userName: data.user.userName,
      registeredAt: data.user.registeredAt,
    }
  } catch (error) {
    console.error('사용자 정보 조회 실패:', error)
    return null
  }
}

// 인증 사용자 타입
export interface AuthUser {
  email: string
  password: string // 실제로는 해시된 비밀번호를 저장해야 함
  createdAt: number
}

// 인증 사용자 저장
export function saveAuthUser(email: string, password: string): void {
  const authUsers = getAuthUsers()
  authUsers[email.toLowerCase()] = {
    email: email.toLowerCase(),
    password, // 실제 프로덕션에서는 해시된 비밀번호 저장
    createdAt: Date.now(),
  }
  localStorage.setItem(STORAGE_KEYS.AUTH_USERS, JSON.stringify(authUsers))
}

// 인증 사용자 조회
export function getAuthUsers(): Record<string, AuthUser> {
  if (typeof window === 'undefined') return {}
  const data = localStorage.getItem(STORAGE_KEYS.AUTH_USERS)
  return data ? JSON.parse(data) : {}
}

// 인증 사용자 확인
export function getAuthUser(email: string): AuthUser | null {
  const authUsers = getAuthUsers()
  return authUsers[email.toLowerCase()] || null
}

// 로그인 확인
export function verifyAuth(email: string, password: string): boolean {
  const user = getAuthUser(email)
  if (!user) return false
  return user.password === password // 실제 프로덕션에서는 해시 비교
}

// 현재 로그인한 사용자 저장
export function setCurrentUser(email: string | null): void {
  if (email) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, email.toLowerCase())
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
  }
}

// 현재 로그인한 사용자 조회
export function getCurrentUser(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
}
