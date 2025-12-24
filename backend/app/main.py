from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import hashlib
import os
import shutil
from pathlib import Path
from typing import List
from datetime import datetime
from .database import engine, get_db
from . import models, schemas, crud
from .services.parser import DocumentParser
from .services.extractor import InformationExtractor
from .services.matcher import CandidateMatcher
from .services.websocket_manager import manager
from .auth import create_access_token, get_current_user, get_current_active_user
from .permissions import (
    require_permission,
    require_roles,
    require_min_role,
    can_modify_candidate,
    can_delete_comment,
    get_user_permissions
)
from fastapi import BackgroundTasks
import asyncio
import glob
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
except:
    nlp = None
    logger.warning("spaCy model not loaded")

ALLOWED_BASE_PATHS = [
    "/home",
    "/mnt",
    "/data",
    "C:\\Users",
    "D:\\",
    os.path.expanduser("~"),
]

# Create all tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Candidate Analysis API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
parser = DocumentParser()
extractor = InformationExtractor()
matcher = CandidateMatcher()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def sanitize_text(text: str) -> str:
    """Remove null bytes and other problematic characters"""
    if not text:
        return ""
    
    text = text.replace('\x00', '')
    text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t\r')
    
    return text.strip()


# ============================================
# AUTHENTICATION ROUTES
# ============================================


