import React, { useState, useEffect } from 'react';
import { Search, Eye, X, Mail, Phone, Briefcase, GraduationCap, Filter, SlidersHorizontal, Calendar, Ban, MessageSquare, Lock, Trash2 } from 'lucide-react';
import { getCandidates, getCandidate, getComments, addComment, updateCandidateStatus, blacklistCandidate, unblacklistCandidate } from '../services/api';
import {api} from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatDate } from '../utils/dateUtils';
import { usePermissions, Can } from '../contexts/PermissionContext';
import PrivateNotes from '../components/PrivateNotes';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetails, setCandidateDetails] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [activeTab, setActiveTab] = useState('notes');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    status: 'all',
    skills: [],
    dateFrom: '',
    dateTo: '',
    sortBy: 'date-desc'
  });
  
  const { lastMessage } = useWebSocket();
  const { hasPermission } = usePermissions();

  // Get all unique skills from candidates
  const allSkills = [...new Set(
    candidates.flatMap(c => c.skills || [])
  )].sort();

  // Get all unique statuses
  const allStatuses = ['all', 'new', 'reviewed', 'interviewed', 'rejected', 'hired'];

  const loadCandidates = async () => {
    try {
      const data = await getCandidates();
      setCandidates(data);
    } catch (error) {
      console.error('Failed to load candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCandidateDetails = async (id) => {
    setLoadingDetails(true);
    try {
      const [details, commentsList] = await Promise.all([
        getCandidate(id),
        getComments(id)
      ]);
      setCandidateDetails(details);
      setComments(commentsList);
    } catch (error) {
      console.error('Failed to load candidate details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewCandidate = async (candidate) => {
    setSelectedCandidate(candidate);
    setActiveTab('notes'); // Reset to notes tab when opening
    await loadCandidateDetails(candidate.id);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      await addComment(selectedCandidate.id, newComment);
      
      setNewComment('');
      const updatedComments = await getComments(selectedCandidate.id);
      setComments(updatedComments);
    } catch (error) {
      console.error('Failed to add comment:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!candidateDetails) return;
    
    try {
      await updateCandidateStatus(
        candidateDetails.id,
        newStatus,
        candidateDetails.version,
        'HR Manager'
      );
      
      await loadCandidateDetails(candidateDetails.id);
      await loadCandidates();
    } catch (error) {
      if (error.response?.status === 409) {
        alert('This candidate was modified by another user. Please refresh and try again.');
        await loadCandidateDetails(candidateDetails.id);
      } else {
        console.error('Failed to update status:', error);
        alert('Failed to update status');
      }
    }
  };

  const handleBlacklist = async () => {
    if (!blacklistReason.trim()) {
      alert('Please provide a reason for blacklisting');
      return;
    }

    try {
      await blacklistCandidate(selectedCandidate.id, blacklistReason, 'HR Manager');
      setShowBlacklistModal(false);
      setBlacklistReason('');
      setSelectedCandidate(null);
      setCandidateDetails(null);
      await loadCandidates();
      alert('Candidate blacklisted successfully');
    } catch (error) {
      console.error('Failed to blacklist:', error);
      alert('Failed to blacklist candidate');
    }
  };

  const handleUnblacklist = async () => {
    if (!confirm('Are you sure you want to remove this candidate from the blacklist?')) {
      return;
    }

    try {
      await unblacklistCandidate(selectedCandidate.id);
      await loadCandidateDetails(selectedCandidate.id);
      await loadCandidates();
      alert('Candidate removed from blacklist');
    } catch (error) {
      console.error('Failed to unblacklist:', error);
      alert('Failed to remove from blacklist');
    }
  };

  const handleDeleteCandidate = async () => {
    if (!selectedCandidate) return;
    
    setDeleting(true);
    try {
      await api.delete(`/api/candidates/${selectedCandidate.id}`);
      
      setShowDeleteModal(false);
      setSelectedCandidate(null);
      setCandidateDetails(null);
      
      // Refresh candidates list
      await loadCandidates();
      
      alert('Candidate deleted successfully');
    } catch (error) {
      console.error('Failed to delete candidate:', error);
      alert('Failed to delete candidate: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  useEffect(() => {
    if (lastMessage?.type === 'new_candidate') {
      loadCandidates();
    }
    if (lastMessage?.type === 'new_comment' && selectedCandidate) {
      if (lastMessage.candidate_id === selectedCandidate.id) {
        loadCandidateDetails(selectedCandidate.id);
      }
    }
    if (lastMessage?.type === 'status_change' && selectedCandidate) {
      if (lastMessage.candidate_id === selectedCandidate.id) {
        loadCandidateDetails(selectedCandidate.id);
      }
      loadCandidates();
    }
    if (lastMessage?.type === 'candidate_blacklisted' || lastMessage?.type === 'candidate_unblacklisted') {
      loadCandidates();
      if (selectedCandidate) {
        loadCandidateDetails(selectedCandidate.id);
      }
    }
  }, [lastMessage, selectedCandidate]);

  // Apply all filters
  const filtered = candidates.filter(c => {
    // Filter out blacklisted candidates
    if (c.is_blacklisted) return false;

    // Text search
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || 
      c.name.toLowerCase().includes(searchLower) ||
      (c.email && c.email.toLowerCase().includes(searchLower)) ||
      (c.skills && c.skills.some(s => s.toLowerCase().includes(searchLower)));
    
    if (!matchesSearch) return false;

    // Status filter
    if (filters.status !== 'all' && c.status !== filters.status) return false;

    // Skills filter
    if (filters.skills.length > 0) {
      const hasAllSkills = filters.skills.every(skill => 
        c.skills && c.skills.some(s => s.toLowerCase() === skill.toLowerCase())
      );
      if (!hasAllSkills) return false;
    }

    // Date range filter
    if (filters.dateFrom) {
      const candidateDate = new Date(c.uploaded_at);
      const fromDate = new Date(filters.dateFrom);
      if (candidateDate < fromDate) return false;
    }
    if (filters.dateTo) {
      const candidateDate = new Date(c.uploaded_at);
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59);
      if (candidateDate > toDate) return false;
    }

    return true;
  });

  // Apply sorting
  const sorted = [...filtered].sort((a, b) => {
    switch (filters.sortBy) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'date-asc':
        return new Date(a.uploaded_at) - new Date(b.uploaded_at);
      case 'date-desc':
        return new Date(b.uploaded_at) - new Date(a.uploaded_at);
      case 'status':
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  const toggleSkillFilter = (skill) => {
    setFilters(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      skills: [],
      dateFrom: '',
      dateTo: '',
      sortBy: 'date-desc'
    });
    setSearch('');
  };

  const activeFilterCount = 
    (filters.status !== 'all' ? 1 : 0) +
    filters.skills.length +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (search ? 1 : 0);

  if (loading) return <div className="text-center p-12">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">All Candidates ({sorted.length})</h1>
          {filtered.length !== candidates.length && (
            <p className="text-sm text-gray-500 mt-1">
              Showing {sorted.length} of {candidates.filter(c => !c.is_blacklisted).length} candidates
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search candidates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 w-64"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-4 py-2 rounded-lg border ${
              showFilters ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="h-5 w-5 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Advanced Filters</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear All ({activeFilterCount})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {allStatuses.map(status => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          {/* Skills Filter */}
          {allSkills.length > 0 && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Skills ({filters.skills.length} selected)
              </label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
                {allSkills.map(skill => (
                  <button
                    key={skill}
                    onClick={() => toggleSkillFilter(skill)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.skills.includes(skill)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {search && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center">
              Search: "{search}"
              <button onClick={() => setSearch('')} className="ml-2 hover:text-blue-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.status !== 'all' && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center">
              Status: {filters.status}
              <button onClick={() => setFilters({ ...filters, status: 'all' })} className="ml-2 hover:text-blue-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.skills.map(skill => (
            <span key={skill} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center">
              Skill: {skill}
              <button onClick={() => toggleSkillFilter(skill)} className="ml-2 hover:text-blue-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {filters.dateFrom && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center">
              From: {filters.dateFrom}
              <button onClick={() => setFilters({ ...filters, dateFrom: '' })} className="ml-2 hover:text-blue-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.dateTo && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center">
              To: {filters.dateTo}
              <button onClick={() => setFilters({ ...filters, dateTo: '' })} className="ml-2 hover:text-blue-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Candidates Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skills</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                  {candidates.length === 0 ? 'No candidates yet' : 'No candidates match your filters'}
                </td>
              </tr>
            ) : (
              sorted.map(candidate => (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <span className="font-medium">{candidate.name}</span>
                      {candidate.is_blacklisted && (
                        <Ban className="h-4 w-4 text-red-500 ml-2" title="Blacklisted" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{candidate.email || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(candidate.skills || []).slice(0, 3).map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                      {(candidate.skills || []).length > 3 && (
                        <span className="px-2 py-1 text-xs text-gray-500">
                          +{candidate.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      candidate.status === 'new' ? 'bg-blue-100 text-blue-800' :
                      candidate.status === 'reviewed' ? 'bg-yellow-100 text-yellow-800' :
                      candidate.status === 'interviewed' ? 'bg-purple-100 text-purple-800' :
                      candidate.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {candidate.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(candidate.uploaded_at)}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleViewCandidate(candidate)}
                      className="text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center space-x-4">
                <h2 className="text-2xl font-bold">{selectedCandidate.name}</h2>
                {candidateDetails?.is_blacklisted && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium flex items-center">
                    <Ban className="h-4 w-4 mr-1" />
                    Blacklisted
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Can do="blacklist_candidate">
                  {candidateDetails && !candidateDetails.is_blacklisted && (
                    <button
                      onClick={() => setShowBlacklistModal(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Blacklist
                    </button>
                  )}
                </Can>
                
                <Can do="delete_candidate">
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 flex items-center"
                    title="Permanently delete candidate"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </button>
                </Can>
                
                {candidateDetails?.is_blacklisted && hasPermission('unblacklist_candidate') && (
                  <button
                    onClick={handleUnblacklist}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                  >
                    Remove Blacklist
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedCandidate(null);
                    setCandidateDetails(null);
                    setComments([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {loadingDetails ? (
              <div className="p-12 text-center">Loading details...</div>
            ) : candidateDetails ? (
              <div className="p-6 space-y-6">
                {/* Blacklist Warning */}
                {candidateDetails.is_blacklisted && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <Ban className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-900">This candidate is blacklisted</h4>
                        <p className="text-sm text-red-700 mt-1">
                          <strong>Reason:</strong> {candidateDetails.blacklist_reason}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Blacklisted by {candidateDetails.blacklisted_by} on{' '}
                          {new Date(candidateDetails.blacklisted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Change Dropdown */}
                <Can do="change_status">
                  {!candidateDetails.is_blacklisted && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Change Status</label>
                      <select
                        value={candidateDetails.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="new">New</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="interviewed">Interviewed</option>
                        <option value="rejected">Rejected</option>
                        <option value="hired">Hired</option>
                      </select>
                    </div>
                  )}
                </Can>

                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {candidateDetails.email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <span>{candidateDetails.email}</span>
                      </div>
                    )}
                    {candidateDetails.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <span>{candidateDetails.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Skills */}
                {candidateDetails.skills && candidateDetails.skills.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {candidateDetails.skills.map((skill, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience */}
                {candidateDetails.experience && candidateDetails.experience.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <Briefcase className="h-5 w-5 mr-2" />
                      Work Experience
                    </h3>
                    <div className="space-y-3">
                      {candidateDetails.experience.map((exp, idx) => (
                        <div key={idx} className="border-l-2 border-blue-500 pl-4">
                          <p className="font-medium">{exp.title || 'Position'}</p>
                          <p className="text-sm text-gray-600">{exp.company || 'Company'}</p>
                          <p className="text-xs text-gray-500">{exp.duration || 'Duration'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {candidateDetails.education && candidateDetails.education.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <GraduationCap className="h-5 w-5 mr-2" />
                      Education
                    </h3>
                    <div className="space-y-2">
                      {candidateDetails.education.map((edu, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded">
                          <p className="font-medium">{edu.degree || 'Degree'}</p>
                          {edu.institution && (
                            <p className="text-sm text-gray-600">{edu.institution}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                {candidateDetails.links && Object.keys(candidateDetails.links).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Links</h3>
                    <div className="space-y-2">
                      {Object.entries(candidateDetails.links).map(([key, value]) => (
                        <a
                          key={key}
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-600 hover:underline"
                        >
                          {key}: {value}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabs for Notes and Comments */}
                <div className="border-t pt-6">
                  <div className="flex space-x-4 border-b mb-4">
                    <button
                      onClick={() => setActiveTab('notes')}
                      className={`pb-2 px-4 font-medium transition-colors ${
                        activeTab === 'notes'
                          ? 'border-b-2 border-purple-600 text-purple-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4" />
                        <span>My Private Notes</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('comments')}
                      className={`pb-2 px-4 font-medium transition-colors ${
                        activeTab === 'comments'
                          ? 'border-b-2 border-blue-600 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="h-4 w-4" />
                        <span>Team Comments</span>
                        {comments.length > 0 && (
                          <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {comments.length}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Tab Content */}
                  {activeTab === 'notes' ? (
                    <PrivateNotes candidateId={selectedCandidate.id} />
                  ) : (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center">
                        <MessageSquare className="h-5 w-5 mr-2" />
                        Team Comments
                      </h3>
                      
                      {comments.length > 0 ? (
                        <div className="space-y-3 mb-4">
                          {comments.map((comment) => (
                            <div key={comment.id} className="p-3 bg-gray-50 rounded">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">{comment.hr_name}</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(comment.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">{comment.comment}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm mb-4">No team comments yet</p>
                      )}

                      <div>
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a team comment (visible to all)..."
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows="3"
                        />
                        <button
                          onClick={handleAddComment}
                          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Add Comment
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t text-sm text-gray-500">
                  <p>Uploaded by: {candidateDetails.uploaded_by}</p>
                  <p>Uploaded at: {new Date(candidateDetails.uploaded_at).toLocaleString()}</p>
                  <p>Version: {candidateDetails.version}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Blacklist Modal */}
      {showBlacklistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <Ban className="h-6 w-6 text-red-600 mr-2" />
              <h3 className="text-xl font-bold">Blacklist Candidate</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to blacklist <strong>{selectedCandidate?.name}</strong>?
              They will be flagged if they apply again.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Blacklisting *
              </label>
              <textarea
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                placeholder="e.g., Failed background check, Unprofessional behavior, False credentials..."
                rows="4"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500"
                autoFocus
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowBlacklistModal(false);
                  setBlacklistReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBlacklist}
                disabled={!blacklistReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Blacklist Candidate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <Trash2 className="h-6 w-6 text-red-600 mr-2" />
              <h3 className="text-xl font-bold">Delete Candidate</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to <strong className="text-red-600">permanently delete</strong>{' '}
              <strong>{selectedCandidate?.name}</strong>?
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-red-900 mb-2">
                ⚠️ This action CANNOT be undone!
              </p>
              <p className="text-sm text-red-800 mb-2">
                The following will be permanently deleted:
              </p>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Candidate profile and resume data</li>
                <li>• All comments ({comments.length} comment{comments.length !== 1 ? 's' : ''})</li>
                <li>• All private notes (from all users)</li>
                <li>• All match results</li>
                <li>• All activity history</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>💡 Alternative:</strong> If you just want to hide this candidate, 
                use <strong>Blacklist</strong> instead. Blacklisted candidates can be restored later.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCandidate}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Yes, Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
