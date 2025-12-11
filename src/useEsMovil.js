import { useState, useEffect } from 'react';

export function useEsMovil(threshold = 768) {
  const [esMovil, setEsMovil] = useState(window.innerWidth < threshold);

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setEsMovil(window.innerWidth < threshold);
      }, 250); // Debounce de 250ms
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId); // Limpiar el timeout al desmontar
    };
  }, [threshold]);

  return esMovil;
}