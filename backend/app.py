"""
=============================================================================
AI-POWERED HOSPITAL APPOINTMENT SYSTEM
=============================================================================
Single-file FastAPI backend integrating:
  - Firebase Auth & Firestore
  - Twilio (Voice Calls + WhatsApp)
  - Deepgram (Speech-to-Text)
  - Groq (LLM: Intent Detection + JSON Extraction)

Author  : Senior Backend Engineer
Version : 1.0.0
=============================================================================
"""

# ---------------------------------------------------------------------------
# IMPORTS
# ---------------------------------------------------------------------------
import os
import uuid
import json
import logging
import httpx
from datetime import datetime
from typing import Optional

# Load .env file automatically (must come before os.environ reads)
from dotenv import load_dotenv
load_dotenv()

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth, firestore

from fastapi import FastAPI, Request, Header, HTTPException, Depends, Form
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse, Gather

from groq import Groq

# ---------------------------------------------------------------------------
# LOGGING
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("hospital-appointment")

# ---------------------------------------------------------------------------
# ENVIRONMENT VARIABLES  (loaded from .env via python-dotenv)
# ---------------------------------------------------------------------------
# Firebase — path to your service-account JSON file
FIREBASE_CREDENTIALS_PATH = os.environ.get(
    "FIREBASE_CREDENTIALS_PATH",
    "./hospital-management-1cb98-firebase-adminsdk-fbsvc-0c69b6b47d.json",
)

# Twilio
TWILIO_ACCOUNT_SID  = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN   = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER", "")
TWILIO_WHATSAPP_NUM = os.environ.get("TWILIO_WHATSAPP_NUMBER", f"whatsapp:{TWILIO_PHONE_NUMBER}")

# Groq
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# Deepgram
DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")

# Public base URL of this server (for Twilio webhooks)
BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")

# ---------------------------------------------------------------------------
# FIREBASE INITIALISATION
# ---------------------------------------------------------------------------
if not firebase_admin._apps:
    if not os.path.exists(FIREBASE_CREDENTIALS_PATH):
        raise FileNotFoundError(
            f"Firebase credentials file not found: {FIREBASE_CREDENTIALS_PATH}\n"
            "Set FIREBASE_CREDENTIALS_PATH in your .env file."
        )
    _cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
    firebase_admin.initialize_app(_cred)
    logger.info("Firebase initialised from: %s", FIREBASE_CREDENTIALS_PATH)

db = firestore.client()

# ---------------------------------------------------------------------------
# TWILIO CLIENT (lazy — only fails when an endpoint actually calls Twilio)
# ---------------------------------------------------------------------------
_twilio_client: TwilioClient | None = None

def get_twilio() -> TwilioClient:
    global _twilio_client
    if _twilio_client is None:
        if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
            raise HTTPException(status_code=503, detail="Twilio credentials not configured.")
        _twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    return _twilio_client

# Alias used in booking/notification code
twilio_client = None  # replaced by get_twilio() calls below

# ---------------------------------------------------------------------------
# GROQ CLIENT
# ---------------------------------------------------------------------------
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# ---------------------------------------------------------------------------
# IN-MEMORY SESSION STORE  (session_id → uid)
# NOTE: For production at scale, replace with Redis.
# ---------------------------------------------------------------------------
SESSION_STORE: dict[str, str] = {}   # { session_id: uid }

# ---------------------------------------------------------------------------
# FASTAPI APPLICATION
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AI Hospital Appointment System",
    description="Voice + Web appointment booking powered by Groq, Deepgram, Twilio, Firebase.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS  — allow all origins so both localhost (dev) and any deployed frontend work
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten to specific domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===========================================================================
# SECTION 1 – FIREBASE AUTH HELPERS
# ===========================================================================

def verify_firebase_token(id_token: str) -> str:
    """
    Verify a Firebase ID token.
    Returns the user's UID on success.
    Raises HTTPException(401) on failure.
    """
    try:
        decoded = firebase_auth.verify_id_token(id_token)
        uid = decoded["uid"]
        logger.info(f"Token verified for UID: {uid}")
        return uid
    except Exception as exc:
        logger.warning(f"Token verification failed: {exc}")
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token.")


