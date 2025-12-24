from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class UserCreate(BaseModel):
    email: str
    username: str
    full_name: str
    password: str
    role: Optional[str] = "hr_manager"


class UserLogin(BaseModel):
    username: str
    password: str


class User(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: User


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


class RoleUpdate(BaseModel):
    role: str


class UserPermissions(BaseModel):
    role: str
    permissions: Dict[str, bool]


class UserList(BaseModel):
    id: int
    username: str
    full_name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ SCREENING (STAGE 1) ============

class ScreeningFilters(BaseModel):
    skills: Optional[List[str]] = []
    min_experience: Optional[int] = 0
    max_experience: Optional[int] = None
    locations: Optional[List[str]] = []


class BatchCreate(BaseModel):
    name: str
    folder_path: str
    filters: ScreeningFilters


class BatchResponse(BaseModel):
    id: int
    name: str
    folder_path: str
    created_by: str
    created_at: datetime
    status: str
    total_resumes: int
    processed_count: int
    filter_skills: Optional[List[str]] = []
    filter_min_experience: Optional[int] = 0
    filter_locations: Optional[List[str]] = []
    
    class Config:
        from_attributes = True


class PotentialResponse(BaseModel):
    id: int
    batch_id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    skills: Optional[List[str]] = []
    experience_years: Optional[float] = 0
    location: Optional[str]
    match_score: float
    status: str
    assigned_to: Optional[str]
    resume_filename: str
    
    class Config:
        from_attributes = True


class PotentialStatusUpdate(BaseModel):
    status: str  # to_be_called, interested, waiting_resume, not_interested


class ScreeningProgress(BaseModel):
    batch_id: int
    total: int
    processed: int
    percentage: float
    status: str


# ============ CANDIDATES ============


class CandidateBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class CandidateCreate(CandidateBase):
    unique_hash: str
    skills: Optional[List[str]] = []
    experience: Optional[List[Dict[str, Any]]] = []
    education: Optional[List[Dict[str, Any]]] = []
    certifications: Optional[List[str]] = []
    links: Optional[Dict[str, str]] = {}
    resume_text: str
    resume_filename: str
    uploaded_by: str


class CandidateUpdate(BaseModel):
    status: Optional[str] = None
    version: int
    user: str


class BlacklistUpdate(BaseModel):
    reason: str
    user: str


class Candidate(CandidateBase):
    id: int
    status: str
    uploaded_by: str
    uploaded_at: datetime
    skills: Optional[List[str]] = []
    experience: Optional[List[Dict[str, Any]]] = []
    education: Optional[List[Dict[str, Any]]] = []
    version: int
    is_blacklisted: bool  # ✅ Add
    blacklist_reason: Optional[str] = None  # ✅ Add
    blacklisted_by: Optional[str] = None  # ✅ Add
    blacklisted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ JOBS ============


class JobDescriptionCreate(BaseModel):
    title: str
    description: str
    experience_years: Optional[int] = 0
    created_by: str


class JobDescription(JobDescriptionCreate):  # ✅ FIXED
    id: int
    required_skills: List[str]
    preferred_skills: Optional[List[str]] = []
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

# ============ COMMENTS ============


class CommentCreate(BaseModel):
    comment: str


class Comment(CommentCreate):
    id: int
    candidate_id: int
    hr_name: str
    comment: str
    created_at: datetime

    class Config:
        from_attributes = True

# ============ MATCH RESULTS ============


class MatchResultCreate(BaseModel):
    candidate_id: int
    job_id: int
    overall_score: float
    skill_match_score: float
    experience_match_score: float
    semantic_score: float
    matching_skills: List[str]
    missing_skills: List[str]
    strengths: List[str]
    concerns: List[str]
    recommended_questions: List[str]


class MatchResult(MatchResultCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ============ NOTES ============


class NoteCreate(BaseModel):
    note: str
    is_pinned: Optional[bool] = False


class NoteUpdate(BaseModel):
    note: Optional[str] = None
    is_pinned: Optional[bool] = None


class Note(BaseModel):
    id: int
    candidate_id: int
    user_id: int
    note: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime

    # Include user info for display
    class Config:
        from_attributes = True


class NoteWithUser(Note):
    """Note with user information attached"""
    user_name: str
    user_email: str

    class Config:
        from_attributes = True
