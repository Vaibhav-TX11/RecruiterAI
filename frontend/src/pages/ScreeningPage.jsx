import React, { useState, useEffect } from 'react';
import { Filter, Users, Clock, CheckCircle, AlertCircle, TrendingUp, Plus, RefreshCw } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { getCurrentUser } from '../services/auth';
import BatchCreationModal from '../components/screening/BatchCreationModal';
import PotentialsList from '../components/screening/PotentialsList';
import FilterPanel from '../components/screening/FilterPanel';
import BatchProgress from '../components/screening/BatchProgress';
import BatchActionButtons from '../components/screening/BatchActionButtons';
import { api } from '../services/api';

export default function ScreeningPage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [potentials, setPotentials] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activities, setActivities] = useState([]);
  
  const { lastMessage } = useWebSocket();
  const currentUser = getCurrentUser();
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    toCall: 0,
    interested: 0,
    waiting: 0,
    notInterested: 0
  });

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      loadPotentials(selectedBatch.id);
      loadActivities(selectedBatch.id);
    }
  }, [selectedBatch, currentPage]);

  useEffect(() => {
    // Real-time updates
    if (lastMessage?.type === 'potential_promoted' || lastMessage?.type === 'potential_rejected') {
      if (selectedBatch) {
        loadPotentials(selectedBatch.id);
        loadActivities(selectedBatch.id);
      }
    }
    
    // ✅ NEW: Handle batch status updates
    if (lastMessage?.type === 'batch_paused' || 
        lastMessage?.type === 'batch_resumed' || 
        lastMessage?.type === 'batch_cancelled' ||
        lastMessage?.type === 'batch_deleted') {
      loadBatches();
      if (selectedBatch) {
        if (lastMessage?.type === 'batch_deleted' && lastMessage?.batch_id === selectedBatch.id) {
          setSelectedBatch(null);
        } else {
          loadPotentials(selectedBatch.id);
        }
      }
    }
  }, [lastMessage]);

  const loadBatches = async () => {
    try {
      const { data } = await api.get('/api/screening/batches');
      setBatches(data);
      
      // If selected batch was deleted, clear selection
      if (selectedBatch && !data.find(b => b.id === selectedBatch.id)) {
        setSelectedBatch(data.length > 0 ? data[0] : null);
      } else if (data.length > 0 && !selectedBatch) {
        setSelectedBatch(data[0]);
      }
    } catch (error) {
      console.error('Failed to load batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPotentials = async (batchId, page = 1) => {
    try {
      const { data } = await api.get(`/api/screening/potentials/${batchId}`, {
        params: { page, per_page: 100 }
      });
      
      setPotentials(data.potentials || []);
      setTotalCount(data.total || 0);
      
      // Calculate stats
      const newStats = {
        total: data.total || 0,
        pending: 0,
        toCall: 0,
        interested: 0,
        waiting: 0,
        notInterested: 0
      };
      
      (data.potentials || []).forEach(p => {
        if (p.status === 'pending') newStats.pending++;
        else if (p.status === 'to_be_called') newStats.toCall++;
        else if (p.status === 'interested') newStats.interested++;
        else if (p.status === 'waiting_resume') newStats.waiting++;
        else if (p.status === 'not_interested') newStats.notInterested++;
      });
      
      setStats(newStats);
    } catch (error) {
      console.error('Failed to load potentials:', error);
    }
  };

  const loadActivities = async (batchId) => {
    try {
      const { data } = await api.get(`/api/screening/activities/${batchId}`, {
        params: { limit: 20 }
      });
      setActivities(data || []);
    } catch (error) {
      console.error('Failed to load activities:', error);
    }
  };

  const handleBatchCreated = async (newBatch) => {
    await loadBatches();
    setSelectedBatch(newBatch);
    setShowCreateModal(false);
  };

  const handleStatusUpdate = async (potentialId) => {
    if (selectedBatch) {
      await loadPotentials(selectedBatch.id, currentPage);
      await loadActivities(selectedBatch.id);
    }
  };

  const handleBatchUpdated = async () => {
    await loadBatches();
    if (selectedBatch) {
      await loadPotentials(selectedBatch.id, currentPage);
    }
  };

  if (loading) {
    return <div className="text-center p-12">Loading screening system...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Filter className="h-8 w-8 text-blue-600 mr-3" />
            Resume Screening (Stage 1)
          </h1>
          <p className="text-gray-600 mt-2">
            Quick triage: Process thousands of resumes to find top candidates
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Batch
        </button>
      </div>

      {/* Batch Selector with Action Buttons */}
      {batches.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <label className="text-sm font-medium text-gray-700">Active Batch:</label>
              <select
                value={selectedBatch?.id || ''}
                onChange={(e) => {
                  const batch = batches.find(b => b.id === parseInt(e.target.value));
                  setSelectedBatch(batch);
                  setCurrentPage(1);
                }}
                className="flex-1 max-w-md p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name} - {batch.status} ({batch.processed_count}/{batch.total_resumes})
                  </option>
                ))}
              </select>
            </div>

            {/* ✅ NEW: Batch Action Buttons */}
            <div className="flex items-center space-x-2 ml-4">
              <BatchActionButtons 
                batch={selectedBatch} 
                onBatchUpdated={handleBatchUpdated}
                userRole={currentUser?.role}
              />
              <button
                onClick={() => selectedBatch && loadPotentials(selectedBatch.id, currentPage)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                title="Refresh"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ✅ NEW: Status Badge for Current Batch */}
          {selectedBatch && (
            <div className="mt-3 flex items-center space-x-2">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedBatch.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                selectedBatch.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                selectedBatch.status === 'ready' ? 'bg-green-100 text-green-800' :
                selectedBatch.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                selectedBatch.status === 'error' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {selectedBatch.status.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* No batches state */}
      {batches.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Filter className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-700 mb-2">No Screening Batches Yet</h3>
          <p className="text-gray-500 mb-6">
            Create your first batch to start processing resumes
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Batch
          </button>
        </div>
      ) : (
        <>
          {/* Progress Card */}
          {selectedBatch && (
            <BatchProgress batch={selectedBatch} />
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-gray-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Pending</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">To Call</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.toCall}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Interested</p>
                  <p className="text-2xl font-bold text-green-600">{stats.interested}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Waiting</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.waiting}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-purple-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Not Interested</p>
                  <p className="text-2xl font-bold text-red-600">{stats.notInterested}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-red-400" />
              </div>
            </div>
          </div>

          {/* Filter Toggle */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-4 py-2 rounded-lg border ${
                showFilters ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-50'
              }`}
            >
              <Filter className="h-5 w-5 mr-2" />
              Filters
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && selectedBatch && (
            <FilterPanel
              batch={selectedBatch}
              onFilterChange={() => loadPotentials(selectedBatch.id, 1)}
            />
          )}

          {/* Potentials List */}
          {selectedBatch && (
            <PotentialsList
              potentials={potentials}
              onStatusUpdate={handleStatusUpdate}
              batchId={selectedBatch.id}
            />
          )}

          {/* Pagination */}
          {totalCount > 100 && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Page {currentPage} of {Math.ceil(totalCount / 100)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / 100), p + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / 100)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {activities.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-2">
                {activities.slice(0, 10).map((activity, idx) => (
                  <div key={idx} className="text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    <span className="font-medium mr-2">{activity.user}</span>
                    <span>{activity.action.replace(/_/g, ' ')}</span>
                    {activity.details?.candidate_name && (
                      <span className="ml-1">: {activity.details.candidate_name}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Batch Creation Modal */}
      {showCreateModal && (
        <BatchCreationModal
          onClose={() => setShowCreateModal(false)}
          onBatchCreated={handleBatchCreated}
        />
      )}
    </div>
  );
}
