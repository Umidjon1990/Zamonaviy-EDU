import unittest
from unittest.mock import Mock, patch

import numpy as np

from vision import CaptureError, FaceCamera


class FaceCameraTests(unittest.TestCase):
    def setUp(self):
        self.camera = FaceCamera.__new__(FaceCamera)
        self.camera.camera_index = 0
        self.feature = np.eye(128, dtype=np.float32)[0]
        self.device = Mock()
        self.device.read.return_value = (True, object())
        for target, value in [
            ("vision.cv2.VideoCapture", self.device),
            ("vision.secrets.choice", 1),
            ("vision.time.sleep", None),
        ]:
            patcher = patch(target, return_value=value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_matching_face_must_turn_in_the_requested_direction_and_return(self):
        self.camera.sample = Mock(side_effect=[(self.feature, yaw) for yaw in [0.0, -0.22, 0.22, 0.04, 0.02]])
        prompts = []
        result = self.camera.capture(lambda _, prompt: prompts.append(prompt), self.feature)
        np.testing.assert_array_equal(result, self.feature)
        self.assertIn("chapga", prompts[0])
        self.assertEqual(self.camera.sample.call_count, 5)
        self.device.release.assert_called_once()

    def test_wrong_identity_never_reaches_attendance(self):
        other_face = np.eye(128, dtype=np.float32)[1]
        self.camera.sample = Mock(return_value=(other_face, 0.0))
        with self.assertRaises(CaptureError) as error:
            self.camera.capture(lambda *_: None, self.feature)
        self.assertEqual(error.exception.reason, "face_mismatch")
        self.device.release.assert_called_once()


if __name__ == "__main__":
    unittest.main()