def get_uid_from_auth_header(authorization: str = Header(...)) -> str:
    """
    FastAPI dependency: extracts Bearer token from Authorization header
    and verifies it with Firebase, returning the UID.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must be 'Bearer <token>'.")
    token = authorization.split(" ", 1)[1]
    return verify_firebase_token(token)


# ===========================================================================
# SECTION 2 – USER IDENTIFICATION (WEB + CALL FLOWS)
# ===========================================================================

def get_uid_by_phone(raw_phone: str) -> Optional[str]:
    """
    Normalise caller phone number and look up the corresponding Firestore user.
    Returns UID or None if not found.
    """
    # Normalise: strip spaces/dashes, ensure E.164 format
    phone = "".join(filter(lambda c: c.isdigit() or c == "+", raw_phone))
    if not phone.startswith("+"):
        phone = "+" + phone
    logger.info(f"Looking up user by phone: {phone}")

    try:
        users_ref = db.collection("users")
        docs = users_ref.where("phone", "==", phone).limit(1).stream()
        for doc in docs:
            uid = doc.id
            logger.info(f"Found user UID={uid} for phone={phone}")
            return uid
    except Exception as exc:
        logger.error(f"Firestore phone lookup error: {exc}")

    return None


def get_user_profile(uid: str) -> dict:
    """
    Fetch user profile document from Firestore.
    Raises HTTPException(404) if missing.
    """
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail=f"User profile not found for UID: {uid}")
    return doc.to_dict()


# ===========================================================================
# SECTION 3 – SESSION BRIDGE  (Twilio ↔ Firebase UID)
# ===========================================================================

def create_session(uid: str) -> str:
    """
    Create a new session_id mapped to a Firebase UID.
    Returns the session_id.
    """
    session_id = str(uuid.uuid4())
    SESSION_STORE[session_id] = uid
    logger.info(f"Session created: {session_id} → {uid}")
    return session_id


def resolve_session(session_id: str) -> Optional[str]:
    """
    Look up a session_id and return the UID, or None.
    """
    return SESSION_STORE.get(session_id)


def destroy_session(session_id: str) -> None:
    """Remove session from store after call ends."""
    SESSION_STORE.pop(session_id, None)
    logger.info(f"Session destroyed: {session_id}")


# ===========================================================================
# SECTION 4 – DEEPGRAM SPEECH-TO-TEXT
# ===========================================================================

async def transcribe_audio(recording_url: str) -> str:
    """
    Download audio from Twilio recording URL and transcribe via Deepgram REST API.
    Returns transcribed text.
    """
    deepgram_url = "https://api.deepgram.com/v1/listen"
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "url": recording_url,
        "model": "nova-2",
        "smart_format": True,
        "punctuate": True,
        "language": "en-US",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(deepgram_url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            transcript = (
                data["results"]["channels"][0]["alternatives"][0]["transcript"]
            )
            logger.info(f"Deepgram transcript: {transcript}")
            return transcript
    except Exception as exc:
        logger.error(f"Deepgram transcription error: {exc}")
        return ""


# ===========================================================================
# SECTION 5 – GROQ LLM (INTENT DETECTION + JSON EXTRACTION ONLY)
# ===========================================================================

# Voice used for all TTS — Polly.Aditi is Indian English, warm and natural
VOICE = "Polly.Aditi"

# Speech hints help Twilio's STT engine recognize medical + Indian language terms
MEDICAL_HINTS = (
    "appointment, doctor, hospital, cardiology, dermatology, orthopedics, general, "
    "tomorrow, today, morning, afternoon, evening, cancel, confirm, book, "
    "kal, aaj, subah, dopahar, shaam, milna, chahiye, appointment chahiye, "
    "doctor se milna, date, time, specialist, physician, Monday, Tuesday, "
    "Wednesday, Thursday, Friday, Saturday, Sunday"
)

GROQ_SYSTEM_PROMPT = """
You are a multilingual medical appointment intent extractor for an Indian hospital.
Patients may speak in English, Hindi, Marathi, Kannada, Tamil, Telugu, Gujarati,
or any mix (Hinglish). Your ONLY job is to extract intent and return a JSON object.

