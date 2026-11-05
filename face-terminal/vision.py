"""Camera frames and face embeddings stay in the terminal process."""
import secrets
import time

import cv2
import numpy as np

from models import MODEL_DIR, verified_model

MATCH_THRESHOLD = 0.50
LIVE_THRESHOLD = 0.90
SAMPLE_COUNT = 3
MEAN = np.array([151.2405, 119.5950, 107.8395], dtype=np.float32)
SCALE = np.array([63.0105, 56.4570, 55.0035], dtype=np.float32)


class CaptureError(Exception):
    def __init__(self, reason, message):
        super().__init__(message)
        self.reason = reason


class FaceCamera:
    def __init__(self, camera_index, model_dir=MODEL_DIR):
        self.camera_index = camera_index
        self.detector = cv2.FaceDetectorYN.create(verified_model(model_dir, "yunet.onnx"), "", (640, 480), 0.90)
        self.recognizer = cv2.FaceRecognizerSF.create(verified_model(model_dir, "sface.onnx"), "")
        self.pad = cv2.dnn.readNetFromONNX(verified_model(model_dir, "anti-spoof-mn3.onnx"))

    def live_probability(self, crop):
        rgb = cv2.cvtColor(cv2.resize(crop, (128, 128)), cv2.COLOR_BGR2RGB)
        batch = ((rgb.astype(np.float32) - MEAN) / SCALE).transpose(2, 0, 1)[None, ...]
        self.pad.setInput(np.ascontiguousarray(batch))
        scores = self.pad.forward().reshape(-1)
        if scores.size != 2 or not np.isfinite(scores).all() or not np.isclose(scores.sum(), 1, atol=0.01):
            raise CaptureError("camera", "Jonli yuz modeli ishga tushmadi.")
        return float(scores[0])

    def sample(self, frame):
        height, width = frame.shape[:2]
        self.detector.setInputSize((width, height))
        _, faces = self.detector.detect(frame)
        if faces is None or len(faces) != 1:
            raise CaptureError("quality", "Kamerada faqat bitta yuz ko‘rinsin.")
        face = faces[0]
        x, y, w, h = map(int, face[:4])
        if min(w, h) < 100 or x < 0 or y < 0 or x + w > width or y + h > height:
            raise CaptureError("quality", "Yuzingizni kamera markaziga yaqinlashtiring.")
        crop = frame[y:y+h, x:x+w]
        if self.live_probability(crop) < LIVE_THRESHOLD:
            raise CaptureError("liveness", "Jonli yuz tasdiqlanmadi. Yorug‘likni tekshiring.")
        aligned = self.recognizer.alignCrop(frame, face)
        feature = self.recognizer.feature(aligned).reshape(-1)
        norm = np.linalg.norm(feature)
        if not np.isfinite(norm) or norm == 0 or feature.size != 128:
            raise CaptureError("quality", "Yuz andozasi olinmadi.")
        eyes = sorted((float(face[4]), float(face[6])))
        if eyes[1] - eyes[0] < 20:
            raise CaptureError("quality", "Kameraga yuzlaning.")
        yaw = (float(face[8]) - sum(eyes) / 2) / (eyes[1] - eyes[0])
        return feature / norm, yaw

    def capture(self, update, expected=None):
        camera = cv2.VideoCapture(self.camera_index)
        last_error = CaptureError("quality", "Yuzni aniq ko‘rsatib, qayta urinib ko‘ring.")
        samples = []
        direction = secrets.choice((-1, 1))
        turned = False
        baseline = None
        prompt = "Kameraga to‘g‘ri qarang."
        try:
            if not camera.isOpened():
                raise CaptureError("camera", "Kamerani ochib bo‘lmadi. Administratorga xabar bering.")
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                ok, frame = camera.read()
                if not ok:
                    raise CaptureError("camera", "Kameradan tasvir olinmadi.")
                try:
                    feature, yaw = self.sample(frame)
                except CaptureError as error:
                    if error.reason == "camera":
                        raise
                    last_error = error
                    samples.clear()
                    baseline = None
                    turned = False
                    prompt = "Kameraga to‘g‘ri qarang."
                    update(frame, str(error))
                    time.sleep(0.15)
                    continue
                if expected is not None and float(expected @ feature) < MATCH_THRESHOLD:
                    raise CaptureError("face_mismatch", "Yuz tanlangan o‘qituvchiga mos kelmadi.")
                if samples and float(samples[0] @ feature) < MATCH_THRESHOLD:
                    raise CaptureError("face_mismatch", "Kamera qarshisidagi yuz o‘zgardi. Qayta urinib ko‘ring.")

                if baseline is None and abs(yaw) <= 0.26:
                    baseline = yaw
                    samples.append(feature)
                    # On the unmirrored frame the subject’s left points to increasing x.
                    side = "chapga" if direction > 0 else "o‘ngga"
                    prompt = f"Boshingizni biroz {side} buring."
                    last_error = CaptureError("liveness", "Bosh harakati tasdiqlanmadi. Qayta urinib ko‘ring.")
                elif baseline is not None and not turned and (yaw - baseline) * direction >= 0.17:
                    turned = True
                    prompt = "Yana kameraga to‘g‘ri qarang."
                elif turned and abs(yaw - baseline) < 0.13:
                    samples.append(feature)
                    if len(samples) == SAMPLE_COUNT:
                        combined = np.mean(samples, axis=0)
                        return combined / np.linalg.norm(combined)
                update(frame, prompt)
                time.sleep(0.13)
            raise last_error
        except cv2.error:
            raise CaptureError("camera", "Kamera yoki yuz modeli ishlamadi.") from None
        finally:
            camera.release()
