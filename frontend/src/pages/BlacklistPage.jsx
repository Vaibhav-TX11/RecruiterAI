import React, { useState, useEffect } from 'react';
import { Ban, Trash2, RotateCcw, AlertTriangle, Calendar, User } from 'lucide-react';
import { getBlacklist, unblacklistCandidate } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatDate } from '../utils/dateUtils';

export default function BlacklistPage() {
  const [blacklisted, setBlacklisted] = useState([]);
  const [loading, setLoading] = useState(true);
  const { lastMessage } = useWebSocket();

  const loadBlacklist = async () => {
    try {
      const data = await getBlacklist();
      setBlacklisted(data);
    } catch (error) {
      console.error('Failed to load blacklist:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlacklist();
  }, []);

  useEffect(() => {
    if (lastMessage?.type === 'candidate_blacklisted' || lastMessage?.type === 'candidate_unblacklisted') {
      loadBlacklist();
    }
  }, [lastMessage]);

  const handleUnblacklist = async (candidateId) => {
    if (!confirm('Are you sure you want to remove this candidate from the blacklist?')) {
      return;
    }

    try {
      await unblacklistCandidate(candidateId);
      await loadBlacklist();
    } catch (error) {
      console.error('Failed to unblacklist:', error);
      alert('Failed to unblacklist candidate');
    }
  };

  if (loading) return <div className="text-center p-12">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Ban className="h-8 w-8 text-red-600 mr-3" />
          Blacklisted Candidates ({blacklisted.length})
        </h1>
        <p className="text-gray-600 mt-2">
          Candidates who have been blacklisted and will be flagged if they reapply
        </p>
      </div>

      {blacklisted.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Ban className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-700 mb-2">No Blacklisted Candidates</h3>
          <p className="text-gray-500">No candidates have been blacklisted yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blacklisted By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {blacklisted.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <Ban className="h-5 w-5 text-red-500 mr-2" />
                      <div>
                        <div className="font-medium text-gray-900">{candidate.name}</div>
                        <div className="text-xs text-gray-500">ID: {candidate.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-gray-900">{candidate.email || 'No email'}</div>
                    <div className="text-gray-500">{candidate.phone || 'No phone'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start">
                      <AlertTriangle className="h-4 w-4 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">
                        {candidate.blacklist_reason || 'No reason provided'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center text-gray-600">
                      <User className="h-4 w-4 mr-1" />
                      {candidate.blacklisted_by}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(candidate.blacklisted_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleUnblacklist(candidate.id)}
                      className="flex items-center px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 text-sm"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}