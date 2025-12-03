'use client'

import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Github } from 'lucide-react'

export default function GitHubPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 lg:px-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Github className="h-8 w-8 text-primary" />
              <CardTitle className="text-2xl">GitHub</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                WAK QnA 프로젝트의 GitHub 저장소입니다.
              </p>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">프로젝트 정보</h3>
                <p className="text-sm text-muted-foreground">
                  이 페이지는 임시 페이지입니다. 실제 GitHub 저장소 링크를 추가하세요.
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

