import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp, Coins, Award, Crown } from "lucide-react"

const topUsers = [
  {
    rank: 1,
    name: "개발고수A",
    avatar: "/top1.jpg",
    tokens: 5240,
    answers: 234,
    accepted: 189,
    level: 12,
  },
  {
    rank: 2,
    name: "React전문가B",
    avatar: "/top2.jpg",
    tokens: 4890,
    answers: 198,
    accepted: 167,
    level: 11,
  },
  {
    rank: 3,
    name: "코딩마스터C",
    avatar: "/top3.jpg",
    tokens: 4320,
    answers: 176,
    accepted: 145,
    level: 10,
  },
]

const allRankings = Array.from({ length: 20 }, (_, i) => ({
  rank: i + 4,
  name: `개발자${i + 4}`,
  avatar: `/placeholder.svg?height=40&width=40&query=user${i + 4}`,
  tokens: 4000 - i * 200,
  answers: 150 - i * 7,
  accepted: 120 - i * 5,
  level: 10 - Math.floor(i / 3),
}))

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Trophy className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="mb-2 text-4xl font-bold">리더보드</h1>
          <p className="text-lg text-muted-foreground">최고의 기여자들을 확인하고 영감을 받으세요</p>
        </div>

        {/* 탭 */}
        <Tabs defaultValue="overall" className="mb-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="overall">전체</TabsTrigger>
            <TabsTrigger value="month">이번 달</TabsTrigger>
            <TabsTrigger value="week">이번 주</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Top 3 특별 표시 */}
        <div className="mb-12 grid gap-6 md:grid-cols-3">
          {topUsers.map((user) => (
            <Card
              key={user.rank}
              className={`relative overflow-hidden ${
                user.rank === 1
                  ? "border-yellow-500 bg-gradient-to-br from-yellow-500/10 to-transparent"
                  : user.rank === 2
                    ? "border-gray-400 bg-gradient-to-br from-gray-400/10 to-transparent"
                    : "border-orange-600 bg-gradient-to-br from-orange-600/10 to-transparent"
              }`}
            >
              {user.rank === 1 && <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-yellow-500/20" />}
              <CardHeader className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="relative">
                    <Avatar className="h-20 w-20 border-4 border-background">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full ${
                        user.rank === 1
                          ? "bg-yellow-500 text-yellow-950"
                          : user.rank === 2
                            ? "bg-gray-400 text-gray-900"
                            : "bg-orange-600 text-orange-50"
                      } font-bold shadow-lg`}
                    >
                      {user.rank === 1 ? <Crown className="h-6 w-6" /> : `#${user.rank}`}
                    </div>
                  </div>
                </div>
                <CardTitle className="mb-1">{user.name}</CardTitle>
                <Badge variant="secondary">Level {user.level}</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">토큰</span>
                    </div>
                    <span className="font-bold text-primary">{user.tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">답변</span>
                    </div>
                    <span className="font-semibold">{user.answers}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">채택</span>
                    </div>
                    <span className="font-semibold">{user.accepted}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 전체 랭킹 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle>전체 랭킹</CardTitle>
            <CardDescription>상위 100명의 기여자</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allRankings.map((user) => (
                <div
                  key={user.rank}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex w-8 items-center justify-center">
                      <span className="text-lg font-bold text-muted-foreground">#{user.rank}</span>
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-sm text-muted-foreground">Level {user.level}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-primary">{user.tokens.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">토큰</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{user.answers}</p>
                      <p className="text-xs text-muted-foreground">답변</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{user.accepted}</p>
                      <p className="text-xs text-muted-foreground">채택</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
