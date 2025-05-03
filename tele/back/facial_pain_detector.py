import cv2
import mediapipe as mp
import asyncio
import websockets
import json
import numpy as np
import time

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# Define face regions and their corresponding body parts
FACE_REGIONS = {
    "jaw": {
        "landmarks": [61, 91, 84, 314, 402, 178, 87, 14, 317, 405, 321, 375, 291],  # Jaw line landmarks
        "body_region": "jaw",
        "threshold": 0.05,
        "description": "Jaw/TMJ pain"
    },
    "forehead": {
        "landmarks": [10, 338, 297, 332, 284, 251, 389, 356, 454, 323],  # Forehead landmarks
        "body_region": "head",
        "threshold": 0.04,
        "description": "Headache/Migraine"
    },
    "right_eye": {
        "landmarks": [33, 133, 157, 158, 159, 160, 161, 173, 246],  # Right eye landmarks
        "body_region": "right_eye",
        "threshold": 0.06,
        "description": "Right eye pain"
    },
    "left_eye": {
        "landmarks": [362, 263, 386, 387, 388, 466, 390, 373, 374],  # Left eye landmarks
        "body_region": "left_eye",
        "threshold": 0.06,
        "description": "Left eye pain"
    },
    "nose": {
        "landmarks": [1, 2, 3, 4, 5, 6, 168, 197, 195],  # Nose landmarks
        "body_region": "nose",
        "threshold": 0.05,
        "description": "Sinus pain"
    },
    "right_cheek": {
        "landmarks": [50, 101, 36, 206, 207, 187],  # Right cheek landmarks
        "body_region": "right_cheek",
        "threshold": 0.04,
        "description": "Right facial pain"
    },
    "left_cheek": {
        "landmarks": [280, 330, 266, 426, 427, 411],  # Left cheek landmarks
        "body_region": "left_cheek",
        "threshold": 0.04,
        "description": "Left facial pain"
    }
}

# Baseline values for normal expressions
baseline_values = {}
calibration_frames = 30
calibration_counter = 0

# Function to detect mouth opening (jaw pain)
def detect_jaw_pain(landmarks):
    # Measure distance between upper and lower lip
    upper_lip = landmarks[13]  # Upper lip
    lower_lip = landmarks[14]  # Lower lip
    mouth_gap = abs(upper_lip.y - lower_lip.y)
    
    # Compare with baseline if available
    if "jaw" in baseline_values:
        # If mouth is significantly more open than baseline, it might indicate pain
        return mouth_gap > baseline_values["jaw"] * 1.5, mouth_gap / baseline_values["jaw"]
    else:
        # Default threshold if no baseline
        return mouth_gap > 0.05, mouth_gap / 0.05

# Function to detect eye squinting (eye pain)
def detect_eye_pain(landmarks, side="right"):
    if side == "right":
        # Right eye upper and lower points
        upper_eye = landmarks[159]  # Upper eyelid
        lower_eye = landmarks[145]  # Lower eyelid
    else:
        # Left eye upper and lower points
        upper_eye = landmarks[386]  # Upper eyelid
        lower_eye = landmarks[374]  # Lower eyelid
    
    eye_opening = abs(upper_eye.y - lower_eye.y)
    
    # Compare with baseline if available
    region_key = "right_eye" if side == "right" else "left_eye"
    if region_key in baseline_values:
        # If eye is significantly more closed than baseline, it might indicate pain
        return eye_opening < baseline_values[region_key] * 0.7, 1 - (eye_opening / baseline_values[region_key])
    else:
        # Default threshold if no baseline
        return eye_opening < 0.02, 1 - (eye_opening / 0.02)

# Function to detect forehead furrowing (headache)
def detect_forehead_pain(landmarks):
    # Measure distance between eyebrows and hairline
    left_eyebrow = landmarks[107]
    right_eyebrow = landmarks[336]
    forehead = landmarks[10]  # Top of forehead
    
    # Calculate vertical distance
    eyebrow_height = (left_eyebrow.y + right_eyebrow.y) / 2
    forehead_height = forehead.y
    forehead_distance = abs(forehead_height - eyebrow_height)
    
    # Compare with baseline if available
    if "forehead" in baseline_values:
        # If forehead is significantly more furrowed than baseline
        return forehead_distance < baseline_values["forehead"] * 0.8, 1 - (forehead_distance / baseline_values["forehead"])
    else:
        # Default threshold if no baseline
        return forehead_distance < 0.15, 1 - (forehead_distance / 0.15)

