import React, { useState, useEffect } from 'react';
import { Plus, Briefcase, X, Calendar, Users } from 'lucide-react';
import { getJobs, createJob } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    experience_years: 0,
    created_by: 'HR Manager'
  });
  const [creating, setCreating] = useState(false);
  const { lastMessage } = useWebSocket();  // ✅ Add this

  const loadJobs = async () => {
    try {
      const data = await getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  // ✅ Add this useEffect for real-time updates
  useEffect(() => {
    if (lastMessage?.type === 'job_created') {
      loadJobs();
    }
  }, [lastMessage]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    
    try {
      await createJob(formData);
      setShowCreateModal(false);
      setFormData({ title: '', description: '', experience_years: 0, created_by: 'HR Manager' });
      await loadJobs();
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to create job: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="text-center p-12">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Job Descriptions ({jobs.length})</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Job
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Briefcase className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-700 mb-2">No Jobs Yet</h3>
          <p className="text-gray-500 mb-6">Create your first job description to start matching candidates</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Job
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <Briefcase className="h-8 w-8 text-blue-600" />
                <span className={`px-2 py-1 text-xs rounded-full ${
                  job.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {job.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <h3 className="text-xl font-bold mb-2">{job.title}</h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">{job.description}</p>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-500">
                  <Users className="h-4 w-4 mr-2" />
                  {job.experience_years} years experience required
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="h-4 w-4 mr-2" />
                  {new Date(job.created_at).toLocaleDateString()}
                </div>
              </div>

              {job.required_skills && job.required_skills.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Required Skills:</p>
                  <div className="flex flex-wrap gap-1">
                    {job.required_skills.slice(0, 5).map((skill, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {skill}
                      </span>
                    ))}
                    {job.required_skills.length > 5 && (
                      <span className="px-2 py-1 text-xs text-gray-500">
                        +{job.required_skills.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold">Create Job Description</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Senior Backend Engineer"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Description *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Paste the full job description here. Include responsibilities, requirements, and nice-to-haves..."
                  rows="10"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The system will automatically extract required skills from the description
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Years of Experience Required
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={formData.experience_years}
                  onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}