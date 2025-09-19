import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp } from 'lucide-react';
import { useKlinePlayer } from '@/contexts/KlinePlayerContext';

export function KlinePlayerSidebar() {
  const {
    loading,
    selectedSymbol,
    selectedInterval,
    viewMode,
    startTime,
    endTime,
    symbols,
    intervals,
    movingAverageConfig,
    setSelectedSymbol,
    setSelectedInterval,
    setViewMode,
    setStartTime,
    setEndTime,
    setMovingAverageConfig,
    handleLoadData,
  } = useKlinePlayer();

  return (
    <div className="p-4 space-y-4 border-t border-gray-200 bg-gray-50">
      {/* 視圖模式 */}
      <div>
        <Label className="text-xs font-medium mb-2 text-gray-700">視圖模式</Label>
        <div className="space-y-1">
          <label className="flex items-center text-xs">
            <input
              type="radio"
              name="viewMode"
              value="static"
              checked={viewMode === 'static'}
              onChange={(e) => setViewMode(e.target.value as 'static' | 'player')}
              className="mr-2 text-xs"
            />
            <span>靜態模式</span>
          </label>
          <label className="flex items-center text-xs">
            <input
              type="radio"
              name="viewMode"
              value="player"
              checked={viewMode === 'player'}
              onChange={(e) => setViewMode(e.target.value as 'static' | 'player')}
              className="mr-2 text-xs"
            />
            <span>播放器模式</span>
          </label>
        </div>
      </div>

      {/* 幣別選擇 */}
      <div>
        <Label className="text-xs font-medium mb-2 text-gray-700">幣別</Label>
        <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {symbols.map((symbol) => (
              <SelectItem key={symbol.value} value={symbol.value} className="text-xs">
                {symbol.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 時間區間 */}
      <div>
        <Label className="text-xs font-medium mb-2 text-gray-700">時間區間</Label>
        <Select value={selectedInterval} onValueChange={setSelectedInterval}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {intervals.map((interval) => (
              <SelectItem key={interval.value} value={interval.value} className="text-xs">
                {interval.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 開始時間 */}
      <div>
        <Label className="text-xs font-medium mb-2 text-gray-700">開始時間</Label>
        <Input 
          type="datetime-local" 
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {/* 結束時間 */}
      <div>
        <Label className="text-xs font-medium mb-2 text-gray-700">結束時間</Label>
        <Input 
          type="datetime-local" 
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {/* 載入按鈕 */}
      <Button 
        onClick={handleLoadData}
        disabled={loading}
        className="w-full h-8 text-xs flex items-center gap-1"
        size="sm"
      >
        <TrendingUp className="h-3 w-3" />
        {loading ? '載入中...' : '載入資料'}
      </Button>

      {/* 均線配置 - 簡化版 */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">均線設定</Label>
        <div className="space-y-1">
          {Object.entries(movingAverageConfig).map(([key, config]) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => {
                    const newConfig = {
                      ...movingAverageConfig,
                      [key]: {
                        ...config,
                        enabled: e.target.checked,
                      },
                    };
                    setMovingAverageConfig(newConfig);
                  }}
                  className="text-xs"
                />
                <span className="text-xs">{config.label}</span>
              </div>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  value={config.period}
                  onChange={(e) => {
                    const newConfig = {
                      ...movingAverageConfig,
                      [key]: {
                        ...config,
                        period: parseInt(e.target.value) || 1,
                      },
                    };
                    setMovingAverageConfig(newConfig);
                  }}
                  disabled={!config.enabled}
                  className="w-12 h-6 px-1 text-xs border border-gray-300 rounded disabled:opacity-50"
                  min="1"
                  max="200"
                />
                <input
                  type="color"
                  value={config.color}
                  onChange={(e) => {
                    const newConfig = {
                      ...movingAverageConfig,
                      [key]: {
                        ...config,
                        color: e.target.value,
                      },
                    };
                    setMovingAverageConfig(newConfig);
                  }}
                  disabled={!config.enabled}
                  className="w-6 h-6 border border-gray-300 rounded disabled:opacity-50 cursor-pointer"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
