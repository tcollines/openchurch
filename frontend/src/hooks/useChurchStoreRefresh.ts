import { useEffect, useState } from 'react';
import { subscribeToChurchStore } from '@/services/churchService';

export const useChurchStoreRefresh = (): number => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return subscribeToChurchStore(() => {
      setTick((t) => t + 1);
    });
  }, []);

  return tick;
};

