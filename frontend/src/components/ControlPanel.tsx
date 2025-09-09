import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Symbol, Interval } from '@/lib/api';

interface ControlPanelProps {
  symbols: Symbol[];
  intervals: Interval[];
  selectedSymbol: string;
  selectedInterval: string;
  startDate: string;
  endDate: string;
  isLoading: boolean;
  onSymbolChange: (value: string) => void;
  onIntervalChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onLoadData: () => void;
}

export function ControlPanel({
  symbols,
  intervals,
  selectedSymbol,
  selectedInterval,
  startDate,
  endDate,
  isLoading,
  onSymbolChange,
  onIntervalChange,
  onStartDateChange,
  onEndDateChange,
  onLoadData,
}: ControlPanelProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="symbol">幣別</Label>
            <Select value={selectedSymbol} onValueChange={onSymbolChange}>
              <SelectTrigger>
                <SelectValue placeholder="選擇幣別" />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((symbol) => (
                  <SelectItem key={symbol.value} value={symbol.value}>
                    {symbol.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">時間區間</Label>
            <Select value={selectedInterval} onValueChange={onIntervalChange}>
              <SelectTrigger>
                <SelectValue placeholder="選擇時間區間" />
              </SelectTrigger>
              <SelectContent>
                {intervals.map((interval) => (
                  <SelectItem key={interval.value} value={interval.value}>
                    {interval.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">開始時間</Label>
            <input
              type="datetime-local"
              id="startDate"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">結束時間</Label>
            <input
              type="datetime-local"
              id="endDate"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label>&nbsp;</Label>
            <Button 
              onClick={onLoadData} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? '載入中...' : '載入資料'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}