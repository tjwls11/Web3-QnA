"use client"

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

type MarkdownContentProps = {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) return null

  return (
    <div
      className={cn(
        'text-sm leading-relaxed whitespace-pre-wrap break-words',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')

            if (!inline) {
              return (
                <pre
                  className="mb-3 rounded-md bg-muted px-3 py-2 text-xs overflow-x-auto"
                  {...props}
                >
                  <code className={className}>{children}</code>
                </pre>
              )
            }

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