JSON schema (return ONLY this — no markdown, no code fences, no explanation):
{
  "intent": "<book_appointment | cancel_appointment | check_slots | unknown>",
  "specialization": "<cardiology | dermatology | orthopedics | general | null>",
  "date": "<YYYY-MM-DD or null>",
  "time": "<HH:MM 24h or null>",
  "doctor_name": "<string or null>"
}

Multilingual translation hints:
- 'appointment chahiye / book karo / doctor se milna / apointment / doctor ko dikhana' → book_appointment
- 'appointment cancel / band karo / cancel karna' → cancel_appointment
- 'time kya hai / slots / available / kab milenge' → check_slots
- 'kal' = tomorrow, 'aaj' = today, 'parso' = day after tomorrow
- 'subah' = ~09:00, 'dopahar' = ~14:00, 'shaam' = ~17:00, 'raat' = ~19:00
- 'heart / dil' → cardiology, 'skin / chamdi' → dermatology
- 'haddi / bone / joint / ghutna' → orthopedics

CRITICAL RULES:
- Be VERY lenient. If the patient mentions anything related to a doctor, hospital,
  appointment, illness, or checkup → set intent to book_appointment.
- NEVER return 'unknown' if a doctor or hospital was mentioned in any language.
- Missing fields should be null, not an error.
- Return ONLY valid JSON. No other text.
"""


def extract_intent_from_text(text: str) -> dict:
    """
    Send patient transcript to Groq.
    Returns structured intent dict.
    LLM never writes to DB – only returns parsed intent.
    """
    if not text.strip():
        return {"intent": "unknown", "specialization": None, "date": None, "time": None, "doctor_name": None}

    if not groq_client:
        logger.error("Groq not configured — set GROQ_API_KEY in .env")
        return {"intent": "unknown", "specialization": None, "date": None, "time": None, "doctor_name": None}

    try:
        completion = groq_client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": GROQ_SYSTEM_PROMPT},
                {"role": "user",   "content": text},
            ],
            temperature=0.0,
            max_tokens=256,
        )
        raw = completion.choices[0].message.content.strip()
        logger.info(f"Groq raw response: {raw}")
        intent_data = json.loads(raw)
        return intent_data
    except json.JSONDecodeError as exc:
        logger.error(f"Groq returned non-JSON: {exc}")
        return {"intent": "unknown", "specialization": None, "date": None, "time": None, "doctor_name": None}
    except Exception as exc:
        logger.error(f"Groq API error: {exc}")
        return {"intent": "unknown", "specialization": None, "date": None, "time": None, "doctor_name": None}


# ===========================================================================
# SECTION 6 – SLOT & DOCTOR RESOLUTION
# ===========================================================================

def find_available_slot(specialization: Optional[str], date: Optional[str], time: Optional[str]) -> Optional[dict]:
    """
    Query Firestore for an unbooked slot matching the requested criteria.
    Returns slot dict with id, doctor_id, date, time, or None.
    """
    try:
        slots_ref = db.collection("slots")
        query = slots_ref.where("booked", "==", False)

        if specialization:
            query = query.where("specialization", "==", specialization)
        if date:
            query = query.where("date", "==", date)
        if time:
            query = query.where("time", "==", time)

        docs = list(query.limit(1).stream())
        if not docs:
            logger.info("No available slot found matching criteria.")
            return None

        slot = docs[0].to_dict()
        slot["id"] = docs[0].id
        logger.info(f"Available slot found: {slot['id']}")
        return slot
    except Exception as exc:
        logger.error(f"Slot query error: {exc}")
        return None


# ===========================================================================
# SECTION 7 – CORE BOOKING FUNCTION (Firestore Transaction)
# ===========================================================================

def book_appointment(user_id: str, doctor_id: str, slot_id: str) -> dict:
    """
    Atomically book an appointment using a Firestore transaction.
    - Verifies slot exists
    - Verifies slot is not already booked
    - Marks slot as booked
    - Creates appointment document
    Returns appointment data dict.
    Raises HTTPException on failure.
    """
    slot_ref        = db.collection("slots").document(slot_id)
    appointment_ref = db.collection("appointments").document()

    @firestore.transactional
    def _transact(transaction):
        slot_snap = slot_ref.get(transaction=transaction)

        # Guard: slot must exist
        if not slot_snap.exists:
            raise ValueError(f"Slot {slot_id} does not exist.")

        slot_data = slot_snap.to_dict()

        # Guard: slot must be free
        if slot_data.get("booked", False):
            raise ValueError(f"Slot {slot_id} is already booked.")

        now = datetime.utcnow().isoformat()

        # Mark slot as booked
        transaction.update(slot_ref, {
            "booked":    True,
            "bookedBy":  user_id,
            "bookedAt":  now,
        })

        # Create appointment document
        appointment_data = {
            "userId":    user_id,
            "doctorId":  doctor_id,
            "slotId":    slot_id,
            "date":      slot_data.get("date"),
            "time":      slot_data.get("time"),
            "status":    "confirmed",
            "createdAt": now,
        }
        transaction.set(appointment_ref, appointment_data)
        return appointment_data

    try:
        transaction = db.transaction()
        appointment_data = _transact(transaction)
        appointment_data["appointmentId"] = appointment_ref.id
        logger.info(f"Appointment booked: {appointment_ref.id} for user {user_id}")
        return appointment_data
    except ValueError as exc:
        logger.warning(f"Booking rejected: {exc}")
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        logger.error(f"Firestore transaction error: {exc}")
        raise HTTPException(status_code=500, detail="Booking failed due to a database error.")


# ===========================================================================
# SECTION 8 – WHATSAPP NOTIFICATION
# ===========================================================================

def send_whatsapp_notification(uid: str, appointment_data: dict) -> None:
    """
    Fetch patient + doctor names and send a WhatsApp confirmation
    via Twilio WhatsApp sandbox / business number.
    """
    try:
        # Fetch patient name
        patient_doc = db.collection("users").document(uid).get()
        patient_name = patient_doc.to_dict().get("name", "Patient") if patient_doc.exists else "Patient"

        # Fetch doctor name
        doctor_id  = appointment_data.get("doctorId", "")
        doctor_doc = db.collection("doctors").document(doctor_id).get()
        doctor_name = doctor_doc.to_dict().get("name", "Doctor") if doctor_doc.exists else "Doctor"

        date = appointment_data.get("date", "N/A")
        time = appointment_data.get("time", "N/A")
        appt_id = appointment_data.get("appointmentId", "N/A")

        # Get patient's phone number
        patient_phone = patient_doc.to_dict().get("phone", "") if patient_doc.exists else ""
        if not patient_phone:
            logger.warning(f"No phone number for UID {uid}. Skipping WhatsApp.")
            return

        message_body = (
            f"✅ *Appointment Confirmed!*\n\n"
            f"Hello {patient_name},\n"
            f"Your appointment has been booked successfully.\n\n"
            f"📅 Date: {date}\n"
            f"⏰ Time: {time}\n"
            f"👨‍⚕️ Doctor: Dr. {doctor_name}\n"
            f"🔖 Ref ID: {appt_id}\n\n"
            f"Please arrive 10 minutes early. Reply CANCEL to cancel."
        )

        get_twilio().messages.create(
            body=message_body,
            from_=TWILIO_WHATSAPP_NUM,
            to=f"whatsapp:{patient_phone}",
        )
        logger.info(f"WhatsApp notification sent to {patient_phone}")
    except Exception as exc:
        # Non-fatal: log and continue
        logger.error(f"WhatsApp notification failed: {exc}")


# ===========================================================================
# SECTION 9 – TWILIO VOICE HELPERS
# ===========================================================================

def twiml_say(vr: VoiceResponse, text: str) -> None:
    """Append a <Say> using Polly.Aditi (Indian English, natural-sounding)."""
    vr.say(text, voice=VOICE)


def twiml_error_response(message: str) -> str:
    """Return TwiML that speaks an error in both English + Hindi cue, then hangs up."""
    vr = VoiceResponse()
    twiml_say(vr, message)
    vr.hangup()
    return str(vr)


def twiml_gather_response(prompt: str, action_url: str, session_id: str, attempt: int = 1) -> str:
    """
    Return TwiML that speaks a prompt and records the caller's speech.
    - Uses hi-IN language for best Indian multilingual recognition.
    - enhanced=True activates Twilio's improved speech model.
    - hints pre-loads medical + Indian language vocabulary.
    - attempt is passed as a query param to break infinite loops.
    """
    vr = VoiceResponse()
    gather = Gather(
        input="speech",
        action=f"{action_url}?session_id={session_id}&attempt={attempt + 1}",
        method="POST",
        speech_timeout="auto",
        language="hi-IN",          # Best for Indian users — handles Hindi & Hinglish
        enhanced="true",           # Twilio's premium speech model for better accuracy
        hints=MEDICAL_HINTS,       # Pre-load vocabulary for better recognition
    )
    twiml_say(gather, prompt)     # type: ignore[arg-type]
    vr.append(gather)
    twiml_say(vr, "Koi jawab nahi mila. Phir milenge. Goodbye.")
    vr.hangup()
    return str(vr)


# ===========================================================================
# SECTION 10 – REQUEST / RESPONSE MODELS
# ===========================================================================

class StartCallRequest(BaseModel):
    patient_phone: str   # Phone number to call


class WebBookingRequest(BaseModel):
    doctor_id: str
    slot_id:   str


# ===========================================================================
# SECTION 11 – API ENDPOINTS
# ===========================================================================

# ---------------------------------------------------------------------------
# POST /start-call
# ---------------------------------------------------------------------------
@app.post("/start-call", summary="Initiate an outbound AI voice call")
async def start_call(
    body:  StartCallRequest,
    uid:   str = Depends(get_uid_from_auth_header),
):
    """
    1. Firebase token already verified by dependency (uid extracted).
    2. Creates a session_id → uid mapping.
    3. Triggers an outbound Twilio call to the patient.
    4. Passes session_id to the /voice webhook via statusCallbackUrl.
    """
    session_id = create_session(uid)
    voice_url  = f"{BASE_URL}/voice?session_id={session_id}"

    try:
        call = get_twilio().calls.create(
            to=body.patient_phone,
            from_=TWILIO_PHONE_NUMBER,
            url=voice_url,
            method="POST",
        )
        logger.info(f"Outbound call initiated. SID={call.sid}, session={session_id}")
        return {"status": "call_initiated", "call_sid": call.sid, "session_id": session_id}
    except Exception as exc:
        destroy_session(session_id)
        logger.error(f"Twilio call error: {exc}")
        raise HTTPException(status_code=502, detail=f"Failed to initiate call: {exc}")


# ---------------------------------------------------------------------------
# POST /voice  (Twilio Webhook)
# ---------------------------------------------------------------------------
@app.post("/voice", response_class=PlainTextResponse, summary="Twilio voice webhook")
async def voice_webhook(
    request: Request,
    session_id: Optional[str] = None,
    attempt: int = 1,
):
    """
    Twilio webhook handler. Flow:
    1. Resolve session_id → uid  OR  caller phone → uid.
    2. Deepgram STT on recorded speech.
    3. Groq intent extraction.
    4. If booking intent → book_appointment().
    5. WhatsApp notification.
    6. Return TwiML response.
    """
    form_data = await request.form()
    caller_phone  = form_data.get("From", "")
    speech_result = form_data.get("SpeechResult", "")      # From <Gather input="speech">
    recording_url = form_data.get("RecordingUrl", "")      # From <Record> if used

    # --- Identify user --------------------------------------------------
    uid = None

    # Method A: session bridge (preferred, used when call was started via /start-call)
    if session_id:
        uid = resolve_session(session_id)
        if not uid:
            logger.warning(f"Invalid session_id: {session_id}")
            return PlainTextResponse(
                twiml_error_response("Session not found. Please use the website to start a call."),
                media_type="application/xml",
            )

    # Method B: caller phone lookup (inbound calls)
    if not uid and caller_phone:
        uid = get_uid_by_phone(caller_phone)
        if not uid:
            return PlainTextResponse(
                twiml_error_response(
                    "We could not find your account. "
                    "Please register on our website first, then call again."
                ),
                media_type="application/xml",
            )

    if not uid:
        return PlainTextResponse(
            twiml_error_response("Unable to identify you. Please call back or use the website."),
            media_type="application/xml",
        )

    # --- Speech to text -------------------------------------------------
    transcript = speech_result  # Use Gather's SpeechResult when available

    if not transcript and recording_url:
        transcript = await transcribe_audio(recording_url)

    if not transcript:
        # First contact — no speech yet. Greet in bilingual (English + Hindi cues)
        twiml = twiml_gather_response(
            "Namaste! Welcome to our hospital appointment system. "
            "Aap Hindi ya English mein bol sakte hain. "
            "Please tell me: which doctor or specialization, preferred date, and time.",
            action_url=f"{BASE_URL}/voice",
            session_id=session_id or "",
            attempt=1,
        )
        return PlainTextResponse(twiml, media_type="application/xml")

    logger.info(f"Transcript for UID={uid}: {transcript}")

    # --- Intent extraction (Groq) ---------------------------------------
    intent_data = extract_intent_from_text(transcript)
    intent      = intent_data.get("intent", "unknown")
    logger.info(f"Intent detected: {intent_data}")

    # --- Handle intent --------------------------------------------------
    if intent == "book_appointment":
        specialization = intent_data.get("specialization")
        date           = intent_data.get("date")
        time           = intent_data.get("time")

        # Find an available slot
        slot = find_available_slot(specialization, date, time)

        if not slot:
            msg = (
                f"Sorry, no available slots for {specialization or 'the requested specialisation'} "
                f"on {date or 'that date'} at {time or 'that time'}. "
                "Please try a different date or visit our website."
            )
            return PlainTextResponse(
                twiml_error_response(msg),
                media_type="application/xml",
            )

        # Book the appointment (Firestore transaction)
        try:
            appointment = book_appointment(
                user_id=uid,
                doctor_id=slot["doctor_id"],
                slot_id=slot["id"],
            )
        except HTTPException as exc:
            if exc.status_code == 409:
                return PlainTextResponse(
                    twiml_error_response(
                        "That slot was just booked by someone else. Please try again for a different slot."
                    ),
                    media_type="application/xml",
                )
            raise

        # Send WhatsApp confirmation
        send_whatsapp_notification(uid, appointment)

        # Destroy session after successful booking
        if session_id:
            destroy_session(session_id)

        vr = VoiceResponse()
        twiml_say(
            vr,
            f"Perfect! Your appointment has been booked for {appointment['date']} "
            f"at {appointment['time']}. "
            "Aapko WhatsApp par confirmation message milega. "
            "Thank you for calling. Goodbye!",
        )
        vr.hangup()
        return PlainTextResponse(str(vr), media_type="application/xml")

    elif intent == "check_slots":
        twiml = twiml_gather_response(
            "Main aapke liye slots dhundh sakti hoon. "
            "Please tell me the specialization and your preferred date, "
            "or say 'book' followed by the details and I will book it for you.",
            action_url=f"{BASE_URL}/voice",
            session_id=session_id or "",
            attempt=attempt,
        )
        return PlainTextResponse(twiml, media_type="application/xml")

    elif intent == "cancel_appointment":
        vr = VoiceResponse()
        twiml_say(
            vr,
            "Appointment cancellations ke liye please hamare website par jaiye. "
            "We are sorry for the inconvenience. Goodbye!",
        )
        vr.hangup()
        return PlainTextResponse(str(vr), media_type="application/xml")

    else:
        # Unknown intent — track attempts to avoid infinite loop
        logger.info(f"Unknown intent at attempt {attempt}. Transcript: '{transcript}'")

        if attempt >= 3:
            # After 3 failed attempts, end the call gracefully
            vr = VoiceResponse()
            twiml_say(
                vr,
                "Mujhe samajh nahi aaya, but don't worry. "
                "Please visit our website to book your appointment, "
                "ya hamare reception number par call karein. "
                "Thank you. Goodbye!",
            )
            vr.hangup()
            if session_id:
                destroy_session(session_id)
            return PlainTextResponse(str(vr), media_type="application/xml")

        # Still have attempts left — re-prompt with clearer guidance
        twiml = twiml_gather_response(
            "Mujhe thoda aur clearly batayein please. "
            "For example, say: 'Book appointment with cardiologist, tomorrow morning.' "
            "Aap Hindi ya English mein bol sakte hain.",
            action_url=f"{BASE_URL}/voice",
            session_id=session_id or "",
            attempt=attempt,
        )
        return PlainTextResponse(twiml, media_type="application/xml")


# ---------------------------------------------------------------------------
# POST /book-appointment  (Web booking)
# ---------------------------------------------------------------------------
@app.post("/book-appointment", summary="Web-based appointment booking")
async def web_book_appointment(
    body: WebBookingRequest,
    uid:  str = Depends(get_uid_from_auth_header),
):
    """
    Web booking endpoint.
    - Firebase token verified → UID extracted.
    - Calls the same atomic book_appointment() function.
    - Sends WhatsApp notification.
    """
    appointment = book_appointment(
        user_id=uid,
        doctor_id=body.doctor_id,
        slot_id=body.slot_id,
    )
    send_whatsapp_notification(uid, appointment)
    return {
        "status":      "confirmed",
        "appointment": appointment,
    }


# ---------------------------------------------------------------------------
# GET /available-slots
# ---------------------------------------------------------------------------
@app.get("/available-slots", summary="List all unbooked appointment slots")
async def available_slots(
    specialization: Optional[str] = None,
    date:           Optional[str] = None,
    uid:            str = Depends(get_uid_from_auth_header),
):
    """
    Returns a list of unbooked slots.
    Optionally filter by specialization and/or date.
    Requires Firebase auth.
    """
    try:
        query = db.collection("slots").where("booked", "==", False)
        if specialization:
            query = query.where("specialization", "==", specialization)
        if date:
            query = query.where("date", "==", date)

        docs  = query.stream()
        slots = []
        for doc in docs:
            slot        = doc.to_dict()
            slot["id"]  = doc.id
            # Fetch doctor name for display
            doctor_doc  = db.collection("doctors").document(slot.get("doctor_id", "")).get()
            slot["doctorName"] = doctor_doc.to_dict().get("name", "Unknown") if doctor_doc.exists else "Unknown"
            slots.append(slot)

        return {"slots": slots, "count": len(slots)}
    except Exception as exc:
        logger.error(f"Failed to fetch slots: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve slots.")


# ---------------------------------------------------------------------------
# GET /health  (Liveness probe)
# ---------------------------------------------------------------------------
@app.get("/health", summary="Health check")
async def health():
    return {"status": "ok", "service": "hospital-appointment-api"}


# ===========================================================================
# SECTION 12 – GLOBAL EXCEPTION HANDLER
# ===========================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTPException {exc.status_code}: {exc.detail} | path={request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "An internal server error occurred."},
    )


# ===========================================================================
# SECTION 13 – ENTRY POINT
# ===========================================================================
# Run with:  uvicorn app:app --host 0.0.0.0 --port 8000 --reload
# ===========================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
