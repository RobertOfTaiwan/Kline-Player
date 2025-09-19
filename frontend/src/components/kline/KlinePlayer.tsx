import { KlineChart } from '../KlineChart';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Play, Pause, Square, RotateCcw } from 'lucide-react';
import { useKlinePlayer } from '@/contexts/KlinePlayerContext';

export function KlinePlayer() {
  const {
    status,
    currentData,
    selectedSymbol,
    selectedInterval,
    viewMode,
    speed,
    movingAverageConfig,
    historicalData,
    isPlaying,
    progress,
    setSpeed,
    handlePlay,
    handlePause,
    handleStop,
    handleReset,
  } = useKlinePlayer();

  return (
    <div className="h-screen flex flex-col">
      {/* 標題和播放控制區域 */}
      <div className="bg-white border-b p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              K線圖播放器
            </h1>
            <p className="text-sm text-gray-700">
              歷史 K線資料回放與技術分析工具
            </p>
          </div>

          {/* 播放控制 - 當有歷史資料時總是顯示，或者在播放器模式下總是顯示 */}
          {(historicalData.length > 0 || viewMode === 'player') && (
            <div className="flex items-center gap-4">
              {/* 播放控制按鈕 - 只在播放器模式下顯示 */}
              {viewMode === 'player' && (
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handlePlay}
                    disabled={historicalData.length === 0 || isPlaying}
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Play className="h-4 w-4" />
                    播放
                  </Button>
                  <Button 
                    onClick={handlePause}
                    disabled={!isPlaying}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    <Pause className="h-4 w-4" />
                    暫停
                  </Button>
                  <Button 
                    onClick={handleStop}
                    disabled={historicalData.length === 0}
                    size="sm"
                    variant="destructive"
                    className="flex items-center gap-1"
                  >
                    <Square className="h-4 w-4" />
                    停止
                  </Button>
                  <Button 
                    onClick={handleReset}
                    disabled={historicalData.length === 0}
                    size="sm"
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <RotateCcw className="h-4 w-4" />
                    重置
                  </Button>
                </div>
              )}

              {/* 播放速度控制 - 只在播放器模式下顯示 */}
              {viewMode === 'player' && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">播放速度:</Label>
                  <Select value={speed.toString()} onValueChange={(value) => setSpeed(parseInt(value))}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                      <SelectItem value="3">3x</SelectItem>
                      <SelectItem value="5">5x</SelectItem>
                      <SelectItem value="10">10x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 進度條 - 只在播放器模式下顯示 */}
              {viewMode === 'player' && (
                <div className="flex items-center gap-2 min-w-48">
                  <span className="text-xs text-gray-600 whitespace-nowrap">
                    進度: {Math.round(progress)}%
                  </span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* 數據資訊 - 總是顯示 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {viewMode === 'static' ? '靜態模式' : '播放器模式'}
                  {historicalData.length > 0 && ` | 顯示: ${currentData.length} / 總共: ${historicalData.length}`}
                  {historicalData.length === 0 && currentData.length > 0 && ` | 資料筆數: ${currentData.length}`}
                  {historicalData.length === 0 && currentData.length === 0 && ' | 請載入資料'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 狀態信息 */}
        <div className="mt-2">
          <span className={`text-sm font-medium ${
            status.includes('錯誤') || status.includes('失敗') 
              ? 'text-red-600' 
              : status.includes('成功') 
                ? 'text-green-600' 
                : status.includes('載入')
                  ? 'text-blue-600'
                  : 'text-gray-600'
          }`}>
            {status}
          </span>
        </div>
      </div>

      {/* 圖表區域 */}
      <div className="flex-1 bg-white min-h-0">
        {(currentData.length > 0 || historicalData.length > 0) ? (
          <div className="h-full p-4">
            <KlineChart 
              data={currentData.length > 0 ? currentData : historicalData} 
              symbol={selectedSymbol} 
              interval={selectedInterval}
              movingAverageConfig={movingAverageConfig}
              historicalData={historicalData}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4">📈</div>
              <div className="text-xl font-medium mb-2">K線圖表</div>
              <div className="text-sm">
                {viewMode === 'static' ? '請從左側面板載入資料查看圖表' : '請從左側面板載入資料並播放'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
