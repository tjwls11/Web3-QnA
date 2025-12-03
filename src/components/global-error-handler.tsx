'use client'

import { useEffect } from 'react'

export function GlobalErrorHandler() {
  useEffect(() => {
    // 에러 메시지가 "signal already cancelled" 관련인지 확인하는 함수
    const isCancelledError = (error: any): boolean => {
      if (!error) return false

      const errorMessage = error?.message || error?.toString() || ''
      const errorCode = error?.code || ''

      return (
        errorCode === 'UNSUPPORTED_OPERATION' ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('signal') ||
        errorMessage.includes('fetchCancelSignal') ||
        errorMessage.includes('operation="fetchCancelSignal') ||
        errorMessage.includes('singal already cancelled')
      )
    }

    // 원본 console.error 저장
    const originalConsoleError = console.error
    const originalConsoleWarn = console.warn

    // console.error 오버라이드 (일시적으로 비활성화하여 실제 에러 확인)
    console.error = (...args: any[]) => {
      const firstArg = args[0]

      // "signal already cancelled" 에러만 필터링
      if (
        isCancelledError(firstArg) ||
        args.some((arg) => isCancelledError(arg))
      ) {
        // 취소 에러는 조용히 무시
        return
      }

      // 다른 모든 에러는 정상적으로 출력 (디버깅을 위해)
      originalConsoleError.apply(console, args)
    }

    // console.warn 오버라이드
    console.warn = (...args: any[]) => {
      const firstArg = args[0]

      // "signal already cancelled" 경고는 필터링
      if (
        isCancelledError(firstArg) ||
        args.some((arg) => isCancelledError(arg))
      ) {
        return // 경고를 출력하지 않음
      }

      // 다른 경고는 정상적으로 출력
      originalConsoleWarn.apply(console, args)
    }

    // 전역 unhandledrejection 이벤트 핸들러
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isCancelledError(event.reason)) {
        event.preventDefault() // 에러 전파 방지
        return
      }
    }

    // 전역 error 이벤트 핸들러
    const handleError = (event: ErrorEvent) => {
      if (isCancelledError(event.error)) {
        event.preventDefault() // 에러 전파 방지
        return
      }
    }

    // 이벤트 리스너 등록
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    // 클린업
    return () => {
      // 원본 console 메서드 복원
      console.error = originalConsoleError
      console.warn = originalConsoleWarn

      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])

  return null // UI 렌더링 없음
}
