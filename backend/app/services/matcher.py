from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import Dict, List, Optional
from difflib import SequenceMatcher
import re
import logging

logger = logging.getLogger(__name__)


class CandidateMatcher:
    """Enhanced candidate-job matcher with fuzzy matching and explainability"""
    
    def __init__(self):
        try:
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Sentence transformer model loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load sentence transformer: {e}")
            self.model = None

    def calculate_skill_match(self, candidate_skills: List[str], required_skills: List[str]) -> Dict:
        """Calculate skill match score with exact matching only"""
        if not required_skills:
            return {
                "score": 70.0 if candidate_skills else 50.0,
                "matching": [],
                "missing": []
            }
        
        if not candidate_skills:
            return {
                "score": 0.0,
                "matching": [],
                "missing": required_skills
            }
        
        candidate_lower = [s.lower() for s in candidate_skills]
        required_lower = [s.lower() for s in required_skills]
        
        matching = [s for s in required_skills if s.lower() in candidate_lower]
        missing = [s for s in required_skills if s.lower() not in candidate_lower]
        
        score = (len(matching) / len(required_skills)) * 100
        
        return {
            "score": round(score, 2),
            "matching": matching,
            "missing": missing
        }

    def calculate_skill_match_fuzzy(self, candidate_skills: List[str], required_skills: List[str]) -> Dict:
        """
        Advanced skill matching with fuzzy matching
        Returns matches, near-matches, and missing skills
        """
        if not required_skills:
            return {
                "score": 70.0 if candidate_skills else 50.0,
                "matching": [],
                "near_matching": [],
                "missing": [],
                "explanation": "No specific skills required"
            }
        
        if not candidate_skills:
            return {
                "score": 0.0,
                "matching": [],
                "near_matching": [],
                "missing": required_skills,
                "explanation": "Candidate has no listed skills"
            }
        
        matches = []
        near_matches = []
        missing = []
        
        for req_skill in required_skills:
            best_match_score = 0
            best_candidate_skill = None
            
            for cand_skill in candidate_skills:
                similarity = SequenceMatcher(
                    None, 
                    req_skill.lower(), 
                    cand_skill.lower()
                ).ratio()
                
                if similarity > best_match_score:
                    best_match_score = similarity
                    best_candidate_skill = cand_skill
            
            if best_match_score >= 0.9:  # Exact/very close match
                matches.append(req_skill)
            elif best_match_score >= 0.7:  # Similar skill
                near_matches.append({
                    "required": req_skill,
                    "candidate": best_candidate_skill,
                    "similarity": round(best_match_score * 100, 1)
                })
            else:
                missing.append(req_skill)
        
        # Calculate score with weights
        total_required = len(required_skills)
        exact_weight = 1.0
        near_weight = 0.7
        
        score = ((len(matches) * exact_weight + len(near_matches) * near_weight) / total_required) * 100
        
        # Build explanation
        explanation = f"{len(matches)} exact match{'es' if len(matches) != 1 else ''}"
        if near_matches:
            explanation += f", {len(near_matches)} similar skill{'s' if len(near_matches) != 1 else ''}"
        if missing:
            explanation += f", missing {len(missing)} skill{'s' if len(missing) != 1 else ''}"
        
        return {
            "score": round(min(100, score), 2),
            "matching": matches,
            "near_matching": near_matches,
            "missing": missing,
            "explanation": explanation
        }

    def calculate_semantic_similarity(self, resume_text: str, job_desc: str) -> float:
        """Calculate semantic similarity using embeddings"""
        if not self.model or not resume_text or not job_desc:
            return 50.0
        
        try:
            resume_snippet = resume_text[:3000]
            job_snippet = job_desc[:3000]
            
            emb1 = self.model.encode([resume_snippet])
            emb2 = self.model.encode([job_snippet])
            
            similarity = float(cosine_similarity(emb1, emb2)[0][0])
            return round(similarity * 100, 2)
        except Exception as e:
            logger.error(f"Semantic similarity error: {e}")
            return 50.0

    def calculate_experience_match(self, candidate_exp: List[Dict], required_years: int, resume_text: str = "") -> Dict:
        """
        Calculate experience match with better accuracy
        """
        if not required_years or required_years == 0:
            estimated_years = len(candidate_exp) * 2
            return {
                "score": 80.0,
                "years": estimated_years,
                "explanation": f"Candidate has ~{estimated_years} years (no minimum required)"
            }
        
        # Try to extract exact years from resume
        estimated_years = len(candidate_exp) * 2
        
        if resume_text:
            pattern = r'(\d+)\+?\s*years?\s+(?:of\s+)?(?:total\s+)?experience'
            match = re.search(pattern, resume_text, re.IGNORECASE)
            if match:
                estimated_years = int(match.group(1))
        
        if estimated_years == 0:
            return {
                "score": 0.0,
                "years": 0,
                "explanation": "No experience information found"
            }
        
        # Calculate score
        if estimated_years >= required_years * 1.5:
            score = 100.0
            explanation = f"Significantly exceeds requirement ({estimated_years} vs {required_years} years)"
        elif estimated_years >= required_years:
            score = 90.0
            explanation = f"Meets requirement ({estimated_years} vs {required_years} years)"
        elif estimated_years >= required_years * 0.75:
            score = 70.0
            explanation = f"Slightly below requirement ({estimated_years} vs {required_years} years)"
        elif estimated_years >= required_years * 0.5:
            score = 50.0
            explanation = f"Half the required experience ({estimated_years} vs {required_years} years)"
        else:
            score = 30.0
            explanation = f"Significantly below requirement ({estimated_years} vs {required_years} years)"
        
        return {
            "score": round(score, 2),
            "years": estimated_years,
            "explanation": explanation
        }

    def calculate_education_match(self, candidate_education: List[Dict], required_level: str = "") -> Dict:
        """
        Match education level with scoring
        """
        if not required_level:
            return {
                "score": 80.0,
                "explanation": "No specific education requirement"
            }
        
        if not candidate_education:
            return {
                "score": 40.0,
                "explanation": "No education information provided"
            }
        
        # Education hierarchy
        hierarchy = {
            "phd": 5,
            "ph.d": 5,
            "ph.d.": 5,
            "doctorate": 5,
            "master": 4,
            "mba": 4,
            "m.tech": 4,
            "m.e.": 4,
            "m.s": 4,
            "bachelor": 3,
            "b.tech": 3,
            "b.e.": 3,
            "b.s": 3,
            "diploma": 2,
            "high school": 1
        }
        
        # Get candidate's highest education level
        candidate_level = 0
        highest_degree = "Unknown"
        for edu in candidate_education:
            degree = edu.get("degree", "").lower()
            for key, value in hierarchy.items():
                if key in degree:
                    if value > candidate_level:
                        candidate_level = value
                        highest_degree = edu.get("degree")
        
        # Get required level
        required_level_num = 0
        req_lower = required_level.lower()
        for key, value in hierarchy.items():
            if key in req_lower:
                required_level_num = value
                break
        
        # Score based on comparison
        if candidate_level >= required_level_num:
            return {
                "score": 100.0,
                "explanation": f"Meets requirement ({highest_degree})"
            }
        elif candidate_level == required_level_num - 1:
            return {
                "score": 70.0,
                "explanation": f"One level below requirement ({highest_degree})"
            }
        else:
            return {
                "score": 40.0,
                "explanation": f"Below requirement ({highest_degree})"
            }

    def calculate_screening_score(
        self, 
        candidate_skills: List[str],
        required_skills: List[str],
        candidate_exp_years: float,
        required_exp_years: int,
        resume_text: str = ""
    ) -> float:
        """
        Calculate match score for screening (Stage 1)
        Simpler scoring focused on skills and experience
        """
        # Skills weight: 70%
        skill_match = self.calculate_skill_match(candidate_skills, required_skills)
        skill_score = skill_match["score"]
        
        # Experience weight: 30%
        if required_exp_years > 0:
            if candidate_exp_years >= required_exp_years:
                exp_score = min(100.0, 80.0 + (candidate_exp_years - required_exp_years) * 4)
            else:
                exp_score = (candidate_exp_years / required_exp_years) * 70.0
        else:
            exp_score = 70.0 if candidate_exp_years > 0 else 50.0
        
        overall_score = (skill_score * 0.7) + (exp_score * 0.3)
        
        # Bonus for having many skills
        if len(candidate_skills) > 10:
            overall_score = min(100.0, overall_score + 5)
        elif len(candidate_skills) > 5:
            overall_score = min(100.0, overall_score + 2)
        
        return round(overall_score, 2)

    def generate_match_report(self, candidate: Dict, job: Dict, resume_text: str) -> Dict:
        """
        Generate detailed match report for Stage 2 (full candidate analysis)
        With explainability and recommendations
        """
        # Calculate individual scores
        skill_match = self.calculate_skill_match_fuzzy(
            candidate.get("skills", []), 
            job.get("required_skills", [])
        )
        
        semantic_score = self.calculate_semantic_similarity(
            resume_text, 
            job.get("description", "")
        )
        
        exp_match = self.calculate_experience_match(
            candidate.get("experience", []), 
            job.get("experience_years", 0),
            resume_text
        )
        
        edu_match = self.calculate_education_match(
            candidate.get("education", []),
            job.get("education_level", "")
        )
        
        # Calculate overall score with weights
        overall = (
            skill_match["score"] * 0.40 +
            semantic_score * 0.25 +
            exp_match["score"] * 0.20 +
            edu_match["score"] * 0.15
        )
        
        # Generate strengths and concerns
        strengths = self._generate_strengths(skill_match, exp_match, edu_match, semantic_score)
        concerns = self._generate_concerns(skill_match, exp_match, edu_match, semantic_score)
        
        # Generate recommended questions
        questions = self._generate_questions(skill_match, exp_match, candidate, job)
        
        # Generate recommendation
        recommendation = self._generate_recommendation(overall)
        
        return {
            "overall_score": round(overall, 2),
            "skill_match_score": skill_match["score"],
            "semantic_score": semantic_score,
            "experience_match_score": exp_match["score"],
            "education_match_score": edu_match["score"],
            "matching_skills": skill_match["matching"],
            "near_matching_skills": skill_match.get("near_matching", []),
            "missing_skills": skill_match["missing"],
            "strengths": strengths,
            "concerns": concerns,
            "recommended_questions": questions,
            "recommendation": recommendation
        }

    def _generate_strengths(self, skill_match, exp_match, edu_match, semantic_score) -> List[str]:
        """Generate list of candidate strengths"""
        strengths = []
        
        if skill_match["score"] >= 70:
            strengths.append(f"Strong skill match ({len(skill_match['matching'])} matching skills)")
        
        if skill_match.get("near_matching"):
            strengths.append(f"Has similar skills in {len(skill_match['near_matching'])} areas")
        
        if semantic_score >= 75:
            strengths.append("Highly relevant experience based on resume content")
        
        if exp_match["score"] >= 80:
            strengths.append(f"Excellent experience ({exp_match['years']} years)")
        
        if edu_match["score"] >= 80:
            strengths.append("Meets or exceeds education requirements")
        
        if not strengths:
            strengths.append("Candidate shows potential with appropriate development")
        
        return strengths

    def _generate_concerns(self, skill_match, exp_match, edu_match, semantic_score) -> List[str]:
        """Generate list of concerns"""
        concerns = []
        
        if skill_match["score"] < 50:
            concerns.append(f"Missing {len(skill_match['missing'])} key skills")
        
        if semantic_score < 50:
            concerns.append("Resume content may not align well with job requirements")
        
        if exp_match["score"] < 60:
            concerns.append("May lack sufficient experience for this role")
        
        if edu_match["score"] < 60:
            concerns.append("Education level below requirement")
        
        if not concerns:
            concerns.append("No major concerns identified")
        
        return concerns

    def _generate_questions(self, skill_match, exp_match, candidate, job) -> List[str]:
        """Generate recommended interview questions"""
        questions = []
        
        # Skill-based questions
        if skill_match["missing"]:
            missing_top = skill_match["missing"][:3]
            questions.append(f"How would you approach learning {', '.join(missing_top)}?")
        
        # Experience-based questions
        if exp_match["years"] < job.get("experience_years", 0):
            questions.append("Can you describe a challenging project where you exceeded expectations despite limited experience?")
        
        # General questions
        questions.extend([
            "Can you describe your experience with the key technologies listed in your resume?",
            "What projects have you worked on that are most similar to this role?",
            "How do you stay updated with industry trends and new technologies?"
        ])
        
        return questions[:5]  # Return max 5 questions

    def _generate_recommendation(self, score: float) -> str:
        """Generate hiring recommendation based on overall score"""
        if score >= 85:
            return "Strongly Recommended - Excellent match for the role"
        elif score >= 70:
            return "Recommended - Good match with minor gaps that can be addressed"
        elif score >= 55:
            return "Consider with Reservations - Notable gaps exist"
        else:
            return "Not Recommended - Significant gaps in requirements"

    def matches_filters(self, extracted: dict, exp_years: float, location: str, filters: dict) -> bool:
        """Check if candidate matches screening filters"""
        # Skills filter
        required_skills = filters.get('skills', [])
        if required_skills:
            candidate_skills = [s.lower() for s in extracted.get('skills', [])]
            has_skills = any(
                req.lower() in candidate_skills
                for req in required_skills
            )
            if not has_skills:
                return False

        # Experience filter
        min_exp = filters.get('min_experience', 0)
        max_exp = filters.get('max_experience')
        if min_exp and exp_years < min_exp:
            return False
        if max_exp and exp_years > max_exp:
            return False

        # Location filter
        required_locations = filters.get('locations', [])
        if required_locations:
            location_match = any(
                loc.lower() in location.lower() or location.lower() in loc.lower()
                for loc in required_locations
            )
            if not location_match:
                return False

        return True