@app.post("/api/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    existing_user = crud.get_user_by_username(db, user.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    existing_email = crud.get_user_by_email(db, user.email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    return crud.create_user(db, user)


@app.post("/api/auth/login", response_model=schemas.Token)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login user and return JWT token"""
    user = crud.authenticate_user(db, user_credentials.username, user_credentials.password)

    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    crud.update_last_login(db, user.id)
    access_token = create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@app.get("/api/auth/me", response_model=schemas.User)
async def get_me(current_user: models.User = Depends(get_current_active_user)):
    """Get current user info"""
    return current_user


@app.post("/api/auth/logout")
async def logout(current_user: models.User = Depends(get_current_active_user)):
    """Logout user"""
    return {"message": "Successfully logged out"}


# ============================================
# WEBSOCKET
# ============================================

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(None),
    db: Session = Depends(get_db)
):
    """WebSocket endpoint with authentication"""
    if token:
        from .auth import verify_token
        user_id = verify_token(token)
        if user_id:
            user = crud.get_user(db, user_id)
            if user:
                await manager.connect(websocket, user.full_name)
            else:
                await manager.connect(websocket, "Anonymous")
        else:
            await manager.connect(websocket, "Anonymous")
    else:
        await manager.connect(websocket, "Anonymous")

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        user = manager.disconnect(websocket)
        if user:
            await manager.broadcast({"type": "user_disconnected", "user": user})


# ============================================
# RESUME ROUTES
# ============================================

@app.post("/api/resumes/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_permission("upload_resume")),
    db: Session = Depends(get_db)
):
    """Upload and process a resume"""
    ext = os.path.splitext(file.filename)[1]
    temp_path = os.path.join(UPLOAD_DIR, file.filename)

    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Extract text with improved parser
        resume_text = parser.extract_text(temp_path, ext)
        
        # Extract information with improved extractor
        extracted = extractor.extract_all(resume_text, file.filename)
        
        # Generate unique hash
        unique_hash = hashlib.md5(
            f"{extracted['name']}{extracted['email']}".encode()
        ).hexdigest()

        # Check if blacklisted
        blacklisted = crud.check_if_blacklisted(
            db,
            email=extracted['email'],
            phone=extracted['phone'],
            unique_hash=unique_hash
        )

        if blacklisted:
            return {
                "status": "blacklisted",
                "message": f"⚠️ This candidate is blacklisted. Reason: {blacklisted.blacklist_reason}",
                "candidate": {
                    "id": blacklisted.id,
                    "name": blacklisted.name,
                    "blacklisted_by": blacklisted.blacklisted_by,
                    "blacklisted_at": str(blacklisted.blacklisted_at),
                    "reason": blacklisted.blacklist_reason
                }
            }

        # Check for duplicates
        existing = crud.get_candidate_by_hash(db, unique_hash)
        if existing:
            return {
                "status": "duplicate",
                "message": f"Candidate already exists (uploaded by {existing.uploaded_by})",
                "candidate_id": existing.id
            }

        # Create candidate
        candidate_data = schemas.CandidateCreate(
            unique_hash=unique_hash,
            name=extracted["name"],
            email=extracted["email"],
            phone=extracted["phone"],
            skills=extracted["skills"],
            experience=extracted["experience"],
            education=extracted["education"],
            links=extracted["links"],
            certifications=extracted["certifications"],
            resume_text=resume_text,
            resume_filename=file.filename,
            uploaded_by=current_user.full_name
        )

        candidate = crud.create_candidate(db, candidate_data)
        
        crud.create_activity_log(
            db,
            user=current_user.full_name,
            action="uploaded_resume",
            candidate_id=candidate.id,
            details={
                "filename": file.filename,
                "candidate_name": candidate.name
            }
        )

        await manager.broadcast({
            "type": "new_candidate",
            "candidate": {"id": candidate.id, "name": candidate.name}
        })

        return {
            "status": "success",
            "candidate_id": candidate.id,
            "data": extracted
        }

    except ValueError as e:
        logger.error(f"Resume processing error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process resume")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/api/filesystem/browse")
async def browse_filesystem(
    path: str = "/",
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Browse server filesystem to select folders"""
    try:
        abs_path = os.path.abspath(path)
        
        is_allowed = False
        for base_path in ALLOWED_BASE_PATHS:
            base_abs = os.path.abspath(base_path)
            try:
                Path(abs_path).relative_to(base_abs)
                is_allowed = True
                break
            except ValueError:
                continue
        
        if not is_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Path must be within allowed directories: {ALLOWED_BASE_PATHS}"
            )
        
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail="Path not found")
        
        if not os.path.isdir(abs_path):
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        items = []
        try:
            entries = os.listdir(abs_path)
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied to access this directory")
        
        for entry in sorted(entries):
            entry_path = os.path.join(abs_path, entry)
            
            try:
                is_dir = os.path.isdir(entry_path)
                
                file_count = 0
                if is_dir:
                    try:
                        files = os.listdir(entry_path)
                        file_count = sum(1 for f in files if f.lower().endswith(('.pdf', '.docx', '.doc')))
                    except PermissionError:
                        file_count = 0
                
                items.append({
                    "name": entry,
                    "path": entry_path,
                    "is_directory": is_dir,
                    "size": os.path.getsize(entry_path) if not is_dir else 0,
                    "resume_count": file_count if is_dir else 0,
                    "modified": os.path.getmtime(entry_path)
                })
            except (PermissionError, OSError):
                continue
        
        parent_path = os.path.dirname(abs_path) if abs_path != "/" else None
        
        return {
            "current_path": abs_path,
            "parent_path": parent_path,
            "items": items,
            "allowed_base_paths": ALLOWED_BASE_PATHS
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error browsing filesystem: {str(e)}")


@app.get("/api/filesystem/validate")
async def validate_folder_path(
    path: str,
    current_user: models.User = Depends(get_current_active_user)
):
    """Validate if a folder path exists and contains resume files"""
    try:
        abs_path = os.path.abspath(path)
        
        if not os.path.exists(abs_path):
            return {"valid": False, "error": "Path does not exist"}
        
        if not os.path.isdir(abs_path):
            return {"valid": False, "error": "Path is not a directory"}
        
        try:
            files = os.listdir(abs_path)
            resume_files = [f for f in files if f.lower().endswith(('.pdf', '.docx', '.doc'))]
            
            return {
                "valid": True,
                "path": abs_path,
                "total_files": len(files),
                "resume_files": len(resume_files),
                "file_list": resume_files[:10]
            }
        except PermissionError:
            return {"valid": False, "error": "Permission denied to access directory"}
            
    except Exception as e:
        return {"valid": False, "error": str(e)}


# ============================================
# SCREENING
# ============================================

@app.post("/api/screening/start", response_model=schemas.BatchResponse)
async def start_screening(
    batch_data: schemas.BatchCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Start a new screening batch"""
    batch = crud.create_batch(
        db,
        name=batch_data.name,
        folder_path=batch_data.folder_path,
        created_by=current_user.full_name,
        filters=batch_data.filters.dict()
    )

    crud.create_screening_activity(
        db,
        batch_id=batch.id,
        user=current_user.full_name,
        action="started_screening",
        details={
            "batch_name": batch.name,
            "folder_path": batch.folder_path,
            "filters": batch_data.filters.dict()
        }
    )

    background_tasks.add_task(
        process_batch_resumes,
        batch.id,
        batch.folder_path,
        batch_data.filters.dict(),
        db
    )

    return batch


async def process_batch_resumes(batch_id: int, folder_path: str, filters: dict, db: Session):
    """Background task to process resumes with PAUSE/CANCEL support"""
    logger.info(f"🚀 Starting batch processing for batch_id: {batch_id}")
    logger.info(f"📁 Folder path: {folder_path}")
    logger.info(f"🔍 Filters: {filters}")
    
    try:
        # Get all PDF/DOCX files from folder
        patterns = [
            os.path.join(folder_path, "*.pdf"),
            os.path.join(folder_path, "*.PDF"),
            os.path.join(folder_path, "*.docx"),
            os.path.join(folder_path, "*.DOCX"),
            os.path.join(folder_path, "*.doc"),
            os.path.join(folder_path, "*.DOC")
        ]

        files = []
        for pattern in patterns:
            found_files = glob.glob(pattern)
            files.extend(found_files)

        files = list(set(files))
        total = len(files)
        logger.info(f"✅ Found {total} resume files to process")
        
        if total == 0:
            batch = crud.get_batch(db, batch_id)
            if batch:
                batch.status = "error"
                db.commit()
            return

        crud.update_batch_progress(db, batch_id, 0, total)

        successful = 0
        failed = 0
        failed_files = []

        for idx, file_path in enumerate(files):
            # Check if batch is paused or cancelled
            if not crud.check_batch_should_continue(db, batch_id):
                batch = crud.get_batch(db, batch_id)
                if batch and batch.status == "paused":
                    logger.info(f"\n⏸️  BATCH PAUSED at {idx}/{total}")
                elif batch and batch.status == "cancelled":
                    logger.info(f"\n❌ BATCH CANCELLED at {idx}/{total}")
                return
            
            filename = os.path.basename(file_path)
            
            try:
                logger.info(f"\n📄 Processing {idx+1}/{total}: {filename}")
                
                ext = os.path.splitext(file_path)[1]
                
                # Use improved parser
                resume_text = parser.extract_text(file_path, ext)
                
                if not resume_text or len(resume_text) < 100:
                    logger.warning(f"⚠️  Skipping - insufficient text")
                    failed += 1
                    failed_files.append((filename, "Insufficient text"))
                    continue

                resume_text = sanitize_text(resume_text)
                
                if len(resume_text) < 100:
                    logger.warning(f"⚠️  Skipping - text too short after sanitization")
                    failed += 1
                    failed_files.append((filename, "Text too short"))
                    continue

                # Use improved extractor with filename
                extracted = extractor.extract_all(resume_text, filename)
                
                logger.info(f"   👤 Name: {extracted['name']}")
                logger.info(f"   📧 Email: {extracted.get('email') or 'N/A'}")
                logger.info(f"   🔧 Skills: {len(extracted.get('skills', []))} found")
                
                # Use extracted experience years
                exp_years = extracted.get('experience_years', 0)
                location = extracted.get('location', 'Not Specified')
                
                # Use matcher for filtering
                if not matcher.matches_filters(extracted, exp_years, location, filters):
                    logger.info(f"   ❌ Filtered out (doesn't match criteria)")
                    failed += 1
                    failed_files.append((filename, "Doesn't match filters"))
                    continue
                
                # Use matcher for scoring
                match_score = matcher.calculate_screening_score(
                    extracted.get('skills', []),
                    filters.get('skills', []),
                    exp_years,
                    filters.get('min_experience', 0),
                    resume_text
                )
                
                logger.info(f"   ⭐ Match Score: {match_score}%")
                
                # Generate unique hash
                email_for_hash = extracted.get('email') or ''
                unique_hash = hashlib.md5(
                    f"{extracted['name']}{email_for_hash}".encode()
                ).hexdigest()
                
                # Check for duplicates
                existing = db.query(models.Potential).filter(
                    models.Potential.batch_id == batch_id,
                    models.Potential.unique_hash == unique_hash
                ).first()
                
                if existing:
                    logger.info(f"   ⚠️  Duplicate detected")
                    failed += 1
                    failed_files.append((filename, "Duplicate"))
                    continue
                
                # Prepare data
                potential_data = {
                    'unique_hash': unique_hash,
                    'name': sanitize_text(extracted['name']),
                    'email': sanitize_text(extracted.get('email') or ''),
                    'phone': sanitize_text(extracted.get('phone') or ''),
                    'skills': [sanitize_text(s) for s in extracted.get('skills', [])],
                    'experience_years': exp_years,
                    'location': sanitize_text(location),
                    'education': [
                        {k: sanitize_text(str(v)) if v else '' for k, v in edu.items()}
                        for edu in extracted.get('education', [])
                    ],
                    'resume_text': sanitize_text(resume_text[:5000]),
                    'resume_filename': sanitize_text(filename),
                    'resume_path': file_path,
                    'match_score': match_score
                }
                
                try:
                    crud.create_potential(db, batch_id, potential_data)
                    db.commit()
                    successful += 1
                    logger.info(f"   ✅ Success!")
                    
                except Exception as db_error:
                    logger.error(f"   ❌ Database error: {str(db_error)}")
                    db.rollback()
                    failed += 1
                    failed_files.append((filename, f"DB Error: {str(db_error)[:50]}"))
                    continue
                
            except ValueError as e:
                failed += 1
                error_msg = str(e)[:100]
                logger.error(f"   ❌ Validation Error: {error_msg}")
                failed_files.append((filename, error_msg))
                
                try:
                    db.rollback()
                except:
                    pass
                
                continue
                
            except Exception as e:
                failed += 1
                error_msg = str(e)[:100]
                logger.error(f"   ❌ Error: {error_msg}")
                failed_files.append((filename, error_msg))
                
                try:
                    db.rollback()
                except:
                    pass
                
                continue
            
            finally:
                try:
                    crud.update_batch_progress(db, batch_id, idx + 1, total)
                except Exception as progress_error:
                    logger.warning(f"   ⚠️  Could not update progress: {progress_error}")
        
        # Mark batch as complete
        logger.info(f"\n" + "="*60)
        logger.info(f"🎉 BATCH PROCESSING COMPLETE!")
        logger.info(f"="*60)
        logger.info(f"✅ Successful: {successful}/{total} ({(successful/total*100):.1f}%)")
        logger.info(f"❌ Failed: {failed}/{total} ({(failed/total*100):.1f}%)")
        
        if failed_files:
            logger.info(f"\n📋 Failed Files Summary:")
            for fname, reason in failed_files[:10]:
                logger.info(f"   • {fname}: {reason}")
            if len(failed_files) > 10:
                logger.info(f"   ... and {len(failed_files) - 10} more")
        
        logger.info("="*60 + "\n")
        
        try:
            crud.update_batch_progress(db, batch_id, total, total)
        except:
            pass

    except Exception as e:
        logger.error(f"\n💥 CRITICAL ERROR in batch processing:")
        logger.error(f"   {str(e)}")
        import traceback
        traceback.print_exc()
        
        try:
            batch = crud.get_batch(db, batch_id)
            if batch:
                batch.status = "error"
                db.commit()
        except:
            pass


async def process_batch_resumes_resume(batch_id: int, folder_path: str, filters: dict, db: Session):
    """Resume batch processing from where it was paused"""
    await process_batch_resumes(batch_id, folder_path, filters, db)


@app.get("/api/screening/potentials/{batch_id}")
async def get_potentials(
    batch_id: int,
    page: int = 1,
    per_page: int = 100,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get potentials for a batch"""
    potentials, total = crud.get_potentials_paginated(
        db,
        batch_id,
        page,
        per_page,
        exclude_statuses=["not_interested", "promoted"]
    )

    return {
        "potentials": potentials,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page
    }


@app.put("/api/screening/potentials/{potential_id}/status")
async def update_potential_status_endpoint(
    potential_id: int,
    status_update: schemas.PotentialStatusUpdate,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update potential status"""
    potential = crud.update_potential_status(
        db,
        potential_id,
        status_update.status,
        current_user.full_name
    )

    if not potential:
        raise HTTPException(404, "Potential not found")

    action_map = {
        "to_be_called": "marked_to_be_called",
        "interested": "marked_interested",
        "waiting_resume": "marked_waiting",
        "not_interested": "marked_not_interested"
    }

    crud.create_screening_activity(
        db,
        batch_id=potential.batch_id,
        user=current_user.full_name,
        action=action_map.get(status_update.status, "status_updated"),
        potential_id=potential_id,
        details={
            "candidate_name": potential.name,
            "new_status": status_update.status
        }
    )

    if status_update.status == "interested":
        candidate = crud.promote_to_candidate(db, potential_id)

        crud.create_activity_log(
            db,
            user=current_user.full_name,
            action="promoted_from_screening",
            candidate_id=candidate.id,
            details={"candidate_name": candidate.name}
        )

        await manager.broadcast({
            "type": "potential_promoted",
            "potential_id": potential_id,
            "candidate_id": candidate.id
        })

    elif status_update.status == "not_interested":
        crud.reject_potential(db, potential_id, current_user.full_name)

        await manager.broadcast({
            "type": "potential_rejected",
            "potential_id": potential_id
        })

    return potential


@app.get("/api/screening/activities/{batch_id}")
async def get_screening_activities_endpoint(
    batch_id: int,
    limit: int = 50,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get screening activities"""
    return crud.get_screening_activities(db, batch_id, limit)


@app.get("/api/screening/rejected/{batch_id}")
async def get_rejected_list(
    batch_id: int,
    current_user: models.User = Depends(require_permission("view_activity")),
    db: Session = Depends(get_db)
):
    """Get rejected potentials for manual cleanup"""
    return crud.get_rejected_potentials(db, batch_id)


@app.get("/api/screening/batches")
async def get_batches(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all screening batches"""
    batches = crud.get_active_batches(db)
    return batches


# ============================================
# BATCH MANAGEMENT ENDPOINTS
# ============================================

@app.put("/api/screening/batches/{batch_id}/pause")
async def pause_batch_endpoint(
    batch_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Pause a batch that is currently processing"""
    batch = crud.pause_batch(db, batch_id, current_user.full_name)
    
    if not batch:
        raise HTTPException(404, "Batch not found or cannot be paused")
    
    await manager.broadcast({
        "type": "batch_paused",
        "batch_id": batch_id,
        "batch_name": batch.name
    })
    
    return batch


@app.put("/api/screening/batches/{batch_id}/resume")
async def resume_batch_endpoint(
    batch_id: int,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Resume a paused batch"""
    batch = crud.resume_batch(db, batch_id, current_user.full_name)
    
    if not batch:
        raise HTTPException(404, "Batch not found or cannot be resumed")
    
    background_tasks.add_task(
        process_batch_resumes_resume,
        batch.id,
        batch.folder_path,
        {
            'skills': batch.filter_skills or [],
            'min_experience': batch.filter_min_experience or 0,
            'max_experience': batch.filter_max_experience,
            'locations': batch.filter_locations or []
        },
        db
    )
    
    await manager.broadcast({
        "type": "batch_resumed",
        "batch_id": batch_id,
        "batch_name": batch.name
    })
    
    return batch


@app.put("/api/screening/batches/{batch_id}/cancel")
async def cancel_batch_endpoint(
    batch_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a batch"""
    batch = crud.cancel_batch(db, batch_id, current_user.full_name)
    
    if not batch:
        raise HTTPException(404, "Batch not found or cannot be cancelled")
    
    await manager.broadcast({
        "type": "batch_cancelled",
        "batch_id": batch_id,
        "batch_name": batch.name
    })
    
    return batch


@app.delete("/api/screening/batches/{batch_id}")
async def delete_batch_endpoint(
    batch_id: int,
    current_user: models.User = Depends(require_permission("delete_candidate")),
    db: Session = Depends(get_db)
):
    """Delete a batch and all associated data"""
    success = crud.delete_batch(db, batch_id, current_user.full_name)
    
    if not success:
        raise HTTPException(404, "Batch not found")
    
    await manager.broadcast({
        "type": "batch_deleted",
        "batch_id": batch_id
    })
    
    return {"message": "Batch deleted successfully", "batch_id": batch_id}


# ============================================
# CANDIDATE ROUTES
# ============================================

@app.get("/api/candidates")
def get_candidates(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_permission("view_candidates")),
    db: Session = Depends(get_db)
):
    """Get all candidates"""
    return crud.get_candidates(db, skip, limit)


@app.get("/api/candidates/{candidate_id}")
def get_candidate(
    candidate_id: int,
    current_user: models.User = Depends(require_permission("view_candidates")),
    db: Session = Depends(get_db)
):
    """Get specific candidate"""
    candidate = crud.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    return candidate


@app.put("/api/candidates/{candidate_id}/status")
async def update_status(
    candidate_id: int,
    update: schemas.CandidateUpdate,
    current_user: models.User = Depends(require_permission("change_status")),
    db: Session = Depends(get_db)
):
    """Update candidate status"""
    candidate = crud.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    if not can_modify_candidate(current_user, candidate, db):
        raise HTTPException(403, "You can only modify candidates you uploaded")

    updated = crud.update_candidate_status(
        db,
        candidate_id,
        update.status,
        candidate.version,
        current_user.full_name
    )

    if not updated:
        raise HTTPException(409, "Version conflict")

    crud.create_activity_log(
        db,
        user=current_user.full_name,
        action="status_change",
        candidate_id=candidate_id,
        details={
            "candidate_name": updated.name,
            "new_status": update.status
        }
    )

    await manager.broadcast({
        "type": "status_change",
        "candidate_id": candidate_id,
        "status": update.status
    })

    return updated


@app.delete("/api/candidates/{candidate_id}")
async def delete_candidate_endpoint(
    candidate_id: int,
    current_user: models.User = Depends(require_permission("delete_candidate")),
    db: Session = Depends(get_db)
):
    """Permanently delete a candidate and all associated data"""
    success = crud.delete_candidate(db, candidate_id, current_user.full_name)
    
    if not success:
        raise HTTPException(404, "Candidate not found")
    
    await manager.broadcast({
        "type": "candidate_deleted",
        "candidate_id": candidate_id
    })
    
    return {
        "message": "Candidate deleted successfully",
        "candidate_id": candidate_id
    }


@app.put("/api/candidates/{candidate_id}/blacklist")
async def blacklist_candidate_endpoint(
    candidate_id: int,
    blacklist_data: schemas.BlacklistUpdate,
    current_user: models.User = Depends(require_permission("blacklist_candidate")),
    db: Session = Depends(get_db)
):
    """Blacklist a candidate"""
    candidate = crud.blacklist_candidate(
        db,
        candidate_id,
        blacklist_data.reason,
        current_user.full_name
    )

    if not candidate:
        raise HTTPException(404, "Candidate not found")

    crud.create_activity_log(
        db,
        user=current_user.full_name,
        action="blacklisted",
        candidate_id=candidate_id,
        details={
            "candidate_name": candidate.name,
            "reason": blacklist_data.reason
        }
    )

    await manager.broadcast({
        "type": "candidate_blacklisted",
        "candidate_id": candidate_id,
        "candidate_name": candidate.name
    })

    return candidate


@app.put("/api/candidates/{candidate_id}/unblacklist")
async def unblacklist_candidate_endpoint(
    candidate_id: int,
    current_user: models.User = Depends(require_permission("unblacklist_candidate")),
    db: Session = Depends(get_db)
):
    """Remove candidate from blacklist"""
    candidate = crud.unblacklist_candidate(
        db,
        candidate_id,
        current_user.full_name
    )

    if not candidate:
        raise HTTPException(404, "Candidate not found")

    crud.create_activity_log(
        db,
        user=current_user.full_name,
        action="unblacklisted",
        candidate_id=candidate_id,
        details={"candidate_name": candidate.name}
    )

    await manager.broadcast({
        "type": "candidate_unblacklisted",
        "candidate_id": candidate_id
    })

    return candidate


@app.get("/api/blacklist")
def get_blacklist(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_permission("view_blacklist")),
    db: Session = Depends(get_db)
):
    """Get all blacklisted candidates"""
    return crud.get_blacklisted_candidates(db, skip, limit)


# ============================================
# JOB ROUTES
# ============================================

@app.post("/api/jobs")
async def create_job(
    job: schemas.JobDescriptionCreate,
    current_user: models.User = Depends(require_permission("create_job")),
    db: Session = Depends(get_db)
):
    """Create job description"""
    skills = extractor.extract_skills_hybrid(job.description)

    job_data = schemas.JobDescriptionCreate(
        title=job.title,
        description=job.description,
        experience_years=job.experience_years,
        created_by=current_user.full_name
    )

    created_job = crud.create_job(db, job_data, skills)

    crud.create_activity_log(
        db,
        user=current_user.full_name,
        action="created_job",
        details={
            "job_title": created_job.title,
            "skills_count": len(skills)
        }
    )

    await manager.broadcast({
        "type": "job_created",
        "job_id": created_job.id,
        "job_title": created_job.title
    })

    return created_job


@app.get("/api/jobs")
def get_jobs(
    current_user: models.User = Depends(require_permission("view_jobs")),
    db: Session = Depends(get_db)
):
    """Get all active jobs"""
    return crud.get_jobs(db)


@app.get("/api/jobs/{job_id}")
def get_job(
    job_id: int,
    current_user: models.User = Depends(require_permission("view_jobs")),
    db: Session = Depends(get_db)
):
    """Get specific job"""
    job = crud.get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


# ============================================
# MATCHING ROUTES
# ============================================

@app.post("/api/match")
async def match_candidate(
    candidate_id: int,
    job_id: int,
    current_user: models.User = Depends(require_permission("match_candidates")),
    db: Session = Depends(get_db)
):
    """Match a candidate to a job"""
    candidate = crud.get_candidate(db, candidate_id)
    job = crud.get_job(db, job_id)

    if not candidate or not job:
        raise HTTPException(404, "Candidate or Job not found")

    report = matcher.generate_match_report(
        {
            "skills": candidate.skills,
            "experience": candidate.experience,
            "education": candidate.education
        },
        {
            "required_skills": job.required_skills,
            "description": job.description,
            "experience_years": job.experience_years
        },
        candidate.resume_text
    )

    match_data = schemas.MatchResultCreate(
        candidate_id=candidate_id,
        job_id=job_id,
        **report
    )

    match_result = crud.create_match_result(db, match_data)

    await manager.broadcast({
        "type": "match_created",
        "candidate_id": candidate_id,
        "score": report["overall_score"]
    })

    return match_result


@app.get("/api/candidates/{candidate_id}/matches")
def get_candidate_matches(
    candidate_id: int,
    current_user: models.User = Depends(require_permission("match_candidates")),
    db: Session = Depends(get_db)
):
    """Get all match results for a candidate"""
    return crud.get_match_results(db, candidate_id)


# ============================================
# COMMENT ROUTES
# ============================================

@app.post("/api/candidates/{candidate_id}/comments")
async def add_comment(
    candidate_id: int,
    comment_request: schemas.CommentCreate,
    current_user: models.User = Depends(require_permission("add_comment")),
    db: Session = Depends(get_db)
):
    """Add comment to candidate"""
    new_comment = crud.create_comment(
        db,
        candidate_id,
        comment_request,
        hr_name=current_user.full_name
    )

    await manager.broadcast({
        "type": "new_comment",
        "candidate_id": candidate_id,
        "comment": {
            "id": new_comment.id,
            "hr_name": current_user.full_name,
            "text": comment_request.comment
        }
    })

    return new_comment


@app.get("/api/candidates/{candidate_id}/comments")
def get_comments(
    candidate_id: int,
    current_user: models.User = Depends(require_permission("view_comments")),
    db: Session = Depends(get_db)
):
    """Get comments for a candidate"""
    return crud.get_comments(db, candidate_id)


@app.delete("/api/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user: models.User = Depends(require_permission("delete_comment")),
    db: Session = Depends(get_db)
):
    """Delete a comment"""
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(404, "Comment not found")

    if not can_delete_comment(current_user, comment):
        raise HTTPException(403, "You can only delete your own comments")

    db.delete(comment)
    db.commit()

    return {"message": "Comment deleted successfully"}


# ============================================
# PRIVATE NOTES ROUTES
# ============================================

@app.post("/api/candidates/{candidate_id}/notes", response_model=schemas.Note)
async def create_note(
    candidate_id: int,
    note_data: schemas.NoteCreate,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a private note for a candidate"""
    candidate = crud.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    note = crud.create_note(db, candidate_id, current_user.id, note_data)
    return note


@app.get("/api/candidates/{candidate_id}/notes", response_model=List[schemas.Note])
async def get_candidate_notes(
    candidate_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all private notes for a candidate"""
    return crud.get_notes_for_candidate(db, candidate_id, current_user.id)


@app.put("/api/notes/{note_id}", response_model=schemas.Note)
async def update_note(
    note_id: int,
    note_data: schemas.NoteUpdate,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a note"""
    note = crud.update_note(db, note_id, current_user.id, note_data)

    if not note:
        raise HTTPException(404, "Note not found or you don't have permission")

    return note


@app.delete("/api/notes/{note_id}")
async def delete_note(
    note_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a note"""
    success = crud.delete_note(db, note_id, current_user.id)

    if not success:
        raise HTTPException(404, "Note not found or you don't have permission")

    return {"message": "Note deleted successfully"}


@app.put("/api/notes/{note_id}/pin", response_model=schemas.Note)
async def toggle_note_pin(
    note_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Toggle pin status of a note"""
    note = crud.toggle_note_pin(db, note_id, current_user.id)

    if not note:
        raise HTTPException(404, "Note not found or you don't have permission")

    return note


@app.get("/api/notes/my-notes", response_model=List[schemas.Note])
async def get_my_notes(
    limit: int = 50,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all notes by current user"""
    return crud.get_all_notes_by_user(db, current_user.id, limit)


@app.get("/api/notes/search")
async def search_notes(
    q: str,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Search through user's notes"""
    if not q or len(q) < 2:
        raise HTTPException(400, "Search query must be at least 2 characters")

    notes = crud.search_notes(db, current_user.id, q)

    results = []
    for note in notes:
        candidate = crud.get_candidate(db, note.candidate_id)
        results.append({
            "note": note,
            "candidate": {
                "id": candidate.id,
                "name": candidate.name,
                "email": candidate.email
            }
        })

    return results


@app.get("/api/candidates/{candidate_id}/notes/count")
async def get_note_count(
    candidate_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get count of notes for a candidate"""
    count = crud.get_note_count_for_candidate(db, candidate_id, current_user.id)
    return {"count": count}


# ============================================
# ANALYTICS ROUTES
# ============================================

@app.get("/api/analytics")
def get_analytics(
    current_user: models.User = Depends(require_permission("view_analytics")),
    db: Session = Depends(get_db)
):
    """Get analytics data"""
    candidates = crud.get_candidates(db, 0, 1000)

    by_status = {}
    skill_count = {}

    for candidate in candidates:
        status = candidate.status
        by_status[status] = by_status.get(status, 0) + 1

        if candidate.skills:
            for skill in candidate.skills:
                skill_count[skill] = skill_count.get(skill, 0) + 1

    top_skills = dict(sorted(skill_count.items(), key=lambda x: x[1], reverse=True)[:10])

    return {
        "total_candidates": len(candidates),
        "by_status": by_status,
        "top_skills": top_skills,
        "recent_count": len([c for c in candidates if (datetime.utcnow() - c.uploaded_at).days <= 7])
    }


# ============================================
# USER MANAGEMENT ROUTES
# ============================================

@app.get("/api/users", response_model=List[schemas.User])
async def get_users(
    current_user: models.User = Depends(require_permission("view_users")),
    db: Session = Depends(get_db)
):
    """Get all users"""
    return db.query(models.User).all()


@app.put("/api/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    role_update: dict,
    current_user: models.User = Depends(require_permission("manage_users")),
    db: Session = Depends(get_db)
):
    """Update user role"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    new_role = role_update.get("role")
    if new_role not in ["admin", "hr_manager", "recruiter"]:
        raise HTTPException(400, "Invalid role")

    user.role = new_role
    db.commit()
    db.refresh(user)

    crud.create_activity_log(
        db,
        user=current_user.full_name,
        action="role_changed",
        details={
            "target_user": user.full_name,
            "new_role": new_role
        }
    )

    return user


@app.delete("/api/users/{user_id}")
async def deactivate_user(
    user_id: int,
    current_user: models.User = Depends(require_permission("manage_users")),
    db: Session = Depends(get_db)
):
    """Deactivate user"""
    if user_id == current_user.id:
        raise HTTPException(400, "Cannot deactivate your own account")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    user.is_active = False
    db.commit()

    return {"message": "User deactivated successfully"}


@app.get("/api/users/me/permissions")
async def get_my_permissions(
    current_user: models.User = Depends(get_current_active_user)
):
    """Get current user's permissions"""
    return {
        "role": current_user.role,
        "permissions": get_user_permissions(current_user.role)
    }


# ============================================
# ACTIVITY LOG ROUTES
# ============================================

@app.get("/api/activity")
def get_recent_activity(
    limit: int = 50,
    candidate_id: int = None,
    current_user: models.User = Depends(require_permission("view_activity")),
    db: Session = Depends(get_db)
):
    """Get recent activity logs (Admin and HR Manager only)"""
    query = db.query(models.ActivityLog).order_by(
        models.ActivityLog.timestamp.desc())

    if candidate_id:
        query = query.filter(models.ActivityLog.candidate_id == candidate_id)

    activities = query.limit(limit).all()
    return activities


# ============================================
# ROOT ROUTE
# ============================================

@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Candidate Analysis System API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


# ============================================
# HEALTH CHECK
# ============================================

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow()}

