import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';
import { getCandidates, getJobs, matchCandidate } from '../services/api';

export default function MatchingPage() {
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [candidatesData, jobsData] = await Promise.all([
          getCandidates(),
          getJobs()
        ]);
        setCandidates(candidatesData);
        setJobs(jobsData);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  const handleMatch = async () => {
    if (!selectedCandidate || !selectedJob) {
      alert('Please select both a candidate and a job');
      return;
    }

    setLoading(true);
    try {
      const result = await matchCandidate(selectedCandidate, selectedJob);
      setMatchResult(result);
    } catch (error) {
      console.error('Failed to match:', error);
      alert('Failed to generate match: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreBgColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Match Candidates to Jobs</h1>
        <p className="text-gray-600">Select a candidate and job to see AI-powered match analysis</p>
      </div>

      {/* Selection Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Candidate Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Select Candidate</h2>
          {candidates.filter(c => !c.is_blacklisted).length === 0 ? (
            <p className="text-gray-500">No candidates available</p>
          ) : (
            <select
              value={selectedCandidate || ''}
              onChange={(e) => setSelectedCandidate(parseInt(e.target.value))}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a candidate...</option>
              {candidates
                .filter(c => !c.is_blacklisted)  // ✅ Filter out blacklisted
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} - {candidate.email || 'No email'}
                  </option>
                ))}
            </select>
          )}
          
          {selectedCandidate && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              {(() => {
                const candidate = candidates.find(c => c.id === selectedCandidate);
                return candidate ? (
                  <div>
                    <p className="font-medium">{candidate.name}</p>
                    <p className="text-sm text-gray-600">{candidate.email}</p>
                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {candidate.skills.slice(0, 5).map((skill, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Job Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Select Job</h2>
          {jobs.length === 0 ? (
            <p className="text-gray-500">No jobs available. Create a job first.</p>
          ) : (
            <select
              value={selectedJob || ''}
              onChange={(e) => setSelectedJob(parseInt(e.target.value))}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a job...</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          )}
          
          {selectedJob && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              {(() => {
                const job = jobs.find(j => j.id === selectedJob);
                return job ? (
                  <div>
                    <p className="font-medium">{job.title}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{job.description}</p>
                    {job.required_skills && job.required_skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {job.required_skills.slice(0, 5).map((skill, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-200 text-green-800 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Match Button */}
      <div className="text-center mb-6">
        <button
          onClick={handleMatch}
          disabled={!selectedCandidate || !selectedJob || loading}
          className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto"
        >
          <Target className="h-5 w-5 mr-2" />
          {loading ? 'Analyzing Match...' : 'Generate Match Analysis'}
        </button>
      </div>

      {/* Match Results */}
      {matchResult && (
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Match Analysis</h2>
              <div className={`px-6 py-3 rounded-lg ${getScoreColor(matchResult.overall_score)}`}>
                <span className="text-3xl font-bold">{matchResult.overall_score}%</span>
              </div>
            </div>
            
            {/* Score Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Skill Match</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{matchResult.skill_match_score}%</span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreBgColor(matchResult.skill_match_score)}`}
                      style={{ width: `${matchResult.skill_match_score}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Experience Match</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{matchResult.experience_match_score}%</span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreBgColor(matchResult.experience_match_score)}`}
                      style={{ width: `${matchResult.experience_match_score}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Semantic Match</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{matchResult.semantic_score}%</span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreBgColor(matchResult.semantic_score)}`}
                      style={{ width: `${matchResult.semantic_score}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Skills Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Matching Skills */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-2" />
                Matching Skills ({matchResult.matching_skills?.length || 0})
              </h3>
              {matchResult.matching_skills && matchResult.matching_skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {matchResult.matching_skills.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No matching skills found</p>
              )}
            </div>

            {/* Missing Skills */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center text-red-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                Missing Skills ({matchResult.missing_skills?.length || 0})
              </h3>
              {matchResult.missing_skills && matchResult.missing_skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {matchResult.missing_skills.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">All required skills present!</p>
              )}
            </div>
          </div>

          {/* Strengths & Concerns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center text-green-600">
                <TrendingUp className="h-5 w-5 mr-2" />
                Strengths
              </h3>
              {matchResult.strengths && matchResult.strengths.length > 0 ? (
                <ul className="space-y-2">
                  {matchResult.strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{strength}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No specific strengths identified</p>
              )}
            </div>

            {/* Concerns */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center text-orange-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                Concerns
              </h3>
              {matchResult.concerns && matchResult.concerns.length > 0 ? (
                <ul className="space-y-2">
                  {matchResult.concerns.map((concern, idx) => (
                    <li key={idx} className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-orange-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{concern}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No major concerns identified</p>
              )}
            </div>
          </div>

          {/* Recommended Questions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-blue-600">
              <Lightbulb className="h-5 w-5 mr-2" />
              Recommended Interview Questions
            </h3>
            {matchResult.recommended_questions && matchResult.recommended_questions.length > 0 ? (
              <ol className="space-y-3">
                {matchResult.recommended_questions.map((question, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      {idx + 1}
                    </span>
                    <span className="text-gray-700 pt-0.5">{question}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-500">No specific questions generated</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}