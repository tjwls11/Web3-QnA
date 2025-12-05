import { MongoClient, MongoClientOptions } from 'mongodb'

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI

// MongoDB 연결 옵션 설정
const options: MongoClientOptions = {
  // SSL/TLS 설정
  tls: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false,
  // 연결 풀 설정
  maxPoolSize: 10,
  minPoolSize: 1,
  // 연결 타임아웃 설정 (더 길게 설정)
  connectTimeoutMS: 60000,
  socketTimeoutMS: 60000,
  // 서버 선택 타임아웃 (더 길게 설정)
  serverSelectionTimeoutMS: 60000,
  // 재시도 설정
  retryWrites: true,
  retryReads: true,
  // DNS 설정 개선
  directConnection: false,
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

// MongoDB 연결 함수 (에러 처리 개선)
const connectMongoDB = async (): Promise<MongoClient> => {
  try {
    const client = new MongoClient(uri, options)
    await client.connect()
    console.log('MongoDB 연결 성공')
    return client
  } catch (error: any) {
    console.error('MongoDB 연결 실패:', error.message)
    console.error('연결 URI 확인:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')) // 비밀번호 숨김
    throw new Error(`MongoDB 연결 실패: ${error.message}`)
  }
}

if (process.env.NODE_ENV === 'development') {
  // 개발 환경에서는 전역 변수를 사용하여 여러 번의 핫 리로드에서 재사용
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = connectMongoDB()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // 프로덕션 환경에서는 새로운 클라이언트 생성
  clientPromise = connectMongoDB()
}

export default clientPromise

