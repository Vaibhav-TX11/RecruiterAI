import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, CheckCircle, Clock, Activity, Award, Calendar } from 'lucide-react';
import { getCandidates, getJobs } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatDate } from '../utils/dateUtils';

export default function AnalyticsPage() {
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    byStatus: {},
    topSkills: {},
    recentCount: 0,
    avgSkillsPerCandidate: 0
  });
  const { lastMessage } = useWebSocket();

  const loadData = async () => {
    try {
      const [candidatesData, jobsData] = await Promise.all([
        getCandidates(),
        getJobs()
      ]);
      setCandidates(candidatesData);
      setJobs(jobsData);
      calculateStats(candidatesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (candidatesData) => {
    // ✅ Filter out blacklisted candidates for stats
    const activeCandidates = candidatesData.filter(c => !c.is_blacklisted);
    
    // Count by status
    const byStatus = {};
    activeCandidates.forEach(c => {  // Changed from candidatesData
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });

    // Count skills
    const skillCount = {};
    let totalSkills = 0;
    activeCandidates.forEach(c => {  // Changed from candidatesData
      if (c.skills && Array.isArray(c.skills)) {
        totalSkills += c.skills.length;
        c.skills.forEach(skill => {
          skillCount[skill] = (skillCount[skill] || 0) + 1;
        });
      }
    });

    // Sort skills by count
    const topSkills = Object.entries(skillCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((obj, [skill, count]) => {
        obj[skill] = count;
        return obj;
      }, {});

    // Recent candidates (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = activeCandidates.filter(c =>   // Changed from candidatesData
      new Date(c.uploaded_at) >= sevenDaysAgo
    ).length;

    setStats({
      total: activeCandidates.length,  // Changed from candidatesData
      byStatus,
      topSkills,
      recentCount,
      avgSkillsPerCandidate: activeCandidates.length > 0 ? (totalSkills / activeCandidates.length).toFixed(1) : 0
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (lastMessage?.type === 'new_candidate') {
      loadData();
    }
  }, [lastMessage]);

  if (loading) return <div className="text-center p-12">Loading analytics...</div>;

  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-blue-500',
      reviewed: 'bg-yellow-500',
      interviewed: 'bg-purple-500',
      rejected: 'bg-red-500',
      hired: 'bg-green-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const maxSkillCount = Math.max(...Object.values(stats.topSkills), 1);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600">Overview of your hiring pipeline</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Candidates</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600 font-medium">{stats.recentCount} this week</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Active Jobs</p>
              <p className="text-3xl font-bold text-gray-900">{jobs.length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Open positions
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Avg Skills/Candidate</p>
              <p className="text-3xl font-bold text-gray-900">{stats.avgSkillsPerCandidate}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Award className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Skill diversity
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Pending Review</p>
              <p className="text-3xl font-bold text-gray-900">{stats.byStatus.new || 0}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Needs attention
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Candidates by Status</h2>
          <div className="space-y-3">
            {Object.entries(stats.byStatus).map(([status, count]) => {
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{status}</span>
                    <span className="text-sm text-gray-600">{count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getStatusColor(status)}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          
          {Object.keys(stats.byStatus).length === 0 && (
            <p className="text-gray-500 text-center py-8">No candidates yet</p>
          )}
        </div>

        {/* Top Skills */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Top Skills in Pipeline</h2>
          <div className="space-y-3">
            {Object.entries(stats.topSkills).map(([skill, count]) => {
              const percentage = (count / maxSkillCount) * 100;
              return (
                <div key={skill}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{skill}</span>
                    <span className="text-sm text-gray-600">{count} candidates</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          
          {Object.keys(stats.topSkills).length === 0 && (
            <p className="text-gray-500 text-center py-8">No skills data yet</p>
          )}
        </div>
      </div>

      {/* Recent Candidates Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Candidates</h2>
          <Activity className="h-5 w-5 text-gray-400" />
        </div>
        
        {candidates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skills</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {candidates
                  .filter(c => !c.is_blacklisted)  // ✅ Filter blacklisted
                  .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
                  .slice(0, 10)
                  .map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{candidate.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{candidate.email || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(candidate.skills || []).slice(0, 3).map((skill, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {skill}
                            </span>
                          ))}
                          {(candidate.skills || []).length > 3 && (
                            <span className="text-xs text-gray-500">+{candidate.skills.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          candidate.status === 'new' ? 'bg-blue-100 text-blue-800' :
                          candidate.status === 'reviewed' ? 'bg-yellow-100 text-yellow-800' :
                          candidate.status === 'interviewed' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {candidate.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(candidate.uploaded_at)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No candidates yet. Upload resumes to get started!</p>
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
          <Calendar className="h-8 w-8 mb-3 opacity-80" />
          <p className="text-sm opacity-90 mb-1">This Week</p>
          <p className="text-3xl font-bold">{stats.recentCount}</p>
          <p className="text-sm opacity-75 mt-2">New candidates added</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
          <CheckCircle className="h-8 w-8 mb-3 opacity-80" />
          <p className="text-sm opacity-90 mb-1">Interviewed</p>
          <p className="text-3xl font-bold">{stats.byStatus.interviewed || 0}</p>
          <p className="text-sm opacity-75 mt-2">Candidates in pipeline</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
          <Award className="h-8 w-8 mb-3 opacity-80" />
          <p className="text-sm opacity-90 mb-1">Top Skill</p>
          <p className="text-2xl font-bold">
            {Object.keys(stats.topSkills)[0] || 'N/A'}
          </p>
          <p className="text-sm opacity-75 mt-2">
            {Object.values(stats.topSkills)[0] || 0} candidates have this
          </p>
        </div>
      </div>
    </div>
  );
}