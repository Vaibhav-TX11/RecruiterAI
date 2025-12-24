import React, { useState } from 'react';
import { Play, Pause, XCircle, Trash2, AlertTriangle } from 'lucide-react';
import { pauseBatch, resumeBatch, cancelBatch, deleteBatch } from '../../services/api';

export default function BatchActionButtons({ batch, onBatchUpdated, userRole }) {
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handlePause = async () => {
    if (!batch) return;
    
    setLoading(true);
    try {
      await pauseBatch(batch.id);
      onBatchUpdated();
    } catch (error) {
      console.error('Failed to pause batch:', error);
      alert('Failed to pause batch: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    if (!batch) return;
    
    setLoading(true);
    try {
      await resumeBatch(batch.id);
      onBatchUpdated();
    } catch (error) {
      console.error('Failed to resume batch:', error);
      alert('Failed to resume batch: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!batch) return;
    
    setLoading(true);
    try {
      await cancelBatch(batch.id);
      setShowCancelModal(false);
      onBatchUpdated();
    } catch (error) {
      console.error('Failed to cancel batch:', error);
      alert('Failed to cancel batch: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!batch) return;
    
    setLoading(true);
    try {
      await deleteBatch(batch.id);
      setShowDeleteModal(false);
      onBatchUpdated();
    } catch (error) {
      console.error('Failed to delete batch:', error);
      alert('Failed to delete batch: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (!batch) return null;

  const isProcessing = batch.status === 'processing';
  const isPaused = batch.status === 'paused';
  const isCompleted = batch.status === 'ready' || batch.status === 'completed';
  const isCancelled = batch.status === 'cancelled';
  const isError = batch.status === 'error';

  return (
    <>
      <div className="flex items-center space-x-2">
        {/* Pause Button - Only for processing batches */}
        {isProcessing && (
          <button
            onClick={handlePause}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            title="Pause batch processing"
          >
            <Pause className="h-4 w-4 mr-2" />
            Pause
          </button>
        )}

        {/* Resume Button - Only for paused batches */}
        {isPaused && (
          <button
            onClick={handleResume}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            title="Resume batch processing"
          >
            <Play className="h-4 w-4 mr-2" />
            Resume
          </button>
        )}

        {/* Cancel Button - For processing or paused batches */}
        {(isProcessing || isPaused) && (
          <button
            onClick={() => setShowCancelModal(true)}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            title="Cancel batch processing"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </button>
        )}

        {/* Delete Button - Only for completed, cancelled, or error batches (Admin only) */}
        {(isCompleted || isCancelled || isError) && userRole === 'admin' && (
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            title="Delete batch and all data"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </button>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-600 mr-2" />
              <h3 className="text-xl font-bold">Cancel Batch Processing</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel batch "<strong>{batch.name}</strong>"?
            </p>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-orange-800">
                ⚠️ This will stop processing. Already processed candidates will be kept.
                Progress: {batch.processed_count}/{batch.total_resumes}
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Processing
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Yes, Cancel Batch
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <Trash2 className="h-6 w-6 text-red-600 mr-2" />
              <h3 className="text-xl font-bold">Delete Batch</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to permanently delete batch "<strong>{batch.name}</strong>"?
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800 font-medium mb-2">
                ⚠️ This action cannot be undone!
              </p>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• All {batch.processed_count} candidates will be deleted</li>
                <li>• All screening data will be lost</li>
                <li>• Activity logs will be removed</li>
              </ul>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Yes, Delete Batch
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
