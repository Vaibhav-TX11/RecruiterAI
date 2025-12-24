import React, { useState } from 'react';
import { Phone, ThumbsUp, Clock, XCircle, ChevronDown } from 'lucide-react';
import { api } from '../../services/api';

export default function QuickActionDropdown({ potential, onStatusUpdate, batchId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const actions = [
    {
      value: 'to_be_called',
      label: 'To Be Called',
      icon: Phone,
      color: 'text-yellow-700 hover:bg-yellow-50',
      description: 'Mark for follow-up call'
    },
    {
      value: 'interested',
      label: 'Interested',
      icon: ThumbsUp,
      color: 'text-green-700 hover:bg-green-50',
      description: 'Promote to full candidate (Stage 2)'
    },
    {
      value: 'waiting_resume',
      label: 'Waiting Resume',
      icon: Clock,
      color: 'text-purple-700 hover:bg-purple-50',
      description: 'Waiting for updated resume'
    },
    {
      value: 'not_interested',
      label: 'Not Interested',
      icon: XCircle,
      color: 'text-red-700 hover:bg-red-50',
      description: 'Remove from screening'
    }
  ];

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    setIsOpen(false);

    try {
      await api.put(`/api/screening/potentials/${potential.id}/status`, {
        status: newStatus
      });
      
      // Show feedback
      if (newStatus === 'interested') {
        alert(`${potential.name} promoted to Stage 2! You can now find them in the Candidates page.`);
      }
      
      onStatusUpdate(potential.id);
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUpdating(false);
    }
  };

  const getCurrentAction = actions.find(a => a.value === potential.status) || actions[0];
  const CurrentIcon = getCurrentAction.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={updating}
        className={`flex items-center px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
          updating 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-gray-50'
        }`}
      >
        {updating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
            Updating...
          </>
        ) : (
          <>
            <CurrentIcon className="h-4 w-4 mr-1" />
            Action
            <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          ></div>

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-20 overflow-hidden">
            <div className="py-1">
              {actions.map((action) => {
                const Icon = action.icon;
                const isCurrentStatus = action.value === potential.status;
                
                return (
                  <button
                    key={action.value}
                    onClick={() => handleStatusChange(action.value)}
                    disabled={isCurrentStatus}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      isCurrentStatus 
                        ? 'bg-gray-100 cursor-not-allowed opacity-50' 
                        : action.color
                    }`}
                  >
                    <div className="flex items-start">
                      <Icon className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">
                          {action.label}
                          {isCurrentStatus && (
                            <span className="ml-2 text-xs font-normal text-gray-500">(Current)</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {action.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Info Footer */}
            <div className="border-t bg-gray-50 px-4 py-2">
              <p className="text-xs text-gray-600">
                💡 Tip: "Interested" promotes to Stage 2 for full analysis
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}