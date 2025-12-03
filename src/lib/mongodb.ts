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
  // 연결 타임아웃 설정
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
  // 서버 선택 타임아웃
  serverSelectionTimeoutMS: 30000,
  // 재시도 설정
  retryWrites: true,
  retryReads: true,
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  // 개발 환경에서는 전역 변수를 사용하여 여러 번의 핫 리로드에서 재사용
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // 프로덕션 환경에서는 새로운 클라이언트 생성
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

export default clientPromise