# Function to detect facial asymmetry (potential stroke or Bell's palsy)
def detect_facial_asymmetry(landmarks):
    # Compare left and right sides of face
    left_eye = landmarks[386]
    right_eye = landmarks[159]
    left_mouth = landmarks[61]
    right_mouth = landmarks[291]
    
    # Calculate horizontal alignment
    eye_alignment = abs(left_eye.y - right_eye.y)
    mouth_alignment = abs(left_mouth.y - right_mouth.y)
    
    asymmetry = eye_alignment + mouth_alignment
    
    # Compare with baseline if available
    if "asymmetry" in baseline_values:
        return asymmetry > baseline_values["asymmetry"] * 1.5, asymmetry / baseline_values["asymmetry"]
    else:
        # Default threshold if no baseline
        return asymmetry > 0.03, asymmetry / 0.03

# Function to update baseline values during calibration
def update_baseline(landmarks):
    global calibration_counter, baseline_values
    
    # Jaw (mouth opening)
    upper_lip = landmarks[13]
    lower_lip = landmarks[14]
    mouth_gap = abs(upper_lip.y - lower_lip.y)
    
    # Eyes
    right_upper_eye = landmarks[159]
    right_lower_eye = landmarks[145]
    left_upper_eye = landmarks[386]
    left_lower_eye = landmarks[374]
    right_eye_opening = abs(right_upper_eye.y - right_lower_eye.y)
    left_eye_opening = abs(left_upper_eye.y - left_lower_eye.y)
    
    # Forehead
    left_eyebrow = landmarks[107]
    right_eyebrow = landmarks[336]
    forehead = landmarks[10]
    eyebrow_height = (left_eyebrow.y + right_eyebrow.y) / 2
    forehead_height = forehead.y
    forehead_distance = abs(forehead_height - eyebrow_height)
    
    # Asymmetry
    left_eye = landmarks[386]
    right_eye = landmarks[159]
    left_mouth = landmarks[61]
    right_mouth = landmarks[291]
    eye_alignment = abs(left_eye.y - right_eye.y)
    mouth_alignment = abs(left_mouth.y - right_mouth.y)
    asymmetry = eye_alignment + mouth_alignment
    
    # Update running averages
    if calibration_counter == 0:
        baseline_values = {
            "jaw": mouth_gap,
            "right_eye": right_eye_opening,
            "left_eye": left_eye_opening,
            "forehead": forehead_distance,
            "asymmetry": asymmetry
        }
    else:
        for key in baseline_values:
            if key == "jaw":
                baseline_values[key] = (baseline_values[key] * calibration_counter + mouth_gap) / (calibration_counter + 1)
            elif key == "right_eye":
                baseline_values[key] = (baseline_values[key] * calibration_counter + right_eye_opening) / (calibration_counter + 1)
            elif key == "left_eye":
                baseline_values[key] = (baseline_values[key] * calibration_counter + left_eye_opening) / (calibration_counter + 1)
            elif key == "forehead":
                baseline_values[key] = (baseline_values[key] * calibration_counter + forehead_distance) / (calibration_counter + 1)
            elif key == "asymmetry":
                baseline_values[key] = (baseline_values[key] * calibration_counter + asymmetry) / (calibration_counter + 1)
    
    calibration_counter += 1
    print(f"Calibration: {calibration_counter}/{calibration_frames}")

# Function to analyze facial expressions for pain indicators
def analyze_face_for_pain(landmarks):
    if calibration_counter < calibration_frames:
        update_baseline(landmarks)
        return None
    
    pain_indicators = {}
    
    # Check for jaw pain
    jaw_pain, jaw_intensity = detect_jaw_pain(landmarks)
    if jaw_pain:
        pain_indicators["jaw"] = min(jaw_intensity, 1.0)
    
    # Check for eye pain
    right_eye_pain, right_eye_intensity = detect_eye_pain(landmarks, "right")
    if right_eye_pain:
        pain_indicators["right_eye"] = min(right_eye_intensity, 1.0)
    
    left_eye_pain, left_eye_intensity = detect_eye_pain(landmarks, "left")
    if left_eye_pain:
        pain_indicators["left_eye"] = min(left_eye_intensity, 1.0)
    
    # Check for forehead pain (headache)
    forehead_pain, forehead_intensity = detect_forehead_pain(landmarks)
    if forehead_pain:
        pain_indicators["head"] = min(forehead_intensity, 1.0)
    
    # Check for facial asymmetry
    asymmetry, asymmetry_intensity = detect_facial_asymmetry(landmarks)
    if asymmetry:
        # This could indicate stroke or Bell's palsy - high priority alert
        pain_indicators["asymmetry"] = min(asymmetry_intensity, 1.0)
    
    return pain_indicators

