import { useEffect, useRef, useState } from 'react';

export function usePopoverPosition(triggerRef, open) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!open || !triggerRef?.current) {
      setRect(null);
      return;
    }

    const updatePosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (triggerRect) {
        setRect({
          top: triggerRect.bottom,
          left: triggerRect.left,
          width: triggerRect.width,
        });
      }
    };

    updatePosition();
    const resizeObs = new ResizeObserver(updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    resizeObs.observe(triggerRef.current);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      resizeObs.disconnect();
    };
  }, [open, triggerRef]);

  return rect;
}
