'use client'

import { Github } from 'lucide-react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-primary text-white mt-5">
      <div className="max-w-6xl mx-auto sm:px-3 lg:px-8 py-6 flex flex-col items-center justify-center">
        <div className="flex gap-6 mb-3">
          <Link
            href="https://github.com/tjwls11/Web3-QnA"
            className="hover:text-gray-100 inline-flex items-center gap-2 text-base"
          >
            <Github className="h-5 w-5" />
            GitHub
          </Link>
          <Link
            href="/team"
            className="hover:text-gray-100 inline-flex items-center gap-2 text-base"
          >
            Team
          </Link>
          <Link
            href="/wak"
            className="hover:text-gray-100 inline-flex items-center gap-2 text-base"
          >
            Wak
          </Link>
        </div>
        <p className="text-sm text-gray-300">
          © 2025 WAK QnA. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
