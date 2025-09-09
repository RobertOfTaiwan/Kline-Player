import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface PlayerControlsProps {
  isPlaying: boolean;
  progress: number;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onReset: () => void;
  onSeek: (progress: number) => void;
  onSpeedChange: (value: number) => void;
}

const speedOptions = [
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '3', label: '3x' },
  { value: '5', label: '5x' },
  { value: '10', label: '10x' },
];

export function PlayerControls({
  isPlaying,
  progress,
  speed,
  onPlay,
  onPause,
  onStop,
  onReset,
  onSeek,
  onSpeedChange,
}: PlayerControlsProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            <Button
              variant={isPlaying ? "secondary" : "default"}
              size="sm"
              onClick={onPlay}
              disabled={isPlaying}
            >
              <Play className="h-4 w-4" />
              播放
            </Button>
            
            <Button
              variant={isPlaying ? "default" : "secondary"}
              size="sm"
              onClick={onPause}
              disabled={!isPlaying}
            >
              <Pause className="h-4 w-4" />
              暫停
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onStop}
            >
              <Square className="h-4 w-4" />
              停止
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
            >
              <RotateCcw className="h-4 w-4" />
              重置
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="speed" className="whitespace-nowrap">播放速度</Label>
            <Select value={speed.toString()} onValueChange={(value) => onSpeedChange(Number(value))}>
              <SelectTrigger className="w-[80px]">
                <SelectValue placeholder="速度" />
              </SelectTrigger>
              <SelectContent>
                {speedOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              進度
            </span>
            <div className="flex-1">
              <Slider
                value={[progress]}
                onValueChange={(value) => onSeek(value[0])}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            <span className="text-sm text-muted-foreground min-w-[3ch]">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}