export interface PhaseResult {
  id: number;
  name: string;
  icon: string;
  color: string;
  agents: {
    name: string;
    result: string;
  }[];
}

export function getPhaseColor(color: string) {
    const colors: Record<string, string> = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      purple: 'from-purple-500 to-purple-600',
      red: 'from-red-500 to-red-600'
    };
    return colors[color] || 'from-gray-500 to-gray-600';
}
