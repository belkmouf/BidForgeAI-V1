import { useState, useEffect } from 'react';

interface CustomCursorProps {
  variant?: 'default' | 'hover';
}

export function CustomCursor({ variant = 'default' }: CustomCursorProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', handleMouseMove);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed pointer-events-none z-[9999] transition-all duration-200 ease-out hidden lg:block"
      style={{ 
        left: mousePos.x,
        top: mousePos.y,
        transform: `translate(-50%, -50%) scale(${variant === 'hover' ? 2.5 : 1})`,
      }}
    >
      <div className={`w-10 h-10 border ${variant === 'hover' ? 'border-[#14a39e] bg-[#14a39e]/10' : 'border-[#14a39e]/40'} rounded-full flex items-center justify-center transition-colors duration-300`}>
        <div className="w-1 h-1 bg-[#c8a962] rounded-full shadow-sm"></div>
      </div>
    </div>
  );
}

export function DynamicBackground() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div 
        className="absolute inset-0 opacity-30 transition-opacity duration-1000"
        style={{
          backgroundImage: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, rgba(20, 163, 158, 0.15), transparent 40%)`,
        }}
      />
      <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-[#14a39e]/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#c8a962]/10 blur-[150px] rounded-full" />
    </div>
  );
}
