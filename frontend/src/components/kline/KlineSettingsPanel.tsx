import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Loader2 } from 'lucide-react';
import { useKlinePlayer } from '@/contexts/KlinePlayerContext';

export function KlineSettingsPanel() {
  const {
    loading,
    selectedSymbol,
    selectedInterval,
    viewMode,
    startTime,
    endTime,
    symbols,
    intervals,
    setSelectedSymbol,
    setSelectedInterval,
    setViewMode,
    setStartTime,
    setEndTime,
    handleLoadData,
  } = useKlinePlayer();

  return (
    <div className="space-y-6">
      {/* 視圖模式選擇 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            視圖模式
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="static"
              name="viewMode"
              value="static"
              checked={viewMode === 'static'}
              onChange={(e) => setViewMode(e.target.value as 'static' | 'player')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="static" className="text-sm">靜態模式</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="player"
              name="viewMode"
              value="player"
              checked={viewMode === 'player'}
              onChange={(e) => setViewMode(e.target.value as 'static' | 'player')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="player" className="text-sm">播放器模式</Label>
          </div>
        </CardContent>
      </Card>

      {/* 參數設定 */}
      <Card>
        <CardHeader>
          <CardTitle>參數設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="symbol">幣別</Label>
            <select
              id="symbol"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full p-2 border border-input rounded-md text-sm"
            >
              {symbols.map((symbol) => (
                <option key={symbol.value} value={symbol.value}>
                  {symbol.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">時間區間</Label>
            <select
              id="interval"
              value={selectedInterval}
              onChange={(e) => setSelectedInterval(e.target.value)}
              className="w-full p-2 border border-input rounded-md text-sm"
            >
              {intervals.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startTime">開始時間</Label>
            <Input
              id="startTime"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endTime">結束時間</Label>
            <Input
              id="endTime"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="text-sm"
            />
          </div>

          <Button
            onClick={handleLoadData}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                載入中...
              </>
            ) : (
              '載入資料'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}