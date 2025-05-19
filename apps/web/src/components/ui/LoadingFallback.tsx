import React from 'react';

const LoadingFallback = ({ message = "Loading..." }: { message?: string }) => {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <p>{message}</p>
      {/* You can add a spinner icon here if you have one from lucide-react or similar */}
    </div>
  );
};

export default LoadingFallback; 