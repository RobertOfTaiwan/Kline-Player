import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  Shield,
  Clock,
  Users,
  BarChart3,
  Zap,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

export function HomePage() {
  const features = [
    {
      name: '專業 K線圖播放器',
      description: '支援多種時間間隔（5m, 15m, 1h, 4h, 1d, 1w），可調節播放速度，提供沉浸式歷史資料回放體驗。',
      icon: TrendingUp,
    },
    {
      name: '智能移動平均線',
      description: '提供 SMA、EMA、VWMA 等多種移動平均線指標，支援自訂週期，幫助分析價格趨勢。',
      icon: BarChart3,
    },
    {
      name: '即時資料同步',
      description: '與 Binance 交易所即時同步，確保資料準確性，背景自動更新最新市場資訊。',
      icon: Zap,
    },
    {
      name: '企業級安全',
      description: '採用雙因子認證（Google Authenticator）、JWT Token 驗證、角色權限管控等安全機制。',
      icon: Shield,
    },
    {
      name: '歷史資料回放',
      description: '精確重現歷史市場走勢，支援靜態模式和動態播放，是學習和分析的完美工具。',
      icon: Clock,
    },
    {
      name: '多層級權限管理',
      description: '分為一般使用者、已註冊用戶、管理者三種角色，提供細緻化的功能存取控制。',
      icon: Users,
    },
  ];

  const supportedSymbols = [
    { symbol: 'BTC/USDT', name: 'Bitcoin', change: '+2.34%' },
    { symbol: 'ETH/USDT', name: 'Ethereum', change: '+1.87%' },
    { symbol: 'SOL/USDT', name: 'Solana', change: '+4.21%' },
  ];

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          專業的加密貨幣
          <span className="text-blue-600"> K線圖播放器</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
          提供完整的歷史 K線資料回放功能，支援多種技術指標與移動平均線，
          是專業交易者和學習者的最佳分析工具。
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Button size="lg" className="px-8">
            開始使用
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" size="lg">
            查看功能
          </Button>
        </div>
      </div>

      {/* Features Section */}
      <div className="mx-auto max-w-2xl lg:max-w-none">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            強大的功能特色
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600">
            集成多項專業級功能，提供完整的 K線分析體驗
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.name} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <feature.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">{feature.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Supported Symbols */}
      <div>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            支援的加密貨幣
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600">
            涵蓋主流加密貨幣的完整歷史資料
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {supportedSymbols.map((crypto) => (
            <Card key={crypto.symbol} className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-2xl">{crypto.symbol}</CardTitle>
                <CardDescription>{crypto.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-green-600 font-semibold text-lg">
                  {crypto.change}
                </div>
                <div className="text-sm text-gray-500 mt-2">24h 變化</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Technical Specs */}
      <div className="bg-gray-50 rounded-2xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            技術規格
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600">
            採用現代化技術架構，確保高效能與穩定性
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">前端技術</h3>
            <ul className="space-y-2">
              {[
                'React 19 + TypeScript',
                'Vite 構建工具',
                'Tailwind CSS + Shadcn UI',
                'Chart.js 圖表庫',
                '響應式設計'
              ].map((tech) => (
                <li key={tech} className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-sm text-gray-700">{tech}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">後端技術</h3>
            <ul className="space-y-2">
              {[
                'Python FastAPI',
                'PostgreSQL 資料庫',
                'SQLAlchemy ORM',
                'JWT 認證',
                'Google Authenticator OTP'
              ].map((tech) => (
                <li key={tech} className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-sm text-gray-700">{tech}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center bg-blue-600 rounded-2xl p-12 text-white">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          準備開始使用了嗎？
        </h2>
        <p className="mt-4 text-lg leading-8 text-blue-100">
          立即註冊，體驗專業級的 K線圖分析工具
        </p>
        <div className="mt-8 flex items-center justify-center gap-x-6">
          <Button size="lg" variant="secondary" className="px-8">
            免費註冊
          </Button>
          <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-blue-600">
            聯繫我們
          </Button>
        </div>
      </div>
    </div>
  );
}