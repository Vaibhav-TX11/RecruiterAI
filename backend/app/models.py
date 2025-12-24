from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
from passlib.context import CryptContext
import secrets
from app.utils import timezone_utils
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="hr_manager")  # admin, hr_manager, recruiter
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=timezone_utils.get_ist_now())
    last_login = Column(DateTime)

    def verify_password(self, password: str) -> bool:
        return pwd_context.verify(password, self.hashed_password)

    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    token = Column(String, unique=True, index=True)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=timezone_utils.get_ist_now())
    is_active = Column(Boolean, default=True)


class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    unique_hash = Column(String, unique=True, index=True)
    name = Column(String, nullable=False, index=True)
    email = Column(String, index=True)
    phone = Column(String)
    skills = Column(JSON)
    experience = Column(JSON)
    education = Column(JSON)
    certifications = Column(JSON)
    links = Column(JSON)
    resume_text = Column(Text)
    resume_filename = Column(String)
    is_blacklisted = Column(Boolean, default=False, index=True)
    blacklist_reason = Column(Text, nullable=True)
    blacklisted_by = Column(String, nullable=True)
    blacklisted_at = Column(DateTime, nullable=True)
    uploaded_by = Column(String)
    uploaded_at = Column(DateTime, default=timezone_utils.get_ist_now())
    status = Column(String, default="new")
    version = Column(Integer, default=1)
    last_modified_by = Column(String)
    last_modified_at = Column(DateTime)
    comments = relationship(
        "Comment", back_populates="candidate", cascade="all, delete-orphan")
    match_results = relationship(
        "MatchResult", back_populates="candidate", cascade="all, delete-orphan")
    notes = relationship(
        "Note", back_populates="candidate", cascade="all, delete-orphan")


class JobDescription(Base):
    __tablename__ = "job_descriptions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    required_skills = Column(JSON)
    preferred_skills = Column(JSON)
    experience_years = Column(Integer)
    education_level = Column(String)
    created_at = Column(DateTime, default=timezone_utils.get_ist_now())
    created_by = Column(String)
    is_active = Column(Boolean, default=True)
    match_results = relationship(
        "MatchResult", back_populates="job", cascade="all, delete-orphan")


class MatchResult(Base):
    __tablename__ = "match_results"
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey(
        "candidates.id", ondelete="CASCADE"))
    job_id = Column(Integer, ForeignKey(
        "job_descriptions.id", ondelete="CASCADE"))
    overall_score = Column(Float)
    skill_match_score = Column(Float)
    experience_match_score = Column(Float)
    semantic_score = Column(Float)
    matching_skills = Column(JSON)
    missing_skills = Column(JSON)
    strengths = Column(JSON)
    concerns = Column(JSON)
    recommended_questions = Column(JSON)
    created_at = Column(DateTime, default=timezone_utils.get_ist_now())
    candidate = relationship("Candidate", back_populates="match_results")
    job = relationship("JobDescription", back_populates="match_results")


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey(
        "candidates.id", ondelete="CASCADE"))
    hr_name = Column(String, nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, default=timezone_utils.get_ist_now())
    candidate = relationship("Candidate", back_populates="comments")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey(
        "candidates.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey(
        "users.id", ondelete="CASCADE"), nullable=False)
    note = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False)  # Pin important notes to top
    created_at = Column(DateTime, default=timezone_utils.get_ist_now())
    updated_at = Column(DateTime, default=timezone_utils.get_ist_now(),
                        onupdate=timezone_utils.get_ist_now())

    # Relationships
    candidate = relationship("Candidate", back_populates="notes")
    user = relationship("User", backref="notes")

    def __repr__(self):
        return f"<Note {self.id} by User {self.user_id}>"


class ResumeBatch(Base):
    """Tracks batch screening sessions"""
    __tablename__ = "resume_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    folder_path = Column(String, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=timezone_utils.get_ist_now())
    status = Column(String, default="processing")
    total_resumes = Column(Integer, default=0)
    processed_count = Column(Integer, default=0)
    
    filter_skills = Column(JSON)
    filter_min_experience = Column(Integer)
    filter_max_experience = Column(Integer)
    filter_locations = Column(JSON)
    
    # Relationships
    potentials = relationship("Potential", back_populates="batch", cascade="all, delete-orphan")
    activities = relationship("ScreeningActivity", cascade="all, delete-orphan")
    rejected_potentials = relationship("RejectedPotential", cascade="all, delete-orphan")


class Potential(Base):
    """Temporary screening candidates (Stage 1)"""
    __tablename__ = "potentials"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("resume_batches.id", ondelete="CASCADE"))
    
    # Candidate info
    unique_hash = Column(String, index=True)
    name = Column(String, nullable=False, index=True)
    email = Column(String, index=True)
    phone = Column(String)
    skills = Column(JSON)
    experience_years = Column(Float)  # Calculated years
    location = Column(String)  # Extracted location
    education = Column(JSON)
    
    # Resume data
    resume_text = Column(Text)
    resume_filename = Column(String)
    resume_path = Column(String)  # Original file path
    
    # Matching score
    match_score = Column(Float, default=0.0)  # 0-100
    
    # Status in screening
    status = Column(String, default="pending")  # pending, to_be_called, interested, waiting_resume, not_interested
    assigned_to = Column(String)  # User who claimed this potential
    claimed_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=timezone_utils.get_ist_now())
    updated_at = Column(DateTime, default=timezone_utils.get_ist_now(), onupdate=timezone_utils.get_ist_now())
    
    # Relationships
    batch = relationship("ResumeBatch", back_populates="potentials")


class RejectedPotential(Base):
    """Tracks 'Not Interested' candidates for later cleanup"""
    __tablename__ = "rejected_potentials"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("resume_batches.id", ondelete="CASCADE"))
    
    # Candidate info
    name = Column(String, nullable=False)
    email = Column(String)
    phone = Column(String)
    resume_filename = Column(String)
    resume_path = Column(String)  # For manual deletion later
    
    # Rejection info
    rejected_by = Column(String, nullable=False)
    rejected_at = Column(DateTime, default=timezone_utils.get_ist_now())
    rejection_reason = Column(String)  # Optional: quick reason


class ScreeningActivity(Base):
    """Activity log specifically for Stage 1 (Screening)"""
    __tablename__ = "screening_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("resume_batches.id", ondelete="CASCADE"))  # ✅ ADD ondelete="CASCADE"
    user = Column(String, nullable=False)
    action = Column(String, nullable=False)
    potential_id = Column(Integer, nullable=True)
    details = Column(JSON)
    timestamp = Column(DateTime, default=timezone_utils.get_ist_now())


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    user = Column(String, nullable=False)
    action = Column(String, nullable=False)
    candidate_id = Column(Integer, nullable=True)
    details = Column(JSON)
    timestamp = Column(DateTime, default=timezone_utils.get_ist_now())
