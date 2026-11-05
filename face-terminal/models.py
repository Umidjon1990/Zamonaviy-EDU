"""Fetch the exact models used by the terminal and verify every load."""
import hashlib
from pathlib import Path
from urllib.request import urlopen

ZOO = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models"
MODELS = {
    "yunet.onnx": (
        f"{ZOO}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        232589, "sha256", "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    ),
    "sface.onnx": (
        f"{ZOO}/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        38696353, "sha256", "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    ),
    "anti-spoof-mn3.onnx": (
        "https://storage.openvinotoolkit.org/repositories/open_model_zoo/public/2022.1/anti-spoof-mn3/anti-spoof-mn3.onnx",
        12270179, "sha384", "6de4534964b723397b3e8c995cadcf43bc007cc2f9930b95ae25f76adccece5d1d4d058d0b15117b9e4a9f758424f92a",
    ),
}
MODEL_DIR = Path(__file__).resolve().parent / "models"


def verified_model(directory, name):
    _, size, algorithm, expected = MODELS[name]
    path = directory / name
    if path.is_file() and path.stat().st_size == size:
        with path.open("rb") as source:
            if hashlib.file_digest(source, algorithm).hexdigest() == expected:
                return str(path)
    raise RuntimeError(f"{name} tekshiruvi o‘tmadi. python models.py buyrug‘ini bajaring.")


def install():
    MODEL_DIR.mkdir(exist_ok=True)
    for name, (url, size, algorithm, expected) in MODELS.items():
        try:
            verified_model(MODEL_DIR, name)
            continue
        except RuntimeError:
            pass
        with urlopen(url, timeout=60) as response:
            data = response.read(size + 1)
        if len(data) != size or hashlib.new(algorithm, data).hexdigest() != expected:
            raise RuntimeError(f"{name} nazorat summasi mos kelmadi.")
        temp = MODEL_DIR / (name + ".download")
        temp.write_bytes(data)
        temp.replace(MODEL_DIR / name)
        print(f"{name} tayyor")


if __name__ == "__main__":
    install()
