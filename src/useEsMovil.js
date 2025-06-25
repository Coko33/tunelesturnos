import { useState, useEffect } from 'react';

export function useEsMovil(threshold = 768) {
  const [esMovil, setEsMovil] = useState(window.innerWidth < threshold);

  useEffect(() => {
    const handleResize = () => {
      setEsMovil(window.innerWidth < threshold);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [threshold]);

  return esMovil;
}