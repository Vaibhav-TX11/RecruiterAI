import React from 'react';
import { Loader, CheckCircle, AlertCircle, Clock, Folder } from 'lucide-react';

export default function BatchProgress({ batch }) {
  if (!batch) return null;

  const percentage = batch.total_resumes > 0 
    ? Math.round((batch.processed_count / batch.total_resumes) * 100)
    : 0;

  const getStatusInfo = () => {
    switch (batch.status) {
      case 'processing':
        return {
          icon: Loader,
          color: 'bg-blue-100 border-blue-300 text-blue-800',
          bgBar: 'bg-blue-600',
          label: 'Processing',
          message: 'System is extracting information from resumes...'
        };
      case 'ready':
        return {
          icon: CheckCircle,
          color: 'bg-green-100 border-green-300 text-green-800',
          bgBar: 'bg-green-600',
          label: 'Ready',
          message: 'All resumes processed successfully!'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'bg-red-100 border-red-300 text-red-800',
          bgBar: 'bg-red-600',
          label: 'Error',
          message: 'An error occurred during processing'
        };
      default:
        return {
          icon: Clock,
          color: 'bg-gray-100 border-gray-300 text-gray-800',
          bgBar: 'bg-gray-600',
          label: 'Pending',
          message: 'Waiting to start...'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={`rounded-lg border-2 p-6 mb-6 ${statusInfo.color}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <StatusIcon className={`h-6 w-6 ${batch.status === 'processing' ? 'animate-spin' : ''}`} />
          <div>
            <h3 className="text-lg font-semibold">{batch.name}</h3>
            <p className="text-sm opacity-80">{statusInfo.message}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{percentage}%</div>
          <div className="text-xs opacity-80">
            {batch.processed_count} / {batch.total_resumes}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white bg-opacity-50 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${statusInfo.bgBar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Batch Info */}
      <div className="mt-4 pt-4 border-t border-current opacity-50 grid grid-cols-2 gap-4">
        <div className="flex items-center text-sm">
          <Folder className="h-4 w-4 mr-2" />
          <span className="truncate">{batch.folder_path}</span>
        </div>
        <div className="flex items-center text-sm justify-end">
          <Clock className="h-4 w-4 mr-2" />
          <span>Created: {new Date(batch.created_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Real-time indicator */}
      {batch.status === 'processing' && (
        <div className="mt-3 flex items-center text-xs">
          <div className="w-2 h-2 bg-current rounded-full mr-2 animate-pulse"></div>
          <span>Processing in real-time...</span>
        </div>
      )}
    </div>
  );
}