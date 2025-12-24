from sqlalchemy.orm import Session
from . import models, schemas
from typing import List, Dict, Optional
from datetime import datetime
from app.utils import timezone_utils
import os

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = models.User.hash_password(user.password)
    db_user = models.User(
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        hashed_password=hashed_password,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not user.verify_password(password):
        return None
    return user

def update_last_login(db: Session, user_id: int):
    user = get_user(db, user_id)
    if user:
        user.last_login = timezone_utils.get_ist_now()
        db.commit()

def create_batch(db: Session, name: str, folder_path: str, created_by: str, filters: Dict):
    """Create a new screening batch"""
    batch = models.ResumeBatch(
        name=name,
        folder_path=folder_path,
        created_by=created_by,
        filter_skills=filters.get('skills', []),
        filter_min_experience=filters.get('min_experience', 0),
        filter_max_experience=filters.get('max_experience'),
        filter_locations=filters.get('locations', []),
        status="processing"
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch

def get_batch(db: Session, batch_id: int):
    return db.query(models.ResumeBatch).filter(models.ResumeBatch.id == batch_id).first()

def get_active_batches(db: Session):
    return db.query(models.ResumeBatch).filter(
        models.ResumeBatch.status.in_(["processing", "ready"])
    ).all()

def update_batch_progress(db: Session, batch_id: int, processed: int, total: int):
    batch = get_batch(db, batch_id)
    if batch:
        batch.processed_count = processed
        batch.total_resumes = total
        if processed >= total:
            batch.status = "ready"
        db.commit()
        db.refresh(batch)
    return batch

# Potential Operations
def create_potential(db: Session, batch_id: int, data: Dict):
    """Create a screening potential"""
    potential = models.Potential(
        batch_id=batch_id,
        unique_hash=data.get('unique_hash'),
        name=data['name'],
        email=data.get('email'),
        phone=data.get('phone'),
        skills=data.get('skills', []),
        experience_years=data.get('experience_years', 0),
        location=data.get('location'),
        education=data.get('education', []),
        resume_text=data.get('resume_text', ''),
        resume_filename=data.get('resume_filename', ''),
        resume_path=data.get('resume_path', ''),
        match_score=data.get('match_score', 0),
        status="pending"
    )
    db.add(potential)
    db.commit()
    db.refresh(potential)
    return potential

def get_potentials_paginated(
    db: Session, 
    batch_id: int, 
    page: int = 1, 
    per_page: int = 100,
    exclude_statuses: List[str] = None
):
    """Get potentials with pagination, excluding certain statuses"""
    query = db.query(models.Potential).filter(
        models.Potential.batch_id == batch_id
    )
    
    if exclude_statuses:
        query = query.filter(~models.Potential.status.in_(exclude_statuses))
    
    # Order by match score descending
    query = query.order_by(models.Potential.match_score.desc())
    
    # Pagination
    offset = (page - 1) * per_page
    potentials = query.offset(offset).limit(per_page).all()
    total = query.count()
    
    return potentials, total

def update_potential_status(
    db: Session, 
    potential_id: int, 
    status: str, 
    user: str
):
    """Update potential status"""
    potential = db.query(models.Potential).filter(
        models.Potential.id == potential_id
    ).first()
    
    if not potential:
        return None
    
    potential.status = status
    potential.assigned_to = user
    potential.claimed_at = timezone_utils.get_ist_now()
    potential.updated_at = timezone_utils.get_ist_now()
    
    db.commit()
    db.refresh(potential)
    return potential

def promote_to_candidate(db: Session, potential_id: int):
    """Promote potential to full candidate (Stage 2)"""
    potential = db.query(models.Potential).filter(
        models.Potential.id == potential_id
    ).first()
    
    if not potential:
        return None
    
    # Create candidate from potential
    candidate = models.Candidate(
        unique_hash=potential.unique_hash,
        name=potential.name,
        email=potential.email,
        phone=potential.phone,
        skills=potential.skills,
        experience=[],  # Parse from resume_text if needed
        education=potential.education,
        certifications=[],
        links={},
        resume_text=potential.resume_text,
        resume_filename=potential.resume_filename,
        uploaded_by=potential.assigned_to,
        status="new"
    )
    
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    
    # Mark potential as promoted
    potential.status = "promoted"
    db.commit()
    
    return candidate

def reject_potential(db: Session, potential_id: int, user: str):
    """Move potential to rejected list"""
    potential = db.query(models.Potential).filter(
        models.Potential.id == potential_id
    ).first()
    
    if not potential:
        return None
    
    # Create rejected record
    rejected = models.RejectedPotential(
        batch_id=potential.batch_id,
        name=potential.name,
        email=potential.email,
        phone=potential.phone,
        resume_filename=potential.resume_filename,
        resume_path=potential.resume_path,
        rejected_by=user
    )
    db.add(rejected)
    
    # Update potential status
    potential.status = "not_interested"
    potential.assigned_to = user
    
    db.commit()
    return rejected

def get_rejected_potentials(db: Session, batch_id: int = None):
    """Get all rejected potentials"""
    query = db.query(models.RejectedPotential)
    if batch_id:
        query = query.filter(models.RejectedPotential.batch_id == batch_id)
    return query.all()

# Screening Activity Log
def create_screening_activity(
    db: Session, 
    batch_id: int, 
    user: str, 
    action: str, 
    potential_id: int = None, 
    details: dict = None
):
    """Log screening activity (Stage 1)"""
    activity = models.ScreeningActivity(
        batch_id=batch_id,
        user=user,
        action=action,
        potential_id=potential_id,
        details=details
    )
    db.add(activity)
    db.commit()
    return activity

def get_screening_activities(db: Session, batch_id: int = None, limit: int = 50):
    """Get screening activities"""
    query = db.query(models.ScreeningActivity).order_by(
        models.ScreeningActivity.timestamp.desc()
    )
    if batch_id:
        query = query.filter(models.ScreeningActivity.batch_id == batch_id)
    return query.limit(limit).all()


def get_candidate(db: Session, candidate_id: int):
    return db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()


def get_candidate_by_hash(db: Session, unique_hash: str):
    return db.query(models.Candidate).filter(models.Candidate.unique_hash == unique_hash).first()


def get_candidates(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Candidate).offset(skip).limit(limit).all()


def create_candidate(db: Session, candidate: schemas.CandidateCreate):
    db_candidate = models.Candidate(**candidate.dict())
    db.add(db_candidate)
    db.commit()
    db.refresh(db_candidate)
    return db_candidate


def update_candidate_status(db: Session, candidate_id: int, status: str, version: int, user: str):
    candidate = get_candidate(db, candidate_id)
    if not candidate or candidate.version != version:
        return None
    candidate.status = status
    candidate.version += 1
    candidate.last_modified_by = user
    candidate.last_modified_at = timezone_utils.get_ist_now()
    db.commit()
    db.refresh(candidate)
    return candidate

def blacklist_candidate(db: Session, candidate_id: int, reason: str, user: str):
    """Blacklist a candidate"""
    candidate = get_candidate(db, candidate_id)
    if not candidate:
        return None
    
    candidate.is_blacklisted = True
    candidate.blacklist_reason = reason
    candidate.blacklisted_by = user
    candidate.blacklisted_at = timezone_utils.get_ist_now()
    candidate.status = "rejected"  # Also mark as rejected
    candidate.last_modified_by = user
    candidate.last_modified_at = timezone_utils.get_ist_now()
    
    db.commit()
    db.refresh(candidate)
    return candidate

def unblacklist_candidate(db: Session, candidate_id: int, user: str):
    """Remove candidate from blacklist"""
    candidate = get_candidate(db, candidate_id)
    if not candidate:
        return None
    
    candidate.is_blacklisted = False
    candidate.blacklist_reason = None
    candidate.blacklisted_by = None
    candidate.blacklisted_at = None
    candidate.status = "new"  # ✅ Reset status to "new"
    candidate.last_modified_by = user
    candidate.last_modified_at = timezone_utils.get_ist_now()
    
    db.commit()
    db.refresh(candidate)
    return candidate

def get_blacklisted_candidates(db: Session, skip: int = 0, limit: int = 100):
    """Get all blacklisted candidates"""
    return db.query(models.Candidate).filter(
        models.Candidate.is_blacklisted == True
    ).offset(skip).limit(limit).all()

def check_if_blacklisted(db: Session, email: str = None, phone: str = None, unique_hash: str = None):
    """Check if candidate is blacklisted by email, phone, or hash"""
    query = db.query(models.Candidate).filter(models.Candidate.is_blacklisted == True)
    
    if unique_hash:
        result = query.filter(models.Candidate.unique_hash == unique_hash).first()
        if result:
            return result
    
    if email:
        result = query.filter(models.Candidate.email == email).first()
        if result:
            return result
    
    if phone:
        result = query.filter(models.Candidate.phone == phone).first()
        if result:
            return result
    
    return None

def get_job(db: Session, job_id: int):
    return db.query(models.JobDescription).filter(models.JobDescription.id == job_id).first()


def get_jobs(db: Session):
    return db.query(models.JobDescription).filter(models.JobDescription.is_active == True).all()


def create_job(db: Session, job: schemas.JobDescriptionCreate, skills: List[str]):
    db_job = models.JobDescription(**job.dict(), required_skills=skills)
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job


def get_comments(db: Session, candidate_id: int):
    return db.query(models.Comment).filter(models.Comment.candidate_id == candidate_id).order_by(models.Comment.created_at.desc()).all()


def create_comment(db: Session, candidate_id: int, comment: schemas.CommentCreate, hr_name: str):
    db_comment = models.Comment(
        candidate_id=candidate_id,
        hr_name=hr_name,
        comment=comment.comment
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment


def create_match_result(db: Session, match: schemas.MatchResultCreate):
    db_match = models.MatchResult(**match.dict())
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    return db_match


def create_note(db: Session, candidate_id: int, user_id: int, note_data: schemas.NoteCreate):
    """Create a private note for a candidate"""
    db_note = models.Note(
        candidate_id=candidate_id,
        user_id=user_id,
        note=note_data.note,
        is_pinned=note_data.is_pinned
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


def get_notes_for_candidate(db: Session, candidate_id: int, user_id: int) -> List[models.Note]:
    """Get all notes for a candidate by the current user (private)"""
    return db.query(models.Note).filter(
        models.Note.candidate_id == candidate_id,
        models.Note.user_id == user_id
    ).order_by(
        models.Note.is_pinned.desc(),  # Pinned notes first
        models.Note.updated_at.desc()  # Then by most recent
    ).all()


def get_note(db: Session, note_id: int) -> Optional[models.Note]:
    """Get a specific note"""
    return db.query(models.Note).filter(models.Note.id == note_id).first()


def update_note(db: Session, note_id: int, user_id: int, note_data: schemas.NoteUpdate):
    """Update a note (only if user owns it)"""
    note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.user_id == user_id
    ).first()
    
    if not note:
        return None
    
    if note_data.note is not None:
        note.note = note_data.note
    if note_data.is_pinned is not None:
        note.is_pinned = note_data.is_pinned
    
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, note_id: int, user_id: int) -> bool:
    """Delete a note (only if user owns it)"""
    note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.user_id == user_id
    ).first()
    
    if not note:
        return False
    
    db.delete(note)
    db.commit()
    return True


def toggle_note_pin(db: Session, note_id: int, user_id: int) -> Optional[models.Note]:
    """Toggle pin status of a note"""
    note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.user_id == user_id
    ).first()
    
    if not note:
        return None
    
    note.is_pinned = not note.is_pinned
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return note


