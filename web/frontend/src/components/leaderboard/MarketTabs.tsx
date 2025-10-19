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
    <div className="border-b border-gray-200 mb-6">
      <div className="flex space-x-1 overflow-x-auto">
        {markets.map((market) => (
          <button
            key={market}
            onClick={() => onMarketChange(market)}
            className={`
              px-6 py-3 font-medium text-sm whitespace-nowrap transition-all duration-200
              ${activeMarket === market
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            <i className={`fas ${getMarketIcon(market)} mr-2`} />
            {marketLabels[market]}
          </button>
        ))}
      </div>
    </div>
  );
}
