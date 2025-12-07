'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

type MarkdownContentProps = {
  content: string
  className?: string
}

// ReactMarkdown code 컴포넌트용 props 타입 명시
type CodeBlockProps = {
  inline?: boolean
  className?: string
  children?: React.ReactNode
  [key: string]: any
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) return null

  return (
    <div
      className={cn(
        'text-sm leading-relaxed whitespace-pre-wrap wrap-break-word',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: CodeBlockProps) {
            const match = /language-(\w+)/.exec(className || '')

            // 블록 코드
            if (!inline) {
              return (
                <pre className="mb-3 rounded-md bg-muted px-3 py-2 text-xs overflow-x-auto">
                  <code className={className}>{children}</code>
                </pre>
              )
            }

            // 인라인 코드
            return (
              <code
                className={cn(
                  'rounded bg-muted px-1.5 py-0.5 text-xs',
                  className
                )}
                {...props}
              >
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
