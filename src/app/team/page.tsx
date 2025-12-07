'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/header'

interface TeamMember {
  name: string
  role: string
  github: string
  image: string
  githubUsername: string
}

const teamMembers: TeamMember[] = [
  {
    name: '백서진',
    role: '팀장 · 스마트 컨트랙트/아키텍처',
    github: 'https://github.com/tjwls11',
    image: '/team/seojin.jpg',
    githubUsername: 'tjwls11',
  },
  {
    name: '윤지현',
    role: '프론트엔드 · UI/UX 및 인터랙션 담당',
    github: 'https://github.com/hyejeong22',
    image: '/team/jihyun.jpg',
    githubUsername: 'hyyyeon',
  },
  {
    name: '임한글',
    role: '백엔드 · API·DB 및 서비스 운영 담당',
    github: 'https://github.com/hangeul245',
    image: '/team/han.jpg',
    githubUsername: 'hangeul245',
  },
]

function TeamCard({ member }: { member: TeamMember }) {
  const [githubAvatar, setGithubAvatar] = useState<string | null>(null)
  const [isHover, setIsHover] = useState(false)

  const handleMouseEnter = () => {
    setIsHover(true)

    if (!githubAvatar) {
      fetch(`https://api.github.com/users/${member.githubUsername}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.avatar_url) {
            setGithubAvatar(data.avatar_url)
          }
        })
        .catch((err) => {
          console.error('GitHub 프로필 불러오기 실패:', err)
        })
    }
  }

  const handleMouseLeave = () => {
    setIsHover(false)
  }

  const imageSrc = isHover && githubAvatar ? githubAvatar : member.image

  return (
    <Link
      href={member.github}
      target="_blank"
      rel="noopener noreferrer"
      className="group block w-full max-w-xs"
      aria-label={`${member.name} GitHub 프로필로 이동`}
    >
      <div
        className="relative w-full aspect-3/4 overflow-hidden rounded-2xl shadow-md transition-transform duration-300 group-hover:-translate-y-2 cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={imageSrc}
          alt={member.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/40 to-transparent p-4">
          <h2 className="text-lg font-semibold text-white">{member.name}</h2>
          <p className="text-sm text-gray-200">{member.role}</p>
          <p className="mt-1 text-xs text-gray-300 opacity-80">
            {isHover ? 'GitHub 프로필 보기 →' : '카드를 클릭하면 GitHub로 이동'}
          </p>
        </div>
      </div>
    </Link>
  )
}

export default function TeamPage() {
  return (
    <>
      <Header />

      <main className="container mx-auto px-4">
        <section className="py-16 md:py-24">
          <div className="mb-10 text-center">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              팀 소개
            </h1>
          </div>

          <div className="flex flex-wrap justify-center gap-10 md:gap-12">
            {teamMembers.map((member) => (
              <TeamCard key={member.githubUsername} member={member} />
            ))}
          </div>
          <br />
          <div className="mb-10 text-center mt-10 ">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              시연영상
            </h2>
            <video
              src="/videos/demo.mp4"
              controls
              className="w-full h-full max-w-4xl mx-auto object-cover mt-10"
            />
          </div>
        </section>
      </main>
    </>
  )
}
