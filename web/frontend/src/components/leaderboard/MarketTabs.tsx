'use client';

import React from 'react';

type Market = 'US' | 'HK' | 'CN';

interface MarketTabsProps {
  activeMarket: Market;
  onMarketChange: (market: Market) => void;
  marketLabels: Record<Market, string>;
}

export function MarketTabs({ activeMarket, onMarketChange, marketLabels }: MarketTabsProps) {
  const markets: Market[] = ['US', 'HK', 'CN'];
  
  const getMarketIcon = (market: Market) => {
    switch (market) {
      case 'US':
        return 'fa-flag-usa';
      case 'HK':
        return 'fa-building';
      case 'CN':
        return 'fa-landmark';
      default:
        return 'fa-chart-line';
    }
  };

  return (
    <div className="mb-8">
      <div className="grid grid-cols-3 gap-4">
        {markets.map((market) => (
          <button
            key={market}
            onClick={() => onMarketChange(market)}
            className={`
              relative px-6 py-4 font-semibold text-base rounded-xl transition-all duration-300
              ${activeMarket === market
                ? 'bg-gradient-to-br from-accent-primary to-accent-secondary text-white transform scale-105 shadow-glow-cyan'
                : 'bg-dark-secondary text-text-secondary hover:bg-dark-tertiary border border-dark-border hover:border-accent-primary'
              }
            `}
          >
            <div className="flex flex-col items-center space-y-2">
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center transition-all
                ${activeMarket === market
                  ? 'bg-white/20 text-white'
                  : 'bg-gradient-to-br from-accent-primary to-accent-secondary text-white'
                }
              `}>
                <i className={`fas ${getMarketIcon(market)} text-xl`} />
              </div>
              <span>{marketLabels[market]}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
