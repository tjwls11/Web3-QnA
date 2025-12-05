import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
)

const JWT_EXPIRES_IN = 7 * 24 * 60 * 60 // 7일 (초 단위)

// JWT 토큰 생성
export async function createToken(email: string): Promise<string> {
  const token = await new SignJWT({ email: email.toLowerCase() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN)
    .sign(secret)

  return token
}

// JWT 토큰 검증
export async function verifyToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return {
      email: payload.email as string,
    }
  } catch (error) {
    return null
  }
}







