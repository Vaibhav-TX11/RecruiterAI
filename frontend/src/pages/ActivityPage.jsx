import React, { useState, useEffect } from 'react';
import { Activity, Clock, User, FileText, CheckCircle, Ban, MessageSquare, TrendingUp, Briefcase } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatTimeAgo, formatDateTime } from '../utils/dateUtils';
import axios from 'axios';

export default function ActivityPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const { lastMessage } = useWebSocket();

  const loadActivities = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:8000/api/activity', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivities(response.data);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    if (lastMessage) {
      loadActivities();
    }
  }, [lastMessage]);

  const getActivityIcon = (action) => {
    switch (action) {
      case 'uploaded_resume':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'status_change':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'blacklisted':
        return <Ban className="h-5 w-5 text-red-500" />;
      case 'unblacklisted':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'commented':
        return <MessageSquare className="h-5 w-5 text-purple-500" />;
      case 'matched':
        return <TrendingUp className="h-5 w-5 text-orange-500" />;
      case 'created_job':
        return <Briefcase className="h-5 w-5 text-indigo-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getActivityColor = (action) => {
    switch (action) {
      case 'uploaded_resume':
        return 'bg-blue-50 border-blue-200';
      case 'status_change':
        return 'bg-green-50 border-green-200';
      case 'blacklisted':
        return 'bg-red-50 border-red-200';
      case 'unblacklisted':
        return 'bg-green-50 border-green-200';
      case 'commented':
        return 'bg-purple-50 border-purple-200';
      case 'matched':
        return 'bg-orange-50 border-orange-200';
      case 'created_job':
        return 'bg-indigo-50 border-indigo-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getActivityDescription = (activity) => {
    const details = activity.details || {};
    
    switch (activity.action) {
      case 'uploaded_resume':
        return (
          <>
            uploaded resume for <strong>{details.candidate_name || 'a candidate'}</strong>
          </>
        );
      case 'status_change':
        return (
          <>
            changed status of <strong>{details.candidate_name || 'candidate'}</strong> to <strong>{details.new_status || 'unknown'}</strong>
          </>
        );
      case 'blacklisted':
        return (
          <>
            blacklisted <strong>{details.candidate_name || 'candidate'}</strong>
            {details.reason && (
              <>: <span className="text-red-600 italic">"{details.reason}"</span></>
            )}
          </>
        );
      case 'unblacklisted':
        return (
          <>
            removed <strong>{details.candidate_name || 'candidate'}</strong> from blacklist
          </>
        );
      case 'commented':
        return 'added a comment';
      case 'matched':
        return (
          <>
            matched candidate to job (<strong>{details.score || 0}% match</strong>)
          </>
        );
      case 'created_job':
        return (
          <>
            created job posting <strong>{details.job_title || 'New Job'}</strong>
            {details.skills_count && (
              <> with <strong>{details.skills_count} required skills</strong></>
            )}
          </>
        );
      default:
        return activity.action;
    }
  };

  if (loading) return <div className="text-center p-12">Loading activity...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Activity className="h-8 w-8 text-blue-600 mr-3" />
          Activity Log
        </h1>
        <p className="text-gray-600 mt-2">
          Track all actions and changes in the system
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-700 mb-2">No Activity Yet</h3>
          <p className="text-gray-500">Activity will appear here as actions are performed</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${getActivityColor(activity.action)}`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        <span className="font-semibold">{activity.user}</span>
                        {' '}
                        <span className="font-normal text-gray-600">
                          {getActivityDescription(activity)}
                        </span>
                      </p>
                      <div className="flex items-center text-sm text-gray-500 ml-4">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatTimeAgo(activity.timestamp)}
                      </div>
                    </div>
                    
                    {activity.timestamp && (
                      <div className="mt-2 text-xs text-gray-500">
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                          {formatDateTime(activity.timestamp)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}