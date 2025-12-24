import re
import spacy
from typing import Dict, List, Set, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

try:
    nlp = spacy.load("en_core_web_sm")
except:
    nlp = None
    logger.warning("spaCy model not loaded. Name extraction may be limited.")


class InformationExtractor:
    """Enhanced information extractor with better accuracy"""

    def __init__(self):
        self.email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        self.url_pattern = r'(https?://[^\s]+|www\.[^\s]+|linkedin\.com/in/[\w\-]+)'

        # TECHNICAL SKILLS - Comprehensive list
        self.skill_keywords = [
            # Programming Languages
            'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'go', 'rust',
            'php', 'ruby', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'perl',
            'c', 'objective-c', 'dart', 'elixir', 'clojure', 'haskell', 'lua',

            # Frontend
            'react', 'angular', 'vue', 'vue.js', 'svelte', 'next.js', 'nuxt', 'gatsby',
            'jquery', 'redux', 'webpack', 'html', 'html5', 'css', 'css3', 'sass',
            'tailwind', 'bootstrap', 'material-ui', 'mui',

            # Backend
            'node.js', 'nodejs', 'express', 'django', 'flask', 'spring', 'spring boot',
            'asp.net', '.net', 'rails', 'laravel', 'fastapi', 'nestjs',

            # Databases
            'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'oracle',
            'sql server', 'dynamodb', 'cassandra', 'elasticsearch', 'firebase',

            # Cloud & DevOps
            'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform',
            'ansible', 'git', 'github', 'gitlab', 'ci/cd', 'devops',

            # Data Science & AI
            'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras',
            'pandas', 'numpy', 'scikit-learn', 'nlp', 'computer vision', 'opencv',
            'spark', 'hadoop', 'kafka', 'airflow',

            # Tools
            'jira', 'confluence', 'postman', 'figma', 'excel', 'power bi', 'tableau',
            'sap', 'salesforce', 'servicenow',

            # Specific Technical Skills
            'rest api', 'graphql', 'microservices', 'agile', 'scrum', 'testing',
            'junit', 'pytest', 'selenium', 'api', 'json', 'xml'
        ]

        self.skill_keywords_set = set(skill.lower() for skill in self.skill_keywords)

        # SECTION HEADERS TO IGNORE
        self.section_headers = {
            'professional experience', 'work experience', 'experience', 'employment history',
            'education', 'academic background', 'qualifications', 'skills', 'technical skills',
            'core competencies', 'summary', 'objective', 'profile', 'about me',
            'additional information', 'certifications', 'achievements', 'projects',
            'references', 'hobbies', 'interests', 'languages', 'contact',
            'personal information', 'declaration', 'career objective',
            'professional summary', 'key skills', 'areas of expertise',
            'training', 'courses', 'workshops', 'seminars', 'publications'
        }

        # SOFT SKILLS TO IGNORE
        self.soft_skills = {
            'communication', 'leadership', 'teamwork', 'problem solving', 'critical thinking',
            'time management', 'adaptability', 'collaboration', 'creativity',
            'attention to detail', 'work ethic', 'interpersonal skills',
            'analytical skills', 'organizational skills', 'presentation skills',
            'ability to work in a team', 'ability to work under pressure',
            'multitasking', 'flexibility', 'initiative', 'motivation',
            'team player', 'self-motivated', 'detail-oriented', 'results-driven',
            'customer service', 'client relations', 'stakeholder management',
            'conflict resolution', 'decision making', 'strategic thinking'
        }

        # GENERIC PHRASES TO IGNORE
        self.generic_phrases = {
            'basic computer skills', 'good communication skills', 'team management',
            'project management', 'time management', 'resource management',
            'relationship management', 'performance management', 'change management',
            'risk management', 'quality management', 'business management',
            'recruitment', 'hiring', 'onboarding', 'training', 'coaching',
            'coordinating', 'scheduling', 'planning', 'organizing', 'monitoring',
            'handling', 'managing', 'overseeing', 'conducting', 'assisting',
            'supporting', 'maintaining', 'ensuring', 'implementing', 'developing',
            'experience in', 'knowledge of', 'familiar with', 'proficient in',
            'expert in', 'skilled in', 'strong', 'excellent', 'good', 'basic',
            'advanced', 'intermediate', 'beginner', 'working knowledge'
        }

    def extract_contact_info(self, text: str) -> Dict:
        """Extract email and phone from text"""
        emails = re.findall(self.email_pattern, text)
        indian_mobile_pattern = r'(?:\+91[\s-]?|0)?[6-9]\d{9}'
        phones = re.findall(indian_mobile_pattern, text)

        unique_phones = []
        seen = set()

        for phone in phones:
            digits = re.sub(r'\D', '', phone)
            if digits.startswith("91"):
                normalized = f"+{digits}"
            else:
                normalized = f"+91{digits[-10:]}"

            if normalized not in seen:
                seen.add(normalized)
                unique_phones.append(normalized)

        return {
            "email": emails[0] if emails else None,
            "phone": unique_phones[0] if unique_phones else None
        }

    def extract_name(self, text: str, filename: str = "") -> str:
        """
        Extract candidate name with improved logic
        
        Priority:
        1. Filename if it looks like a name
        2. First few lines pattern matching
        3. NER extraction
        4. Fallback to filename or "Unknown"
        """
        potential_names = []
        
        # Method 1: Try filename first
        if filename:
            name_from_file = filename.replace('.pdf', '').replace('.docx', '').replace('.doc', '').replace('.txt', '')
            name_from_file = re.sub(r'^\d+\s*-\s*', '', name_from_file)
            name_from_file = re.sub(r'^\d+\s+', '', name_from_file)
            
            words = name_from_file.split()
            if 2 <= len(words) <= 4:
                if all(word[0].isupper() for word in words[:2] if word):
                    non_names = ['resume', 'cv', 'curriculum', 'vitae', 'jd', 'gmail', 'com']
                    if not any(nn in name_from_file.lower() for nn in non_names):
                        potential_names.append((name_from_file.strip(), 95))
        
        # Method 2: NER extraction
        if nlp:
            try:
                doc = nlp(text[:1500])
                for ent in doc.ents:
                    if ent.label_ == "PERSON":
                        name = ent.text.strip()
                        if self._is_valid_name(name):
                            potential_names.append((name, 90))
            except Exception as e:
                logger.debug(f"NER extraction failed: {e}")
        
        # Method 3: Pattern matching in first 15 lines
        lines = text.split('\n')
        for i, line in enumerate(lines[:15]):
            line = line.strip()
            
            if len(line) < 3 or len(line) > 60:
                continue
            
            skip_patterns = [
                '@', 'http', 'www', 'resume', 'curriculum', 'cv',
                'phone', 'email', 'contact', 'address', 'objective',
                'summary', 'experience', 'education', 'skills',
                'professional', 'personal', 'references', 'declaration'
            ]
            
            if any(pattern in line.lower() for pattern in skip_patterns):
                continue
            
            words = line.split()
            
            if 2 <= len(words) <= 4:
                capitalized_count = sum(1 for w in words if w and w[0].isupper())
                
                if capitalized_count >= 2:
                    if self._is_valid_name(line):
                        confidence = 85 - (i * 5)
                        potential_names.append((line, confidence))
        
        # Sort by confidence and return best
        if potential_names:
            potential_names.sort(key=lambda x: x[1], reverse=True)
            return potential_names[0][0]
        
        # Fallback
        if filename:
            clean_filename = filename.replace('.pdf', '').replace('.docx', '').replace('.doc', '')
            if len(clean_filename) > 2:
                return clean_filename.strip()
        
        return "Unknown"

    def _is_valid_name(self, text: str) -> bool:
        """Validate if text looks like a name"""
        text = text.strip()
        
        if len(text) < 3 or len(text) > 60:
            return False
        
        if text.isupper() and len(text) > 15:
            return False
        
        if text.islower():
            return False
        
        words = text.split()
        
        if len(words) < 2 or len(words) > 5:
            return False
        
        if any(len(w) > 20 for w in words):
            return False
        
        non_name_words = [
            'mumbai', 'delhi', 'bangalore', 'india', 'experience', 'professional',
            'bachelor', 'master', 'mba', 'skills', 'curriculum', 'resume',
            'vitae', 'objective', 'summary', 'contact', 'email', 'phone',
            'address', 'location', 'education', 'qualification', 'extra',
            'curricular', 'about', 'profile', 'color', 'pharma', 'sciences',
            'company', 'ltd', 'pvt', 'inc', 'corp', 'technologies', 'solutions',
            'generalist', 'recruiter', 'manager', 'engineer', 'developer',
            'analyst', 'consultant', 'specialist', 'executive', 'officer',
            'january', 'february', 'march', 'april', 'may', 'june', 'july',
            'august', 'september', 'october', 'november', 'december',
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
        ]
        
        text_lower = text.lower()
        if any(word in text_lower for word in non_name_words):
            return False
        
        if any(char.isdigit() for char in text[:-3]):
            return False
        
        allowed_special = {'.', ',', "'", '-', ' '}
        if any(char not in allowed_special and not char.isalnum() for char in text):
            return False
        
        if '@' in text or '.' in words[0] or 'www' in text_lower:
            return False
        
        return True

    def extract_links(self, text: str) -> Dict:
        """Extract LinkedIn, GitHub, portfolio links"""
        urls = re.findall(self.url_pattern, text, re.IGNORECASE)
        links = {}

        for url in urls:
            url_lower = url.lower()
            if 'linkedin.com' in url_lower:
                links['linkedin'] = url if url.startswith('http') else 'https://' + url
            elif 'github.com' in url_lower:
                links['github'] = url if url.startswith('http') else 'https://' + url

        return links

    def is_valid_technical_skill(self, text: str) -> bool:
        """Check if text is a valid TECHNICAL skill"""
        text_lower = text.strip().lower()
        
        text_lower = re.sub(r'^(experience in|knowledge of|familiar with|proficient in|skilled in)\s+', '', text_lower)
        text_lower = text_lower.strip()

        if len(text_lower) < 2 or len(text_lower) > 30:
            return False

        if text_lower in self.section_headers:
            return False

        if text_lower in self.soft_skills:
            return False

        if text_lower in self.generic_phrases:
            return False

        non_skill_indicators = [
            'ability', 'experience', 'knowledge', 'skills', 'background',
            'expertise', 'proficiency', 'understanding', 'management',
            'team', 'work', 'working', 'handled', 'responsible', 'duties',
            'role', 'position', 'job', 'career', 'professional', 'summary'
        ]
        
        if text_lower in non_skill_indicators:
            return False

        if text_lower in self.skill_keywords_set:
            return True

        if re.match(r'^[a-z0-9+#.\-/]+$', text_lower):
            if not re.match(r'^\d+$', text_lower):
                return True

        if re.match(r'^[A-Z]{2,5}$', text):
            return True

        for known_skill in self.skill_keywords_set:
            if known_skill in text_lower or text_lower in known_skill:
                if len(text_lower) >= 3:
                    return True

        return False

    def extract_skills_hybrid(self, text: str) -> List[str]:
        """Extract only TECHNICAL skills"""
        all_skills = set()

        text_lower = text.lower()
        for skill in self.skill_keywords:
            pattern = r'\b' + re.escape(skill.lower()) + r'\b'
            if re.search(pattern, text_lower):
                all_skills.add(skill.title())

        skills_patterns = [
            r'(?:technical\s+)?skills?:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)',
            r'(?:core\s+)?competencies:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)',
            r'technologies:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)',
        ]

        for pattern in skills_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                skills_text = match.group(1)
                items = re.split(r'[,;|\n•·]', skills_text)
                for item in items:
                    item = item.strip()
                    item = re.sub(r'^[-–—]\s*', '', item)
                    item = re.sub(r'^\d+\.\s*', '', item)
                    
                    if self.is_valid_technical_skill(item):
                        all_skills.add(item.title())

        words = re.findall(r'\b[A-Z][a-zA-Z0-9+#./-]{1,19}\b', text)
        for word in words:
            if word.lower() in self.skill_keywords_set:
                all_skills.add(word)

        filtered_skills = set()
        for skill in all_skills:
            if self.is_valid_technical_skill(skill):
                filtered_skills.add(skill)

        return sorted(list(filtered_skills))

    def extract_experience(self, text: str) -> List[Dict]:
        """Extract work experience with better accuracy"""
        experience = []
        
        exp_section = re.search(
            r'(?:professional\s+)?(?:work\s+)?experience:?(.*?)(?=education:|skills:|$)',
            text,
            re.IGNORECASE | re.DOTALL
        )
        
        if not exp_section:
            date_pattern = r'(\d{4}|\w{3,9}\s+\d{4})\s*[-–—]\s*(\d{4}|\w{3,9}\s+\d{4}|Present|Current)'
            dates = re.findall(date_pattern, text, re.IGNORECASE)
            
            for _ in dates[:5]:
                experience.append({"duration": "N/A"})
        else:
            exp_text = exp_section.group(1)
            date_pattern = r'(\d{4}|\w{3,9}\s+\d{4})\s*[-–—]\s*(\d{4}|\w{3,9}\s+\d{4}|Present|Current)'
            dates = re.findall(date_pattern, exp_text, re.IGNORECASE)
            
            for date_range in dates[:5]:
                experience.append({
                    "duration": f"{date_range[0]} - {date_range[1]}"
                })

        return experience

    def extract_total_experience_years(self, text: str) -> float:
        """
        Calculate total years of experience accurately
        """
        # Look for explicit mentions
        explicit_patterns = [
            r'(\d+)\+?\s*years?\s+(?:of\s+)?(?:total\s+)?experience',
            r'(?:total\s+)?experience\s*:?\s*(\d+)\+?\s*years?',
            r'(\d+)\+?\s*years?\s+in\s+(?:the\s+)?industry',
        ]
        
        for pattern in explicit_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                years = int(match.group(1))
                logger.info(f"Found explicit experience mention: {years} years")
                return float(years)
        
        # Parse date ranges more accurately
        date_pattern = r'(\w+\s+\d{4}|\d{4})\s*[-–—]\s*(\w+\s+\d{4}|\d{4}|Present|Current)'
        dates = re.findall(date_pattern, text, re.IGNORECASE)
        
        total_months = 0
        for start, end in dates:
            try:
                start_date = self._parse_date(start)
                end_date = self._parse_date(end) if end.lower() not in ['present', 'current'] else datetime.now()
                
                if start_date and end_date:
                    months = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.year)
                    total_months += max(0, months)
            except:
                continue
        
        if total_months > 0:
            return round(total_months / 12, 1)
        
        # Fallback: estimate from number of jobs
        return len(self.extract_experience(text)) * 2.0

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse various date formats"""
        formats = [
            '%B %Y',  # January 2020
            '%b %Y',  # Jan 2020
            '%Y',     # 2020
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except:
                continue
        return None

    def extract_education(self, text: str) -> List[Dict]:
        """Extract education information"""
        education = []

        degree_patterns = [
            (r'MBA', 'MBA'),
            (r'MCA', 'MCA'),
            (r'M\.?Tech\.?', 'M.Tech'),
            (r'M\.?E\.?', 'M.E.'),
            (r'Master\s+of\s+[\w\s]+', None),
            (r'M\.?S\.?\s+in\s+[\w\s]+', None),
            (r'B\.?Tech\.?', 'B.Tech'),
            (r'B\.?E\.?', 'B.E.'),
            (r'Bachelor\s+of\s+[\w\s]+', None),
            (r'B\.?S\.?\s+in\s+[\w\s]+', None),
            (r'B\.?A\.?\s+in\s+[\w\s]+', None),
            (r'Ph\.?D\.?', 'Ph.D.'),
        ]

        seen = set()

        for pattern, default_name in degree_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                degree = match.group(0).strip()
                degree_name = default_name if default_name else degree
                degree_name = re.sub(r'\s+', ' ', degree_name).strip()
                
                if len(degree_name) < 2 or degree_name.lower() in seen:
                    continue

                seen.add(degree_name.lower())
                
                start = max(0, match.start() - 100)
                end = min(len(text), match.end() + 100)
                context = text[start:end]
                
                inst_pattern = r'([A-Z][\w\s]+(?:University|College|Institute|School)[\w\s]*)'
                inst_match = re.search(inst_pattern, context)
                
                education.append({
                    "degree": degree_name,
                    "institution": inst_match.group(1).strip() if inst_match else None
                })

        unique_education = []
        seen_degrees = set()
        for edu in education:
            if edu["degree"].lower() not in seen_degrees:
                unique_education.append(edu)
                seen_degrees.add(edu["degree"].lower())

        return unique_education

    def extract_certifications(self, text: str) -> List[str]:
        """Extract certifications from resume"""
        certifications = []
        
        cert_patterns = [
            r'(AWS Certified[\w\s]+)',
            r'(Microsoft Certified[\w\s]+)',
            r'(Azure[\w\s]+Certified)',
            r'(Google Cloud[\w\s]+Certified)',
            r'(Certified[\w\s]+Professional)',
            r'\b(PMP|CISSP|CEH|CCNA|CCNP|CCIE|CKA|CKAD)\b',
            r'(Certified\s+Scrum\s+Master|CSM)',
            r'(Certified\s+Product\s+Owner|CSPO)',
            r'(Oracle\s+Certified[\w\s]+)',
            r'(Red\s+Hat\s+Certified[\w\s]+)',
        ]
        
        for pattern in cert_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                cert = match.strip() if isinstance(match, str) else match[0].strip()
                if len(cert) > 2 and cert not in certifications:
                    certifications.append(cert)
        
        return certifications

    def extract_location(self, text: str) -> str:
        """Extract location from resume text"""
        cities = [
            "Mumbai", "Delhi", "Bengaluru", "Bangalore", "Hyderabad",
            "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur",
            "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore",
            "Thane", "Bhopal", "Visakhapatnam", "Pimpri", "Patna",
            "Vadodara", "Ghaziabad", "Ludhiana", "Agra", "Nashik",
            "Remote", "Hybrid", "Work from Home", "WFH"
        ]

        text_lower = text.lower()
        
        location_patterns = [
            r'(?:current\s+)?location[:\s]+([A-Za-z\s,]+)',
            r'address[:\s]+([A-Za-z\s,]+)',
            r'based\s+in[:\s]+([A-Za-z\s,]+)',
        ]
        
        for pattern in location_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                loc_text = match.group(1).strip()
                for city in cities:
                    if city.lower() in loc_text.lower():
                        return city
        
        for city in cities:
            if city.lower() in text_lower:
                return city
        
        return "Not Specified"

    def extract_salary_expectations(self, text: str) -> Optional[Dict]:
        """Extract salary expectations if mentioned"""
        
        patterns = [
            r'(?:expected\s+)?(?:salary|compensation|ctc)[\s:]+(?:rs\.?|inr|₹)?\s*([\d,]+)(?:\s*k|\s*lakh|\s*lakhs)?(?:\s*-\s*([\d,]+)(?:\s*k|\s*lakh|\s*lakhs)?)?',
            r'(?:current|last)\s+(?:salary|ctc)[\s:]+(?:rs\.?|inr|₹)?\s*([\d,]+)(?:\s*k|\s*lakh|\s*lakhs)?',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    min_salary = match.group(1).replace(',', '')
                    
                    # Handle lakhs and thousands
                    if 'lakh' in match.group(0).lower():
                        min_salary = float(min_salary) * 100000
                    elif 'k' in match.group(0).lower():
                        min_salary = float(min_salary) * 1000
                    else:
                        min_salary = float(min_salary)
                    
                    max_salary = min_salary
                    if match.group(2):
                        max_salary = match.group(2).replace(',', '')
                        if 'lakh' in match.group(0).lower():
                            max_salary = float(max_salary) * 100000
                        elif 'k' in match.group(0).lower():
                            max_salary = float(max_salary) * 1000
                        else:
                            max_salary = float(max_salary)
                    
                    return {
                        "min": int(min_salary),
                        "max": int(max_salary),
                        "currency": "INR"
                    }
                except:
                    continue
        
        return None

    def extract_all(self, text: str, filename: str = "") -> Dict:
        """Extract all information from resume text"""
        contact = self.extract_contact_info(text)

        return {
            "name": self.extract_name(text, filename),
            "email": contact["email"],
            "phone": contact["phone"],
            "skills": self.extract_skills_hybrid(text),
            "experience": self.extract_experience(text),
            "experience_years": self.extract_total_experience_years(text),
            "education": self.extract_education(text),
            "links": self.extract_links(text),
            "certifications": self.extract_certifications(text),
            "location": self.extract_location(text),
            "salary_expectations": self.extract_salary_expectations(text)
        }