def get_all_notes_by_user(db: Session, user_id: int, limit: int = 50) -> List[models.Note]:
    """Get all notes by a user across all candidates"""
    return db.query(models.Note).filter(
        models.Note.user_id == user_id
    ).order_by(
        models.Note.updated_at.desc()
    ).limit(limit).all()


def search_notes(db: Session, user_id: int, search_query: str) -> List[models.Note]:
    """Search through user's notes"""
    return db.query(models.Note).filter(
        models.Note.user_id == user_id,
        models.Note.note.ilike(f"%{search_query}%")
    ).order_by(
        models.Note.updated_at.desc()
    ).all()


def get_note_count_for_candidate(db: Session, candidate_id: int, user_id: int) -> int:
    """Get count of notes for a candidate by user"""
    return db.query(models.Note).filter(
        models.Note.candidate_id == candidate_id,
        models.Note.user_id == user_id
    ).count()


def get_recent_activities(db: Session, limit: int = 50):
    return db.query(models.ActivityLog).order_by(models.ActivityLog.timestamp.desc()).limit(limit).all()

def create_activity_log(db: Session, user: str, action: str, candidate_id: int = None, details: dict = None):
    """Create an activity log entry"""
    log = models.ActivityLog(
        user=user,
        action=action,
        candidate_id=candidate_id,
        details=details
    )
    db.add(log)
    db.commit()
    return log

