import React from 'react';
import { type MovingAverageType, getDefaultPeriods } from '../utils/movingAverages';

export interface MovingAverageSettings {
  enabled: boolean;
  type: MovingAverageType;
  period: number;
  color: string;
  label: string;
}

export interface MovingAverageConfig {
  short: MovingAverageSettings;
  medium: MovingAverageSettings;
  long: MovingAverageSettings;
}

interface MovingAverageConfigProps {
  config: MovingAverageConfig;
  interval: string;
  onChange: (config: MovingAverageConfig) => void;
}

export const MovingAverageConfigPanel: React.FC<MovingAverageConfigProps> = ({
  config,
  interval,
  onChange,
}) => {
  const defaults = getDefaultPeriods(interval);

  const updateSetting = (
    term: 'short' | 'medium' | 'long',
    field: keyof MovingAverageSettings,
    value: any
  ) => {
    const newConfig = {
      ...config,
      [term]: {
        ...config[term],
        [field]: value,
      },
    };
    onChange(newConfig);
  };

  const resetToDefaults = () => {
    const newConfig: MovingAverageConfig = {
      short: {
        enabled: false,
        type: 'EMA',
        period: defaults.short,
        color: '#3B82F6', // 藍色
        label: '短期',
      },
      medium: {
        enabled: false,
        type: 'EMA',
        period: defaults.medium,
        color: '#EF4444', // 紅色
        label: '中期',
      },
      long: {
        enabled: false,
        type: 'SMA',
        period: defaults.long,
        color: '#10B981', // 綠色
        label: '長期',
      },
    };
    onChange(newConfig);
  };

  const renderSettingRow = (term: 'short' | 'medium' | 'long', settings: MovingAverageSettings) => (
    <div key={term} className="bg-white rounded-lg p-3 border">
      {/* 標題行 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSetting(term, 'enabled', e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">{settings.label}</span>
          {settings.enabled && (
            <span className="ml-2 text-xs text-gray-500">
              {settings.type}{settings.period}
            </span>
          )}
        </div>
        <div className="flex items-center">
          <input
            type="color"
            value={settings.color}
            onChange={(e) => updateSetting(term, 'color', e.target.value)}
            disabled={!settings.enabled}
            className="w-6 h-6 border border-gray-300 rounded disabled:opacity-50 cursor-pointer"
          />
        </div>
      </div>

      {/* 設定控制 - 只在啟用時顯示 */}
      {settings.enabled && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">類型</label>
            <select
              value={settings.type}
              onChange={(e) => updateSetting(term, 'type', e.target.value as MovingAverageType)}
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="SMA">SMA (簡單移動平均)</option>
              <option value="EMA">EMA (指數移動平均)</option>
              <option value="VWMA">VWMA (量價加權平均)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">週期</label>
            <input
              type="number"
              value={settings.period}
              onChange={(e) => updateSetting(term, 'period', parseInt(e.target.value) || 1)}
              min="1"
              max="200"
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );

  const enabledCount = Object.values(config).filter(setting => setting.enabled).length;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">均線設定</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            已啟用: {enabledCount}/3
          </span>
          <button
            onClick={resetToDefaults}
            className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            重置預設值
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {renderSettingRow('short', config.short)}
        {renderSettingRow('medium', config.medium)}
        {renderSettingRow('long', config.long)}
      </div>

      {/* 說明文字 */}
      <div className="mt-4 text-xs text-gray-600 space-y-1 bg-white rounded p-3">
        <p><strong>SMA:</strong> 簡單移動平均線 - 取最近N期的平均值</p>
        <p><strong>EMA:</strong> 指數移動平均線 - 給予近期價格更高權重</p>
        <p><strong>VWMA:</strong> 成交量加權移動平均線 - 考慮成交量的影響</p>
        <p className="mt-2 pt-2 border-t">
          <strong>建議週期 ({interval}):</strong> 
          短期 {defaults.short} / 中期 {defaults.medium} / 長期 {defaults.long}
        </p>
      </div>
    </div>
  );
};