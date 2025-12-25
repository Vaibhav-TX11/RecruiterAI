import os
import sys
import logging
import hashlib
import shutil
import tempfile
import glob
from typing import List
from datetime import datetime

# ============================================
# LOGGING SETUP (MUST BE FIRST)
# ============================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

logger.info("=" * 70)
logger.info("🚀 STARTING RECRUITER AI APPLICATION")
logger.info("=" * 70)

# ============================================
# ENVIRONMENT VALIDATION
# ============================================
logger.info("🔍 Validating environment variables...")
required_vars = ["DATABASE_URL", "SECRET_KEY"]
missing_vars = [var for var in required_vars if not os.getenv(var)]

if missing_vars:
    logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
    sys.exit(1)

logger.info("✅ All required environment variables present")

# ============================================
# CORE IMPORTS
# ============================================
logger.info("📦 Importing FastAPI and core dependencies...")
from fastapi import (
    FastAPI, UploadFile, File, HTTPException, Depends, 
    WebSocket, WebSocketDisconnect, Query, Form, BackgroundTasks
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

logger.info("✅ FastAPI imports successful")

# ============================================
# LAZY DATABASE SETUP (DEFERRED CONNECTION)
# ============================================
logger.info("📦 Initializing database connection (lazy)...")

db_initialized = False
engine = None
models = None
schemas = None
crud = None
get_db = None

def init_database():
    """Initialize database on first use"""
    global db_initialized, engine, models, schemas, crud, get_db
    
    if db_initialized:
        return
    
    logger.info("🔗 Connecting to database...")
    try:
        from app.database import engine as db_engine, get_db as db_get_db
        from app import models as db_models, schemas as db_schemas, crud as db_crud
        
        engine = db_engine
        models = db_models
        schemas = db_schemas
        crud = db_crud
        get_db = db_get_db
        
        # Create tables
        logger.info("🗄️ Creating database tables...")
        models.Base.metadata.create_all(bind=engine)
        logger.info("✅ Database initialized successfully")
        db_initialized = True
        
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        logger.error("⚠️  Database will be retried on first request")
        db_initialized = False
        return False
    
    return True

# # ============================================
# # SERVICE IMPORTS
# # ============================================
# logger.info("📦 Loading services...")
# try:
#     from app.services.parser import DocumentParser
#     from app.services.extractor import InformationExtractor
#     from app.services.matcher import CandidateMatcher
#     from app.services.websocket_manager import manager
#     from app.services.storage_service import storage_service
    
#     logger.info("✅ Core services loaded")
# except Exception as e:
#     logger.error(f"❌ Service import failed: {e}")
#     import traceback
#     traceback.print_exc()
#     sys.exit(1)

# ============================================
# AUTH IMPORTS
# ============================================
logger.info("📦 Loading authentication modules...")
try:
    from app.auth import create_access_token, get_current_user, get_current_active_user
    from app.permissions import (
        require_permission, require_roles, require_min_role,
        can_modify_candidate, can_delete_comment, get_user_permissions
    )
    logger.info("✅ Authentication modules loaded")
except Exception as e:
    logger.error(f"❌ Auth import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# ============================================
# CREATE FASTAPI APP
# ============================================
logger.info("🚀 Creating FastAPI application...")
app = FastAPI(
    title="Candidate Analysis API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ============================================
# CORS CONFIGURATION
# ============================================
logger.info("🔌 Configuring CORS...")
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,https://recruiter-ai-trix.vercel.app"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info(f"✅ CORS configured for {len(allowed_origins)} origins")

# # ============================================
# # SERVICE INITIALIZATION
# # ============================================
# logger.info("⚙️  Initializing services...")
# parser = DocumentParser()
# extractor = InformationExtractor()
# matcher = CandidateMatcher()
# logger.info("✅ Services initialized")

# # ============================================
# # FILE UPLOAD SETUP
# # ============================================
# UPLOAD_DIR = "uploads"
# os.makedirs(UPLOAD_DIR, exist_ok=True)
# logger.info(f"✅ Upload directory ready: {UPLOAD_DIR}")

# # ============================================
# # HELPER FUNCTIONS
# # ============================================
# def sanitize_text(text: str) -> str:
#     """Remove null bytes and problematic characters"""
#     if not text:
#         return ""
#     text = text.replace('\x00', '')
#     text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t\r')
#     return text.strip()

# ============================================
# STARTUP/SHUTDOWN EVENTS
# ============================================
@app.on_event("startup")
async def startup_event():
    """App startup event"""
    logger.info("=" * 70)
    logger.info("✅ FastAPI application started successfully!")
    logger.info(f"📊 Environment: {os.getenv('ENVIRONMENT', 'production')}")
    logger.info(f"🌐 CORS Origins: {len(allowed_origins)} configured")
    logger.info(f"📁 Upload directory: {UPLOAD_DIR}")
    logger.info("=" * 70)
    
    # Try to initialize database, but don't fail if it doesn't work
    if not init_database():
        logger.warning("⚠️  Database connection will be retried on first request")

@app.on_event("shutdown")
async def shutdown_event():
    """App shutdown event"""
    logger.info("🛑 Application shutting down gracefully")

# ============================================
# HEALTH CHECK ENDPOINTS (CRITICAL!)
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

@app.get("/health")
def health_check():
    """Health check endpoint for Render"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "app": "candidate-analysis-api"
    }

@app.get("/health/db")
def health_check_db():
    """Database health check"""
    try:
        if init_database():
            return {
                "status": "healthy",
                "database": "connected",
                "timestamp": datetime.utcnow()
            }
        else:
            return {
                "status": "warning",
                "database": "connection_failed",
                "timestamp": datetime.utcnow()
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "error",
            "error": str(e),
            "timestamp": datetime.utcnow()
        }

# ============================================
# DATABASE DEPENDENCY WITH LAZY INIT
# ============================================
def get_db_with_init():
    """Get database session with lazy initialization"""
    if not init_database():
        raise HTTPException(
            status_code=503,
            detail="Database connection failed. Check your DATABASE_URL and ensure Supabase allows connections from Render."
        )
    return get_db()

# ============================================
# AUTHENTICATION ROUTES
# ============================================
@app.post("/api/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db_with_init)):
    """Register a new user"""
    existing_user = crud.get_user_by_username(db, user.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    existing_email = crud.get_user_by_email(db, user.email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    return crud.create_user(db, user)

@app.post("/api/auth/login", response_model=schemas.Token)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db_with_init)):
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
async def get_me(current_user = Depends(get_current_active_user)):
    """Get current user info"""
    return current_user

@app.post("/api/auth/logout")
async def logout(current_user = Depends(get_current_active_user)):
    """Logout user"""
    return {"message": "Successfully logged out"}

# ============================================
# WEBSOCKET
# ============================================
@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(None),
    db: Session = Depends(get_db_with_init)
):
    """WebSocket endpoint with authentication"""
    try:
        if token:
            from app.auth import verify_token
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

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        user = manager.disconnect(websocket)
        if user:
            await manager.broadcast({"type": "user_disconnected", "user": user})
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await manager.disconnect(websocket)
        except:
            pass

# ============================================
# RESUME UPLOAD ROUTE
# ============================================
@app.post("/api/resumes/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user = Depends(require_permission("upload_resume")),
    db: Session = Depends(get_db_with_init)
):
    """Upload and process a resume"""
    ext = os.path.splitext(file.filename)[1]
    temp_path = os.path.join(UPLOAD_DIR, file.filename)

    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        resume_text = parser.extract_text(temp_path, ext)
        extracted = extractor.extract_all(resume_text, file.filename)
        
        unique_hash = hashlib.md5(
            f"{extracted['name']}{extracted['email']}".encode()
        ).hexdigest()

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

        existing = crud.get_candidate_by_hash(db, unique_hash)
        if existing:
            return {
                "status": "duplicate",
                "message": f"Candidate already exists (uploaded by {existing.uploaded_by})",
                "candidate_id": existing.id
            }

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

# ============================================
# CANDIDATE ROUTES (with lazy DB init)
# ============================================
@app.get("/api/candidates")
def get_candidates(
    skip: int = 0,
    limit: int = 100,
    current_user = Depends(require_permission("view_candidates")),
    db: Session = Depends(get_db_with_init)
):
    """Get all candidates"""
    return crud.get_candidates(db, skip, limit)

@app.get("/api/candidates/{candidate_id}")
def get_candidate(
    candidate_id: int,
    current_user = Depends(require_permission("view_candidates")),
    db: Session = Depends(get_db_with_init)
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
    current_user = Depends(require_permission("change_status")),
    db: Session = Depends(get_db_with_init)
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
    current_user = Depends(require_permission("delete_candidate")),
    db: Session = Depends(get_db_with_init)
):
    """Delete candidate"""
    success = crud.delete_candidate(db, candidate_id, current_user.full_name)
    if not success:
        raise HTTPException(404, "Candidate not found")
    
    await manager.broadcast({
        "type": "candidate_deleted",
        "candidate_id": candidate_id
    })
    
    return {"message": "Candidate deleted successfully", "candidate_id": candidate_id}

@app.put("/api/candidates/{candidate_id}/blacklist")
async def blacklist_candidate_endpoint(
    candidate_id: int,
    blacklist_data: schemas.BlacklistUpdate,
    current_user = Depends(require_permission("blacklist_candidate")),
    db: Session = Depends(get_db_with_init)
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
    current_user = Depends(require_permission("unblacklist_candidate")),
    db: Session = Depends(get_db_with_init)
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
    current_user = Depends(require_permission("view_blacklist")),
    db: Session = Depends(get_db_with_init)
):
    """Get all blacklisted candidates"""
    return crud.get_blacklisted_candidates(db, skip, limit)

# ============================================
# SCREENING ROUTES
# ============================================
@app.post("/api/screening/upload-batch", response_model=schemas.BatchResponse)
async def upload_batch_files(
    name: str = Form(...),
    files: List[UploadFile] = File(...),
    skills: str = Form("[]"),
    min_experience: int = Form(0),
    max_experience: int = Form(None),
    locations: str = Form("[]"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Upload batch files"""
    import json
    
    skills_list = json.loads(skills) if skills else []
    locations_list = json.loads(locations) if locations else []
    
    if not files:
        raise HTTPException(400, "No files uploaded")
    
    allowed_extensions = {'.pdf', '.docx', '.doc', '.txt'}
    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_extensions:
            raise HTTPException(400, f"Invalid file type: {file.filename}")
    
    batch = crud.create_batch(
        db,
        name=name,
        folder_path=f"batch_{db.query(models.ResumeBatch).count() + 1}",
        created_by=current_user.full_name,
        filters={
            'skills': skills_list,
            'min_experience': min_experience,
            'max_experience': max_experience,
            'locations': locations_list
        }
    )
    
    uploaded_files = []
    for file in files:
        try:
            content = await file.read()
            file_path = storage_service.upload_file(
                content,
                file.filename,
                folder=f"batch_{batch.id}"
            )
            uploaded_files.append({
                'filename': file.filename,
                'path': file_path,
                'size': len(content)
            })
        except Exception as e:
            logger.error(f"Failed to upload {file.filename}: {e}")
            continue
    
    batch.total_resumes = len(uploaded_files)
    db.commit()
    
    crud.create_screening_activity(
        db,
        batch_id=batch.id,
        user=current_user.full_name,
        action="started_screening",
        details={
            "batch_name": batch.name,
            "uploaded_files": len(uploaded_files)
        }
    )
    
    background_tasks.add_task(
        process_uploaded_batch,
        batch.id,
        uploaded_files,
        {
            'skills': skills_list,
            'min_experience': min_experience,
            'max_experience': max_experience,
            'locations': locations_list
        }
    )
    
    return batch

async def process_uploaded_batch(batch_id: int, uploaded_files: list, filters: dict):
    """Process uploaded batch files"""
    logger.info(f"🚀 Starting batch processing for batch_id: {batch_id}")
    
    if not init_database():
        logger.error("Cannot process batch - database connection failed")
        return
    
    db = next(get_db())
    
    try:
        total = len(uploaded_files)
        if total == 0:
            batch = crud.get_batch(db, batch_id)
            if batch:
                batch.status = "error"
                db.commit()
            return
        
        successful = 0
        failed = 0
        
        for idx, file_info in enumerate(uploaded_files):
            if not crud.check_batch_should_continue(db, batch_id):
                return
            
            filename = file_info['filename']
            file_path = file_info['path']
            temp_file_path = None
            
            try:
                logger.info(f"📄 Processing {idx+1}/{total}: {filename}")
                
                file_content = storage_service.download_file(file_path)
                
                with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
                    temp_file.write(file_content)
                    temp_file_path = temp_file.name
                
                ext = os.path.splitext(filename)[1]
                resume_text = parser.extract_text(temp_file_path, ext)
                
                if not resume_text or len(resume_text) < 100:
                    failed += 1
                    continue
                
                resume_text = sanitize_text(resume_text)
                extracted = extractor.extract_all(resume_text, filename)
                
                exp_years = extracted.get('experience_years', 0)
                location = extracted.get('location', 'Not Specified')
                
                if not matcher.matches_filters(extracted, exp_years, location, filters):
                    failed += 1
                    continue
                
                match_score = matcher.calculate_screening_score(
                    extracted.get('skills', []),
                    filters.get('skills', []),
                    exp_years,
                    filters.get('min_experience', 0),
                    resume_text
                )
                
                email_for_hash = extracted.get('email') or ''
                unique_hash = hashlib.md5(
                    f"{extracted['name']}{email_for_hash}".encode()
                ).hexdigest()
                
                existing = db.query(models.Potential).filter(
                    models.Potential.batch_id == batch_id,
                    models.Potential.unique_hash == unique_hash
                ).first()
                
                if existing:
                    failed += 1
                    continue
                
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
                except Exception as db_error:
                    db.rollback()
                    failed += 1
                
            except Exception as e:
                failed += 1
                try:
                    db.rollback()
                except:
                    pass
            
            finally:
                if temp_file_path and os.path.exists(temp_file_path):
                    try:
                        os.unlink(temp_file_path)
                    except:
                        pass
        
        logger.info(f"🎉 Batch complete! ✅ {successful}/{total}")
        
    except Exception as e:
        logger.error(f"💥 Batch processing error: {str(e)}")
        try:
            batch = crud.get_batch(db, batch_id)
            if batch:
                batch.status = "error"
                db.commit()
        except:
            pass
    finally:
        try:
            db.close()
        except:
            pass

@app.get("/api/screening/potentials/{batch_id}")
async def get_potentials(
    batch_id: int,
    page: int = 1,
    per_page: int = 100,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
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
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
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
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Get screening activities"""
    return crud.get_screening_activities(db, batch_id, limit)

@app.get("/api/screening/rejected/{batch_id}")
async def get_rejected_list(
    batch_id: int,
    current_user = Depends(require_permission("view_activity")),
    db: Session = Depends(get_db_with_init)
):
    """Get rejected potentials"""
    return crud.get_rejected_potentials(db, batch_id)

@app.get("/api/screening/batches")
async def get_batches(
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Get all screening batches"""
    return crud.get_active_batches(db)

@app.post("/api/screening/start", response_model=schemas.BatchResponse)
async def start_screening(
    batch_data: schemas.BatchCreate,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
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
            "folder_path": batch.folder_path
        }
    )

    background_tasks.add_task(
        process_batch_resumes,
        batch.id,
        batch.folder_path,
        batch_data.filters.dict()
    )

    return batch

async def process_batch_resumes(batch_id: int, folder_path: str, filters: dict):
    """Process batch resumes from folder"""
    logger.info(f"🚀 Starting batch processing for batch_id: {batch_id}")
    
    if not init_database():
        logger.error("Cannot process batch - database connection failed")
        return
    
    db = next(get_db())
    
    try:
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
            files.extend(glob.glob(pattern))

        files = list(set(files))
        total = len(files)
        logger.info(f"✅ Found {total} files")
        
        if total == 0:
            batch = crud.get_batch(db, batch_id)
            if batch:
                batch.status = "error"
                db.commit()
            return

        successful = 0
        failed = 0

        for idx, file_path in enumerate(files):
            if not crud.check_batch_should_continue(db, batch_id):
                return
            
            filename = os.path.basename(file_path)
            
            try:
                logger.info(f"📄 Processing {idx+1}/{total}: {filename}")
                
                ext = os.path.splitext(file_path)[1]
                resume_text = parser.extract_text(file_path, ext)
                
                if not resume_text or len(resume_text) < 100:
                    failed += 1
                    continue

                resume_text = sanitize_text(resume_text)
                extracted = extractor.extract_all(resume_text, filename)
                
                exp_years = extracted.get('experience_years', 0)
                location = extracted.get('location', 'Not Specified')
                
                if not matcher.matches_filters(extracted, exp_years, location, filters):
                    failed += 1
                    continue
                
                match_score = matcher.calculate_screening_score(
                    extracted.get('skills', []),
                    filters.get('skills', []),
                    exp_years,
                    filters.get('min_experience', 0),
                    resume_text
                )
                
                email_for_hash = extracted.get('email') or ''
                unique_hash = hashlib.md5(
                    f"{extracted['name']}{email_for_hash}".encode()
                ).hexdigest()
                
                existing = db.query(models.Potential).filter(
                    models.Potential.batch_id == batch_id,
                    models.Potential.unique_hash == unique_hash
                ).first()
                
                if existing:
                    failed += 1
                    continue
                
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
                except Exception as db_error:
                    db.rollback()
                    failed += 1
                
            except Exception as e:
                failed += 1
                try:
                    db.rollback()
                except:
                    pass
        
        logger.info(f"🎉 Batch complete! ✅ {successful}/{total}")
        
    except Exception as e:
        logger.error(f"💥 Error: {str(e)}")
        try:
            batch = crud.get_batch(db, batch_id)
            if batch:
                batch.status = "error"
                db.commit()
        except:
            pass
    finally:
        try:
            db.close()
        except:
            pass

@app.put("/api/screening/batches/{batch_id}/pause")
async def pause_batch_endpoint(
    batch_id: int,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Pause a batch"""
    batch = crud.pause_batch(db, batch_id, current_user.full_name)
    
    if not batch:
        raise HTTPException(404, "Batch not found")
    
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
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Resume a paused batch"""
    batch = crud.resume_batch(db, batch_id, current_user.full_name)
    
    if not batch:
        raise HTTPException(404, "Batch not found")
    
    background_tasks.add_task(
        process_batch_resumes,
        batch.id,
        batch.folder_path,
        {
            'skills': batch.filter_skills or [],
            'min_experience': batch.filter_min_experience or 0,
            'max_experience': batch.filter_max_experience,
            'locations': batch.filter_locations or []
        }
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
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Cancel a batch"""
    batch = crud.cancel_batch(db, batch_id, current_user.full_name)
    
    if not batch:
        raise HTTPException(404, "Batch not found")
    
    await manager.broadcast({
        "type": "batch_cancelled",
        "batch_id": batch_id,
        "batch_name": batch.name
    })
    
    return batch

@app.delete("/api/screening/batches/{batch_id}")
async def delete_batch_endpoint(
    batch_id: int,
    current_user = Depends(require_permission("delete_candidate")),
    db: Session = Depends(get_db_with_init)
):
    """Delete a batch"""
    success = crud.delete_batch(db, batch_id, current_user.full_name)
    
    if not success:
        raise HTTPException(404, "Batch not found")
    
    await manager.broadcast({
        "type": "batch_deleted",
        "batch_id": batch_id
    })
    
    return {"message": "Batch deleted successfully", "batch_id": batch_id}

# ============================================
# JOB ROUTES
# ============================================
@app.post("/api/jobs")
async def create_job(
    job: schemas.JobDescriptionCreate,
    current_user = Depends(require_permission("create_job")),
    db: Session = Depends(get_db_with_init)
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
    current_user = Depends(require_permission("view_jobs")),
    db: Session = Depends(get_db_with_init)
):
    """Get all active jobs"""
    return crud.get_jobs(db)

@app.get("/api/jobs/{job_id}")
def get_job(
    job_id: int,
    current_user = Depends(require_permission("view_jobs")),
    db: Session = Depends(get_db_with_init)
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
    current_user = Depends(require_permission("match_candidates")),
    db: Session = Depends(get_db_with_init)
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
    current_user = Depends(require_permission("match_candidates")),
    db: Session = Depends(get_db_with_init)
):
    """Get match results for a candidate"""
    return crud.get_match_results(db, candidate_id)

# ============================================
# COMMENT ROUTES
# ============================================
@app.post("/api/candidates/{candidate_id}/comments")
async def add_comment(
    candidate_id: int,
    comment_request: schemas.CommentCreate,
    current_user = Depends(require_permission("add_comment")),
    db: Session = Depends(get_db_with_init)
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
    current_user = Depends(require_permission("view_comments")),
    db: Session = Depends(get_db_with_init)
):
    """Get comments for a candidate"""
    return crud.get_comments(db, candidate_id)

@app.delete("/api/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user = Depends(require_permission("delete_comment")),
    db: Session = Depends(get_db_with_init)
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
# NOTES ROUTES
# ============================================
@app.post("/api/candidates/{candidate_id}/notes", response_model=schemas.Note)
async def create_note(
    candidate_id: int,
    note_data: schemas.NoteCreate,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Create a private note"""
    candidate = crud.get_candidate(db, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    note = crud.create_note(db, candidate_id, current_user.id, note_data)
    return note

@app.get("/api/candidates/{candidate_id}/notes", response_model=List[schemas.Note])
async def get_candidate_notes(
    candidate_id: int,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Get private notes for a candidate"""
    return crud.get_notes_for_candidate(db, candidate_id, current_user.id)

@app.put("/api/notes/{note_id}", response_model=schemas.Note)
async def update_note(
    note_id: int,
    note_data: schemas.NoteUpdate,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Update a note"""
    note = crud.update_note(db, note_id, current_user.id, note_data)

    if not note:
        raise HTTPException(404, "Note not found")

    return note

@app.delete("/api/notes/{note_id}")
async def delete_note(
    note_id: int,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Delete a note"""
    success = crud.delete_note(db, note_id, current_user.id)

    if not success:
        raise HTTPException(404, "Note not found")

    return {"message": "Note deleted successfully"}

@app.put("/api/notes/{note_id}/pin", response_model=schemas.Note)
async def toggle_note_pin(
    note_id: int,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db_with_init)
):
    """Toggle pin status of a note"""
    note = crud.toggle_note_pin(db, note_id, current_user.id)

    if not note:
        raise HTTPException(404, "Note not found")

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
    """Get recent activity logs"""
    query = db.query(models.ActivityLog).order_by(
        models.ActivityLog.timestamp.desc())

    if candidate_id:
        query = query.filter(models.ActivityLog.candidate_id == candidate_id)

    activities = query.limit(limit).all()
    return activities

logger.info("=" * 70)
logger.info("✅ ALL ENDPOINTS REGISTERED SUCCESSFULLY")
logger.info("=" * 70)