def pause_batch(db: Session, batch_id: int, user: str):
    """Pause a batch that is currently processing"""
    batch = get_batch(db, batch_id)
    if not batch:
        return None
    
    if batch.status != "processing":
        return None  # Can only pause processing batches
    
    batch.status = "paused"
    db.commit()
    db.refresh(batch)
    
    # Log the activity
    create_screening_activity(
        db,
        batch_id=batch_id,
        user=user,
        action="paused_batch",
        details={"batch_name": batch.name}
    )
    
    return batch


def resume_batch(db: Session, batch_id: int, user: str):
    """Resume a paused batch"""
    batch = get_batch(db, batch_id)
    if not batch:
        return None
    
    if batch.status != "paused":
        return None  # Can only resume paused batches
    
    batch.status = "processing"
    db.commit()
    db.refresh(batch)
    
    # Log the activity
    create_screening_activity(
        db,
        batch_id=batch_id,
        user=user,
        action="resumed_batch",
        details={"batch_name": batch.name}
    )
    
    return batch


def cancel_batch(db: Session, batch_id: int, user: str):
    """Cancel a batch (can be processing or paused)"""
    batch = get_batch(db, batch_id)
    if not batch:
        return None
    
    if batch.status in ["completed", "cancelled", "error"]:
        return None  # Cannot cancel already finished batches
    
    batch.status = "cancelled"
    db.commit()
    db.refresh(batch)
    
    # Log the activity
    create_screening_activity(
        db,
        batch_id=batch_id,
        user=user,
        action="cancelled_batch",
        details={"batch_name": batch.name, "processed": batch.processed_count, "total": batch.total_resumes}
    )
    
    return batch


