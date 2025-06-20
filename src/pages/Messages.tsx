
import React from 'react';
import { MessageSquare } from 'lucide-react';

export const Messages = () => {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Message Center</h1>
        <p className="text-lg text-gray-600">Under Development</p>
      </div>
    </div>
  );
};