# Main function to run the facial pain detection
async def run_facial_pain_detection(room_id):
    # Connect to WebSocket server
    uri = "ws://localhost:3002/facial-pain"
    print(f"Connecting to WebSocket server at {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to WebSocket server")
            
            # Register with room ID
            registration_message = {
                "roomId": room_id
            }
            await websocket.send(json.dumps(registration_message))
            print(f"Registered with room ID: {room_id}")
            
            # Initialize webcam
            cap = cv2.VideoCapture(0)
            
            # Configure camera for better quality
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            cap.set(cv2.CAP_PROP_FPS, 30)
            
            # Initialize Face Mesh
            with mp_face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            ) as face_mesh:
                
                print("Starting facial pain detection...")
                last_sent_time = 0
                
                while cap.isOpened():
                    success, image = cap.read()
                    if not success:
                        print("Failed to capture image from camera")
                        break
                    
                    # Flip the image horizontally for a selfie-view display
                    image = cv2.flip(image, 1)
                    
                    # Convert the BGR image to RGB
                    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    
                    # Process the image and detect face landmarks
                    results = face_mesh.process(image_rgb)
                    
                    # Draw the face mesh annotations on the image
                    image_height, image_width, _ = image.shape
                    
                    if results.multi_face_landmarks:
                        for face_landmarks in results.multi_face_landmarks:
                            # Draw face mesh
                            mp_drawing.draw_landmarks(
                                image=image,
                                landmark_list=face_landmarks,
                                connections=mp_face_mesh.FACEMESH_TESSELATION,
                                landmark_drawing_spec=None,
                                connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_tesselation_style()
                            )
                            
                            # Convert landmarks to list for easier processing
                            landmarks = face_landmarks.landmark
                            
                            # Analyze face for pain indicators
                            pain_indicators = analyze_face_for_pain(landmarks)
                            
                            # If calibration is complete and we have pain indicators
                            if pain_indicators is not None and len(pain_indicators) > 0:
                                current_time = time.time()
                                
                                # Only send updates every 0.5 seconds to avoid flooding
                                if current_time - last_sent_time >= 0.5:
                                    # Prepare data to send
                                    data = {
                                        "type": "facial_pain",
                                        "roomId": room_id,
                                        "regions": []
                                    }
                                    
                                    # Add each pain indicator to the data
                                    for region, intensity in pain_indicators.items():
                                        region_data = {
                                            "region": region,
                                            "intensity": float(intensity)
                                        }
                                        
                                        # Add description if available
                                        for face_region, info in FACE_REGIONS.items():
                                            if info["body_region"] == region:
                                                region_data["description"] = info["description"]
                                                break
                                        
                                        data["regions"].append(region_data)
                                    
                                    # Send data via WebSocket
                                    await websocket.send(json.dumps(data))
                                    last_sent_time = current_time
                                    
                                    # Display detected pain on the image
                                    for region, intensity in pain_indicators.items():
                                        cv2.putText(
                                            image,
                                            f"{region}: {intensity:.2f}",
                                            (10, 30 + list(pain_indicators.keys()).index(region) * 30),
                                            cv2.FONT_HERSHEY_SIMPLEX,
                                            1,
                                            (0, 0, 255),
                                            2
                                        )
                            
                            # Display calibration status
                            if calibration_counter < calibration_frames:
                                cv2.putText(
                                    image,
                                    f"Calibrating: {calibration_counter}/{calibration_frames}",
                                    (10, 30),
                                    cv2.FONT_HERSHEY_SIMPLEX,
                                    1,
                                    (0, 255, 0),
                                    2
                                )
                    
                    # Display the image
                    cv2.imshow('MediaPipe Face Mesh - Pain Detection', image)
                    
                    # Exit on ESC key
                    if cv2.waitKey(5) & 0xFF == 27:
                        break
                
                cap.release()
                cv2.destroyAllWindows()
    
    except ConnectionRefusedError:
        print("Connection to WebSocket server refused. Make sure the server is running.")
    except Exception as e:
        print(f"Error: {e}")

# Run the facial pain detection
if __name__ == "__main__":
    import sys
    
    # Check if room ID is provided as command line argument
    if len(sys.argv) > 1:
        room_id = sys.argv[1]
    else:
        # Default room ID for testing
        room_id = "test-room"
        print(f"No room ID provided, using default: {room_id}")
        print("Usage: python facial_pain_detector.py <room_id>")
    
    asyncio.run(run_facial_pain_detection(room_id))