'use client'

import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 lg:px-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <CardTitle className="text-2xl">Team</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                WAK QnA 프로젝트를 함께 만드는 팀입니다.
              </p>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">팀 소개</h3>
                <p className="text-sm text-muted-foreground">
                  이 페이지는 임시 페이지입니다. 팀원 정보를 추가하세요.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}