def delete_batch(db: Session, batch_id: int, user: str):
    """Delete a batch and all associated potentials (cascade)"""
    batch = get_batch(db, batch_id)
    if not batch:
        return False
    
    batch_name = batch.name
    
    # Log the activity before deletion
    create_screening_activity(
        db,
        batch_id=batch_id,
        user=user,
        action="deleted_batch",
        details={
            "batch_name": batch_name,
            "total_potentials": len(batch.potentials)
        }
    )
    
    # Delete batch (cascade will handle potentials, rejected_potentials, activities)
    db.delete(batch)
    db.commit()
    
    return True


def check_batch_should_continue(db: Session, batch_id: int) -> bool:
    """
    Check if batch processing should continue
    Returns False if batch is paused or cancelled
    """
    batch = get_batch(db, batch_id)
    if not batch:
        return False
    
    # Continue only if status is "processing"
    return batch.status == "processing"

def delete_candidate(db: Session, candidate_id: int, user: str):
    """
    Permanently delete a candidate and all associated data
    Cascade deletes: comments, notes, match_results, activity_logs
    """
    candidate = get_candidate(db, candidate_id)
    if not candidate:
        return False
    
    # Store info for activity log before deletion
    candidate_name = candidate.name
    candidate_email = candidate.email
    
    # Log the deletion BEFORE deleting (so we can still reference candidate_id)
    create_activity_log(
        db,
        user=user,
        action="deleted_candidate",
        candidate_id=candidate_id,
        details={
            "candidate_name": candidate_name,
            "candidate_email": candidate_email,
            "had_comments": len(candidate.comments) if candidate.comments else 0,
            "had_notes": len(candidate.notes) if candidate.notes else 0,
            "had_matches": len(candidate.match_results) if candidate.match_results else 0
        }
    )
    
    # Delete candidate (cascade will automatically delete related records)
    db.delete(candidate)
    db.commit()
    
    return True
