import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface TeamMember {
  name: string
  role: string
  github: string
  image: string
}

const teamMembers: TeamMember[] = [
  {
    name: '백서진',
    role: '팀장',
    github: 'https://github.com/000712',
    image: '/team/geonhee.jpg',
  },
  {
    name: '윤지현',
    role: '커뮤니티 담당 팀원',
    github: 'https://github.com/hyejeong22',
    image: '/team/hyejeong.png',
  },

  {
    name: '임한글',
    role: '커뮤니티 담당 팀원',
    github: 'https://github.com/tjwls11 ',
    image: '/team/seojin.png',
  },
]

export default function TeamPage() {
  return (
    <div className="container mx-auto px-4">
      {/* 팀 소개 섹션 */}
      <section className="py-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 px-8">
          {teamMembers.map((member, index) => (
            <div key={index} className="bg-white rounded-xl shadow-md p-8">
              <div className="relative w-full aspect-square mb-8">
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  sizes="(max-width: 768px) 100vw,(max-width: 1200px) 50vw,25vw"
                  className="rounded-lg object-cover"
                  priority={index < 2}
                />
              </div>
              <h2 className="text-xl font-semibold mb-4">{member.name}</h2>
              <p className="text-gray-600 mb-8">{member.role}</p>
              <div className="space-y-4">
                <Link
                  href={member.github}
                  className="block text-blue-600 hover:text-blue-800 transition-colors"
                  target="_blank"
                >
                  GitHub
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
